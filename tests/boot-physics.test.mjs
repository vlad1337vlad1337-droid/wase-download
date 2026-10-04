// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {readFileSync} from 'node:fs';
import '../site/public/boot-physics.js';
const {createWorld,mount,STEP,READY_AT,MAX_LIFETIME}=globalThis.WaseBootPhysics;
const random=()=>{let state=123456;return()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);};

test('real Matter gravity accelerates a free body and floor collision reverses its fall',()=>{
 const world=createWorld(Matter,{width:600,height:900,random:random()});
 try{
  const entry=world.bodies[0];Matter.Composite.remove(world.engine.world,world.bodies.slice(1).map(entry=>entry.body));
  Matter.Body.setPosition(entry.body,{x:300,y:100});Matter.Body.setVelocity(entry.body,{x:0,y:0});
  for(let i=0;i<8;i++)world.step();assert.ok(entry.body.position.y>110);assert.ok(entry.body.velocity.y>0);
  Matter.Body.setPosition(entry.body,{x:300,y:900-entry.radius-2});Matter.Body.setVelocity(entry.body,{x:0,y:8});
  let floorHit=false;Matter.Events.on(world.engine,'collisionStart',event=>{floorHit=event.pairs.some(pair=>[pair.bodyA.label,pair.bodyB.label].includes('boot-floor'));});
  world.step();assert.equal(floorHit,true);assert.ok(entry.body.velocity.y<0,'collision produces a real rebound');
 }finally{world.destroy();}
});

test('dynamic avatars collide with one another rather than following independent paths',()=>{
 const world=createWorld(Matter,{width:600,height:900,random:random()});
 try{
  const [a,b]=world.bodies;Matter.Composite.remove(world.engine.world,world.bodies.slice(2).map(entry=>entry.body));world.engine.gravity.scale=0;
  Matter.Body.setPosition(a.body,{x:245,y:200});Matter.Body.setPosition(b.body,{x:355,y:200});
  Matter.Body.setVelocity(a.body,{x:6,y:0});Matter.Body.setVelocity(b.body,{x:-6,y:0});
  let hit=false;Matter.Events.on(world.engine,'collisionStart',event=>{hit=event.pairs.some(pair=>[pair.bodyA.id,pair.bodyB.id].includes(a.body.id)&&[pair.bodyA.id,pair.bodyB.id].includes(b.body.id));});
  world.step();assert.equal(hit,true);assert.ok(a.body.velocity.x<0);assert.ok(b.body.velocity.x>0);
 }finally{world.destroy();}
});

test('pyramid plus rain is bounded and fills phone, landscape and desktop height by readiness',()=>{
 for(const [width,height] of [[320,568],[390,844],[1440,900],[844,390]]){
  const world=createWorld(Matter,{width,height,random:random()});
  try{
   assert.equal(world.bodies.length,15);assert.ok(world.bodies.every(({body})=>!body.isStatic));
   for(let i=0;i<Math.ceil(READY_AT/STEP)+1;i++)world.step();
   assert.equal(world.bodies.length,50);assert.equal(Matter.Composite.allBodies(world.engine.world).length,53);
   const visible=world.bodies.filter(({body})=>body.bounds.max.y>0&&body.bounds.min.y<height);
   assert.ok(visible.length>=45,`${width}: most avatars are on screen`);
   assert.ok(visible.some(({body})=>body.bounds.min.y<height*.1),`${width}: pile reaches screen top`);
   assert.ok(visible.some(({body})=>body.bounds.max.y>height*.95),`${width}: pile reaches floor`);
   assert.ok(world.bodies.every(({body})=>Number.isFinite(body.position.x+body.position.y+body.angle)));
   // Matter's bounds include velocity; inspect geometry and allow bounded
   // contact-solver penetration under a fifty-body pile, rather than tunneling.
   assert.ok(world.bodies.every(({body,radius})=>body.position.y<height&&Math.max(...body.vertices.map(vertex=>vertex.y))<height+Math.max(12,radius*.2)),'floor retains all bodies');
  }finally{world.destroy();}
  assert.equal(Matter.Composite.allBodies(world.engine.world).length,0);assert.equal(world.bodies.length,0);
 }
});

test('seeded simulations are deterministic and resize remains finite',()=>{
 const a=createWorld(Matter,{width:390,height:844,random:random()}),b=createWorld(Matter,{width:390,height:844,random:random()});
 try{
  for(let i=0;i<100;i++){a.step();b.step();}
  assert.deepEqual(a.bodies.map(({body})=>[body.position.x,body.position.y,body.angle]),b.bodies.map(({body})=>[body.position.x,body.position.y,body.angle]));
  a.resize(844,390);for(let i=0;i<20;i++)a.step();
  assert.ok(a.bodies.every(({body,radius})=>Number.isFinite(body.position.x+body.position.y)&&radius>0));
 }finally{a.destroy();b.destroy();}
});

function lifecycleHarness({reduced=false}={}){
 const classes=()=>{const values=new Set();return{add:value=>values.add(value),remove:value=>values.delete(value),contains:value=>values.has(value)};};
 const faces=Array.from({length:50},()=>({style:{},classList:classes(),getAttribute:()=>'',setAttribute(){this.style={};}}));
 const element={isConnected:true,classList:classes(),querySelectorAll:()=>faces};
 const document=new EventTarget();document.hidden=false;document.documentElement={classList:classes()};document.documentElement.classList.add('is-booting');
 const media=new EventTarget();media.matches=reduced;
 const window=new EventTarget(),frames=new Map(),timers=new Map();let nextId=0,ready=0;
 Object.assign(window,{document,Event,innerWidth:390,innerHeight:844,matchMedia:()=>media,requestAnimationFrame:callback=>{const id=++nextId;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(callback,ms)=>{const id=++nextId;timers.set(id,{callback,ms});return id;},clearTimeout:id=>timers.delete(id)});
 window.addEventListener('wase:boot-animation-ready',()=>ready++);
 return {window,document,media,element,frames,timers,get ready(){return ready;},frame(timestamp){const current=[...frames.values()];frames.clear();current.forEach(callback=>callback(timestamp));}};
}

test('RAF work is capped, hidden tabs pause and resume does not catch up elapsed wall time',()=>{
 const h=lifecycleHarness(),instance=mount({Matter,element:h.element,window:h.window});
 try{
  h.frame(0);const before=instance.world.elapsed;h.frame(100000);
  assert.ok(instance.world.elapsed-before<=STEP*2+.001);
  h.document.hidden=true;h.document.dispatchEvent(new Event('visibilitychange'));assert.equal(h.frames.size,0);
  const paused=instance.world.elapsed;h.document.hidden=false;h.document.dispatchEvent(new Event('visibilitychange'));h.frame(200000);
  assert.ok(instance.world.elapsed-paused<=STEP+.001);
 }finally{instance.stop();}
 assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
});

test('readiness is sent once and boot stop destroys the world and RAF',()=>{
 const h=lifecycleHarness(),instance=mount({Matter,element:h.element,window:h.window});
 for(let i=0;i<165;i++)h.frame(i*STEP);
 assert.equal(h.ready,1);assert.equal(h.window.__waseBootPhysicsComplete,true);
 h.window.dispatchEvent(new Event('boot:stop'));
 assert.equal(instance.stopped,true);assert.equal(instance.world.destroyed,true);assert.equal(instance.world.bodies.length,0);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.ready,1);
});

test('reduced motion never creates a world; pagehide, live preference and lifetime stop active worlds',()=>{
 const reduced=lifecycleHarness({reduced:true});
 assert.equal(mount({Matter:{},element:reduced.element,window:reduced.window}),null);assert.equal(reduced.frames.size,0);assert.equal(reduced.ready,1);
 for(const reason of ['pagehide','preference','deadline','removed']){
  const h=lifecycleHarness(),instance=mount({Matter,element:h.element,window:h.window});
  if(reason==='pagehide')h.window.dispatchEvent(new Event('pagehide'));
  if(reason==='preference'){h.media.matches=true;h.media.dispatchEvent(new Event('change'));assert.equal(h.element.classList.contains('is-physics'),false);}
  if(reason==='deadline')[...h.timers.values()].find(timer=>timer.ms===MAX_LIFETIME).callback();
  if(reason==='removed'){h.element.isConnected=false;h.frame(0);}
  assert.equal(instance.stopped,true,reason);assert.equal(instance.world.destroyed,true,reason);assert.equal(h.frames.size,0,reason);assert.equal(h.ready,1,reason);
 }
});

test('a missing Matter engine is decorative failure only and late starts are ignored',()=>{
 const h=lifecycleHarness();assert.equal(mount({Matter:{},element:h.element,window:h.window}),null);assert.equal(h.ready,1);
 h.document.documentElement.classList.remove('is-booting');
 assert.equal(mount({Matter,element:h.element,window:h.window}),null);assert.equal(h.frames.size,0);
});


function sampleOriginalOutline(svg){
 const outer=svg.match(/<g fill="[^"]+">([\s\S]*?)<\/g>/)[1];
 const tokens=outer.match(/<path d="([^"]+)"/)[1].match(/[MCZ]|-?\d*\.?\d+/g);
 const points=[];let x=0,y=0,index=0;
 while(index<tokens.length){
  const command=tokens[index++];
  if(command==='M'){x=Number(tokens[index++]);y=Number(tokens[index++]);}
  else if(command==='C'){
   const [x1,y1,x2,y2,x3,y3]=tokens.slice(index,index+6).map(Number);index+=6;
   for(let i=0;i<=64;i++){const t=i/64,u=1-t;points.push({x:u**3*x+3*u*u*t*x1+3*u*t*t*x2+t**3*x3,y:u**3*y+3*u*u*t*y1+3*u*t*t*y2+t**3*y3});}
   x=x3;y=y3;
  }else if(command!=='Z')throw new Error('Unexpected original SVG path');
 }
 for(const circle of outer.matchAll(/<circle ([^>]+)\/>/g)){
  const attr=name=>Number(circle[1].match(new RegExp(`${name}="([^\"]+)"`))[1]);
  const cx=attr('cx'),cy=attr('cy'),r=attr('r');
  for(let i=0;i<64;i++){const angle=i*Math.PI/32;points.push({x:cx+Math.cos(angle)*r,y:cy+Math.sin(angle)*r});}
 }
 return points;
}

test('convex colliders enclose the real SVG bodies and ears at the rendered centroid offset',()=>{
 const world=createWorld(Matter,{width:390,height:844,random:random()});
 try{
  for(let mascot=0;mascot<4;mascot++){
   const entry=world.bodies.find(entry=>entry.mascot===mascot);
   assert.ok(entry.body.vertices.length<=32);assert.equal(entry.body.parts.length,1,'single convex body requires no decomposition');
   const svg=readFileSync(new URL(`../site/public/mascots/boot-${mascot}.svg`,import.meta.url),'utf8');
   for(const point of sampleOriginalOutline(svg)){
    // Same CSS transform-origin contract as the renderer, independent SVG data.
    const x=entry.radius+(point.x-50)*entry.spriteScale-entry.origin.x;
    const y=entry.radius+(point.y-50)*entry.spriteScale-entry.origin.y;
    const angle=entry.body.angle,worldPoint={x:entry.body.position.x+x*Math.cos(angle)-y*Math.sin(angle),y:entry.body.position.y+x*Math.sin(angle)+y*Math.cos(angle)};
    assert.ok(Matter.Vertices.contains(entry.body.vertices,worldPoint),`mascot ${mascot}: outline ${point.x},${point.y} must be inside its collider`);
   }
  }
 }finally{world.destroy();}
});

test('resizing a sleeping pile wakes bodies and resolves newly introduced intersections',()=>{
 const world=createWorld(Matter,{width:390,height:844,random:random()});
 const maximumDepth=()=>{
  let depth=0;
  for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++)depth=Math.max(depth,Matter.Collision.collides(world.bodies[i].body,world.bodies[j].body)?.depth||0);
  return depth;
 };
 try{
  for(let i=0;i<300;i++)world.step();assert.ok(world.bodies.every(({body})=>body.isSleeping),'test starts from a settled sleeping pile');
  world.resize(844,390);assert.ok(world.bodies.every(({body})=>!body.isSleeping));
  const before=maximumDepth();assert.ok(before>20,'aspect-ratio change introduces real overlap');
  for(let i=0;i<30;i++)world.step();
  assert.ok(maximumDepth()<before*.35,'awakened collision solver removes most of the overlap');
 }finally{world.destroy();}
});
