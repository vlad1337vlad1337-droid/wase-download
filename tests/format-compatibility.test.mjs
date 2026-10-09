// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {chooseAutoTarget} from '../site/src/auto-target.js';
import {browserSelection,browserOutputs} from '../site/src/browser-fallback.js';

// Execute the shipped handlers against a small deterministic DOM boundary.
// Network, image decoding and animations are deliberately outside these cases.
const source=readFileSync(new URL('../site/src/app.js',import.meta.url),'utf8');
const refresh=source.slice(source.indexOf(' function refreshTargets()'),source.indexOf(" for(const id of ['source','target'])"));
const mode=source.split('\n').find(line=>line.startsWith(" $('processing').onchange="));

function harness(){
 const sourceValue={textContent:'AUTO'},targetValue={textContent:'SVG'},note={};
 const nodes={processing:{value:'server'},source:{querySelector:()=>sourceValue},target:{querySelector:()=>targetValue},convert:{disabled:false},announcement:{textContent:''},'processing-note':{},dropzone:{querySelector:()=>({})},'file-input':{}};
 const document={body:{dataset:{lang:'en',source:'AUTO',target:'SVG'}},querySelector:()=>note};
 const context=vm.createContext({
  $:id=>nodes[id],document,browserSelection,browserOutputs,chooseAutoTarget,autoTarget:false,categories:{},
  t:{noSharedFormat:'No shared output',serverInfo:'Server',local:'Browser',mb:'MB',files:'Files',saving:'Local'},
  items:[{type:'DOCX',url:'blob:docx'},{type:'MP3',url:'blob:mp3'}],
  catalog:{docx:{pdf:true},mp3:{wav:true},png:{svg:true,png:true}},
  target:'SVG',compatible:true,modeChosen:false,fileLimit:100,message:'',formats:{},released:[],invalidations:0,
  serverMode:()=>nodes.processing.value==='server',
  render(){nodes.convert.disabled=!context.items.length||!context.compatible;},
  announce(message){context.message=message;nodes.announcement.textContent=message;},
  setFormats(id,values){context.formats[id]=values;},
  invalidate(){context.invalidations++;},outputSettings(){},
  release(item){context.released.push(item.url);}
 });
 vm.runInContext(refresh+'\n'+mode,context);
 return {context,nodes,sourceValue,targetValue};
}

test('switching from incompatible server files to browser mode allows the next image conversion',()=>{
 const {context:c,nodes}=harness();
 c.refreshTargets();assert.equal(c.compatible,false);assert.equal(nodes.convert.disabled,true);
 nodes.processing.value='browser';nodes.processing.onchange();
 assert.equal(c.compatible,true);assert.equal(c.items.length,0);assert.equal(c.message,'');
 assert.equal(c.released.length,2);assert.equal(c.target,'SVG');
 c.items.push({type:'PNG'});c.render();assert.equal(nodes.convert.disabled,false);
});

test('removing a conflicting file clears the stale compatibility error and selects a usable target',()=>{
 const {context:c,targetValue}=harness();
 c.refreshTargets();assert.equal(c.message,'No shared output');
 c.items=c.items.slice(0,1);c.refreshTargets();
 assert.equal(c.compatible,true);assert.equal(c.message,'');
 assert.equal(c.target,'PDF');assert.equal(targetValue.textContent,'PDF');
 assert.deepEqual(Array.from(c.formats.target),['AUTO','PDF']);
});

test('returning an empty incompatible queue to AUTO clears its obsolete error',()=>{
 const {context:c}=harness();c.refreshTargets();
 c.items=[];c.refreshTargets();
 assert.equal(c.compatible,true);assert.equal(c.message,'');
 assert.deepEqual(Array.from(c.formats.target),['AUTO','PDF','PNG','SVG','WAV']);
});

test('refreshing an already compatible queue preserves unrelated input errors',()=>{
 const {context:c}=harness();c.items=[{type:'PNG'}];c.target='SVG';c.message='An uploaded file was too large';
 c.refreshTargets();assert.equal(c.compatible,true);assert.equal(c.message,'An uploaded file was too large');
});

test('recovering compatibility does not erase a newer unrelated error',()=>{
 const {context:c}=harness();c.refreshTargets();c.announce('A different file was rejected');
 c.items=c.items.slice(0,1);c.refreshTargets();
 assert.equal(c.compatible,true);assert.equal(c.message,'A different file was rejected');
});

test('AUTO home stays AUTO before upload and resolves to a real output afterwards',()=>{
 const {context:c,targetValue}=harness();c.items=[];c.target='AUTO';c.autoTarget=true;
 c.refreshTargets();assert.equal(c.target,'AUTO');
 c.items=[{type:'PNG'}];c.refreshTargets();assert.equal(c.target,'PNG');
 assert.equal(targetValue.textContent,'PNG');
 c.items=[];c.refreshTargets();assert.equal(c.target,'AUTO');
});

test('catalogue/mode initialization preserves an explicit user-selected output',()=>{
 const {context:c,nodes}=harness();c.items=[];c.target='PNG';
 nodes.processing.onchange();assert.equal(c.target,'PNG');
 nodes.processing.value='browser';nodes.processing.onchange();assert.equal(c.target,'PNG');
});
