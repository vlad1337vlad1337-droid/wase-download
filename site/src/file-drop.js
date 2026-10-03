// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
import './file-drop.css';
import {bindFileDrop} from './file-drop-controller.js';

export function initFileDrop({overlay,canDrop,onFiles,onBlocked,text}){
 if(!overlay)return;
 const title=overlay.querySelector('h2'),hint=overlay.querySelector('p');
 const hide=()=>{if(overlay.open)overlay.close();};
 const unbind=bindFileDrop(window,{
  canDrop,onFiles,onBlocked,
  onState(state){
   if(!state.active){hide();return;}
   overlay.dataset.blocked=String(!state.allowed);
   title.textContent=state.allowed?text.release:text.wait;
   hint.textContent=state.allowed?text.anywhere:text.waitHint;
   if(!overlay.open)overlay.showModal();
  }
 });
 overlay.addEventListener('cancel',event=>{event.preventDefault();unbind.reset();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)unbind.reset();});
 return unbind;
}
