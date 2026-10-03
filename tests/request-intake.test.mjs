import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,readdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

async function waitFor(check,message){const until=Date.now()+2500;while(Date.now()<until){if(await check())return;await new Promise(r=>setTimeout(r,10));}assert.fail(message);}

test('real HTTP intake bounds uploads and recovers after client disconnects', {timeout:20000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-intake-')),bin=join(dir,'bin'),jobs=join(dir,'jobs'),events=join(dir,'events');
 await mkdir(bin);await writeFile(events,'');
 await writeFile(join(bin,'docker'),`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),a=process.argv.slice(2);
if(a.includes('catalog'))console.log(JSON.stringify({matrix:{png:{svg:['vtracer']}},categories:{png:'image',svg:'vector'}}));
else if(a.includes('hold')){fs.appendFileSync(process.env.FAKE_EVENTS,'started\\n');const source=a.find(v=>v.endsWith(':/job/input.png:ro')).slice(0,-':/job/input.png:ro'.length);if(fs.readFileSync(source,'utf8')==='wait')setInterval(()=>{},1000);else console.log('\\nWASE_OUTPUT_READY');}
else if(a[0]==='cp')fs.writeFileSync(path.join(a.at(-1),'output.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
`,{mode:0o755});
 const child=spawn(process.execPath,['backend/server.mjs'],{cwd:resolve('.'),env:{...process.env,PATH:bin+':'+process.env.PATH,API_PORT:'0',JOB_ROOT:jobs,MAX_FILE_MB:String(1/1024),FAKE_EVENTS:events},stdio:['ignore','pipe','pipe']});
 const pending=[];
 try{
  const port=await new Promise((resolve,reject)=>{let output='',error='';child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Converter API ready: 127\.0\.0\.1:(\d+)/);if(match)resolve(Number(match[1]));});child.stderr.on('data',chunk=>{error+=chunk;});child.once('error',reject);child.once('exit',code=>reject(new Error(`Broker exited ${code}: ${error}`)));});
  const request=({body='ok',headers={},path='/api/convert?from=png&to=svg',end=true}={})=>{
   let result;
   const response=new Promise((resolve,reject)=>{result=http.request({host:'127.0.0.1',port,path,method:'POST',headers},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()}));res.on('error',reject);});result.once('error',reject);result.setTimeout(5000,()=>result.destroy(new Error('Local test request timed out')));});
   response.catch(()=>{});pending.push(result);result.flushHeaders();body&&result.write(body);if(end)result.end();return {req:result,response};
  };
  assert.equal((await request({headers:{'Content-Length':'1025'},body:'',end:false}).response).status,413);
  assert.equal((await request({body:Buffer.alloc(2048)}).response).status,413,'chunked upload stops at the actual byte limit');
  assert.equal((await request({body:''}).response).status,422);
  assert.equal((await request({path:'/api/convert?from=../../etc/passwd&to=svg'}).response).status,400);
  assert.equal((await request({headers:{Origin:'https://attacker.invalid'}}).response).status,403);
  await waitFor(async()=>!(await readdir(jobs)).length,'rejected uploads left temporary files');
  assert.equal(await readFile(events,'utf8'),'','invalid uploads must not start a converter');

  const slowA=request({body:'x',headers:{'Content-Length':'100'},end:false}),slowB=request({body:'x',headers:{'Content-Length':'100'},end:false});
  await waitFor(async()=>(await readdir(jobs)).length===2,'slow uploads were not admitted');
  assert.equal((await request().response).status,429);
  slowA.req.destroy();slowB.req.destroy();
  await waitFor(async()=>!(await readdir(jobs)).length,'disconnected slow uploads left temporary files');

  const active=request({body:'wait',headers:{'X-Real-IP':'192.0.2.1'}});
  await waitFor(async()=>(await readFile(events,'utf8')).includes('started'),'fake active conversion did not start');
  const queued=request({body:'ok',headers:{'X-Real-IP':'192.0.2.2'}});
  await waitFor(async()=>(await readdir(jobs)).length===2,'queued upload did not arrive');
  queued.req.destroy();
  await waitFor(async()=>(await readdir(jobs)).length===1,'disconnected queued upload left its job behind');
  active.req.destroy();
  await waitFor(async()=>!(await readdir(jobs)).length,'disconnected active conversion left its job behind');
  const recovered=await request({headers:{'X-Real-IP':'192.0.2.3'}}).response;
  assert.equal(recovered.status,200);assert.match(recovered.body,/<svg\b/);
  await waitFor(async()=>!(await readdir(jobs)).length,'completed response left temporary files');
 }finally{for(const req of pending)req.destroy();if(child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}await rm(dir,{recursive:true,force:true});}
});
