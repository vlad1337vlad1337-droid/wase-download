import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect} from '../site/src/convert.js';

function coreBitmap(){
 const bytes=new ArrayBuffer(26+8*8*3),view=new DataView(bytes);
 view.setUint16(0,0x4d42,true);view.setUint32(2,bytes.byteLength,true);view.setUint32(10,26,true);
 view.setUint32(14,12,true);view.setUint16(18,8,true);view.setUint16(20,8,true);
 view.setUint16(22,1,true);view.setUint16(24,24,true);
 return new Blob([bytes],{type:'image/bmp'});
}
function imageHarness(onLoad=image=>queueMicrotask(()=>image.onload?.())){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'Image');
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL,images=[],created=[],revoked=[];
 URL.createObjectURL=blob=>{const url=`blob:inspection-${created.length}`;created.push({blob,url});return url;};
 URL.revokeObjectURL=url=>revoked.push(url);
 Object.defineProperty(globalThis,'Image',{configurable:true,value:class {
  constructor(){images.push(this);this.naturalWidth=8;this.naturalHeight=8;}
  get src(){return this.value;}
  set src(value){this.value=value;if(value)onLoad(this);}
 }});
 return {images,created,revoked,restore(){URL.createObjectURL=create;URL.revokeObjectURL=revoke;if(previous)Object.defineProperty(globalThis,'Image',previous);else delete globalThis.Image;}};
}

test('OS/2 core BMP dimensions are read as 16-bit rather than rejected as an oversized image',async()=>{
 const h=imageHarness();try{
  const result=await inspect(coreBitmap());
  assert.equal(result.type,'BMP');assert.equal(result.width,8);assert.equal(result.height,8);
  assert.equal(h.created.length,1);assert.equal(h.revoked.length,0);
  assert.equal(result.image.onload,null);assert.equal(result.image.onerror,null);
 }finally{h.restore();}
});

test('cancellation while reading a file creates no image or object URL',async()=>{
 const controller=new AbortController(),h=imageHarness();let done;
 const file={size:20,arrayBuffer:()=>new Promise(resolve=>done=resolve)};
 try{
  const pending=inspect(file,{signal:controller.signal});controller.abort();await assert.rejects(pending,/cancelled/);
  assert.equal(h.created.length,0);assert.equal(h.images.length,0);
  done(await coreBitmap().arrayBuffer());await Promise.resolve();assert.equal(h.created.length,0);
 }finally{h.restore();}
});

test('cancellation during image decode resets the image and revokes its object URL',async()=>{
 let ready;const decoding=new Promise(resolve=>ready=resolve),h=imageHarness(image=>ready(image));
 const controller=new AbortController();
 try{
  const pending=inspect(coreBitmap(),{signal:controller.signal});const image=await decoding;
  controller.abort();await assert.rejects(pending,/cancelled/);
  assert.deepEqual(h.revoked,[h.created[0].url]);assert.equal(image.src,'');
  assert.equal(image.onload,null);assert.equal(image.onerror,null);
 }finally{h.restore();}
});

test('a decode callback that never arrives cannot lock the queue past its deadline',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 let ready;const decoding=new Promise(resolve=>ready=resolve),h=imageHarness(image=>ready(image));
 try{
  const pending=inspect(coreBitmap());const image=await decoding;
  const rejected=assert.rejects(pending,/decode/);context.mock.timers.tick(15000);await rejected;
  assert.deepEqual(h.revoked,[h.created[0].url]);assert.equal(image.src,'');
 }finally{h.restore();}
});
