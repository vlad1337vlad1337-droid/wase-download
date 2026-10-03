// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
export function initMascots(shell){
 if(!shell)return;
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)'),figures=[...shell.querySelectorAll('.helper-figure')];let frame=0,point;
 const reset=()=>figures.forEach(figure=>{figure.style.setProperty('--gaze-x','0px');figure.style.setProperty('--gaze-y','0px');});
 const pause=()=>{shell.classList.toggle('motion-paused',document.hidden||motion.matches);if(document.hidden||motion.matches){cancelAnimationFrame(frame);frame=0;reset();}};
 const follow=event=>{if(!fine.matches||motion.matches||document.hidden||shell.classList.contains('offscreen'))return;point={x:event.clientX,y:event.clientY};if(frame)return;frame=requestAnimationFrame(()=>{frame=0;for(const figure of figures){const r=figure.getBoundingClientRect();const x=Math.max(-1,Math.min(1,(point.x-r.left-r.width/2)/240)),y=Math.max(-1,Math.min(1,(point.y-r.top-r.height/2)/240));figure.style.setProperty('--gaze-x',`${x*3}px`);figure.style.setProperty('--gaze-y',`${y*2.5}px`);}});};
 document.addEventListener('pointermove',follow,{passive:true});document.documentElement.addEventListener('pointerleave',reset);document.addEventListener('visibilitychange',pause);motion.addEventListener('change',pause);pause();
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(([entry])=>{shell.classList.toggle('offscreen',!entry.isIntersecting);if(!entry.isIntersecting)reset();});observer.observe(shell);}
 return state=>{if(shell.dataset.state!==state)shell.dataset.state=state;};
}
