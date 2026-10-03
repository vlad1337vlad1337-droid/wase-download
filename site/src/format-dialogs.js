// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
export function initFormatDialogs(){
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 for(const picker of document.querySelectorAll('.format-select')){
  const dialog=picker.querySelector('dialog'),trigger=picker.querySelector('.format-trigger');let closing=false;
  const close=async()=>{if(closing||!dialog.open)return;closing=true;if(!motion.matches&&dialog.animate)await dialog.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(24px)'}],{duration:140,easing:'ease-in'}).finished.catch(()=>{});dialog.close();closing=false;};
  trigger.addEventListener('click',()=>{if(trigger.disabled)return;document.querySelectorAll('.format-dialog[open]').forEach(other=>other.close());dialog.showModal();picker.dispatchEvent(new Event('format-open'));trigger.setAttribute('aria-expanded','true');if(!motion.matches&&dialog.animate)dialog.animate([{opacity:0,transform:'translateX(24px)'},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}},true);dialog.querySelector('.picker-close').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('click',event=>{if(event.target===dialog)close();});dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');closing=false;});
 }
 for(const details of document.querySelectorAll('.settings,.conversion-guide,.format-group,.language'))details.addEventListener('toggle',()=>{if(details.open&&!motion.matches&&details.animate)details.animate([{opacity:.5},{opacity:1}],{duration:160});});
}
