import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const code=readFileSync('site/public/boot.js','utf8');
function setup(saved,blocked=false){const classes=new Set(),timers=[],events={};let removed=false;const screen={classList:{add:v=>classes.add(v)},remove:()=>{removed=true}};const root={dataset:{},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}};const window={addEventListener:(name,fn)=>events[name]=fn};const context={document:{documentElement:root,getElementById:id=>id==='boot-screen'?screen:null,querySelector:()=>null,fonts:{ready:Promise.resolve()}},window,localStorage:{getItem:()=>{if(blocked)throw Error('blocked');return saved}},matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t},clearTimeout:t=>t.cleared=true,requestAnimationFrame:fn=>fn()};vm.runInNewContext(code,context);return{root,classes,timers,window,events,get removed(){return removed}}}
test('saved dark theme is set before app startup',()=>{const b=setup('dark');assert.equal(b.root.dataset.theme,'dark');assert.ok(b.classes.has('is-booting'))});
test('blocked storage still falls back to system theme and reveals on deadline',()=>{const b=setup(null,true);assert.equal(b.root.dataset.theme,'light');const deadline=b.timers.find(t=>t.ms===6500);assert.ok(deadline);deadline.fn();assert.ok(!b.classes.has('is-booting'));b.timers.find(t=>t.ms===400).fn();assert.ok(b.removed)});
test('ready UI waits for the catalogue and one animation cycle',async()=>{const b=setup('dark');let resolve;const ready=new Promise(r=>resolve=r);b.window.__waseFinishBoot(ready);b.timers.find(t=>t.ms===1700).fn();await new Promise(r=>setImmediate(r));assert.ok(b.classes.has('is-booting'));resolve();await new Promise(r=>setImmediate(r));assert.ok(!b.classes.has('is-booting'));assert.ok(b.timers.find(t=>t.ms===6500).cleared)});
test('fast startup still shows a short animation',async()=>{const b=setup('light');b.window.__waseFinishBoot();await new Promise(r=>setImmediate(r));assert.ok(b.classes.has('is-booting'));b.timers.find(t=>t.ms===1700).fn();await new Promise(r=>setImmediate(r));assert.ok(!b.classes.has('is-booting'))});
test('a failed catalogue cannot leave the loader stuck',async()=>{const b=setup('light');b.window.__waseFinishBoot(Promise.reject(Error('offline')));b.timers.find(t=>t.ms===1700).fn();await new Promise(r=>setImmediate(r));assert.ok(!b.classes.has('is-booting'))});
test('back-forward cache restores the visible page',()=>{const b=setup('light');b.events.pageshow({persisted:true});assert.ok(!b.classes.has('is-booting'))});

function physicsSetup({reduced=false}={}){
 const classes=new Set(),timers=[],listeners=new Map(),scripts=[],dispatched=[];
 const root={dataset:{},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}};
 const screen={classList:{add(){}},remove(){}};
 const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},dispatchEvent:event=>{dispatched.push(event.type);listeners.get(event.type)?.(event);}};
 const document={documentElement:root,currentScript:{dataset:{engine:'/vendor/matter.js',physics:'/boot-physics.js'}},readyState:'complete',head:{append:script=>scripts.push(script)},createElement:()=>({}),getElementById:id=>id==='boot-screen'?screen:null,querySelector:()=>null,fonts:{ready:Promise.resolve()},removeEventListener(){}};
 const context={window,document,Event,localStorage:{getItem:()=>null},matchMedia:query=>({matches:query.includes('reduced-motion')&&reduced}),setTimeout:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},clearTimeout:timer=>{timer.cleared=true;},requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(code,context);
 return{classes,timers,scripts,window,dispatched,fire:ms=>timers.find(timer=>timer.ms===ms&&!timer.cleared)?.fn()};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('physics downloads asynchronously in order and its completion releases a ready app',async()=>{
 const b=physicsSetup();assert.equal(b.scripts.length,1);assert.equal(b.scripts[0].async,true);
 b.window.__waseFinishBoot();b.fire(1700);await flush();assert.ok(b.classes.has('is-booting'));
 b.scripts[0].onload();await flush();assert.equal(b.scripts[1].src,'/boot-physics.js');assert.equal(b.scripts[1].async,true);
 b.scripts[1].onload();b.window.dispatchEvent(new Event('wase:boot-animation-ready'));await flush();
 assert.ok(!b.classes.has('is-booting'));assert.equal(b.dispatched.filter(type=>type==='boot:stop').length,1);
});

test('an unavailable physics engine never traps the ready interface',async()=>{
 for(const cause of ['error','deadline']){
  const b=physicsSetup();b.window.__waseFinishBoot();b.fire(1700);await flush();
  const delayedOnload=b.scripts[0].onload;
  if(cause==='error')b.scripts[0].onerror(new Error('offline'));else b.fire(3400);
  await flush();assert.ok(!b.classes.has('is-booting'),cause);
  delayedOnload();await flush();assert.equal(b.scripts.length,1,'late engine must not start physics after reveal');
 }
});

test('reduced motion does not download the optional physics engine',async()=>{
 const b=physicsSetup({reduced:true});b.window.__waseFinishBoot();b.fire(1700);await flush();
 assert.equal(b.scripts.length,0);assert.ok(!b.classes.has('is-booting'));
});
