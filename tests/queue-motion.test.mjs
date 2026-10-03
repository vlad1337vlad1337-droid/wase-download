import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../site/src/queue-motion.js',import.meta.url),'utf8');
const {initQueueMotion}=await import(`data:text/javascript;base64,${Buffer.from(source.replace("import './queue-motion.css';",'')).toString('base64')}`);

function harness({reduced=false,supported=true,legacyMedia=false}={}){
 const globals=['document','window','matchMedia'];
 const previous=new Map(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const document=new EventTarget();document.hidden=false;
 const window=new EventTarget(),media=new EventTarget();media.matches=reduced;
 if(legacyMedia){media.addListener=fn=>media.legacyChange=fn;media.addEventListener=undefined;}
 const classes=new Set(),animations=[];
 let panelRect={top:240,height:260},heroRect={top:140,height:24},reads=0;
 const animate=(owner,keyframes,options)=>{
  const animation={owner,keyframes,options,cancelled:false,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};
  animations.push(animation);return animation;
 };
 const shell={classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},animate:(frames,opts)=>animate('shell',frames,opts)};
 const panel={classList:{contains:()=>false},getBoundingClientRect:()=>{reads++;return panelRect;},animate:supported?(frames,opts)=>animate('panel',frames,opts):undefined};
 const hero={getBoundingClientRect:()=>{reads++;return heroRect;},animate:(frames,opts)=>animate('hero',frames,opts)};
 Object.assign(globalThis,{document,window,matchMedia:()=>media});
 const begin=initQueueMotion(shell,panel,{companions:[hero]});
 return {begin,classes,animations,document,window,
  setPanel(rect){panelRect=rect;},setHero(rect){heroRect=rect;},
  reduce(value){media.matches=value;if(legacyMedia)media.legacyChange();else media.dispatchEvent(new Event('change'));},
  get reads(){return reads;},
  restore(){for(const name of globals){const old=previous.get(name);if(old)Object.defineProperty(globalThis,name,old);else delete globalThis[name];}}
 };
}

test('empty-to-queue transition grows panel without scaling text and releases animations',()=>{
 const h=harness();try{
  const finish=h.begin(true);
  h.setPanel({top:120,height:480});h.setHero({top:80,height:24});finish();
  assert.equal(h.animations.length,3);
  const size=h.animations.find(animation=>animation.owner==='panel');
  assert.deepEqual(size.keyframes,[{height:'260px',maxHeight:'260px'},{height:'480px',maxHeight:'480px'}]);
  assert.equal(size.options.duration,300);
  assert.deepEqual(h.animations.find(animation=>animation.owner==='shell').keyframes,[{transform:'translateY(120px)'},{transform:'translateY(0)'}]);
  assert.ok(h.animations.every(animation=>!JSON.stringify(animation.keyframes).includes('scale')));
  assert.ok(h.classes.has('queue-is-animating'));
  size.finish();assert.equal(h.classes.has('queue-is-animating'),false);
  assert.ok(h.animations.every(animation=>animation.cancelled));
 }finally{h.restore();}
});

test('adding remaining files and updating progress cause no extra layout reads',()=>{
 const h=harness();try{
  assert.equal(h.reads,0);h.begin(false)();assert.equal(h.reads,0);
  const finish=h.begin(true);h.setPanel({top:120,height:480});finish();
  const reads=h.reads,count=h.animations.length;
  for(let n=0;n<60;n++)h.begin(true)();
  assert.equal(h.reads,reads);assert.equal(h.animations.length,count);
 }finally{h.restore();}
});

test('clearing mid-expansion starts from current visual size and cancels obsolete callbacks',()=>{
 const h=harness();try{
  const expand=h.begin(true);h.setPanel({top:120,height:480});expand();
  const old=[...h.animations],obsolete=old[0].onfinish;
  h.setPanel({top:185,height:355});
  const collapse=h.begin(false);
  assert.ok(old.every(animation=>animation.cancelled));
  h.setPanel({top:240,height:260});collapse();
  const shrinking=h.animations.filter(animation=>animation.owner==='panel').at(-1);
  assert.deepEqual(shrinking.keyframes,[{height:'355px',maxHeight:'355px'},{height:'260px',maxHeight:'260px'}]);
  obsolete();assert.ok(h.classes.has('queue-is-animating'));
  shrinking.finish();assert.equal(h.classes.has('queue-is-animating'),false);
 }finally{h.restore();}
});

test('resize, hidden page and reduced-motion cancel the transient effect',()=>{
 for(const event of ['resize','visibilitychange','reduced-motion','pagehide']){
  const h=harness();try{
   const finish=h.begin(true);h.setPanel({top:120,height:480});finish();
   if(event==='visibilitychange'){h.document.hidden=true;h.document.dispatchEvent(new Event(event));}
   else if(event==='reduced-motion')h.reduce(true);
   else h.window.dispatchEvent(new Event(event));
   assert.equal(h.classes.has('queue-is-animating'),false,event);
   assert.ok(h.animations.every(animation=>animation.cancelled),event);
  }finally{h.restore();}
 }
});

test('reduced motion and browsers without WAAPI use the layout immediately without measurements',()=>{
 for(const config of [{reduced:true},{supported:false}]){
  const h=harness(config);try{
   h.begin(true)();h.begin(false)();
   assert.equal(h.reads,0);assert.equal(h.animations.length,0);
   assert.equal(h.classes.has('queue-is-animating'),false);
  }finally{h.restore();}
 }
});

test('older Safari media listeners and cancelled pending measurements remain safe',()=>{
 const h=harness({legacyMedia:true});try{
  const finish=h.begin(true);h.reduce(true);h.setPanel({top:120,height:480});finish();
  assert.equal(h.animations.length,0);
  h.reduce(false);const collapse=h.begin(false);h.setPanel({top:240,height:260});collapse();
  assert.ok(h.animations.length>0);
  h.reduce(true);assert.ok(h.animations.every(animation=>animation.cancelled));
 }finally{h.restore();}
});
