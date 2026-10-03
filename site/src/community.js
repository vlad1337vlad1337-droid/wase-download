import {communityCopy} from './community-copy.js';
import {sharePage,shareLink} from './community-policy.js';
import './community.css';
export function initCommunity(){
 const t=communityCopy[document.body.dataset.lang]||communityCopy.en;
 const link=document.getElementById('github-project'),count=document.getElementById('github-stars');
 // This optional request is never part of boot or conversion readiness.
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
 if(link&&count)fetch('/api/github',{signal:controller.signal,credentials:'omit'}).then(r=>r.ok?r.json():null).then(data=>{
  if(data?.repository!=='vlad1337vlad1337-droid/wase-download'||!Number.isSafeInteger(data.stars)||data.stars<0)return;
  count.textContent=new Intl.NumberFormat(document.documentElement.lang).format(data.stars);
  link.setAttribute('aria-label',`${t.star} · ${t.stars}: ${data.stars}`);
 }).catch(()=>{}).finally(()=>clearTimeout(timer));
 else clearTimeout(timer);
 const button=document.getElementById('save-page'),dialog=document.getElementById('save-page-dialog');
 if(!button||!dialog||typeof dialog.showModal!=='function')return;
 let data;try{data=sharePage(document.querySelector('link[rel=canonical]').href,document.title);}catch{return;}
 const input=dialog.querySelector('input'),status=dialog.querySelector('[role=status]'),copy=dialog.querySelector('[data-copy]'),share=dialog.querySelector('[data-share]');
 input.value=data.url;
 dialog.querySelector('kbd').textContent=/Mac|iPhone|iPad/i.test(navigator.userAgentData?.platform||navigator.platform)?'⌘D':'Ctrl+D';
 if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){dialog.querySelector('.bookmark-hint span').textContent=t.mobileBookmark;dialog.querySelector('kbd').hidden=true;}
 share.hidden=typeof navigator.share!=='function'||!!(navigator.canShare&&!navigator.canShare(data));
 button.hidden=false;
 button.onclick=()=>{status.textContent='';copy.textContent=t.copy;dialog.showModal();};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(data.url);status.textContent=t.copied;}catch{input.focus();input.select();status.textContent=t.manual;}};
 share.onclick=async()=>{share.disabled=true;try{const result=await shareLink(navigator,data);if(result==='shared')dialog.close();else if(result==='unavailable'){input.focus();input.select();status.textContent=t.manual;}}finally{share.disabled=false;}};
}
