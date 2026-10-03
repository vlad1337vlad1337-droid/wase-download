import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {abortable} from '../site/src/task-lifecycle.js';

test('aborting an unresolved operation releases the caller and ignores late rejection',async()=>{
 const controller=new AbortController();let reject;
 const operation=new Promise((_,no)=>reject=no),pending=abortable(operation,controller.signal);
 assert.equal(getEventListeners(controller.signal,'abort').length,1);
 controller.abort();await assert.rejects(pending,/cancelled/);
 assert.equal(getEventListeners(controller.signal,'abort').length,0);
 reject(new Error('late browser failure'));await Promise.resolve();
});

test('pre-aborted work never starts and rejected promises stay observed',async()=>{
 const controller=new AbortController();controller.abort();let starts=0;
 await assert.rejects(abortable(()=>{starts++;},controller.signal),/cancelled/);
 await assert.rejects(abortable(Promise.reject(new Error('already failed')),controller.signal),/cancelled/);
 assert.equal(starts,0);assert.equal(getEventListeners(controller.signal,'abort').length,0);
});

test('successful completion removes cancellation listeners',async()=>{
 const controller=new AbortController();
 assert.equal(await abortable(Promise.resolve('done'),controller.signal,{timeout:1000}),'done');
 assert.equal(getEventListeners(controller.signal,'abort').length,0);controller.abort();
});

test('deadlines run cleanup once, even when cleanup also aborts',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const controller=new AbortController();let cleaned=0;
 const pending=abortable(new Promise(()=>{}),controller.signal,{timeout:15000,timeoutError:'decode',onCancel(){cleaned++;controller.abort();}});
 context.mock.timers.tick(14999);assert.equal(cleaned,0);
 const rejected=assert.rejects(pending,/decode/);context.mock.timers.tick(1);await rejected;
 assert.equal(cleaned,1);assert.equal(getEventListeners(controller.signal,'abort').length,0);
});
