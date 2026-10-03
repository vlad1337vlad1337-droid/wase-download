// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {initResultPreview} from '../site/src/result-preview.js';

function harness(){
 const names=['document','requestAnimationFrame'];
 const previous=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const frames=[],created=[];
 let focused;
 class Element extends EventTarget{
  constructor(tag){super();this.tagName=tag;this.children=[];this.attributes={};this.open=false;this.paused=0;this.loaded=0;created.push(this);}
  setAttribute(name,value){this.attributes[name]=value;}
  removeAttribute(name){delete this.attributes[name];delete this[name];}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(selector.split(',').includes(child.tagName)?[child]:[]),...child.querySelectorAll(selector)]);}
  showModal(){this.open=true;}
  close(){if(!this.open)return;this.open=false;this.dispatchEvent(new Event('close'));}
  focus(){focused=this;}
  pause(){this.paused++;}
  load(){this.loaded++;}
 }
 const origin=new Element('button'),choose=new Element('button'),body=new Element('body');
 Object.assign(globalThis,{
  document:{body,createElement:tag=>new Element(tag),querySelector:()=>origin,getElementById:()=>choose},
  requestAnimationFrame:callback=>frames.push(callback)
 });
 const copy={previewTitle:'Preview',close:'Close',download:'Download',previewTooLarge:'Too large',previewUnavailable:'Unavailable',previewLoading:'Loading',previewError:'Error'};
 const preview=initResultPreview(copy),dialog=body.children[0];
 const content=created.find(element=>element.className==='result-preview-content');
 return {preview,dialog,content,origin,created,get focused(){return focused;},flushFrames(){frames.splice(0).forEach(callback=>callback());},restore(){for(const name of names){const descriptor=previous.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}};
}
const item=(extension,blob,id=1)=>({id,outputName:`file.${extension}`,resultUrl:`blob:result-${id}`,result:{extension,blob}});

test('closing text preview discards a late read and returns focus to its queue action',async()=>{
 const h=harness();let resolve;
 try{
  const pending=h.preview(item('txt',{size:10,text:()=>new Promise(done=>resolve=done)}));
  assert.equal(h.dialog.open,true);assert.equal(h.content.children[0].textContent,'Loading');
  h.dialog.close();resolve('Late content');await pending;h.flushFrames();
  assert.equal(h.content.children.length,0);assert.equal(h.focused,h.origin);
 }finally{h.restore();}
});

test('an obsolete text read cannot replace the newly opened result',async()=>{
 const h=harness();let resolve;
 try{
  const previous=h.preview(item('txt',{size:10,text:()=>new Promise(done=>resolve=done)}));
  h.dialog.close();await h.preview(item('txt',new Blob(['Current content']),2));
  resolve('Obsolete content');await previous;
  assert.equal(h.content.children[0].tagName,'pre');assert.equal(h.content.children[0].textContent,'Current content');
 }finally{h.restore();}
});

test('closing audio or video stops playback and releases its media source',async()=>{
 for(const extension of ['mp3','mp4']){
  const h=harness();
  try{
   await h.preview(item(extension,new Blob(['media'])));
   const media=h.content.children[0];assert.equal(media.controls,true);
   h.dialog.close();assert.equal(media.paused,1);assert.equal(media.loaded,1);assert.equal(media.src,undefined);assert.equal(h.content.children.length,0);
  }finally{h.restore();}
 }
});

test('oversized text and active HTML are never injected into preview markup',async()=>{
 const h=harness();let read=false;
 try{
  await h.preview(item('txt',{size:1024*1024+1,text(){read=true;throw new Error('must not read');}}));
  assert.equal(read,false);assert.equal(h.content.children[0].textContent,'Too large');
  h.dialog.close();const html='<script>window.injected=true</script>';
  await h.preview(item('html',new Blob([html])));
  assert.equal(h.content.children[0].tagName,'pre');assert.equal(h.content.children[0].textContent,html);
 }finally{h.restore();}
});
