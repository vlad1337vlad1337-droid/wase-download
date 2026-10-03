// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
// PDF.js is loaded only when a user opens a PDF result, never during page boot.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

const MAX_FILE_BYTES=32*1024*1024,MAX_CANVAS_PIXELS=2_000_000,MAX_CANVAS_EDGE=4096;
// Vite emits these immutable assets locally; PDF-selected URLs are never fetched.
const assetUrls=import.meta.glob('../../node_modules/pdfjs-dist/{cmaps/*.bcmap,standard_fonts/*.{pfb,ttf},wasm/{openjpeg,jbig2,qcms_bg}.wasm}',{eager:true,query:'?url',import:'default'});
const assetNames=new Map(Object.entries(assetUrls).map(([path,url])=>[path.split('/').at(-1),url]));
const abortError=()=>new DOMException('PDF preview cancelled','AbortError');

export async function renderPDF(blob,container,{isCurrent=()=>true}={}){
 if(!blob||!Number.isFinite(blob.size)||blob.size===0||blob.size>MAX_FILE_BYTES)throw new Error('PDF preview size limit');
 let disposed=false,loadingTask,pdfDocument,pdfWorker,nativeWorker,renderTask,canvas,monitor,deadline,destroying;
 const assetAbort=new AbortController();
 let cancelWait;const cancelled=new Promise((_,reject)=>{cancelWait=reject;});cancelled.catch(()=>{});
 const wait=promise=>Promise.race([promise,cancelled]);
 const current=()=>!disposed&&isCurrent();
 const cleanup=()=>{
  if(disposed)return destroying||Promise.resolve();
  disposed=true;clearInterval(monitor);clearTimeout(deadline);assetAbort.abort();cancelWait(abortError());try{renderTask?.cancel();}catch{}
  if(canvas){canvas.width=0;canvas.height=0;}
  // Stop the parser even if malformed input prevents a graceful worker reply.
  let hardStop;const forced=new Promise(resolve=>{hardStop=setTimeout(resolve,500);});
  const stop=Promise.resolve().then(()=>pdfDocument?pdfDocument.destroy():loadingTask?loadingTask.destroy():undefined).catch(()=>{});
  destroying=Promise.race([stop,forced]).finally(()=>{clearTimeout(hardStop);try{pdfWorker?.destroy();}finally{nativeWorker?.terminate();}}).catch(()=>{});
  return destroying;
 };
 const assertCurrent=()=>{if(!current())throw abortError();};
 monitor=setInterval(()=>{if(!isCurrent())cleanup();},100);
 deadline=setTimeout(cleanup,20_000);
 try{
  const pdfjs=await wait(import('pdfjs-dist/legacy/build/pdf.mjs'));assertCurrent();
  nativeWorker=new Worker(workerUrl,{type:'module',name:'wase-pdf-preview'});
  pdfWorker=pdfjs.PDFWorker.create({port:nativeWorker,verbosity:0});
  class LocalAssets{
   async fetch({kind,filename}){
    if(!['cMapUrl','standardFontDataUrl','wasmUrl'].includes(kind))throw new Error('Unsupported PDF asset');
    const url=assetNames.get(filename);if(!url)throw new Error('Unknown PDF asset');assertCurrent();
    const response=await fetch(url,{signal:assetAbort.signal,credentials:'omit',cache:'force-cache'});
    if(!response.ok)throw new Error('Unavailable PDF asset');
    return new Uint8Array(await response.arrayBuffer());
   }
  }
  const data=new Uint8Array(await wait(blob.arrayBuffer()));assertCurrent();
  loadingTask=pdfjs.getDocument({
   data,worker:pdfWorker,BinaryDataFactory:LocalAssets,useWorkerFetch:false,
   isEvalSupported:false,enableXfa:false,disableFontFace:true,useSystemFonts:false,
   maxImageSize:8_000_000,canvasMaxAreaInBytes:8_000_000,
   disableRange:true,disableStream:true,disableAutoFetch:true,stopAtErrors:true,verbosity:0
  });
  pdfDocument=await wait(loadingTask.promise);assertCurrent();
  const page=await wait(pdfDocument.getPage(1));assertCurrent();
  const base=page.getViewport({scale:1});
  if(!Number.isFinite(base.width)||!Number.isFinite(base.height)||base.width<=0||base.height<=0)throw new Error('Invalid PDF page');
  const ratio=Math.min(2,Math.max(1,globalThis.devicePixelRatio||1));
  const width=Math.max(160,Math.min(760,container.clientWidth-24));
  const height=Math.max(160,globalThis.innerHeight-220);
  const scale=Math.min(2*ratio,width/base.width*ratio,height/base.height*ratio,Math.sqrt(MAX_CANVAS_PIXELS/(base.width*base.height)),MAX_CANVAS_EDGE/base.width,MAX_CANVAS_EDGE/base.height);
  const viewport=page.getViewport({scale});
  canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(viewport.width));canvas.height=Math.max(1,Math.floor(viewport.height));
  if(canvas.width*canvas.height>MAX_CANVAS_PIXELS)throw new Error('PDF canvas size limit');
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`PDF · 1 / ${pdfDocument.numPages}`);
  const surface=document.createElement('div');surface.className='pdf-preview-surface';surface.append(canvas);
  const count=document.createElement('span');count.className='pdf-page-count';count.textContent=`1 / ${pdfDocument.numPages}`;count.dir='ltr';surface.append(count);assertCurrent();container.replaceChildren(surface);
  renderTask=page.render({canvas,viewport,annotationMode:pdfjs.AnnotationMode.DISABLE,background:'#ffffff'});
  renderTask.onContinue=resume=>{if(current())requestAnimationFrame(()=>{if(current())resume();else renderTask.cancel();});else renderTask.cancel();};
  await wait(renderTask.promise);assertCurrent();page.cleanup();
  clearTimeout(deadline);
  return cleanup;
 }catch(error){await cleanup();throw error;}
}
