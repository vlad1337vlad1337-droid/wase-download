// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {preserveQueueFocus} from '../site/src/queue-focus.js';

function harness(){
 const document={body:{name:'body'},activeElement:null};document.activeElement=document.body;
 const calls=[];
 const button=(name,row)=>({
  name,row,isConnected:true,disabled:false,hidden:false,inert:false,visible:true,
  matches(selector){return name===selector;},
  closest(selector){return selector==='.file-row'?row:this.hidden||this.inert?{}:null;},
  getClientRects(){return this.visible&&this.isConnected?[{}]:[];},
  focus(options){document.activeElement=this;calls.push({control:this,options});}
 });
 const row=(id,actions=['.preview-button','a.download','.remove'])=>{
  const result={dataset:{id:String(id)},controls:[],querySelector:selector=>result.controls.find(control=>control.name===selector)};
  result.controls=actions.map(action=>button(action,result));return result;
 };
 const list={ownerDocument:document,rows:[row(1),row(2)],contains:control=>list.rows.some(row=>row.controls.includes(control)),querySelectorAll:()=>list.rows};
 const replace=(rows=[row(1),row(2)])=>{
  const removed=list.contains(document.activeElement);
  for(const row of list.rows)for(const control of row.controls)control.isConnected=false;
  list.rows=rows;if(removed)document.activeElement=document.body;
 };
 return {document,list,calls,row,button,replace};
}

test('queue rerender restores the same file and action without scrolling',()=>{
 for(const action of ['.preview-button','a.download','.remove']){
  const h=harness();const original=h.list.rows[0].querySelector(action);original.focus();h.calls.length=0;
  const restore=preserveQueueFocus(h.list);h.replace([h.row(2),h.row(1)]);restore();
  const replacement=h.list.rows[1].querySelector(action);
  assert.equal(h.document.activeElement,replacement);assert.notEqual(replacement,original);
  assert.deepEqual(h.calls,[{control:replacement,options:{preventScroll:true}}]);
 }
});

test('focus outside the queue is never captured or stolen',()=>{
 const h=harness(),outside=h.button('search');outside.focus();h.calls.length=0;
 const restore=preserveQueueFocus(h.list);h.replace();restore();
 assert.equal(h.document.activeElement,outside);assert.equal(h.calls.length,0);
});

test('a deliberate focus move after replacement takes precedence',()=>{
 const h=harness();h.list.rows[0].querySelector('a.download').focus();
 const restore=preserveQueueFocus(h.list);h.replace();
 const outside=h.button('dialog-close');outside.focus();h.calls.length=0;restore();
 assert.equal(h.document.activeElement,outside);assert.equal(h.calls.length,0);
});

test('removed, disabled, hidden or inert actions are not replaced with a different focus target',()=>{
 for(const state of ['removed-file','removed-action','disabled','hidden','inert','invisible']){
  const h=harness();h.list.rows[0].querySelector('a.download').focus();h.calls.length=0;
  const restore=preserveQueueFocus(h.list);
  const row=h.row(1,state==='removed-action'?['.remove']:undefined);
  h.replace(state==='removed-file'?[h.row(2)]:[row,h.row(2)]);
  const control=row.querySelector('a.download');
  if(['disabled','hidden','inert'].includes(state))control[state]=true;
  if(state==='invisible')control.visible=false;
  restore();assert.equal(h.document.activeElement,h.document.body,state);assert.equal(h.calls.length,0,state);
 }
});

test('an unchanged control and its focus remain untouched',()=>{
 const h=harness(),original=h.list.rows[0].querySelector('a.download');original.focus();h.calls.length=0;
 preserveQueueFocus(h.list)();assert.equal(h.document.activeElement,original);assert.equal(h.calls.length,0);
});

test('the shipped remove handler still focuses the next row and then Choose',()=>{
 const h=harness(),choose=h.button('choose');
 const source=readFileSync(new URL('../site/src/app.js',import.meta.url),'utf8');
 const handler=source.split('\n').find(line=>line.startsWith(' function removeItem(item)'));
 h.document.querySelector=selector=>{
  const id=selector.match(/data-id="(\d+)"/)?.[1];return h.list.rows.find(row=>row.dataset.id===id)?.querySelector('.remove');
 };
 const context=vm.createContext({
  items:[{id:1},{id:2}],document:h.document,$:()=>choose,release(){},refreshTargets(){},
  render(){const restore=preserveQueueFocus(h.list);h.replace(Array.from(context.items,item=>h.row(item.id)));restore();}
 });
 vm.runInContext(handler,context);
 h.list.rows[0].querySelector('.remove').focus();context.removeItem(context.items[0]);
 assert.equal(h.document.activeElement,h.list.rows[0].querySelector('.remove'));assert.equal(h.list.rows[0].dataset.id,'2');
 context.removeItem(context.items[0]);assert.equal(h.document.activeElement,choose);
});
