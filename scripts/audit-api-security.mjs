import http from 'node:http';
import assert from 'node:assert/strict';
// Deliberately local only: incomplete uploads must never be sent to production.
const base=process.env.SECURITY_TEST_ORIGIN||'http://127.0.0.1:5190';
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'Local security test only');
const hold=()=>{const req=http.request(base+'/api/convert?from=png&to=svg',{method:'POST',headers:{'Content-Length':100}},res=>res.resume());req.on('error',()=>{});req.write('x');return req;};
const first=hold(),second=hold();await new Promise(r=>setTimeout(r,250));
const r=await fetch(base+'/api/convert?from=png&to=svg',{method:'POST',body:'x'});assert.equal(r.status,429);await r.text();const other=await fetch(base+'/api/convert?from=png&to=svg',{method:'POST',body:'',headers:{'X-Real-IP':'192.0.2.22'},signal:AbortSignal.timeout(2000)});assert.equal(other.status,422);await other.text();first.destroy();second.destroy();await new Promise(r=>setTimeout(r,500));
const empty=await fetch(base+'/api/convert?from=png&to=svg',{method:'POST',body:''});assert.equal(empty.status,422);await empty.text();
const formats=await fetch(base+'/api/formats');assert.equal(formats.status,200);const etag=formats.headers.get('etag');assert.ok(etag);await formats.text();const cached=await fetch(base+'/api/formats',{headers:{'If-None-Match':etag}});assert.equal(cached.status,304);
console.log('Local runtime: per-IP queue 429, aborted slots reusable, conditional formats 304 passed');
