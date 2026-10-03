import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {createResultsZip,archiveName,sameResults} from '../site/src/zip-results.js';
const item=(name,text)=>({outputName:name,result:{blob:new Blob([text])}});
test('ZIP has correct content, unique portable names and branding',async()=>{
 const items=[item('C:\\report.svg','one'),item('same.svg','two'),item('SAME.svg','three'),item('CON.txt','four')];
 const blob=await createResultsZip(items);const bytes=new Uint8Array(await blob.arrayBuffer());const data=unzipSync(bytes);
 assert.deepEqual(Object.keys(data),['C__report.svg','same.svg','1-SAME.svg','_CON.txt']);assert.equal(new TextDecoder().decode(data['same.svg']),'two');assert.ok(new TextDecoder().decode(bytes.slice(-80)).includes('Created by wase.download'));
});
test('archive names cannot create paths or Windows drive paths',()=>{
 const used=new Set();for(const input of ['../escape','C:escape','..','NUL','folder/file','a\x00b']){const name=archiveName(input,used);assert.ok(name);assert.doesNotMatch(name,/^[. ]|[. ]$|[\\/:\x00]/);assert.notEqual(name,'NUL');}
});
test('ZIP budget and cancellation reject before loading or consuming files',async()=>{
 let loaded=false;await assert.rejects(createResultsZip([item('a','123')],{maxBytes:2,loadZip:()=>{loaded=true;}}),/zipLimit/);assert.equal(loaded,false);
 const c=new AbortController();c.abort();await assert.rejects(createResultsZip([item('a','123')],{signal:c.signal}),/cancelled/);
});
test('ZIP yields between bounded chunks and can be cancelled with no later result',async()=>{
 const c=new AbortController();let yielded=0;
 await assert.rejects(createResultsZip([item('large.bin',new Uint8Array(4*1024*1024))],{signal:c.signal,yieldTask:async()=>{yielded++;c.abort();}}),/cancelled/);assert.equal(yielded,1);
});
test('ZIP abort cancels a pending reader without waiting for further bytes',async()=>{
 const c=new AbortController();let wasCancelled=false,started;
 const reading=new Promise(resolve=>started=resolve);
 const blob={size:1,stream:()=>new ReadableStream({pull(){started();},cancel(){wasCancelled=true;}})};
 const pending=createResultsZip([{outputName:'slow.txt',result:{blob}}],{signal:c.signal});await reading;c.abort();await assert.rejects(pending,/cancelled/);assert.equal(wasCancelled,true);
});
test('cached ZIP is reused only for the same result blobs and names',()=>{
 const items=[item('a','1'),item('b','2')],cache={results:items.map(i=>({blob:i.result.blob,name:i.outputName}))};
 assert.equal(sameResults(cache,items),true);assert.equal(sameResults(cache,[...items].reverse()),false);assert.equal(sameResults(cache,[items[0]]),false);assert.equal(sameResults(cache,[items[0],item('b','2')]),false);
});
test('ZIP cancellation does not wait for a lazy library download',async()=>{
 const c=new AbortController();const pending=createResultsZip([item('a','1')],{signal:c.signal,loadZip:()=>new Promise(()=>{})});c.abort();await assert.rejects(pending,/cancelled/);
});
test('ZIP reports failed file reads and a following archive still works',async()=>{
 const broken={size:1,stream:()=>new ReadableStream({start(controller){controller.error(new Error('read failed'));}})};
 await assert.rejects(createResultsZip([{outputName:'broken',result:{blob:broken}}]),/read failed/);
 const zip=await createResultsZip([item('good.txt','ok')]);assert.equal(new TextDecoder().decode(unzipSync(new Uint8Array(await zip.arrayBuffer()))['good.txt']),'ok');
});
