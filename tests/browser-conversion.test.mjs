import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {convert} from '../site/src/convert.js';
import {previewKind} from '../site/src/result-preview-policy.js';

const options={detail:'balanced',colors:16,quality:.8,edge:0};
const item={type:'PNG',width:2,height:2,image:{}};

function canvasHarness(encode,{context}={}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const canvas={width:0,height:0,getContext:()=>context===undefined?({drawImage(){},fillRect(){},getImageData:()=>({data:new Uint8ClampedArray(16)})}):context,toBlob:encode};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>canvas}});
 return {canvas,restore(){if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}};
}

test('local results carry a usable format for preview as well as download',async()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>';
 const copied=await convert({...item,type:'SVG',svg},'SVG',options,new AbortController().signal);
 assert.equal(copied.extension,'svg');assert.equal(previewKind(copied.extension),'image');
 assert.equal(await copied.blob.text(),svg);
 const h=canvasHarness((callback,type)=>callback(new Blob(['encoded fixture'],{type})));
 try{
  for(const format of ['PNG','JPG','WEBP','BMP','ICO']){
   const result=await convert(item,format,options,new AbortController().signal);
   assert.equal(result.extension,format.toLowerCase());
   assert.equal(previewKind(result.extension),'image');
   assert.ok(result.blob.size>0);assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
  }
 }finally{h.restore();}
});

test('cancellation during unsupported native WebP encoding does not launch a worker',async()=>{
 const controller=new AbortController();let workerCount=0;
 const previous=Object.getOwnPropertyDescriptor(globalThis,'Worker');
 Object.defineProperty(globalThis,'Worker',{configurable:true,value:class {constructor(){workerCount++;throw new Error('Unexpected fallback worker');}}});
 const h=canvasHarness(callback=>queueMicrotask(()=>{controller.abort();callback(new Blob(['Safari PNG fallback'],{type:'image/png'}));}));
 try{
  await assert.rejects(convert(item,'WEBP',options,controller.signal),/cancelled/);
  assert.equal(workerCount,0);assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
 }finally{h.restore();if(previous)Object.defineProperty(globalThis,'Worker',previous);else delete globalThis.Worker;}
});

test('cancellation during successful native encoding discards its late result',async()=>{
 const controller=new AbortController();
 const h=canvasHarness((callback,type)=>queueMicrotask(()=>{controller.abort();callback(new Blob(['late result'],{type}));}));
 try{await assert.rejects(convert(item,'PNG',options,controller.signal),/cancelled/);}
 finally{h.restore();}
});

test('cancel does not wait for a stalled native encoder callback',async()=>{
 const controller=new AbortController();let callback;
 const h=canvasHarness(done=>callback=done);
 try{
  const pending=convert(item,'PNG',options,controller.signal);assert.equal(typeof callback,'function');
  controller.abort();await assert.rejects(pending,/cancelled/);
  assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
  assert.equal(getEventListeners(controller.signal,'abort').length,0);
  callback(new Blob(['late bytes'],{type:'image/png'}));await Promise.resolve();
 }finally{h.restore();}
});

test('native encoding is bounded if a browser never invokes its callback',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const h=canvasHarness(()=>{});
 try{
  const pending=convert(item,'PNG',options,new AbortController().signal);
  const rejected=assert.rejects(pending,/timeout/);context.mock.timers.tick(45000);await rejected;
  assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
 }finally{h.restore();}
});

test('failed canvas allocation or drawing releases the bitmap surface',async()=>{
 for(const drawing of [null,{drawImage(){throw new Error('draw failed');}}]){
  const h=canvasHarness(()=>{throw new Error('unexpected encode');},{context:drawing});
  try{
   await assert.rejects(convert(item,'PNG',options,new AbortController().signal),drawing?/draw failed/:/encode/);
   assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
  }finally{h.restore();}
 }
});

test('worker transfer failures terminate workers and clear cancellation handlers',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'Worker');let worker;
 Object.defineProperty(globalThis,'Worker',{configurable:true,value:class {
  constructor(){worker=this;this.stopped=false;}
  postMessage(){throw new Error('transfer failed');}
  terminate(){this.stopped=true;}
 }});
 const controller=new AbortController(),h=canvasHarness(()=>{});
 try{
  await assert.rejects(convert(item,'SVG',options,controller.signal),/transfer failed/);
  assert.equal(worker.stopped,true);assert.equal(worker.onmessage,null);assert.equal(worker.onerror,null);
  assert.equal(getEventListeners(controller.signal,'abort').length,0);
  assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
 }finally{h.restore();if(previous)Object.defineProperty(globalThis,'Worker',previous);else delete globalThis.Worker;}
});

test('cancelling a pending vector worker terminates it immediately',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'Worker');let worker;
 Object.defineProperty(globalThis,'Worker',{configurable:true,value:class {
  constructor(){worker=this;this.stopped=false;}
  postMessage(){}
  terminate(){this.stopped=true;}
 }});
 const controller=new AbortController(),h=canvasHarness(()=>{});
 try{
  const pending=convert(item,'SVG',options,controller.signal);controller.abort();await assert.rejects(pending,/cancelled/);
  assert.equal(worker.stopped,true);assert.equal(worker.onmessage,null);
  assert.equal(getEventListeners(controller.signal,'abort').length,0);
 }finally{h.restore();if(previous)Object.defineProperty(globalThis,'Worker',previous);else delete globalThis.Worker;}
});
