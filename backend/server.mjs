import {zipSync} from 'fflate';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp,mkdir,chmod,writeFile,readFile,rm,stat,readdir,lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
const allowedOrigins=new Set((process.env.PUBLIC_ORIGINS||'http://127.0.0.1:5188,http://localhost:5188,https://wase.download').split(','));
const image=process.env.CONVERTX_IMAGE||'ghcr.io/c4illin/convertx@sha256:8590a21a16adb8514a8be55b74ad0112bf58ba772328a53f7b40528fcf8fa013';
const docker=process.env.DOCKER_CONTEXT?['--context',process.env.DOCKER_CONTEXT]:[];
const script=resolve('backend/engine.mjs');const jobRoot=resolve('backend/.jobs');await mkdir(jobRoot,{recursive:true});
function run(args,signal){return new Promise((yes,no)=>{const p=spawn('docker',[...docker,...args],{signal});let out='',err='';p.stdout.on('data',b=>{out+=b;if(out.length>8e6)p.kill();});p.stderr.on('data',b=>{err=(err+b).slice(-4000);});p.on('error',no);p.on('exit',c=>c===0?yes(out):no(new Error('Conversion failed')));});}
const base=['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','-e','HOME=/home/convertx','-e','XDG_CONFIG_HOME=/tmp/config','-e','XDG_CACHE_HOME=/tmp/cache','--cpus','1','--memory','768m','--pids-limit','128','--tmpfs','/tmp:rw,size=128m','--tmpfs','/home/convertx:rw,size=64m,mode=1777','-v',`${script}:/engine.mjs:ro`,'--entrypoint','bun'];
const catalog=JSON.parse(await run([...base,image,'/engine.mjs','catalog']));
const groups=[],inputGroups={},groupIds=new Map();for(const [input,targets]of Object.entries(catalog)){const values=Object.keys(targets).sort(),key=JSON.stringify(values);if(!groupIds.has(key)){groupIds.set(key,groups.length);groups.push(values);}inputGroups[input]=groupIds.get(key);}const publicCatalog=JSON.stringify({groups,inputs:inputGroups});
let active=0;const jobs=new Map();const visits=new Map();
const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const url=new URL(req.url,'http://localhost');
if(req.method==='GET'&&url.pathname==='/api/formats'){res.setHeader('Content-Type','application/json');res.end(publicCatalog);return;}
if(req.method!=='POST'||url.pathname!=='/api/convert'){res.writeHead(404).end();return;}
const origin=req.headers.origin;if(origin&&!allowedOrigins.has(origin)){res.writeHead(403).end();return;}
const source=url.searchParams.get('from')?.toLowerCase(),target=url.searchParams.get('to')?.toLowerCase();const choices=catalog[source]?.[target];
if(!Array.isArray(choices)){res.writeHead(400).end('Unsupported format pair');return;}
const key=String(req.headers['x-real-ip']||req.socket.remoteAddress),now=Date.now();const visit=visits.get(key)||{start:now,count:0};if(now-visit.start>60000){visit.start=now;visit.count=0;}visits.set(key,visit);if(active>=2||++visit.count>20){res.writeHead(429).end('Try again shortly');return;}
if(Number(req.headers['content-length'])>20*1024*1024){res.writeHead(413).end();return;}
active++;let dir,name;const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),60000);res.on('close',()=>{if(!res.writableEnded)abort.abort();});
try{let length=0;const chunks=[];for await(const b of req){length+=b.length;if(length>20*1024*1024)throw new Error('File too large');chunks.push(b);}if(!length)throw new Error('Empty file');dir=await mkdtemp(join(jobRoot,'wase-job-'));await import('node:fs/promises').then(fs=>fs.chmod(dir,0o777));await writeFile(join(dir,`input.${source}`),Buffer.concat(chunks),{mode:0o644});await chmod(join(dir,`input.${source}`),0o644);name='wase-'+dir.split('/').pop();jobs.set(name,dir);const priority=['vtracer','resvg','libheif','libjxl','vips','libreoffice','pandoc','calibre','ffmpeg','imagemagick','graphicsmagick'];const preferred=priority.find(e=>choices.includes(e))||choices[0];
await run([...base,'--name',name,'-v',`${dir}:/job:rw`,image,'/engine.mjs',source,target,preferred],abort.signal);
const outputFiles=[];let total=0;async function collect(folder,prefix=''){for(const entry of await readdir(folder)){if(!prefix&&entry===`input.${source}`)continue;const path=join(folder,entry),info=await lstat(path);if(info.isSymbolicLink())throw new Error('Unsafe output');if(info.isDirectory())await collect(path,prefix+entry+'/');else if(info.isFile()){total+=info.size;if(total>40*1024*1024||outputFiles.length>=5000)throw new Error('Output too large');outputFiles.push({path,name:prefix+entry});}}}await collect(dir);if(!outputFiles.length)throw new Error('No output');let data,extension=target;if(outputFiles.length===1){data=await readFile(outputFiles[0].path);}else{const entries={};for(const f of outputFiles)entries[f.name]=new Uint8Array(await readFile(f.path));data=zipSync(entries,{level:0});extension='zip';}res.setHeader('Content-Type',extension==='zip'?'application/zip':'application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="converted.${extension}"`);res.end(data);
}catch{if(!res.destroyed)res.writeHead(422).end('Could not convert this file. Try another output format.');}
finally{clearTimeout(timer);if(name)await run(['rm','-f',name]).catch(()=>{});if(dir)await rm(dir,{recursive:true,force:true});if(name)jobs.delete(name);active--;}
});
setInterval(()=>{for(const [key,v]of visits)if(Date.now()-v.start>60000)visits.delete(key);},60000).unref();
server.requestTimeout=65000;server.headersTimeout=15000;server.listen(Number(process.env.API_PORT||5189),'127.0.0.1',()=>console.log('Converter API ready: 127.0.0.1:5189'));

let stopping=false;async function shutdown(){if(stopping)return;stopping=true;server.close();await Promise.all([...jobs].map(async([name,dir])=>{await run(['rm','-f',name]).catch(()=>{});await rm(dir,{recursive:true,force:true});}));process.exit(0);}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
