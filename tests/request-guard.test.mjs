import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {rateLimit,occupancy,clientIP,deadline,matchesETag} from '../backend/request-guard.mjs';
import {discoveryHandler} from '../backend/discovery.mjs';

test('conditional catalogue requests accept weak gzip ETags and tag lists',()=>{
 assert.ok(matchesETag('W/"catalogue"','"catalogue"'));
 assert.ok(matchesETag('"other", W/"catalogue"','"catalogue"'));
 assert.ok(matchesETag('*','"catalogue"'));
 assert.equal(matchesETag('"old"','"catalogue"'),false);
 assert.equal(matchesETag(undefined,'"catalogue"'),false);
});

test('bounded limiter rejects rotating identities and expires without live eviction',()=>{
 let time=0;const rate=rateLimit({limit:2,maxKeys:3,globalLimit:4,windowMs:100,now:()=>time});
 assert.ok(rate.allow('a'));assert.ok(rate.allow('a'));assert.equal(rate.allow('a'),false);
 assert.ok(rate.allow('b'));assert.ok(rate.allow('c'));assert.equal(rate.allow('d'),false);assert.equal(rate.size,3);
 time=100;assert.ok(rate.allow('d'));assert.equal(rate.size,1);
 const bounded=rateLimit({limit:10,maxKeys:2,globalLimit:100});bounded.allow('a');bounded.allow('b');for(let i=0;i<10000;i++)assert.equal(bounded.allow(String(i)),false);assert.equal(bounded.size,2);
});
test('one client cannot monopolize all queue slots; release is idempotent',()=>{
 const queue=occupancy({perClient:2,total:3});const a=queue.enter('a'),b=queue.enter('a');assert.equal(queue.enter('a'),null);const c=queue.enter('b');assert.equal(queue.enter('c'),null);
 a();a();assert.equal(queue.active,2);assert.ok(queue.enter('c'));b();c();
});
test('only valid IP from a loopback reverse proxy is trusted',()=>{
 const request=(peer,header)=>({socket:{remoteAddress:peer},headers:{'x-real-ip':header}});
 assert.equal(clientIP(request('192.0.2.1','198.51.100.1')),'192.0.2.1');
 assert.equal(clientIP(request('127.0.0.1','198.51.100.1')),'198.51.100.1');
 assert.equal(clientIP(request('127.0.0.1','rotating-id')),'127.0.0.1');
});
test('deadline aborts response even when upload was already complete',async()=>{
 const controller=new AbortController();let closedRequest=false,closedResponse=false;
 const clear=deadline({complete:true,destroy(){closedRequest=true;}},{destroy(){closedResponse=true;}},controller,10);
 await new Promise(r=>setTimeout(r,30));clear();assert.ok(controller.signal.aborted);assert.ok(closedRequest);assert.ok(closedResponse);
});
test('MCP validates IDs, enforces a global budget and frees slow-body connections',async()=>{
 const handler=discoveryHandler({matrix:{png:{svg:['trace']}},categories:{}},new Set(),100,{rate:{limit:100,globalLimit:5},bodyTimeout:60});
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,url=`http://127.0.0.1:${port}/api/mcp`;
 const post=(data,headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 try{
  assert.equal((await post({jsonrpc:'2.0',method:'ping',id:{bad:true}})).status,400);
  assert.equal((await post({jsonrpc:'2.0',method:'tools/call',id:1,params:{name:'list_formats',arguments:{category:'x'.repeat(100)}}})).status,200);
  await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:'/api/mcp',method:'POST',headers:{'Content-Type':'application/json','Content-Length':10}},()=>reject(new Error('Incomplete body was accepted')));req.on('error',()=>resolve());req.write('{');});
  assert.equal((await post({jsonrpc:'2.0',method:'ping',id:1})).status,200);
  assert.equal((await post({jsonrpc:'2.0',method:'ping',id:2})).status,200);
  const limited=await post({jsonrpc:'2.0',method:'ping',id:3},{'X-Real-IP':'192.0.2.99'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('MCP rejects oversized chunked bodies without buffering unbounded data',async()=>{
 const server=http.createServer(discoveryHandler({matrix:{},categories:{}},new Set(),100));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const status=await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,path:'/api/mcp',method:'POST',headers:{'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.write('x'.repeat(17000));req.end();});assert.equal(status,413);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
