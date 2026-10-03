// SPDX-License-Identifier: MIT
import './theme.css';
import {themeCopy} from './theme-copy.js';
import {createThemeController} from './theme-policy.js';

export function initTheme(){
 const picker=document.querySelector('.theme-choice');
 const summary=picker?.querySelector('summary');
 const label=picker?.querySelector('[data-theme-label]');
 const choices=Array.from(picker?.querySelectorAll('[data-theme-choice]')||[]);
 const copy=themeCopy[document.body.dataset.lang]||themeCopy.en;
 let storage;try{storage=localStorage;}catch{}
 const controller=createThemeController({storage,media:matchMedia('(prefers-color-scheme: dark)'),apply:(color,preference)=>{
  document.documentElement.dataset.theme=color;
  if(label)label.textContent=copy[preference];
  summary?.setAttribute('aria-label',`${copy.theme}: ${copy[preference]}`);
  picker?.setAttribute('data-preference',preference);
  for(const button of choices)button.setAttribute('aria-pressed',String(button.dataset.themeChoice===preference));
 }});
 for(const button of choices)button.addEventListener('click',()=>{
  controller.choose(button.dataset.themeChoice);picker.open=false;summary.focus();
 });
 document.addEventListener('click',event=>{if(picker&&!picker.contains(event.target))picker.open=false;});
 picker?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){picker.open=false;summary.focus();event.stopPropagation();}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();picker.open=true;
   const index=choices.indexOf(document.activeElement),step=event.key==='ArrowDown'?1:-1;
   choices[index<0?(step===1?0:choices.length-1):(index+step+choices.length)%choices.length]?.focus();
  }
 });
 window.addEventListener('storage',event=>{if(event.key==='wase-theme'||event.key===null)controller.refresh();});
 return controller;
}
