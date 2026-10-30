// Paused conversion intake recovers by itself once Docker confirms that no
// job container, labeled job volume or job directory remains. Nothing here
// touches resources outside the exact Wase job names created by server.mjs.
export const containerPattern=/^wase-wase-job-[A-Za-z0-9]+-\d+$/;
export const directoryPattern=/^wase-job-[A-Za-z0-9]+$/;
export function jobNames(text){return [...new Set(String(text).split('\n').map(line=>line.trim().replace(/^\//,'')).filter(name=>containerPattern.test(name)))].sort();}
const empty=found=>!found.containers.length&&!found.volumes.length&&!found.directories.length;
const describe=found=>`${found.containers.length} container(s), ${found.volumes.length} volume(s), ${found.directories.length} job folder(s)`;
// inspect() lists leftovers, remove() deletes them, idle() is true when no
// upload or conversion still owns a job. Timers are unref'd: they never keep a
// stopping process alive.
export function intakeRecovery({inspect,remove,idle=()=>true,recheckMs=45000,alertMs=300000,alert=null,log=console.error,now=Date.now}){
 let paused=false,stopped=false,pausedAt=0,timer=null,alertTimer=null,alerted=false,report='',checking=null;
 const later=(fn,ms)=>{const handle=setTimeout(fn,ms);handle.unref?.();return handle;};
 const seconds=()=>Math.round((now()-pausedAt)/1000);
 function schedule(){if(paused&&!stopped&&!timer)timer=later(()=>{timer=null;check();},recheckMs);}
 function notify(text){if(!alert)return;Promise.resolve().then(()=>alert(text)).catch(()=>{});}
 function resume(){
  paused=false;clearTimeout(timer);clearTimeout(alertTimer);timer=alertTimer=null;report='';
  log(`Converter cleanup confirmed after ${seconds()} s; conversion intake resumed.`);
  if(alerted)notify(`wase.download: conversion intake resumed after ${seconds()} s.`);
 }
 async function inspectSafely(){try{return await inspect();}catch{return null;}}
 async function check(){
  if(checking)return checking;
  checking=(async()=>{
   if(!paused||stopped)return;
   // Live requests own their containers and directories; wait for them.
   if(!idle())return;
   let found=await inspectSafely();
   if(found&&!empty(found)){
    const next=describe(found);if(next!==report){report=next;log(`Conversion intake still paused: ${next} remain; removing them.`);}
    try{await remove(found);}catch{}
    found=await inspectSafely();
   }
   if(!found){if(report!=='docker'){report='docker';log('Conversion intake still paused: Docker did not answer the cleanup check.');}return;}
   if(empty(found)&&paused&&!stopped&&idle())resume();
  })().finally(()=>{checking=null;schedule();});
  return checking;
 }
 return {
  get paused(){return paused;},
  pause(){
   if(paused||stopped)return;
   paused=true;pausedAt=now();alerted=false;report='';
   log(`Converter cleanup could not be confirmed; conversion intake paused. Rechecking Docker every ${Math.round(recheckMs/1000)} s and resuming automatically once no job containers, volumes or directories remain.`);
   schedule();
   if(alert&&alertMs>=0)alertTimer=later(()=>{alertTimer=null;if(!paused||stopped)return;alerted=true;notify(`wase.download: conversion intake has been paused for ${Math.round(alertMs/60000)} min; Docker cleanup is still unconfirmed. The API retries every ${Math.round(recheckMs/1000)} s.`);},alertMs);
  },
  check,
  stop(){stopped=true;clearTimeout(timer);clearTimeout(alertTimer);timer=alertTimer=null;}
 };
}
// A failed or slow optional webhook never affects conversions. The URL is not
// logged because it commonly embeds a token.
export function webhookAlert(url,{timeout=5000,log=console.error}={}){
 if(!url)return null;
 let target;try{target=new URL(url);}catch{}
 if(!target||!['https:','http:'].includes(target.protocol)){log('ALERT_WEBHOOK_URL ignored: it must be an http(s) URL.');return null;}
 return async text=>{
  try{const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),redirect:'error',signal:AbortSignal.timeout(timeout)});await response.body?.cancel();if(!response.ok)log(`Converter alert webhook answered HTTP ${response.status}.`);}
  catch(error){log(`Converter alert webhook failed: ${error.name}.`);}
 };
}
