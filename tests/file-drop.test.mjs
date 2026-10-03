import test from 'node:test';
import assert from 'node:assert/strict';
import {bindFileDrop,hasFiles} from '../site/src/file-drop-controller.js';
import {fileDropCopy} from '../site/src/file-drop-copy.js';
import {localeCodes} from '../site/src/locales.js';

function fixture(){
 const target=new EventTarget(),states=[],batches=[];
 let locked=false,blocked=0;
 const unbind=bindFileDrop(target,{canDrop:()=>!locked,onState:state=>states.push(state),onFiles:files=>batches.push(files),onBlocked:()=>blocked++});
 function send(type,transfer={types:['Files'],files:[]},extra={}){
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{dataTransfer:transfer,...extra});
  target.dispatchEvent(event);
  return event;
 }
 return{send,states,batches,unbind,lock:()=>locked=true,blocked:()=>blocked};
}

test('OS file drags are detected before protected files become readable; text is left alone',()=>{
 assert.equal(hasFiles({types:['Files'],files:[]}),true);
 assert.equal(hasFiles({types:[],items:[{kind:'file'}]}),true);
 assert.equal(hasFiles({types:['text/plain','text/uri-list'],files:[]}),false);
 const f=fixture();
 assert.equal(f.send('dragover',{types:['text/plain']}).defaultPrevented,false);
 assert.deepEqual(f.states,[]);
 const transfer={types:['Files'],files:[]};
 assert.equal(f.send('dragover',transfer).defaultPrevented,true);
 assert.equal(transfer.dropEffect,'copy');
 assert.deepEqual(f.states,[{active:true,allowed:true}]);
});

test('whole-window drop outside the upload card adds one batch and hides the overlay',()=>{
 const f=fixture(),file={name:'report.epub'};
 f.send('dragenter');
 const event=f.send('drop',{types:['Files'],files:[file]});
 assert.equal(event.defaultPrevented,true);
 assert.deepEqual(f.batches,[[file]]);
 assert.deepEqual(f.states.at(-1),{active:false});
});

test('crossing children does not flicker; leaving the window clears the overlay',()=>{
 const f=fixture();
 f.send('dragenter');f.send('dragenter');f.send('dragleave');
 assert.equal(f.states.length,1);
 f.send('dragleave');
 assert.deepEqual(f.states,[{active:true,allowed:true},{active:false}]);
});

test('task locking changes the affordance and prevents navigation or a concurrent batch',()=>{
 const f=fixture();f.send('dragenter');f.lock();
 const transfer={types:['Files'],files:[{name:'second.png'}]};
 f.send('dragover',transfer);
 assert.equal(transfer.dropEffect,'none');
 assert.deepEqual(f.states.at(-1),{active:true,allowed:false});
 assert.equal(f.send('drop',transfer).defaultPrevented,true);
 assert.equal(f.blocked(),1);assert.deepEqual(f.batches,[]);
});

test('Escape, focus loss and page exit cannot leave an overlay stuck',()=>{
 for(const event of ['keydown','blur','pagehide','dragend']){
  const f=fixture();f.send('dragenter');f.send(event,undefined,{key:'Escape'});
  assert.deepEqual(f.states.at(-1),{active:false});
  f.send('dragenter');assert.deepEqual(f.states.at(-1),{active:true,allowed:true});
  f.unbind();f.send('dragenter');assert.deepEqual(f.states.at(-1),{active:false});
 }
});

test('file-item fallback works and non-file drops do not alter browser behavior',()=>{
 const f=fixture(),file={name:'notes.txt'};
 f.send('drop',{items:[{kind:'file',getAsFile:()=>file}],files:[]});
 assert.deepEqual(f.batches,[[file]]);
 assert.equal(f.send('drop',{types:['text/plain']}).defaultPrevented,false);
});

test('drop affordance is translated for every published locale',()=>{
 assert.deepEqual(Object.keys(fileDropCopy).sort(),[...localeCodes].sort());
 for(const text of Object.values(fileDropCopy))for(const key of ['release','anywhere','wait','waitHint'])assert.ok(text[key]?.trim());
});
