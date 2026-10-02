import {engineOrder} from './engine-order.mjs';
import {discoveryHandler} from './discovery.mjs';
import {zipSync} from 'fflate';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp,mkdir,chmod,copyFile,open,writeFile,readFile,rm,stat,readdir,lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
const maxFileMB=Number(process.env.MAX_FILE_MB||100),maxOutputMB=200,jobTimeout=180000,maxConcurrent=Number(process.env.MAX_CONCURRENT||1);
const allowedOrigins=new Set((process.env.PUBLIC_ORIGINS||'http://127.0.0.1:5188,http://localhost:5188,https://wase.download').split(','));
const image=process.env.CONVERTX_IMAGE||'wase-converter:20261002';
const docker=process.env.DOCKER_CONTEXT?['--context',process.env.DOCKER_CONTEXT]:[];
const script=resolve('backend/engine.mjs');const jobRoot=resolve('backend/.jobs');await mkdir(jobRoot,{recursive:true});
function run(args,signal){return new Promise((yes,no)=>{const p=spawn('docker',[...docker,...args],{signal});let out='',err='';p.stdout.on('data',b=>{out+=b;if(out.length>8e6)p.kill();});p.stderr.on('data',b=>{err=(err+b).slice(-4000);});p.on('error',no);p.on('exit',c=>c===0?yes(out):no(new Error(process.env.CONVERTER_DEBUG==='1'?err.slice(-1200):'Conversion failed')));});}
const base=['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','-e','HOME=/home/convertx','-e','XDG_CONFIG_HOME=/tmp/config','-e','XDG_CACHE_HOME=/tmp/cache','--cpus',process.env.CONVERT_CPU||'0.25','--cpu-shares','128',...(process.env.CONVERT_CGROUP?['--cgroup-parent',process.env.CONVERT_CGROUP]:[]),'--memory','768m','--pids-limit','128','-v',`${resolve('backend/extra.py')}:/extra.py:ro`,'--tmpfs','/tmp:rw,size=128m','--tmpfs','/home/convertx:rw,size=64m,mode=1777','-v',`${resolve('backend/output-validation.py')}:/output-validation.py:ro`,'-v',`${script}:/engine.mjs:ro`,'--entrypoint','bun'];
const registry=JSON.parse(await run([...base,image,'/engine.mjs','catalog']));const catalog=registry.matrix||registry;
const groups=[],inputGroups={},groupIds=new Map();for(const [input,targets]of Object.entries(catalog)){const values=Object.keys(targets).sort(),key=JSON.stringify(values);if(!groupIds.has(key)){groupIds.set(key,groups.length);groups.push(values);}inputGroups[input]=groupIds.get(key);}const publicCatalog=JSON.stringify({groups,inputs:inputGroups,categories:registry.categories||{},limits:{fileMB:maxFileMB,batch:20}});
const handleDiscovery=discoveryHandler(registry,allowedOrigins,maxFileMB);
let active=0;const waiting=[];
function acquire(signal){if(signal.aborted)return Promise.reject(new Error('Cancelled'));if(active<maxConcurrent){active++;return Promise.resolve();}return new Promise((resolve,reject)=>{const ticket={run(){signal.removeEventListener('abort',cancel);active++;resolve();}};function cancel(){const index=waiting.indexOf(ticket);if(index!==-1)waiting.splice(index,1);reject(new Error('Cancelled'));}waiting.push(ticket);signal.addEventListener('abort',cancel,{once:true});});}
function releaseSlot(){active--;waiting.shift()?.run();}
const jobs=new Map();const visits=new Map();
const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const url=new URL(req.url,'http://localhost');
if(url.pathname==='/api/mcp'){await handleDiscovery(req,res);return;}
if(req.method==='GET'&&url.pathname==='/api/formats'){res.setHeader('Content-Type','application/json');res.end(publicCatalog);return;}
if(req.method!=='POST'||url.pathname!=='/api/convert'){res.writeHead(404).end();return;}
const origin=req.headers.origin;if(origin&&!allowedOrigins.has(origin)){res.writeHead(403).end();return;}
const source=url.searchParams.get('from')?.toLowerCase(),target=url.searchParams.get('to')?.toLowerCase();const choices=catalog[source]?.[target];
if(!Array.isArray(choices)){res.writeHead(400).end('Unsupported format pair');return;}
const key=String(req.headers['x-real-ip']||req.socket.remoteAddress),now=Date.now();const visit=visits.get(key)||{start:now,count:0};if(now-visit.start>60000){visit.start=now;visit.count=0;}visits.set(key,visit);if(waiting.length>=8||++visit.count>20){res.writeHead(429).end('Try again shortly');return;}
if(Number(req.headers['content-length'])>maxFileMB*1024*1024){res.writeHead(413).end();return;}
let acquired=false,dir,name,resultDir;const abort=new AbortController();const timer=setTimeout(()=>{abort.abort();if(!req.complete)req.destroy();},jobTimeout);res.on('close',()=>{if(!res.writableEnded)abort.abort();});let cleaned=false;async function cleanup(){if(cleaned)return;cleaned=true;clearTimeout(timer);try{if(name)await run(['rm','-f',name]).catch(()=>{});if(dir)await rm(dir,{recursive:true,force:true});}finally{if(name)jobs.delete(name);if(acquired)releaseSlot();}}
try{await acquire(abort.signal);acquired=true;dir=await mkdtemp(join(jobRoot,'wase-job-'));await chmod(dir,0o777);const inputPath=join(dir,`input.${source}`);const file=await open(inputPath,'w',0o644);let length=0;try{for await(const chunk of req){length+=chunk.length;if(length>maxFileMB*1024*1024)throw new Error('File too large');await file.write(chunk);}}finally{await file.close();}if(!length)throw new Error('Empty file');await chmod(inputPath,0o644);name='wase-'+dir.split('/').pop();jobs.set(name,dir);let converted=false,attemptIndex=0;const containerBase=name;
for(const engine of engineOrder(choices)){
 jobs.delete(name);name=containerBase+'-'+(++attemptIndex);jobs.set(name,dir);
 if(abort.signal.aborted)throw new Error('Cancelled');
 // Each attempt gets a clean output directory and a fresh isolated container.
 resultDir=join(dir,'attempt-'+attemptIndex);await mkdir(resultDir,{mode:0o777});await chmod(resultDir,0o777);await copyFile(inputPath,join(resultDir,`input.${source}`));await chmod(join(resultDir,`input.${source}`),0o644);
 const attempt=new AbortController(),attemptTimer=setTimeout(()=>attempt.abort(),60000);
 try{await run([...base,'--name',name,'-v',`${resultDir}:/job:rw`,image,'/engine.mjs',source,target,engine],AbortSignal.any([abort.signal,attempt.signal]));converted=true;break;}
 catch(error){if(process.env.CONVERTER_DEBUG==='1')console.error('Attempt failed',engine,error.message);await run(['rm','-f',name]).catch(()=>{});if(abort.signal.aborted)throw new Error('Cancelled');}
 finally{clearTimeout(attemptTimer);}
}
if(!converted)throw new Error('No converter succeeded');
const outputFiles=[];let total=0;async function collect(folder,prefix=''){for(const entry of await readdir(folder)){if(!prefix&&entry===`input.${source}`)continue;const path=join(folder,entry),info=await lstat(path);if(info.isSymbolicLink())throw new Error('Unsafe output');if(info.isDirectory())await collect(path,prefix+entry+'/');else if(info.isFile()){total+=info.size;if(total>maxOutputMB*1024*1024||outputFiles.length>=5000)throw new Error('Output too large');outputFiles.push({path,name:prefix+entry});}}}await collect(resultDir);if(!outputFiles.length)throw new Error('No output');let data,extension=target;if(outputFiles.length===1){data=await readFile(outputFiles[0].path);}else{const entries={};for(const f of outputFiles)entries[f.name]=new Uint8Array(await readFile(f.path));data=zipSync(entries,{level:0});extension='zip';}res.setHeader('Content-Type',extension==='zip'?'application/zip':'application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="converted.${extension}"`);await new Promise(resolve=>{res.once('finish',resolve);res.once('close',resolve);res.end(data);});await cleanup();
}catch(error){if(process.env.CONVERTER_DEBUG==='1')console.error('Request failed',error.message);await cleanup();if(!res.destroyed)res.writeHead(422).end('Could not convert this file. Try another output format.');}
finally{await cleanup();}
});
setInterval(()=>{for(const [key,v]of visits)if(Date.now()-v.start>60000)visits.delete(key);},60000).unref();
server.requestTimeout=jobTimeout+15000;server.headersTimeout=15000;server.listen(Number(process.env.API_PORT||5189),'127.0.0.1',()=>console.log('Converter API ready: 127.0.0.1:5189'));

let stopping=false;async function shutdown(){if(stopping)return;stopping=true;server.close();await Promise.all([...jobs].map(async([name,dir])=>{await run(['rm','-f',name]).catch(()=>{});await rm(dir,{recursive:true,force:true});}));process.exit(0);}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
