// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors

// During OS drags the data store is protected: files can be empty until drop.
export function hasFiles(transfer){
 return !!transfer&&(Array.from(transfer.types||[]).includes('Files')||
  Array.from(transfer.items||[]).some(item=>item.kind==='file')||!!transfer.files?.length);
}

export function bindFileDrop(target,{canDrop=()=>true,onFiles,onBlocked=()=>{},onState=()=>{}}){
 let depth=0,active=false,allowed;
 const reset=()=>{depth=0;if(active){active=false;allowed=undefined;onState({active:false});}};
 const show=()=>{const next=canDrop();if(!active||allowed!==next){active=true;allowed=next;onState({active:true,allowed});}};
 const enter=event=>{if(!hasFiles(event.dataTransfer))return;event.preventDefault();depth++;show();};
 const over=event=>{
  if(!hasFiles(event.dataTransfer))return;
  event.preventDefault();depth=Math.max(1,depth);show();
  event.dataTransfer.dropEffect=allowed?'copy':'none';
 };
 const leave=()=>{if(active&&--depth<=0)reset();};
 const drop=event=>{
  if(!hasFiles(event.dataTransfer)){reset();return;}
  event.preventDefault();
  const accepted=canDrop();
  const files=Array.from(event.dataTransfer.files||[]);
  reset();
  if(!accepted){onBlocked();return;}
  // Some engines expose items but not files on a synthetic/embedded drop.
  if(!files.length)for(const item of Array.from(event.dataTransfer.items||[])){
   if(item.kind==='file'){const file=item.getAsFile?.();if(file)files.push(file);}
  }
  if(files.length)onFiles(files);
 };
 const escape=event=>{if(active&&event.key==='Escape'){event.preventDefault();reset();}};
 const listeners={dragenter:enter,dragover:over,dragleave:leave,drop,dragend:reset,blur:reset,pagehide:reset,keydown:escape};
 for(const [name,listener]of Object.entries(listeners))target.addEventListener(name,listener,{capture:true});
 const unbind=()=>{reset();for(const [name,listener]of Object.entries(listeners))target.removeEventListener(name,listener,{capture:true});};
 unbind.reset=reset;
 return unbind;
}
