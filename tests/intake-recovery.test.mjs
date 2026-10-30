import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {intakeRecovery,jobNames,webhookAlert} from '../backend/intake-recovery.mjs';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,ms=4000){const end=Date.now()+ms;while(Date.now()<end){if(await check())return true;await wait(20);}return false;}

test('only exact broker job names count as converter leftovers',()=>{
 assert.deepEqual(jobNames('wase-wase-job-AbC123-1\n/wase-wase-job-xyz789-12\nwase-wase-job-AbC123-1\npostgres\nwase-wase-job-../x-1\nother-wase-wase-job-a-1\n'),['wase-wase-job-AbC123-1','wase-wase-job-xyz789-12']);
});

test('paused intake removes leftovers and resumes only when Docker confirms a clean state',async()=>{
 const logs=[],alerts=[];let state={containers:['wase-wase-job-a1-1'],volumes:['wase-wase-job-a1-1'],directories:['wase-job-a1']},broken=true,idle=false,removals=0;
 const recovery=intakeRecovery({recheckMs:30,alertMs:60,log:line=>logs.push(line),alert:text=>alerts.push(text),idle:()=>idle,
  inspect:async()=>structuredClone(state),remove:async()=>{removals++;if(!broken)state={containers:[],volumes:[],directories:[]};}});
 recovery.pause();recovery.pause();
 assert.equal(recovery.paused,true);assert.equal(logs.filter(l=>l.includes('conversion intake paused')).length,1);
 await recovery.check();assert.equal(recovery.paused,true);assert.equal(removals,0,'a live request still owns its job');
 idle=true;await recovery.check();assert.equal(recovery.paused,true);assert.equal(removals,1);
 assert.ok(await until(()=>alerts.length===1),'pause longer than the alert threshold notifies once');assert.match(alerts[0],/paused/);
 broken=false;assert.ok(await until(()=>!recovery.paused),'the scheduled recheck resumes intake');
 assert.equal(logs.filter(l=>l.includes('conversion intake resumed')).length,1);
 assert.ok(await until(()=>alerts.length===2));assert.match(alerts[1],/resumed/);
 assert.equal(logs.filter(l=>l.includes('still paused')).length,1,'repeated identical leftovers are logged once');
 recovery.stop();
});

test('an unreachable Docker daemon keeps intake paused and a short pause does not alert',async()=>{
 const logs=[],alerts=[];
 const recovery=intakeRecovery({recheckMs:20,alertMs:10000,log:line=>logs.push(line),alert:text=>alerts.push(text),inspect:async()=>{throw new Error('daemon down');},remove:async()=>{}});
 recovery.pause();await recovery.check();await wait(80);
 assert.equal(recovery.paused,true);assert.ok(logs.some(l=>l.includes('Docker did not answer')));
 recovery.stop();await wait(40);assert.deepEqual(alerts,[]);
});

test('webhook alerts accept only http(s) URLs and never log the secret URL',async()=>{
 const logs=[];assert.equal(webhookAlert('',{log:l=>logs.push(l)}),null);assert.equal(webhookAlert('file:///etc/passwd',{log:l=>logs.push(l)}),null);
 assert.ok(logs.every(l=>!l.includes('/etc/passwd')));
 const send=webhookAlert('http://127.0.0.1:9/token-SECRET',{timeout:500,log:l=>logs.push(l)});await send('text');
 assert.ok(logs.at(-1).startsWith('Converter alert webhook failed'));assert.ok(logs.every(l=>!l.includes('SECRET')));
});

test('broker pauses on unconfirmed cleanup, alerts, then resumes by itself after Docker recovers',{timeout:20000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-recovery-')),bin=join(dir,'bin'),jobs=join(dir,'jobs'),state=join(dir,'state'),broken=join(dir,'broken');
 await mkdir(bin);await writeFile(broken,'');
 // A stateful local Docker double. No daemon, container or network is used.
 await writeFile(join(bin,'docker'),`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),a=process.argv.slice(2),file=process.env.FAKE_STATE;
const read=()=>{try{return fs.readFileSync(file,'utf8').split('\\n').filter(Boolean);}catch{return [];}};
const write=list=>fs.writeFileSync(file,list.join('\\n'));
if(a.includes('catalog'))console.log(JSON.stringify({matrix:{png:{svg:['vtracer']}},categories:{png:'image',svg:'vector'}}));
else if(a[0]==='volume'&&a[1]==='create')write([...read(),'volume:'+a.at(-1)]);
else if(a.includes('hold')){write([...read(),'container:'+a[a.indexOf('--name')+1]]);console.log('\\nWASE_OUTPUT_READY');}
else if(a[0]==='cp')fs.writeFileSync(path.join(a.at(-1),'output.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
else if(a[0]==='ps')console.log(read().filter(v=>v.startsWith('container:')).map(v=>v.slice(10)).join('\\n'));
else if(a[0]==='volume'&&a[1]==='ls')console.log(read().filter(v=>v.startsWith('volume:')).map(v=>v.slice(7)).join('\\n'));
else if(a[0]==='rm'||(a[0]==='volume'&&a[1]==='rm')){
 if(fs.existsSync(process.env.FAKE_BROKEN)){console.error('Error response from daemon: permission denied');process.exitCode=1;}
 else{const kind=a[0]==='rm'?'container:':'volume:',names=a.slice(2);write(read().filter(v=>!names.some(n=>v===kind+n)));}
}
`,{mode:0o755});
 const hooks=[];const receiver=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{hooks.push({type:req.headers['content-type'],body:JSON.parse(body)});res.end('ok');});});
 receiver.listen(0,'127.0.0.1');await once(receiver,'listening');
 const child=spawn(process.execPath,['backend/server.mjs'],{cwd:resolve('.'),env:{...process.env,PATH:bin+':'+process.env.PATH,API_PORT:'0',JOB_ROOT:jobs,FAKE_STATE:state,FAKE_BROKEN:broken,PAUSE_RECHECK_MS:'200',PAUSE_ALERT_MS:'400',DOCKER_CLEANUP_TIMEOUT_MS:'2000',ALERT_WEBHOOK_URL:`http://127.0.0.1:${receiver.address().port}/hook?token=SECRET`},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
 try{
  const port=await new Promise((resolve,reject)=>{let text='';child.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/Converter API ready: 127\.0\.0\.1:(\d+)/);if(match)resolve(Number(match[1]));});child.once('exit',code=>reject(new Error(`Broker exited ${code}`)));});
  const convert=ip=>fetch(`http://127.0.0.1:${port}/api/convert?from=png&to=svg`,{method:'POST',body:'png',headers:{'X-Real-IP':ip},signal:AbortSignal.timeout(5000)}).then(r=>r.status);
  assert.equal(await convert('192.0.2.1'),503,'unconfirmed container removal pauses intake');
  assert.equal(await convert('192.0.2.2'),503);
  assert.ok(await until(()=>hooks.length===1),'a pause longer than the threshold posts one alert');
  assert.equal(hooks[0].type,'application/json');assert.match(hooks[0].body.text,/paused/);
  await rm(broken);
  assert.ok(await until(()=>errors.includes('conversion intake resumed')),'recheck removes leftovers and resumes');
  assert.equal(await convert('192.0.2.3'),200,'conversions work again without a restart');
  assert.ok(await until(()=>hooks.length===2));assert.match(hooks[1].body.text,/resumed/);
  assert.equal(errors.split('conversion intake paused').length-1,1);assert.equal(errors.split('conversion intake resumed').length-1,1);
  assert.ok(!errors.includes('SECRET'),'webhook URL is never logged');
 }finally{if(child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;}receiver.close();await rm(dir,{recursive:true,force:true});}
});
