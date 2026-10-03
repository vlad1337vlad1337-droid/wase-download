// Public, tokenless metadata. Visitors never cause arbitrary outbound requests.
export const repository='vlad1337vlad1337-droid/wase-download';
const upstream=`https://api.github.com/repos/${repository}/stargazers/count`;
export function githubStats({fetcher=fetch,now=Date.now,ttl=900000,retry=60000,timeout=3000}={}){
 let cached=null,pending=null,nextAttempt=0;
 async function refresh(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
   const response=await fetcher(upstream,{signal:controller.signal,redirect:'error',headers:{Accept:'application/vnd.github+json','User-Agent':'wase.download','X-GitHub-Api-Version':'2026-03-10'}});
   if(!response.ok)throw new Error('GitHub unavailable');
   if(Number(response.headers.get('content-length'))>4096)throw new Error('Metadata too large');
   const reader=response.body.getReader();let length=0;const chunks=[];
   try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>4096)throw new Error('Metadata too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!Number.isSafeInteger(value.count)||value.count<0)throw new Error('Invalid star count');
   cached={stars:value.count,updatedAt:new Date(now()).toISOString()};nextAttempt=now()+ttl;
  }catch{nextAttempt=now()+retry;}
  finally{clearTimeout(timer);}
 }
 return async()=>{
  if(now()>=nextAttempt){if(!pending)pending=refresh().finally(()=>{pending=null;});await pending;}
  return {repository,stars:cached?.stars??null,updatedAt:cached?.updatedAt??null,stale:!cached||now()-Date.parse(cached.updatedAt)>=ttl};
 };
}
