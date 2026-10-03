// SPDX-License-Identifier: MIT
import {previewKind,previewLimit} from './result-preview-policy.js';

export function initResultPreview(t){
 const dialog=document.createElement('dialog');dialog.className='result-preview';dialog.setAttribute('aria-labelledby','result-preview-title');
 const panel=document.createElement('div');panel.className='result-preview-panel';
 const header=document.createElement('header');header.className='result-preview-header';
 const title=document.createElement('h2');title.id='result-preview-title';title.textContent=t.previewTitle;
 const close=document.createElement('button');close.type='button';close.className='picker-close';close.setAttribute('aria-label',t.close);close.onclick=()=>dialog.close();header.append(title,close);
 const content=document.createElement('div');content.className='result-preview-content';content.setAttribute('aria-live','polite');
 const footer=document.createElement('footer');footer.className='result-preview-footer';const name=document.createElement('span');const download=document.createElement('a');download.className='download';download.textContent=t.download;footer.append(name,download);panel.append(header,content,footer);dialog.append(panel);document.body.append(dialog);
 let generation=0,previewId,pdfCleanup;
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{generation++;pdfCleanup?.();pdfCleanup=null;for(const media of content.querySelectorAll('audio,video')){media.pause();media.removeAttribute('src');media.load();}content.replaceChildren();requestAnimationFrame(()=>{(document.querySelector(`.file-row[data-id="${previewId}"] .preview-button`)||document.getElementById('choose'))?.focus();});});
 const message=text=>{const p=document.createElement('p');p.textContent=text;content.replaceChildren(p);};
 return async item=>{
  const current=++generation;previewId=item.id;name.textContent=item.outputName;download.href=item.resultUrl;download.download=item.outputName;content.replaceChildren();dialog.showModal();close.focus();
  const kind=previewKind(item.result.extension);if(item.result.blob.size>previewLimit(kind)){message(t.previewTooLarge);return;}
  if(kind==='unavailable'){message(t.previewUnavailable);return;}
  if(kind==='pdf'){
   message(t.previewLoading);
   try{const {renderPDF}=await import('./pdf-preview.js');if(current!==generation||!dialog.open)return;content.replaceChildren();const caption=document.createElement('p');caption.textContent=t.previewFirstPage;const canvas=document.createElement('div');canvas.className='pdf-canvas';content.append(caption,canvas);const cleanup=await renderPDF(item.result.blob,canvas,{isCurrent:()=>current===generation&&dialog.open});if(current!==generation||!dialog.open)cleanup?.();else pdfCleanup=cleanup;}catch{if(current===generation&&dialog.open)message(t.previewUnavailable);}return;
  }
  if(kind==='text'){
   message(t.previewLoading);
   try{const text=await item.result.blob.text();if(current!==generation||!dialog.open)return;const pre=document.createElement('pre');pre.textContent=text;pre.dir='auto';content.replaceChildren(pre);}catch{if(current===generation)message(t.previewError);}return;
  }
  const media=document.createElement(kind==='image'?'img':kind);media.src=item.resultUrl;
  if(kind==='image')media.alt=item.outputName;else{media.controls=true;media.preload='metadata';if(kind==='video')media.playsInline=true;}
  media.onerror=()=>{if(current===generation&&dialog.open)message(t.previewUnavailable);};content.append(media);
 };
}
