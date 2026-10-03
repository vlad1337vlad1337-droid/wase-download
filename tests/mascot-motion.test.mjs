import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// CSS is handled by Vite. Exercise the actual controller in a small event-driven
// DOM stand-in so visibility changes can be checked without a running browser.
const source=await readFile(new URL('../site/src/mascots.js',import.meta.url),'utf8');
const {initMascots}=await import(`data:text/javascript;base64,${Buffer.from(source.replace("import './mascot-processing.css';",'')).toString('base64')}`);

function harness(){
 const names=['document','window','matchMedia','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame'];
 const previous=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const document=new EventTarget();document.hidden=false;document.documentElement=new EventTarget();
 const reduced=new EventTarget();reduced.matches=false;
 const fine=new EventTarget();fine.matches=true;
 const classes=new Set(),frames=new Map(),styles=[new Map(),new Map()];
 let nextFrame=1,measurements=0,intersection;
 const figures=styles.map(style=>({style:{setProperty:(key,value)=>style.set(key,value)},getBoundingClientRect:()=>{measurements++;return{left:100,top:100,width:100,height:100};}}));
 const shell={dataset:{state:'idle'},querySelectorAll:()=>figures,classList:{contains:name=>classes.has(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
 class Observer{constructor(callback){intersection=callback;}observe(){}}
 Object.assign(globalThis,{document,window:{IntersectionObserver:Observer},matchMedia:query=>query.includes('reduced-motion')?reduced:fine,IntersectionObserver:Observer,requestAnimationFrame:callback=>{const id=nextFrame++;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 const state=initMascots(shell);
 return {state,shell,styles,document,reduced,fine,
  point(x=450,y=450){document.dispatchEvent(Object.assign(new Event('pointermove'),{clientX:x,clientY:y}));},
  flush(){const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback());},
  visibility(hidden){document.hidden=hidden;document.dispatchEvent(new Event('visibilitychange'));},
  intersect(visible){intersection([{isIntersecting:visible}]);},
  reduce(enabled){reduced.matches=enabled;reduced.dispatchEvent(new Event('change'));},
  get pending(){return frames.size;},get measurements(){return measurements;},
  restore(){for(const name of names){const old=previous.get(name);if(old)Object.defineProperty(globalThis,name,old);else delete globalThis[name];}}
 };
}

test('mascot gaze follows at most once per frame and stays bounded',()=>{
 const h=harness();try{
  h.point();h.point(900,900);assert.equal(h.pending,1);h.flush();
  assert.equal(h.measurements,2);
  for(const style of h.styles){assert.equal(style.get('--gaze-x'),'3px');assert.equal(style.get('--gaze-y'),'2.5px');}
 }finally{h.restore();}
});

test('conversion uses CSS gaze and cancels pending pointer layout reads',()=>{
 const h=harness();try{
  h.point();h.state('processing');assert.equal(h.pending,0);h.point();h.flush();
  assert.equal(h.measurements,0);
  for(const style of h.styles)assert.equal(style.get('--gaze-x'),'0px');
  h.state('idle');h.point();h.flush();assert.equal(h.measurements,2);
 }finally{h.restore();}
});

test('hidden, offscreen, reduced-motion and coarse-pointer mascots do no pointer work',()=>{
 const h=harness();try{
  h.point();h.visibility(true);assert.equal(h.pending,0);h.point();h.flush();assert.equal(h.measurements,0);
  assert.equal(h.shell.classList.contains('motion-paused'),true);
  h.visibility(false);h.point();h.intersect(false);assert.equal(h.pending,0);h.point();h.flush();assert.equal(h.measurements,0);
  h.intersect(true);h.point();h.reduce(true);assert.equal(h.pending,0);h.point();h.flush();assert.equal(h.measurements,0);
  h.reduce(false);h.fine.matches=false;h.point();assert.equal(h.pending,0);
  h.fine.matches=true;h.point();h.flush();assert.equal(h.measurements,2);
 }finally{h.restore();}
});
