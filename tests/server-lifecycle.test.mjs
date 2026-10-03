import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,mkdir,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';

// A local process test: emulate catalogue discovery without starting Docker or
// a converter, then interrupt an actual incomplete HTTP upload with SIGTERM.
for(const phase of ['incomplete upload','active conversion and queued upload'])test(`graceful shutdown removes ${phase} before exiting`, {timeout:10000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-lifecycle-')),bin=join(dir,'bin'),jobs=join(dir,'jobs');
 await mkdir(bin);
 await writeFile(join(bin,'docker'),`#!/usr/bin/env node\nif(process.argv.includes('catalog'))console.log(JSON.stringify({matrix:{png:{svg:['vtracer']}},categories:{png:'image',svg:'vector'}}));else if(process.argv.includes('hold'))setInterval(()=>{},1000);\n`,{mode:0o755});
 const child=spawn(process.execPath,['backend/server.mjs'],{cwd:resolve('.'),env:{...process.env,PATH:bin+':'+process.env.PATH,API_PORT:'0',JOB_ROOT:jobs},stdio:['ignore','pipe','pipe']});
 const uploads=[];
 try{
  const ready=await new Promise((resolve,reject)=>{
   let text='',error='';
   child.stderr.on('data',chunk=>{error+=chunk;});
   child.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/Converter API ready: 127\.0\.0\.1:(\d+)/);if(match)resolve(Number(match[1]));});
   child.once('error',reject);child.once('exit',code=>reject(new Error(`Broker exited ${code}: ${error}`)));
  });
  function upload(ip,complete){
   const req=http.request({host:'127.0.0.1',port:ready,path:'/api/convert?from=png&to=svg',method:'POST',headers:{'Content-Length':complete?7:100,'X-Real-IP':ip}},res=>res.resume());
   req.on('error',()=>{});uploads.push(req);complete?req.end('partial'):req.write('partial');
  }
  const queued=phase!=='incomplete upload';upload('192.0.2.1',queued);if(queued)upload('192.0.2.2',true);
  const expected=queued?2:1;
  const until=Date.now()+2000;
  while((await readdir(jobs)).length<expected&&Date.now()<until)await new Promise(r=>setTimeout(r,10));
  assert.equal((await readdir(jobs)).length,expected,'each upload has a temporary job directory');
  if(queued){
   // Only the acquired converter slot creates an attempt directory. The
   // second complete upload waits in the broker queue without a container.
   let attempts=0;
   while(!attempts&&Date.now()<until){attempts=(await Promise.all((await readdir(jobs)).map(async name=>(await readdir(join(jobs,name))).filter(entry=>entry.startsWith('attempt-')).length))).reduce((a,b)=>a+b,0);if(!attempts)await new Promise(r=>setTimeout(r,10));}
   assert.equal(attempts,1);
  }
  const stopped=once(child,'exit');child.kill('SIGTERM');
  assert.equal((await stopped)[0],0);
  assert.deepEqual(await readdir(jobs),[],'shutdown must erase uploads as well as active containers');
 }finally{for(const upload of uploads)upload.destroy();if(child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;}await rm(dir,{recursive:true,force:true});}
});
