// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
import {createResultsZip,sameResults} from './zip-results.js';
import {abortable} from './task-lifecycle.js';
import {brandBlob} from '../../backend/output-brand.mjs';
import {initMascots} from './mascots.js';
import {initQueueMotion} from './queue-motion.js';
import {preserveQueueFocus} from './queue-focus.js';
import {initCommunity} from './community.js';
import {initTheme} from './theme.js';
import {browserSelection,browserOutputs,fallbackCopy} from './browser-fallback.js';
import {initFileDrop} from './file-drop.js';
import {fileDropCopy} from './file-drop-copy.js';
import {initFormatDialogs} from './format-dialogs.js';
import {readFormatCache,writeFormatCache,prepareCatalog} from './catalog-cache.js';
import {chooseAutoTarget} from './auto-target.js';
import { strings } from './strings.js';
import {categoryLabels} from './seo.js';
import { inspect,convert } from './convert.js';
import {initResultPreview} from './result-preview.js';
import {outputMime,resultsComplete} from './result-preview-policy.js';
initFormatDialogs();
initCommunity();
const mascotState=initMascots(document.querySelector('.converter-shell'));
const $=id=>document.getElementById(id),t=strings[document.body.dataset.lang]||strings.en;
const store={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};
initTheme();
document.querySelectorAll('.language a').forEach(a=>a.addEventListener('click',()=>store.set('wase-language',a.lang.toLowerCase().split('-')[0])));
document.addEventListener('click',e=>document.querySelectorAll('details.language,details.format-select').forEach(d=>{if(!d.contains(e.target))d.open=false;}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('details.language,details.format-select').forEach(d=>d.open=false);});
// Native values stay internal; every visible picker uses the same lightweight menu.
function syncPickers(){document.querySelectorAll('select').forEach(select=>{const picker=select.nextElementSibling;if(!picker?.classList.contains('choice'))return;const selected=select.selectedOptions[0]?.textContent||'';picker.querySelector('summary span').textContent=selected;picker.querySelector('summary').setAttribute('aria-label',`${picker.dataset.label}: ${selected}`);picker.querySelector('summary').setAttribute('aria-disabled',String(select.disabled));if(select.disabled)picker.open=false;picker.querySelectorAll('button').forEach((button,index)=>{const option=select.options[index];button.disabled=select.disabled||option.disabled;button.setAttribute('aria-selected',String(option.selected));});});}
document.querySelectorAll('select').forEach(select=>{select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');const picker=document.createElement('details');picker.className='choice';picker.dataset.select=select.id;picker.dataset.label=select.parentElement.firstChild.textContent.trim();const summary=document.createElement('summary');summary.innerHTML='<span></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';summary.setAttribute('aria-label',picker.dataset.label);const menu=document.createElement('div');menu.className='choice-menu';menu.setAttribute('role','listbox');for(const option of select.options){const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.dataset.value=option.value;button.setAttribute('role','option');button.onclick=()=>{if(select.disabled||option.disabled)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));syncPickers();picker.open=false;summary.focus();};menu.append(button);}summary.addEventListener('click',event=>{if(select.disabled)event.preventDefault();});picker.append(summary,menu);select.after(picker);select.addEventListener('change',syncPickers);new MutationObserver(syncPickers).observe(select,{attributes:true,subtree:true});picker.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;summary.focus();event.stopPropagation();}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(select.disabled)return;picker.open=true;const buttons=Array.from(menu.querySelectorAll('button:not(:disabled)'));const index=buttons.indexOf(document.activeElement);const step=event.key==='ArrowDown'?1:-1;buttons[index<0?(step===1?0:buttons.length-1):(index+step+buttons.length)%buttons.length]?.focus();}});});
document.addEventListener('click',event=>document.querySelectorAll('.choice').forEach(picker=>{if(!picker.contains(event.target))picker.open=false;}));syncPickers();
const counter=import.meta.env.VITE_METRIKA_ID;
function startAnalytics(){if(!/^\d+$/.test(counter||'')||window.__waseAnalyticsStarted)return;window.__waseAnalyticsStarted=true;window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments);};window.ym.l=Date.now();const script=document.createElement('script');script.src='https://mc.yandex.ru/metrika/tag.js';script.async=true;script.onload=()=>window.ym(Number(counter),'init',{clickmap:false,trackLinks:false,accurateTrackBounce:true,webvisor:false});document.head.append(script);}
if(/^\d+$/.test(counter||'')){$('analytics-settings').hidden=false;const consent=store.get('wase-analytics');if(consent==='yes')startAnalytics();else if(!consent)$('consent').hidden=false;$('analytics-settings').onclick=()=>{$('consent').hidden=false;};document.querySelectorAll('[data-consent]').forEach(b=>b.onclick=()=>{const answer=b.dataset.consent;store.set('wase-analytics',answer);$('consent').hidden=true;if(answer==='yes')startAnalytics();else if(window.__waseAnalyticsStarted){window.ym?.(Number(counter),'destruct');window.location.reload();}});}
let startupReady=Promise.resolve();
if($('converter')){
 const queueMotion=initQueueMotion(document.querySelector('.converter-shell'),$('converter'),{companions:[document.querySelector('.hero'),document.querySelector('.conversion-guide')].filter(Boolean)});
 const requestedOutput=new URLSearchParams(location.search).get('to');
 if(document.body.dataset.catalogue&&requestedOutput&&requestedOutput.length<=64)document.body.dataset.target=requestedOutput.toUpperCase();
 let catalog=null,catalogReady,modeChosen=false,compatible=true,categories={},fileLimit=100;const serverMode=()=>$('processing').value==='server';let items=[],zipBusy=false,busy=false,adding=false,controller=null,target=document.body.dataset.target||'AUTO',nextId=0,archive=null;
 let autoTarget=target==='AUTO';
 const preview=initResultPreview(t);
 const downloadReady=document.createElement('a');downloadReady.id='download-ready';downloadReady.className='primary';downloadReady.hidden=true;$('convert').after(downloadReady);
 const partialZip=document.createElement('a');partialZip.id='archive-ready';partialZip.className='secondary';partialZip.hidden=true;$('download-zip').after(partialZip);
 function clearArchive(){if(archive)URL.revokeObjectURL(archive.url);archive=null;}
 function syncDownloads(finished,locked){
  const primaryFocused=document.activeElement===$('convert'),archiveFocused=document.activeElement===$('download-zip');
  const completed=items.filter(i=>i.result);if(archive&&!sameResults(archive,completed))clearArchive();
  const single=finished&&items.length===1?items[0]:null;
  const ready=!locked&&(single||finished&&archive);
  downloadReady.hidden=!ready;$('convert').hidden=!!ready;
  if(ready){downloadReady.href=single?single.resultUrl:archive.url;downloadReady.download=single?single.outputName:'wase-download.zip';downloadReady.textContent=single?t.download:t.downloadAll;}
  else downloadReady.removeAttribute('href');
  partialZip.hidden=locked||finished||!archive;
  if(!partialZip.hidden){partialZip.href=archive.url;partialZip.download='wase-download.zip';partialZip.textContent=t.zip;}else partialZip.removeAttribute('href');
  if(archive)$('download-zip').hidden=true;
  if(ready&&primaryFocused)downloadReady.focus({preventScroll:true});
  else if(!partialZip.hidden&&archiveFocused)partialZip.focus({preventScroll:true});
 }

 function focusDownloadIfIdle(keyboard){if(keyboard&&[document.body,$('convert'),$('download-zip')].includes(document.activeElement)){const link=!downloadReady.hidden?downloadReady:!partialZip.hidden?partialZip:null;link?.focus({preventScroll:true});}}
 function downloadFile(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;document.body.append(a);a.click();setTimeout(()=>a.remove(),1000);}
 const announce=(message,error=false)=>{$('announcement').textContent=message;$('announcement').classList.toggle('error',error);};
 const size=n=>n>=1048576?`${(n/1048576).toFixed(1)} ${t.mb}`:`${Math.max(1,Math.round(n/1024))} ${t.kb}`;
 function release(item){URL.revokeObjectURL(item.url);if(item.resultUrl)URL.revokeObjectURL(item.resultUrl);}
 function removeItem(item){const index=items.indexOf(item);release(item);items=items.filter(value=>value!==item);refreshTargets();render();const next=items[Math.min(index,items.length-1)];(next?document.querySelector(`.file-row[data-id="${next.id}"] .remove`):$('choose'))?.focus({preventScroll:true});}
 function invalidate(){for(const i of items){if(i.resultUrl)URL.revokeObjectURL(i.resultUrl);delete i.result;delete i.resultUrl;delete i.outputName;i.status='queued';delete i.error;}render();}
 function outputSettings(){const svg=target==='SVG'&&!serverMode();$('edge').parentElement.hidden=serverMode();document.querySelector('.settings').hidden=serverMode();$('quality-setting').hidden=serverMode();$('detail-setting').hidden=!svg;$('colors-setting').hidden=!svg;$('quality-setting').hidden=serverMode()||!['JPG','WEBP'].includes(target);$('format-note').hidden=!svg;}
 function render(){
  const finishMotion=queueMotion(!!items.length||adding);
  const locked=busy||adding||zipBusy;
  const listScroll=$('queue-scroll').scrollTop;
  const restoreFocus=preserveQueueFocus($('file-list'));
  mascotState?.(busy?'processing':items.some(i=>i.error)?'error':items.length&&items.every(i=>i.status==='done')?'success':'idle');$('converter').classList.toggle('is-converting',busy);$('converter').setAttribute('aria-busy',String(busy||adding||zipBusy));$('workspace').hidden=!items.length&&!adding;$('converter').classList.toggle('has-files',!!items.length||adding);$('file-count').textContent=adding&&!items.length?t.reading:`${t.files} · ${items.length}`;$('file-list').replaceChildren();
  for(const i of items){const row=document.createElement('article');row.className='file-row'+(i.status==='working'?' is-working':'');row.dataset.id=String(i.id);
   const img=document.createElement('img');img.hidden=!i.previewable&&!i.result?.blob.type.startsWith('image/');img.loading='lazy';img.decoding='async';img.className='file-preview';img.alt=i.file.name;img.src=i.result?.blob.type.startsWith('image/')?i.resultUrl:i.url;row.append(img);const info=document.createElement('div');info.style.minWidth='0';const name=document.createElement('div');name.className='file-name';name.textContent=i.file.name;info.append(name);
   const meta=document.createElement('div');meta.className='file-meta';meta.textContent=`${i.type}${i.width?` · ${i.width} × ${i.height}`:''} · ${size(i.file.size)}`+(i.result?` → ${target} · ${size(i.result.blob.size)}`:'');info.append(meta);const status=document.createElement('div');status.className='file-status'+(i.status==='done'?' is-done':i.error?' is-error':'');status.textContent=i.error?i.error==='server'?t.serverError:t.errors[i.error]||t.failed:i.status==='working'?t.converting:i.status==='done'?t.done:t.queued;info.append(status);row.append(info);
   if(i.resultUrl){const actions=document.createElement('div');actions.className='result-actions';const view=document.createElement('button');view.type='button';view.className='secondary preview-button';view.textContent=t.preview;view.setAttribute('aria-label',`${t.preview}: ${i.outputName}`);view.onclick=()=>preview(i);actions.append(view);const a=document.createElement('a');a.className='download';a.href=i.resultUrl;a.download=i.outputName;a.textContent=t.download;a.addEventListener('click',()=>a.classList.add('is-saved'),{once:true});actions.append(a);row.append(actions);}const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label',`${t.remove}: ${i.file.name}`);remove.disabled=locked;remove.onclick=()=>removeItem(i);(row.querySelector('.result-actions')||row).append(remove);$('file-list').append(row);
  }
  $('queue-scroll').scrollTop=listScroll;
  const finished=resultsComplete(items);$('convert').textContent=zipBusy?t.zipping:adding?t.reading:busy?t.converting:finished?(items.length===1?t.download:t.downloadAll):t.convert;$('download-zip').hidden=finished||items.filter(i=>i.result).length<2;$('download-zip').disabled=busy||adding||zipBusy;$('convert').disabled=busy||adding||zipBusy||!items.length||!compatible||target==='AUTO';$('cancel').hidden=!(busy||adding||zipBusy);$('clear').disabled=locked;$('choose').disabled=locked;$('choose').childNodes[0].textContent=(items.length?t.add:t.choose)+' ';$('processing').disabled=locked;$('example').disabled=locked;$('paste').disabled=locked;document.querySelectorAll('.format-trigger').forEach(e=>e.disabled=locked||(e.closest('#source')&&items.length>0));document.querySelectorAll('.settings select,.format-grid button').forEach(e=>e.disabled=locked);
  syncDownloads(finished,locked);restoreFocus();finishMotion();
 }
 async function addFiles(files){
  if(busy||adding||zipBusy)return;const selected=Array.from(files);adding=true;controller=new AbortController();const current=controller;render();announce('');
  try{
   if(!modeChosen){await abortable(catalogReady,current.signal);if(catalog){$('processing').value='server';$('processing').onchange();syncPickers();}}
   const space=20-items.length;if(selected.length>space)announce(t.errors.batch,true);
   for(const file of selected.slice(0,space)){
    if(current.signal.aborted)break;
    try{
     let data;
     if(serverMode()){
      if(file.size>fileLimit*1024*1024)throw new Error('size');const lower=file.name.toLowerCase();const type=Object.keys(catalog).filter(x=>lower.endsWith('.'+x)).sort((a,b)=>b.length-a.length)[0];
      if(!catalog?.[type])throw new Error('type');data={type:type.toUpperCase(),url:URL.createObjectURL(file),previewable:/^(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(type)};
     }else{data=await inspect(file,{signal:current.signal});data.previewable=true;}
     if(current.signal.aborted){URL.revokeObjectURL(data.url);break;}
     items.push({...data,file,id:++nextId,status:'queued'});render();
    }catch(e){if(current.signal.aborted)break;const message=e.message==='size'?t.fileTooLarge.replace('{limit}',String(serverMode()?fileLimit:20)):e.message==='type'?t.unsupportedFile:t.errors[e.message]||t.errors.decode;announce(`${file.name}: ${message}`,true);}
   }
  }catch(e){if(!current.signal.aborted)announce(t.errors[e.message]||t.failed,true);}
  finally{
   adding=false;if(controller===current)controller=null;render();
   if(items.length){refreshTargets();const types=new Set(items.map(i=>i.type));$('source').querySelector('.format-value').textContent=types.size===1?items[0].type:'AUTO';}
   if(current.signal.aborted)announce(t.errors.cancelled);
  }
 }
 $('choose').onclick=()=>$('file-input').click();$('file-input').onchange=e=>{addFiles(e.target.files);e.target.value='';};
 initFileDrop({overlay:$('file-drop-overlay'),canDrop:()=>!busy&&!adding&&!zipBusy,onFiles:addFiles,onBlocked:()=>announce((fileDropCopy[document.body.dataset.lang]||fileDropCopy.en).waitHint),text:fileDropCopy[document.body.dataset.lang]||fileDropCopy.en});
 document.addEventListener('paste',e=>{if(e.target.closest?.('input,textarea,[contenteditable=true]'))return;const files=Array.from(e.clipboardData?.items||[]).filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();addFiles(files);}});
 $('paste').onclick=async()=>{if(!navigator.clipboard?.read){announce(t.errors.unsupported,true);return;}try{const clips=await navigator.clipboard.read(),files=[];for(const clip of clips){const type=clip.types.find(x=>x.startsWith('image/'));if(type){const blob=await clip.getType(type);files.push(new File([blob],`clipboard.${type.split('/')[1].replace('jpeg','jpg')}`,{type}));}}if(files.length)await addFiles(files);else announce(t.errors.clipboard,true);}catch{announce(t.errors.unsupported,true);}};
 const categoryNames={all:t.all,...categoryLabels[document.body.dataset.lang]};
function setFormats(id,values){$(id)._formats=values;$(id)._category='all';const list=$(id).querySelector('.category-list');list.replaceChildren();for(const [key,name] of Object.entries(categoryNames)){const button=document.createElement('button');button.type='button';const label=document.createElement('span');label.textContent=name;const count=document.createElement('small');count.textContent=String(values.filter(v=>key==='all'||categories[v.toLowerCase()]===key).length);button.append(label,count);button.disabled=count.textContent==='0';button.dataset.category=key;button.setAttribute('aria-pressed',String(key==='all'));button.onclick=()=>{$(id)._category=key;list.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$(id).querySelector('input').dispatchEvent(new Event('input'));};list.append(button);}if($(id).querySelector('dialog').open)paintFormats(id,values);else{$(id).querySelector('.format-grid').replaceChildren();$(id).querySelector('.picker-empty').hidden=true;}}

 function paintFormats(id,values){$(id).querySelector('.picker-empty').hidden=values.length>0;const grid=$(id).querySelector('.format-grid');grid.replaceChildren(...values.map(value=>{const b=document.createElement('button');b.type='button';b.dataset.format=value;b.textContent=value;b.dir='ltr';b.setAttribute('aria-pressed',String(value===$(id).querySelector('.format-value').textContent));return b;}));}
 function refreshTargets(){
  const wasCompatible=compatible;
  const input=items[0]?.type.toLowerCase()||$('source').querySelector('.format-value').textContent.toLowerCase();
  const inputs=items.length?[...new Set(items.map(i=>i.type.toLowerCase()))]:[input];
  const outputs=!serverMode()?browserOutputs:!catalog?[]:!items.length&&input==='auto'?Array.from(new Set(Object.values(catalog).flatMap(group=>Object.keys(group)))).sort().map(v=>v.toUpperCase()):Object.keys(catalog[inputs[0]]||{}).filter(output=>inputs.every(type=>catalog[type]?.[output])).sort().map(x=>x.toUpperCase());
  compatible=outputs.length>0;
  setFormats('target',outputs.length?['AUTO',...outputs]:[]);
  if(!compatible){if(items.length){$('convert').disabled=true;announce(t.noSharedFormat,true);}return;}
  if(!wasCompatible&&$('announcement').textContent===t.noSharedFormat)announce('');
  const next=autoTarget?(!items.length&&input==='auto'?'AUTO':chooseAutoTarget(inputs,outputs,categories)):outputs.includes(target)?target:chooseAutoTarget(inputs,outputs,categories);
  if(next!==target){target=next;$('target').querySelector('.format-value').textContent=target;invalidate();}
  outputSettings();
 }
 for(const id of ['source','target']){$(id).addEventListener('format-open',()=>$(id).querySelector('input').dispatchEvent(new Event('input')));$(id).querySelector('.format-grid').onclick=e=>{const b=e.target.closest('[data-format]');if(!b||busy||adding||zipBusy)return;const value=b.dataset.format;$(id).querySelector('.format-value').textContent=value;$(id).querySelector('dialog').close();if(id==='target'){target=value;autoTarget=value==='AUTO';refreshTargets();invalidate();outputSettings();}else{if(serverMode()){$('file-input').accept=value==='AUTO'?'':'.'+value.toLowerCase();refreshTargets();}else $('file-input').accept=value==='AUTO'?'image/*':`image/${value==='JPG'?'jpeg':value.toLowerCase()}`;}};$(id).querySelector('input').oninput=e=>{const values=$(id)._formats||Array.from($(id).querySelectorAll('[data-format]')).map(b=>b.dataset.format);paintFormats(id,values.filter(v=>v.toLowerCase().includes(e.target.value.toLowerCase())&&(!$(id)._category||$(id)._category==='all'||categories[v.toLowerCase()]===$(id)._category)));};}
 $('processing').onchange=()=>{modeChosen=true;items.forEach(release);items=[];compatible=true;render();announce('');$('processing-note').textContent=serverMode()?t.serverInfo:t.local;$('dropzone').querySelector('small').textContent=serverMode()?`${fileLimit} ${t.mb} · 20 ${document.body.dataset.lang==='ru'?'файлов':t.files.toLowerCase()}`:`20 ${t.mb} · 20 ${document.body.dataset.lang==='ru'?'файлов':t.files.toLowerCase()}`;document.querySelector('.converter-bottom span').hidden=serverMode();document.querySelector('.converter-bottom span').textContent=t.saving;$('file-input').accept=serverMode()?'':'image/*';setFormats('source',serverMode()?['AUTO',...Object.keys(catalog).sort().map(x=>x.toUpperCase())]:['AUTO','PNG','JPG','WEBP','GIF','BMP','SVG']);setFormats('target',serverMode()?Array.from(new Set(Object.values(catalog).flatMap(group=>Object.keys(group)))).sort().map(v=>v.toUpperCase()):['SVG','PNG','JPG','WEBP','BMP','ICO']);if(!serverMode()){const selection=browserSelection(document.body.dataset.source||'AUTO',target);target=selection.target;if(target==='AUTO')autoTarget=true;$('source').querySelector('.format-value').textContent=selection.source;}$('target').querySelector('.format-value').textContent=target;refreshTargets();outputSettings();};
 document.body.classList.add('catalog-loading');$('processing-note').textContent=t.loading;
 let formatStorage;try{formatStorage=localStorage;}catch{}
 const cachedFormats=readFormatCache(formatStorage);
 const catalogAbort=new AbortController(),catalogTimer=setTimeout(()=>catalogAbort.abort(),4500);
 const refreshCatalog=fetch('/api/formats',{signal:catalogAbort.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{const allowed=prepareCatalog(data);writeFormatCache(formatStorage,allowed);return allowed;}).finally(()=>clearTimeout(catalogTimer));
 // A fresh cached catalogue opens immediately. Revalidation updates the next visit,
 // never resets files or changes the selected format in the current session.
 if(cachedFormats)refreshCatalog.catch(()=>{});
 catalogReady=(cachedFormats?Promise.resolve(cachedFormats):refreshCatalog).then(data=>{const groups=data.groups.map(values=>Object.fromEntries(values.map(v=>[v,true])));categories=data.categories||{};fileLimit=data.limits?.fileMB||100;catalog=Object.fromEntries(Object.entries(data.inputs).map(([input,index])=>[input,groups[index]]));$('processing').querySelector('[value=server]').disabled=false;if(!items.length&&!adding&&!modeChosen){$('processing').value='server';$('processing').onchange();syncPickers();}}).catch(()=>{$('processing').value='browser';$('processing').onchange();syncPickers();announce(fallbackCopy[document.body.dataset.lang]||fallbackCopy.en);}).finally(()=>{document.body.classList.remove('catalog-loading');});
 startupReady=catalogReady;
 document.querySelectorAll('.settings select').forEach(e=>e.addEventListener('change',invalidate));$('clear').onclick=()=>{items.forEach(release);items=[];compatible=true;$('source').querySelector('.format-value').textContent=serverMode()?(document.body.dataset.source||'AUTO'):browserSelection(document.body.dataset.source||'AUTO',target).source;render();announce('');refreshTargets();$('choose').focus({preventScroll:true});};$('cancel').onclick=()=>controller?.abort();
 $('download-zip').onclick=async event=>{
  const keyboard=event?.detail===0;
  if(busy||adding||zipBusy)return;const completed=items.filter(i=>i.result);
  if(sameResults(archive,completed)){downloadFile(archive.url,'wase-download.zip');return;}
  zipBusy=true;controller=new AbortController();const current=controller;render();announce(t.zipping);
  try{
   const blob=await createResultsZip(completed,{signal:current.signal});if(current.signal.aborted)throw new Error('cancelled');
   clearArchive();archive={url:URL.createObjectURL(blob),results:completed.map(item=>({blob:item.result.blob,name:item.outputName}))};
   zipBusy=false;render();downloadFile(archive.url,'wase-download.zip');announce(t.done);
  }catch(e){announce(current.signal.aborted?t.errors.cancelled:e.message==='zipLimit'?t.zipLimit:t.failed,!current.signal.aborted);}
  finally{zipBusy=false;if(controller===current)controller=null;render();focusDownloadIfIdle(keyboard);}
 };
 $('convert').onclick=async event=>{const keyboard=event?.detail===0;if(busy||adding||zipBusy||!items.length||!compatible||target==='AUTO')return;if(resultsComplete(items)){if(items.length>1){$('download-zip').onclick(event);}else{downloadFile(items[0].resultUrl,items[0].outputName);}return;}busy=true;controller=new AbortController();const current=controller,opts={detail:$('detail').value,colors:Number($('colors').value),quality:Number($('quality').value),edge:Number($('edge').value)};render();announce('');for(const i of items){if(current.signal.aborted)break;if(i.status==='done'&&i.result)continue;if(i.resultUrl)URL.revokeObjectURL(i.resultUrl);delete i.resultUrl;delete i.result;delete i.error;i.status='working';render();try{let result;if(serverMode()){const r=await fetch(`/api/convert?from=${encodeURIComponent(i.type.toLowerCase())}&to=${encodeURIComponent(target.toLowerCase())}`,{method:'POST',body:i.file,signal:current.signal});if(!r.ok)throw new Error(r.status===429?'serverBusy':r.status===413?'uploadLimit':'server');const blob=await r.blob();const zipped=r.headers.get('content-type')?.includes('application/zip');result={extension:zipped?'zip':target.toLowerCase(),blob:new Blob([blob],{type:outputMime(zipped?'zip':target)})};}else{result=await convert(i,target,opts,current.signal);result.blob=await brandBlob(result.blob,result.extension||target.toLowerCase());}if(current.signal.aborted)throw new Error('cancelled');i.result=result;i.resultUrl=URL.createObjectURL(result.blob);i.outputName=i.file.name.replace(/\.[^.]+$/,'')+' - wase.download.'+(result.extension||target.toLowerCase());i.status='done';}catch(e){i.error=current.signal.aborted?'cancelled':e.message;i.status='failed';}render();}busy=false;controller=null;render();focusDownloadIfIdle(keyboard);announce(current.signal.aborted?t.errors.cancelled:items.some(i=>i.error)?t.failed:t.done,items.some(i=>i.error));};
 // The built-in example is PNG; do not mislabel it as a document/font fixture.
 $('example').hidden=!['AUTO','PNG','JPG','JPEG','WEBP','GIF','BMP','SVG','AVIF','HEIC','HEIF','TIF','TIFF','ICO'].includes(document.body.dataset.source||'AUTO');
 $('example').onclick=()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const c=canvas.getContext('2d');c.fillStyle='#faf9f6';c.fillRect(0,0,320,240);c.fillStyle='#f44937';c.beginPath();c.arc(130,120,66,0,Math.PI*2);c.fill();c.fillStyle='#252624';c.fillRect(153,57,75,125);canvas.toBlob(b=>{if(b)addFiles([new File([b],'wase-example.png',{type:'image/png'})]);},'image/png');};
 setFormats('source',['AUTO','PNG','JPG','WEBP','GIF','BMP','SVG']);setFormats('target',['AUTO',...browserOutputs]);window.addEventListener('pagehide',e=>{if(!e.persisted){controller?.abort();items.forEach(release);clearArchive();}});outputSettings();render();
}

// Reveal the stable first screen after its catalogue is ready; conversion engines remain lazy.
window.__waseFinishBoot?.(startupReady);
