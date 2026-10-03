// SPDX-License-Identifier: MIT
import {abortable} from './task-lifecycle.js';
import {brandBlob} from '../../backend/output-brand.mjs';
export const ZIP_LIMIT=100*1024*1024;
export function archiveName(value,used){
 let name=String(value).replace(/[\\/<>:"|?*\x00-\x1f\x7f]/g,'_').replace(/^[. ]+|[. ]+$/g,'')||'file';
 if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='_'+name;
 const base=name;let suffix=1;while(used.has(name.toLowerCase()))name=`${suffix++}-${base}`;
 used.add(name.toLowerCase());return name;
}
export function sameResults(cached,items){return !!cached&&cached.results.length===items.length&&items.every((item,i)=>cached.results[i].blob===item.result.blob&&cached.results[i].name===item.outputName);}
export async function createResultsZip(items,{signal,maxBytes=ZIP_LIMIT,loadZip=()=>import('fflate'),yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 const cancelled=()=>{if(signal?.aborted)throw new Error('cancelled');};cancelled();
 if(!items.length||items.length>20||items.reduce((size,item)=>size+item.result.blob.size,0)>maxBytes)throw new Error('zipLimit');
 const {Zip,ZipPassThrough}=await abortable(loadZip,signal);cancelled();
 let zip,reader,rejectArchive,settled=false;const chunks=[];
 const archive=new Promise((resolve,reject)=>{rejectArchive=reject;zip=new Zip((error,data,final)=>{if(settled)return;if(error){settled=true;reject(error);return;}chunks.push(data);if(final){settled=true;resolve(new Blob(chunks,{type:'application/zip'}));}});});
 // Attach before streaming: cancellation/errors can reject before awaiting the result.
 archive.catch(()=>{});
 const abort=()=>{zip.terminate();reader?.cancel().catch(()=>{});if(!settled){settled=true;rejectArchive(new Error('cancelled'));}};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const used=new Set();let sinceYield=0;
  for(const item of items){
   cancelled();const entry=new ZipPassThrough(archiveName(item.outputName,used));zip.add(entry);reader=item.result.blob.stream().getReader();
   try{while(true){cancelled();const {done,value}=await reader.read();cancelled();entry.push(value||new Uint8Array(),done);sinceYield+=value?.byteLength||0;if(done)break;if(sinceYield>=1024*1024){sinceYield=0;await yieldTask();}}}
   finally{reader.releaseLock();reader=null;}
  }
  cancelled();zip.end();const archiveResult=await archive;const result=await abortable(()=>brandBlob(archiveResult,'zip'),signal);cancelled();return result;
 }catch(error){zip.terminate();if(!settled){settled=true;rejectArchive(error);}throw error;}
 finally{signal?.removeEventListener('abort',abort);chunks.length=0;}
}
