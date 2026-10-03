import {publicRegistry} from './conversion-policy.mjs';
import {brandedFile,zipFiles} from './output-stream.mjs';
import {rateLimit,clientIP,reject,occupancy,deadline,matchesETag} from './request-guard.mjs';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {engineOrder,attemptTimeout} from './engine-order.mjs';
import {discoveryHandler} from './discovery.mjs';
import {githubStats} from './github-stats.mjs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp,mkdir,chmod,open,rm,readdir,lstat } from 'node:fs/promises';
import { join,resolve } from 'node:path';
const maxFileMB=Number(process.env.MAX_FILE_MB||100),maxOutputMB=200,jobTimeout=180000,maxConcurrent=Number(process.env.MAX_CONCURRENT||1);
const allowedOrigins=new Set((process.env.PUBLIC_ORIGINS||'http://127.0.0.1:5188,http://localhost:5188,https://wase.download').split(','));
const image=process.env.CONVERTX_IMAGE||'wase-converter:20261002';
const docker=process.env.DOCKER_CONTEXT?['--context',process.env.DOCKER_CONTEXT]:[];
const script=resolve('backend/engine.mjs');const jobRoot=resolve(process.env.JOB_ROOT||'backend/.jobs');await mkdir(jobRoot,{recursive:true});
function run(args,signal){return new Promise((yes,no)=>{const p=spawn('docker',[...docker,...args],{signal});let out='',err='';p.stdout.on('data',b=>{out+=b;if(out.length>8e6)p.kill();});p.stderr.on('data',b=>{err=(err+b).slice(-4000);});p.on('error',no);p.on('exit',c=>c===0?yes(out):no(new Error(process.env.CONVERTER_DEBUG==='1'?err.slice(-1200):'Conversion failed')));});}
// Keep tmpfs mounted until the broker has copied the validated result.
function readyContainer(args,signal){return new Promise((yes,no)=>{
 const child=spawn('docker',[...docker,...args],{signal});let log='',err='',settled=false;
 const finish=(error)=>{if(settled)return;settled=true;error?no(error):yes();};
 child.stdout.on('data',chunk=>{log+=chunk;if(log.includes('\nWASE_OUTPUT_READY\n'))finish();if(log.length>8e6){child.kill();finish(new Error('Too much converter output'));}});
 child.stderr.on('data',chunk=>{err=(err+chunk).slice(-4000);});child.on('error',finish);child.on('exit',()=>finish(new Error(process.env.CONVERTER_DEBUG==='1'?err:'Converter exited without output')));
 });}
const base=['run','--rm','--init','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','-e','HOME=/home/convertx','-e','XDG_CONFIG_HOME=/tmp/config','-e','XDG_CACHE_HOME=/tmp/cache','--cpus',process.env.CONVERT_CPU||'0.25','--cpu-shares','128',...(process.env.CONVERT_CGROUP?['--cgroup-parent',process.env.CONVERT_CGROUP]:[]),'--memory','768m','--pids-limit','128','-v',`${resolve('backend/extra.py')}:/extra.py:ro`,'--tmpfs','/tmp:rw,size=128m','--tmpfs','/home/convertx:rw,size=64m,mode=1777','-v',`${resolve('backend/output-validation.py')}:/output-validation.py:ro`,'-v',`${script}:/engine.mjs:ro`,'--entrypoint','bun'];
const registry=publicRegistry(JSON.parse(await run([...base,image,'/engine.mjs','catalog'])));const catalog=registry.matrix||registry;
const groups=[],inputGroups={},groupIds=new Map();for(const [input,targets]of Object.entries(catalog)){const values=Object.keys(targets).sort(),key=JSON.stringify(values);if(!groupIds.has(key)){groupIds.set(key,groups.length);groups.push(values);}inputGroups[input]=groupIds.get(key);}const publicCatalog=JSON.stringify({groups,inputs:inputGroups,categories:registry.categories||{},limits:{fileMB:maxFileMB,batch:20}});
const handleDiscovery=discoveryHandler(registry,allowedOrigins,maxFileMB);
let active=0;const waiting=[];
function acquire(signal){if(signal.aborted)return Promise.reject(new Error('Cancelled'));if(active<maxConcurrent){active++;return Promise.resolve();}return new Promise((resolve,reject)=>{const ticket={run(){signal.removeEventListener('abort',cancel);active++;resolve();}};function cancel(){const index=waiting.indexOf(ticket);if(index!==-1)waiting.splice(index,1);reject(new Error('Cancelled'));}waiting.push(ticket);signal.addEventListener('abort',cancel,{once:true});});}
function releaseSlot(){active--;waiting.shift()?.run();}
const jobs=new Map();const visits=rateLimit({limit:20,globalLimit:120});const metadataVisits=rateLimit({limit:120,globalLimit:1200});const queueClients=occupancy({perClient:2,total:maxConcurrent+8});
const catalogETag='"'+createHash('sha256').update(publicCatalog).digest('hex')+'"';
const readGithubStats=githubStats();
async function handle(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const url=new URL(req.url,'http://localhost');
if(url.pathname==='/api/mcp'){await handleDiscovery(req,res);return;}
if(req.method==='GET'&&url.pathname==='/api/github'){if(!metadataVisits.allow(clientIP(req))){reject(req,res,429);return;}res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','public, max-age=120');res.end(JSON.stringify(await readGithubStats()));return;}
if(req.method==='GET'&&url.pathname==='/api/formats'){if(!metadataVisits.allow(clientIP(req))){reject(req,res,429);return;}res.setHeader('Cache-Control','private, max-age=60');res.setHeader('ETag',catalogETag);res.setHeader('Content-Type','application/json');if(matchesETag(req.headers['if-none-match'],catalogETag)){res.writeHead(304).end();return;}res.end(publicCatalog);return;}
if(req.method!=='POST'||url.pathname!=='/api/convert'){reject(req,res,404);return;}
const origin=req.headers.origin;if(origin&&!allowedOrigins.has(origin)){reject(req,res,403);return;}
const source=url.searchParams.get('from')?.toLowerCase(),target=url.searchParams.get('to')?.toLowerCase();const choices=catalog[source]?.[target];
if(!Array.isArray(choices)){reject(req,res,400,'Unsupported format pair');return;}
const key=clientIP(req);if(!visits.allow(key)||waiting.length>=8){reject(req,res,429,'Try again shortly');return;}
if(Number(req.headers['content-length'])>maxFileMB*1024*1024){reject(req,res,413);return;}
const leaveQueue=queueClients.enter(key);if(!leaveQueue){reject(req,res,429,'Try again shortly');return;}
let acquired=false,dir,name,resultDir;const abort=new AbortController();const clearDeadline=deadline(req,res,abort,jobTimeout),clearUpload=deadline(req,res,abort,90000);res.on('close',()=>{if(!res.writableEnded)abort.abort();});let cleaned=false;async function cleanup(){if(cleaned)return;cleaned=true;clearDeadline();clearUpload();try{if(name){await run(['rm','-f',name]).catch(()=>{});await run(['volume','rm',name]).catch(()=>{});}if(dir)await rm(dir,{recursive:true,force:true});}finally{if(name)jobs.delete(name);if(acquired)releaseSlot();leaveQueue();}}
try{dir=await mkdtemp(join(jobRoot,'wase-job-'));await chmod(dir,0o777);const inputPath=join(dir,`input.${source}`);const file=await open(inputPath,'w',0o644);let length=0;try{for await(const chunk of req){length+=chunk.length;if(length>maxFileMB*1024*1024){reject(req,res,413);throw new Error('File too large');}let offset=0;while(offset<chunk.length){abort.signal.throwIfAborted();const {bytesWritten}=await file.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}}}finally{await file.close();}clearUpload();if(!length)throw new Error('Empty file');await chmod(inputPath,0o644);await acquire(abort.signal);acquired=true;name='wase-'+dir.split('/').pop();jobs.set(name,dir);let converted=false,attemptIndex=0;const containerBase=name;
for(const engine of engineOrder(choices,source,target)){
 jobs.delete(name);name=containerBase+'-'+(++attemptIndex);jobs.set(name,dir);
 if(abort.signal.aborted)throw new Error('Cancelled');
 // Each attempt gets a clean output directory and a fresh isolated container.
 resultDir=join(dir,'attempt-'+attemptIndex);await mkdir(resultDir,{mode:0o777});await chmod(resultDir,0o777);
 const attempt=new AbortController(),attemptTimer=setTimeout(()=>attempt.abort(),attemptTimeout(source,target));
 try{await run(['volume','create','--driver','local','--label','wase.download.job=true','--opt','type=tmpfs','--opt','device=tmpfs','--opt','o=size=256m,nr_inodes=10000,mode=1777',name],abort.signal);await readyContainer([...base.slice(0,-2).filter(value=>value!=='--rm'),'--name',name,'-v',name+':/job:rw','-v',`${inputPath}:/job/input.${source}:ro`,'--entrypoint','timeout',image,'180','bun','/engine.mjs',source,target,engine,'hold'],AbortSignal.any([abort.signal,attempt.signal]));clearTimeout(attemptTimer);await run(['cp',name+':/job/.',resultDir],abort.signal);await run(['rm','-f',name]);await run(['volume','rm',name]);converted=true;break;}
 catch(error){if(process.env.CONVERTER_DEBUG==='1')console.error('Attempt failed',engine,error.message);await run(['rm','-f',name]).catch(()=>{});await run(['volume','rm',name]).catch(()=>{});await rm(resultDir,{recursive:true,force:true});if(abort.signal.aborted)throw new Error('Cancelled');}
 finally{clearTimeout(attemptTimer);}
}
if(!converted)throw new Error('No converter succeeded');
const outputFiles=[];let total=0,entries=0;async function collect(folder,prefix='',depth=0){if(depth>16)throw new Error('Output too deep');for(const entry of await readdir(folder)){if(++entries>10000||prefix.length+entry.length>1024)throw new Error('Too many output entries');if(!prefix&&entry===`input.${source}`)continue;const path=join(folder,entry),info=await lstat(path);if(info.isSymbolicLink())throw new Error('Unsafe output');if(info.isDirectory())await collect(path,prefix+entry+'/',depth+1);else if(info.isFile()){total+=info.size;if(total>maxOutputMB*1024*1024||outputFiles.length>=5000)throw new Error('Output too large');outputFiles.push({path,name:prefix+entry});}else throw new Error('Unsafe output');}}await collect(resultDir);if(!outputFiles.length)throw new Error('No output');
let outputPath=outputFiles[0].path,extension=target;if(outputFiles.length>1){outputPath=join(dir,'bundle.zip');await zipFiles(outputFiles,outputPath,abort.signal);extension='zip';}
const output=await brandedFile(outputPath,extension,abort.signal);res.setHeader('Content-Type',extension==='zip'?'application/zip':'application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="converted - wase.download.${extension}"`);res.setHeader('Content-Length',output.length);await pipeline(Readable.from(output.stream),res,{signal:abort.signal});
}catch(error){if(process.env.CONVERTER_DEBUG==='1')console.error('Request failed',error.message);await cleanup();if(!res.destroyed&&!res.headersSent)res.writeHead(422).end('Could not convert this file. Try another output format.');}
finally{await cleanup();}
}
const server=http.createServer({maxHeaderSize:16384,connectionsCheckingInterval:1000},(req,res)=>{handle(req,res).catch(error=>{console.error('API request failed',error.name);if(!res.headersSent)reject(req,res,500);else res.destroy();});});
server.maxConnections=128;server.maxRequestsPerSocket=100;server.keepAliveTimeout=5000;
server.requestTimeout=jobTimeout+15000;server.headersTimeout=15000;server.listen(Number(process.env.API_PORT||5189),'127.0.0.1',()=>console.log('Converter API ready: 127.0.0.1:'+server.address().port));

let stopping=false;async function shutdown(){if(stopping)return;stopping=true;server.close();await Promise.all([...jobs].map(async([name,dir])=>{await run(['rm','-f',name]).catch(()=>{});await run(['volume','rm',name]).catch(()=>{});await rm(dir,{recursive:true,force:true});}));process.exit(0);}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
