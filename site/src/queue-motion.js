// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
import './queue-motion.css';

const noop=()=>{};
const timing={duration:300,easing:'cubic-bezier(.22,.8,.24,1)'};

// The final flex layout remains responsible for the queue and its pinned actions.
// Animate its visible panel height, without scaling text or fixing layout sizes.
export function initQueueMotion(shell,panel,{companions=[]}={}){
 if(!shell||!panel)return()=>noop;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let populated=panel.classList.contains('has-files'),active=[],revision=0;
 const stop=()=>{
  revision++;
  const previous=active;active=[];
  shell.classList.remove('queue-is-animating');
  for(const animation of previous){animation.onfinish=null;animation.oncancel=null;animation.cancel();}
 };
 const allowed=()=>!reduced.matches&&!document.hidden&&typeof panel.animate==='function'&&typeof shell.animate==='function';
 const bounds=element=>{
  const {top,height}=element.getBoundingClientRect();
  return Number.isFinite(top)&&Number.isFinite(height)&&height>0?{top,height}:null;
 };
 const cancelIfHidden=()=>{if(document.hidden)stop();};
 if(reduced.addEventListener)reduced.addEventListener('change',stop);
 else reduced.addListener?.(stop);
 window.addEventListener('resize',stop,{passive:true});
 window.addEventListener('pagehide',stop);
 document.addEventListener('visibilitychange',cancelIfHidden);

 return nextPopulated=>{
  // Status changes and the 2nd–20th file require no geometry reads or animation.
  if(populated===nextPopulated)return noop;
  populated=nextPopulated;
  if(!allowed()){stop();return noop;}
  const from=bounds(panel);
  const otherFrom=companions.map(element=>bounds(element));
  stop();
  if(!from)return noop;
  const current=revision;
  return()=>{
   if(current!==revision||!allowed())return;
   const to=bounds(panel);
   if(!to)return;
   const movement=from.top-to.top,heightChange=from.height-to.height;
   if(Math.abs(movement)<1&&Math.abs(heightChange)<1)return;
   shell.classList.add('queue-is-animating');
   try{
    const size=panel.animate([
     {height:`${from.height}px`,maxHeight:`${from.height}px`},
     {height:`${to.height}px`,maxHeight:`${to.height}px`}
    ],timing);
    active.push(size);
    if(Math.abs(movement)>=1)active.push(shell.animate([
     {transform:`translateY(${movement}px)`},{transform:'translateY(0)'}
    ],timing));
    companions.forEach((element,index)=>{
     const before=otherFrom[index],after=bounds(element);
     if(!before||!after||typeof element.animate!=='function')return;
     const offset=before.top-after.top;
     if(Math.abs(offset)>=1)active.push(element.animate([
      {transform:`translateY(${offset}px)`},{transform:'translateY(0)'}
     ],timing));
    });
    size.onfinish=()=>{if(current===revision)stop();};
    size.oncancel=()=>{if(current===revision)stop();};
   }catch{stop();}
  };
 };
}
