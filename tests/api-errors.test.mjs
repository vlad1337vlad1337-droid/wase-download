import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {deadline,fail} from '../backend/request-guard.mjs';

// Local Docker double: "fail" uploads exit without output, "ok" converts.
async function broker(env={}){
 const dir=await mkdtemp(join(tmpdir(),'wase-errors-')),bin=join(dir,'bin');await mkdir(bin);
 await writeFile(join(bin,'docker'),`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),a=process.argv.slice(2);
if(a.includes('catalog'))console.log(JSON.stringify({matrix:{png:{svg:['vtracer']}},categories:{png:'image',svg:'vector'}}));
else if(a.includes('hold')){const source=a.find(v=>v.endsWith(':/job/input.png:ro')).slice(0,-':/job/input.png:ro'.length);if(fs.readFileSync(source,'utf8')!=='fail')console.log('\\nWASE_OUTPUT_READY');}
else if(a[0]==='cp')fs.writeFileSync(path.join(a.at(-1),'output.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
else if((a[0]==='rm'||a[0]==='volume'&&a[1]==='rm')&&process.env.FAKE_BROKEN){console.error('Error response from daemon: permission denied');process.exitCode=1;}
`,{mode:0o755});
 const child=spawn(process.execPath,['backend/server.mjs'],{cwd:resolve('.'),env:{...process.env,PATH:bin+':'+process.env.PATH,API_PORT:'0',JOB_ROOT:join(dir,'jobs'),...env},stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{let text='';child.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/Converter API ready: 127\.0\.0\.1:(\d+)/);if(match)resolve(Number(match[1]));});child.once('exit',code=>reject(new Error('Broker exited '+code)));});
 const call=async(query,body,headers={})=>{const response=await fetch(`http://127.0.0.1:${port}/api/convert?${query}`,{method:'POST',body,headers,signal:AbortSignal.timeout(5000)});const text=await response.text();return {status:response.status,type:response.headers.get('content-type'),retry:response.headers.get('retry-after'),body:response.ok?text:JSON.parse(text)};};
 return {call,async close(){if(child.exitCode===null){const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;}await rm(dir,{recursive:true,force:true});}};
}

test('conversion errors are JSON with a stable code the interface can translate',{timeout:20000},async()=>{
 const api=await broker({MAX_FILE_MB:'1'});
 try{
  const ip=n=>({'X-Real-IP':'192.0.2.'+n});
  let r=await api.call('from=png&to=wma','x',ip(1));assert.equal(r.status,400);assert.equal(r.type,'application/json');assert.equal(r.body.code,'unsupported_pair');assert.ok(r.body.message);
  r=await api.call('from=png&to=svg','',ip(2));assert.equal(r.status,422);assert.equal(r.body.code,'empty');
  r=await api.call('from=png&to=svg',new Uint8Array(1024*1024+1),ip(3));assert.equal(r.status,413);assert.equal(r.body.code,'too_large');
  r=await api.call('from=png&to=svg','fail',ip(4));assert.equal(r.status,422);assert.equal(r.body.code,'engine_failed');
  r=await api.call('from=png&to=svg','ok',ip(5));assert.equal(r.status,200);assert.match(r.body,/<svg/);
  r=await api.call('from=png&to=svg','ok',{...ip(6),Origin:'https://evil.example'});assert.equal(r.status,403);assert.equal(r.body.code,'forbidden');
  let last;for(let i=0;i<21;i++)last=await api.call('from=png&to=svg','',ip(7));
  assert.equal(last.status,429);assert.equal(last.body.code,'rate_limited');assert.equal(last.retry,'60');
 }finally{await api.close();}
});

test('a paused converter answers 503 paused with Retry-After',{timeout:20000},async()=>{
 const api=await broker({FAKE_BROKEN:'1',DOCKER_CLEANUP_TIMEOUT_MS:'1000'});
 try{
  let r=await api.call('from=png&to=svg','ok',{'X-Real-IP':'192.0.2.1'});assert.equal(r.status,503);assert.equal(r.body.code,'paused');
  r=await api.call('from=png&to=svg','ok',{'X-Real-IP':'192.0.2.2'});assert.equal(r.status,503);assert.equal(r.body.code,'paused');assert.equal(r.retry,'60');
 }finally{await api.close();}
});

test('a deadline answers 504 timeout when nothing was sent yet',async()=>{
 const server=http.createServer((req,res)=>{const controller=new AbortController();deadline(req,res,controller,30,()=>fail(req,res,504,'timeout','Conversion took too long'));});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/`,{signal:AbortSignal.timeout(3000)});assert.equal(response.status,504);assert.deepEqual(await response.json(),{code:'timeout',message:'Conversion took too long'});}
 finally{server.closeAllConnections();server.close();}
});

test('an error after file headers were prepared does not advertise the file length',async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Length',100000);res.setHeader('Content-Disposition','attachment; filename="x"');fail(req,res,422,'engine_failed','Could not convert');});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/`,{signal:AbortSignal.timeout(3000)});assert.equal(response.headers.get('content-disposition'),null);assert.deepEqual(await response.json(),{code:'engine_failed',message:'Could not convert'});}
 finally{server.closeAllConnections();server.close();}
});
