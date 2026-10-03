// SPDX-License-Identifier: MIT
// Stop waiting immediately on cancellation, even when a browser operation has
// no native abort API. A late callback remains observed but cannot win the race.
export function abortable(operation,signal,{timeout=0,timeoutError='timeout',onCancel}={}){
 return new Promise((resolve,reject)=>{
  let settled=false,timer;
  const finish=(error,value)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
   error?reject(error):resolve(value);
  };
  const cancel=message=>{
   if(settled)return;
   finish(new Error(message));
   try{onCancel?.();}catch{}
  };
  const abort=()=>cancel('cancelled');
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  else if(Number.isFinite(timeout)&&timeout>0)timer=setTimeout(()=>cancel(timeoutError),timeout);
  let pending;
  try{
   if(typeof operation==='function'){if(settled)return;pending=operation();}
   else pending=operation;
  }catch(error){finish(error);return;}
  Promise.resolve(pending).then(value=>finish(null,value),error=>finish(error));
 });
}
