import test from 'node:test';
import assert from 'node:assert/strict';
import {githubStats,repository} from '../backend/github-stats.mjs';
import {sharePage,shareLink} from '../site/src/community-policy.js';
import {communityCopy} from '../site/src/community-copy.js';
import {localeCodes} from '../site/src/locales.js';
import {browserSelection,fallbackCopy} from '../site/src/browser-fallback.js';
const response=value=>new Response(JSON.stringify(value));
test('public stars coalesce concurrent requests, cache results and never use credentials',async()=>{
 let time=0,calls=0,options,resolve;const get=githubStats({now:()=>time,ttl:100,fetcher:async(url,opts)=>{assert.equal(url,`https://api.github.com/repos/${repository}/stargazers/count`);calls++;options=opts;await new Promise(r=>resolve=r);return response({count:1});}});
 const pending=Array.from({length:100},()=>get());resolve();const result=await Promise.all(pending);assert.equal(calls,1);assert.equal(result[0].stars,1);assert.equal(options.headers.Authorization,undefined);assert.equal(options.redirect,'error');time=99;assert.equal((await get()).stars,1);assert.equal(calls,1);
});
test('outages keep the last count, mark it stale and back off upstream requests',async()=>{
 let time=0,calls=0;const get=githubStats({now:()=>time,ttl:100,retry:50,fetcher:async()=>{calls++;if(calls>1)throw Error('offline');return response({count:0});}});
 assert.equal((await get()).stars,0);time=100;assert.equal((await get()).stale,true);assert.equal((await get()).stars,0);assert.equal(calls,2);time=149;await get();assert.equal(calls,2);time=150;await get();assert.equal(calls,3);
});
test('unknown count stays unknown; invalid, huge and slow responses are bounded',async()=>{
 for(const fetcher of [async()=>response({count:-1}),async()=>response({count:1.5}),async()=>response({count:9007199254740992}),async()=>response({count:1,pad:'x'.repeat(5000)}),async()=>new Response('rate limited',{status:403}),async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout'))))]){
  const get=githubStats({fetcher,timeout:10});const result=await get();assert.equal(result.stars,null);assert.equal(result.updatedAt,null);assert.equal(result.stale,true);
 }
});
test('saved links retain their public route and strip tracking or file query strings',()=>{
 assert.deepEqual(sharePage('https://wase.download/ru/epub-to-txt/?file=private#converter','EPUB → TXT'),{title:'EPUB → TXT',url:'https://wase.download/ru/epub-to-txt/'});
 for(const url of ['javascript:alert(1)','https://other.example/','https://name:secret@wase.download/'])assert.throws(()=>sharePage(url,'Test'));
});
test('native sharing needs browser support; cancellation is quiet and errors fall back',async()=>{
 const data=sharePage('https://wase.download/ru/','Test');assert.equal(await shareLink({},data),'unavailable');assert.equal(await shareLink({canShare:()=>false,share:()=>assert.fail()},data),'unavailable');
 assert.equal(await shareLink({share:async value=>assert.deepEqual(value,data)},data),'shared');assert.equal(await shareLink({share:async()=>{throw Object.assign(Error(),{name:'AbortError'});}},data),'cancelled');assert.equal(await shareLink({share:async()=>{throw Error('denied');}},data),'unavailable');
});
test('all locales have save controls and unavailable-server messages',()=>{
 assert.deepEqual(Object.keys(communityCopy),localeCodes);assert.deepEqual(Object.keys(fallbackCopy),localeCodes);for(const copy of Object.values(communityCopy))for(const value of Object.values(copy))assert.ok(value.trim());
});
test('an offline document or unsupported image direction resets to a working browser choice',()=>{
 assert.deepEqual(browserSelection('EPUB','TXT'),{source:'AUTO',target:'AUTO'});assert.deepEqual(browserSelection('PNG','AVIF'),{source:'PNG',target:'AUTO'});assert.deepEqual(browserSelection('JPG','PNG'),{source:'JPG',target:'PNG'});
});
