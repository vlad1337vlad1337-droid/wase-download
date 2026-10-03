import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFormatCache,writeFormatCache} from '../site/src/catalog-cache.js';
const data={groups:[['png','svg']],inputs:{jpg:0},limits:{fileMB:100}};
function storage(){let value;return {getItem:()=>value,setItem:(key,raw)=>value=raw,set raw(v){value=v}}}
test('cached public formats survive a repeat visit and expire after 24 hours',()=>{const s=storage();writeFormatCache(s,data,100);assert.deepEqual(readFormatCache(s,101),data);assert.equal(readFormatCache(s,100+86400000),null)});
test('corrupt or incompatible caches fall back to fetching',()=>{const s=storage();s.raw='broken';assert.equal(readFormatCache(s),null);s.raw=JSON.stringify({version:2,savedAt:100,data:{groups:[['png']],inputs:{jpg:9}}});assert.equal(readFormatCache(s,101),null)});
test('blocked storage never breaks startup',()=>{const s={getItem(){throw Error('blocked')},setItem(){throw Error('quota')}};assert.equal(readFormatCache(s),null);assert.doesNotThrow(()=>writeFormatCache(s,data))});

test('a catalogue from before upload-policy cleanup is not reused',()=>{const s=storage();s.raw=JSON.stringify({version:1,savedAt:100,data});assert.equal(readFormatCache(s,101),null)});
