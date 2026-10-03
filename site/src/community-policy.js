export function sharePage(canonical,title){
 const url=new URL(canonical);
 if(url.origin!=='https://wase.download'||url.username||url.password)throw new Error('Invalid public page');
 url.search='';url.hash='';
 return {title:String(title).slice(0,200),url:url.href};
}
export async function shareLink(navigator,data){
 if(typeof navigator.share!=='function'||(navigator.canShare&&!navigator.canShare(data)))return 'unavailable';
 try{await navigator.share(data);return 'shared';}catch(error){return error.name==='AbortError'?'cancelled':'unavailable';}
}
