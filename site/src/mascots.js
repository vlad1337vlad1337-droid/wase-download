// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
import './mascot-processing.css';

export function initMascots(shell){
 if(!shell)return;
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)'),figures=[...shell.querySelectorAll('.helper-figure')];let frame=0,point;
 const reset=()=>figures.forEach(figure=>{figure.style.setProperty('--gaze-x','0px');figure.style.setProperty('--gaze-y','0px');});
 const stopTracking=()=>{cancelAnimationFrame(frame);frame=0;point=undefined;reset();};
 const canFollow=()=>fine.matches&&!motion.matches&&!document.hidden&&!shell.classList.contains('offscreen')&&shell.dataset.state!=='processing';
 const pause=()=>{shell.classList.toggle('motion-paused',document.hidden||motion.matches);if(document.hidden||motion.matches)stopTracking();};
 const follow=event=>{if(!canFollow())return;point={x:event.clientX,y:event.clientY};if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(!canFollow()||!point)return;for(const figure of figures){const r=figure.getBoundingClientRect();const x=Math.max(-1,Math.min(1,(point.x-r.left-r.width/2)/240)),y=Math.max(-1,Math.min(1,(point.y-r.top-r.height/2)/240));figure.style.setProperty('--gaze-x',`${x*3}px`);figure.style.setProperty('--gaze-y',`${y*2.5}px`);}});};
 document.addEventListener('pointermove',follow,{passive:true});document.documentElement.addEventListener('pointerleave',reset);document.addEventListener('visibilitychange',pause);if(motion.addEventListener)motion.addEventListener('change',pause);else motion.addListener?.(pause);pause();
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(([entry])=>{shell.classList.toggle('offscreen',!entry.isIntersecting);if(!entry.isIntersecting)stopTracking();});observer.observe(shell);}
 return state=>{if(shell.dataset.state!==state){stopTracking();shell.dataset.state=state;}};
}
