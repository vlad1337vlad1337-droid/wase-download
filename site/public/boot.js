// SPDX-License-Identifier: MIT
(()=>{
 const root=document.documentElement;
 let saved;try{saved=localStorage.getItem('wase-theme')}catch{}
 root.dataset.theme=saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
 root.classList.add('is-booting');
 let finished=false;
 const reveal=()=>{
  if(finished)return;finished=true;clearTimeout(failSafe);
  root.classList.remove('is-booting');
  const screen=document.getElementById('boot-screen');
  if(screen){screen.classList.add('is-leaving');setTimeout(()=>screen.remove(),220)}
 };
 // Keep one short animation cycle, but never trap visitors if startup fails.
 const minimum=new Promise(resolve=>setTimeout(resolve,900));
 const failSafe=setTimeout(reveal,6500);
 window.__waseFinishBoot=(ready=Promise.resolve())=>{
  const fonts=document.fonts?Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,800))]):Promise.resolve();
  Promise.all([minimum,fonts,Promise.resolve(ready).catch(()=>{})]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(reveal)));
 };
 window.addEventListener('pageshow',event=>{if(event.persisted)reveal()});
})();
