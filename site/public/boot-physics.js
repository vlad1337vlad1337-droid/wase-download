// SPDX-License-Identifier: MIT
// Matter.js owns collisions; the DOM is only a renderer for the original SVGs.
(function(host){
 'use strict';
 const STEP=1000/60,MAX_BODIES=50,READY_AT=2600,MAX_LIFETIME=4000;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const ART_SCALES=[1.5,1.75,1.5,1.75];
 // Exact outer paths and circles from /mascots/boot-{0,1,2,3}.svg. A small
 // conservative convex hull includes every ear; eye geometry is untouched.
 const SHAPES=[
  {start:[83.5,49.79],curves:[[83.5,71.34,71.19,84.47,50.99,84.47],[30.79,84.47,18.47,71.34,18.47,49.79],[18.47,28.25,30.79,15.12,50.99,15.12],[71.19,15.12,83.5,28.25,83.5,49.79]],circles:[[26.88,65.2,9.57]]},
  {start:[76.56,49.55],curves:[[76.56,66.42,67.14,76.27,51,76.27],[34.86,76.27,25.43,66.42,25.43,49.55],[25.43,32.67,34.86,22.83,51,22.83],[67.14,22.83,76.56,32.67,76.56,49.55]],circles:[[76.97,53.13,5.17],[60.89,73.83,5.17],[34.91,70.25,5.17],[25.03,45.97,5.17],[41.11,25.27,5.17],[67.08,28.85,5.17]]},
  {start:[81.82,50.16],curves:[[81.82,71,68.75,84.84,49.05,84.84],[29.35,84.84,16.28,71,16.28,50.16],[16.28,29.31,29.35,15.47,49.05,15.47],[68.75,15.47,81.82,29.31,81.82,50.16]],circles:[[20.64,55.07,10.68]]},
  {start:[77.74,49.35],curves:[[77.74,65.84,65.63,78.15,49.42,78.15],[33.2,78.15,21.09,65.84,21.09,49.35],[21.09,32.86,33.2,20.55,49.42,20.55],[65.63,20.55,77.74,32.86,77.74,49.35]],circles:[[28.96,63.59,9]]}
 ];
 function silhouettes(Matter){
  return SHAPES.map(shape=>{
   const points=[];let [x,y]=shape.start;
   for(const [x1,y1,x2,y2,x3,y3] of shape.curves){
    for(let i=0;i<=6;i++){const t=i/6,u=1-t;points.push({x:u*u*u*x+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,y:u*u*u*y+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3});}
    x=x3;y=y3;
   }
   for(const [cx,cy,radius] of shape.circles)for(let i=0;i<12;i++){const angle=i*Math.PI/6;points.push({x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius});}
   const hull=Matter.Vertices.hull(points),center=Matter.Vertices.centre(hull);
   return {center,vertices:hull.map(point=>({x:center.x+(point.x-center.x)*1.015,y:center.y+(point.y-center.y)*1.015}))};
  });
 }

 function createWorld(Matter,{width,height,random=Math.random}={}){
  if(!Matter?.Engine||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid boot world');
  const {Engine,Bodies,Body,Composite,Sleeping}=Matter;
  const shapes=silhouettes(Matter);
  const engine=Engine.create({enableSleeping:true});
  engine.gravity.y=1;engine.gravity.scale=.0018;
  let w=width,h=height,elapsed=0,spawned=0,destroyed=false,walls=[];
  const bodies=[];
  let seedRadius=Math.min(Math.sqrt(w*h*.88/(MAX_BODIES*Math.PI)),w/10.8,h/12);
  let rainRadius=Math.sqrt(Math.max(1,(w*h*.88/Math.PI-15*seedRadius*seedRadius)/35));
  const addWalls=()=>{
   const thickness=Math.max(120,rainRadius*3);
   walls=[
    Bodies.rectangle(w/2,h+thickness/2,w+thickness*2,thickness,{isStatic:true,label:'boot-floor',friction:.5,restitution:.2}),
    Bodies.rectangle(-thickness/2,h/2,thickness,h*3,{isStatic:true,label:'boot-left'}),
    Bodies.rectangle(w+thickness/2,h/2,thickness,h*3,{isStatic:true,label:'boot-right'})
   ];
   Composite.add(engine.world,walls);
  };
  const add=(x,y,radius,index,mascot)=>{
   const shape=shapes[mascot],spriteScale=radius*ART_SCALES[mascot]/50;
   const vertices=shape.vertices.map(point=>({x:(point.x-shape.center.x)*spriteScale,y:(point.y-shape.center.y)*spriteScale}));
   const body=Bodies.fromVertices(x,y,[vertices],{label:`boot-face-${index}`,restitution:.36,friction:.28,frictionStatic:.55,frictionAir:.004,sleepThreshold:45},false,0,0,0);
   Body.setAngle(body,(random()-.5)*.38);
   const origin={x:radius+(shape.center.x-50)*spriteScale,y:radius+(shape.center.y-50)*spriteScale};
   const entry={body,radius,index,mascot,spriteScale,origin};bodies.push(entry);Composite.add(engine.world,body);return entry;
  };
  addWalls();
  for(let row=0;row<5;row++)for(let column=0;column<5-row;column++){
   add(w/2+(column-(4-row)/2)*seedRadius*2.02,h-seedRadius-1-row*seedRadius*1.75,seedRadius,bodies.length,(bodies.length+row)%4);
  }
  const spawn=()=>{
   if(destroyed||bodies.length>=MAX_BODIES)return null;
   const index=spawned++,radius=rainRadius*(.92+random()*.16);
   // The irrational spacing keeps successive arrivals in different streams.
   // Only spawn positions are chosen; landing positions come from collisions.
   const fraction=(index*.61803398875+.16+random()*.08)%1;
   const x=radius+(w-2*radius)*fraction;
   let y=-radius*(1.15+(index%3)*.5);
   for(const entry of bodies){
    if(entry.body.position.y<0&&Math.abs(entry.body.position.x-x)<entry.radius+radius)y=Math.min(y,entry.body.position.y-entry.radius-radius-3);
   }
   const entry=add(x,y,radius,bodies.length,(index*3+Math.floor(index/7))%4);
   Body.setVelocity(entry.body,{x:(random()-.5)*3.6,y:10+random()*3});
   Body.setAngularVelocity(entry.body,(random()-.5)*.075);
   return entry;
  };
  return {
   engine,bodies,
   get elapsed(){return elapsed;},get destroyed(){return destroyed;},
   step(){
    if(destroyed)return;
    elapsed+=STEP;
    while(spawned<35&&elapsed>=160+spawned*38)spawn();
    Engine.update(engine,STEP);
   },
   resize(width,height){
    if(destroyed||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
    const sx=width/w,sy=height/h,scale=Math.sqrt(sx*sy);
    for(const entry of bodies){
     const nextRadius=Math.min(entry.radius*scale,width*.2,height*.24),factor=nextRadius/entry.radius;
     Body.scale(entry.body,factor,factor);entry.radius=nextRadius;entry.spriteScale*=factor;entry.origin.x*=factor;entry.origin.y*=factor;
     Body.setPosition(entry.body,{x:clamp(entry.body.position.x*sx,nextRadius,width-nextRadius),y:Math.min(entry.body.position.y*sy,height-nextRadius)});
     Sleeping.set(entry.body,false);
    }
    Composite.remove(engine.world,walls);w=width;h=height;seedRadius*=scale;rainRadius=Math.min(rainRadius*scale,w*.2,h*.24);addWalls();
   },
   destroy(){if(destroyed)return;destroyed=true;Composite.clear(engine.world,false);Engine.clear(engine);bodies.length=0;walls=[];}
  };
 }

 function mount({Matter=host.Matter,element,window:windowObject=host}={}){
  const document=windowObject.document;
  if(!element?.isConnected||!document?.documentElement.classList.contains('is-booting'))return null;
  const media=windowObject.matchMedia?.('(prefers-reduced-motion: reduce)');
  let announced=false;
  const ready=()=>{
   if(announced)return;announced=true;windowObject.__waseBootPhysicsComplete=true;
   windowObject.dispatchEvent(new windowObject.Event('wase:boot-animation-ready'));
  };
  if(media?.matches){ready();return null;}
  const faces=Array.from(element.querySelectorAll('[data-boot-body]'));
  if(faces.length!==MAX_BODIES){ready();return null;}
  let world,raf=0,last=null,accumulator=0,stopped=false,deadline;
  const originals=faces.map(face=>face.getAttribute('style')||'');
  const drawn=new Set();
  const paint=()=>{
   for(const entry of world.bodies){
    const face=faces[entry.index];
    if(!drawn.has(entry.index)){face.style.width=face.style.height=`${entry.radius*2}px`;face.style.transformOrigin=`${entry.origin.x}px ${entry.origin.y}px`;face.classList.add('is-active');drawn.add(entry.index);}
    face.style.transform=`translate3d(${(entry.body.position.x-entry.origin.x).toFixed(2)}px,${(entry.body.position.y-entry.origin.y).toFixed(2)}px,0) rotate(${entry.body.angle.toFixed(4)}rad)`;
   }
  };
  const stop=reason=>{
   if(stopped)return;stopped=true;windowObject.cancelAnimationFrame(raf);windowObject.clearTimeout(deadline);
   document.removeEventListener('visibilitychange',visibility);
   windowObject.removeEventListener('boot:stop',stop);windowObject.removeEventListener('pagehide',stop);windowObject.removeEventListener('resize',resize);
   if(media?.removeEventListener)media.removeEventListener('change',reduce);else media?.removeListener?.(reduce);
   world?.destroy();
   for(const face of faces)face.style.willChange='auto';
   if(reason==='reduced-motion'||reason==='error'){
    element.classList.remove('is-physics');
    faces.forEach((face,index)=>{face.setAttribute('style',originals[index]);face.classList.remove('is-active');});
   }
   ready();
  };
  const frame=timestamp=>{
   raf=0;
   if(stopped)return;
   if(!element.isConnected||!document.documentElement.classList.contains('is-booting')){stop();return;}
   if(document.hidden){last=null;accumulator=0;return;}
   try{
    const delta=last===null?STEP:clamp(timestamp-last,0,STEP*2);last=timestamp;
    accumulator=Math.min(accumulator+delta,STEP*2);
    let count=0;
    while(accumulator>=STEP&&count<2){world.step();accumulator-=STEP;count++;}
    paint();if(world.elapsed>=READY_AT)ready();
    if(!stopped)raf=windowObject.requestAnimationFrame(frame);
   }catch{stop('error');}
  };
  const visibility=()=>{
   windowObject.cancelAnimationFrame(raf);raf=0;last=null;accumulator=0;
   if(!document.hidden&&!stopped)raf=windowObject.requestAnimationFrame(frame);
  };
  const reduce=()=>{if(media.matches)stop('reduced-motion');};
  const resize=()=>{
   if(stopped)return;
   try{world.resize(windowObject.innerWidth,windowObject.innerHeight);drawn.clear();paint();}catch{stop('error');}
  };
  try{
   world=createWorld(Matter,{width:windowObject.innerWidth,height:windowObject.innerHeight});
   element.classList.add('is-physics');paint();
   document.addEventListener('visibilitychange',visibility);
   windowObject.addEventListener('boot:stop',stop);windowObject.addEventListener('pagehide',stop);windowObject.addEventListener('resize',resize,{passive:true});
   if(media?.addEventListener)media.addEventListener('change',reduce);else media?.addListener?.(reduce);
   deadline=windowObject.setTimeout(stop,MAX_LIFETIME);
   if(!document.hidden)raf=windowObject.requestAnimationFrame(frame);
   return {stop,get world(){return world;},get stopped(){return stopped;}};
  }catch{stop('error');return null;}
 }

 host.WaseBootPhysics={createWorld,mount,STEP,MAX_BODIES,READY_AT,MAX_LIFETIME};
 if(host.document){
  const start=()=>{const element=host.document.getElementById('boot-screen');if(element?.isConnected&&host.document.documentElement.classList.contains('is-booting'))mount({element});};
  if(host.document.readyState==='loading')host.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 }
})(typeof window==='object'?window:globalThis);
