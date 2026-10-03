import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

for(const mode of ['stall','stall-on-shutdown','permission','not-found'])test(`Docker cleanup ${mode}: bounded files and safe converter admission`, {timeout:15000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-cleanup-')),bin=join(dir,'bin'),jobs=join(dir,'jobs'),started=join(dir,'started');
 await mkdir(bin);
 // The fake remove exits by itself after 8 seconds. No unbounded subprocess,
 // real Docker daemon, container, conversion or production request is used.
 await writeFile(join(bin,'docker'),`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),a=process.argv.slice(2);
if(a.includes('catalog'))console.log(JSON.stringify({matrix:{png:{svg:['vtracer']}},categories:{png:'image',svg:'vector'}}));
else if(a.includes('hold')){fs.appendFileSync(process.env.FAKE_STARTED,'started\\n');const source=a.find(v=>v.endsWith(':/job/input.png:ro')).slice(0,-':/job/input.png:ro'.length);if(fs.readFileSync(source,'utf8')==='wait')setTimeout(()=>{},14000);else console.log('\\nWASE_OUTPUT_READY');}
else if(a[0]==='cp')fs.writeFileSync(path.join(a.at(-1),'output.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
else if(a[0]==='rm'||(a[0]==='volume'&&a[1]==='rm')){
 if(process.env.FAKE_MODE.startsWith('stall'))setTimeout(()=>{},8000);
 else if(process.env.FAKE_MODE==='permission'){console.error('Error response from daemon: permission denied');process.exitCode=1;}
 else{console.error(a[0]==='rm'?'Error response from daemon: No such container: '+a.at(-1):'Error response from daemon: get '+a.at(-1)+': no such volume');process.exitCode=1;}
}
`,{mode:0o755});
 const child=spawn(process.execPath,['backend/server.mjs'],{cwd:resolve('.'),env:{...process.env,PATH:bin+':'+process.env.PATH,API_PORT:'0',JOB_ROOT:jobs,FAKE_STARTED:started,FAKE_MODE:mode},stdio:['ignore','pipe','pipe']});
 const requests=[];let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
 try{
  const port=await new Promise((resolve,reject)=>{let text='';child.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/Converter API ready: 127\.0\.0\.1:(\d+)/);if(match)resolve(Number(match[1]));});child.once('error',reject);child.once('exit',code=>reject(new Error(`Broker exited ${code}`)));});
  const upload=(body,headers={})=>{let req;const done=new Promise((resolve,reject)=>{req=http.request({host:'127.0.0.1',port,path:'/api/convert?from=png&to=svg',method:'POST',headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));res.on('error',reject);});req.on('error',reject);req.setTimeout(9000,()=>req.destroy(new Error('Local cleanup test deadline')));});done.catch(()=>{});requests.push(req);req.flushHeaders();if(body!==null)req.end(body);return {req,done};};
  const active=upload('wait',{'X-Real-IP':'192.0.2.1'});
  let until=Date.now()+2500;
  while(Date.now()<until){try{if(await readFile(started,'utf8'))break;}catch{}await new Promise(r=>setTimeout(r,10));}
  assert.equal(await readFile(started,'utf8'),'started\n');
  const queued=upload('ok',{'X-Real-IP':'192.0.2.2'});
  until=Date.now()+2500;while((await readdir(jobs)).length!==2&&Date.now()<until)await new Promise(r=>setTimeout(r,10));assert.equal((await readdir(jobs)).length,2);
  if(mode==='stall-on-shutdown'){
   const stopStarted=Date.now(),stopped=once(child,'exit');child.kill('SIGTERM');
   assert.equal((await stopped)[0],0);assert.ok(Date.now()-stopStarted<9000,'bounded cleanup fits within the 20-second service stop budget');
   assert.deepEqual(await readdir(jobs),[]);assert.equal(await readFile(started,'utf8'),'started\n');return;
  }
  active.req.destroy();
  const failing=mode!=='not-found';assert.equal(await queued.done,failing?503:200,'already queued requests get a service-unavailable result when cleanup is unconfirmed');
  if(failing){
   const early=upload(null,{'Content-Length':100,'X-Real-IP':'192.0.2.3'});
   assert.equal(await early.done,503,'new conversion rejected before reading its body');
   assert.equal(await readFile(started,'utf8'),'started\n','paused intake must not start another converter');
   assert.equal(errors.split('Converter cleanup could not be confirmed').length-1,1,'one generic operator log');
  }else{
   assert.equal(await upload('ok',{'X-Real-IP':'192.0.2.3'}).done,200,'confirmed missing resources do not pause intake');
   assert.equal(errors,'');
  }
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/formats`,{signal:AbortSignal.timeout(1000)})).status,200,'read-only metadata stays available');
  until=Date.now()+2000;
  while((await readdir(jobs)).length&&Date.now()<until)await new Promise(r=>setTimeout(r,25));
  assert.deepEqual(await readdir(jobs),[],'cancelled request files should be erased even if Docker cleanup stalls');
 }finally{for(const req of requests)req.destroy();if(child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;}await rm(dir,{recursive:true,force:true});}
});
