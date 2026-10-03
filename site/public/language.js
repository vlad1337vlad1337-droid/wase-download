// SPDX-License-Identifier: MIT
(()=>{
 const supported=["en","ru","zh","es","fr","de","pt","it","tr","ja","ko","ar","hi"];
 let theme;try{theme=localStorage.getItem('wase-theme');}catch{}
 const root=document.documentElement;
 root.dataset.theme=theme==='dark'||theme==='light'?theme:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',root.dataset.theme==='dark'?'#141414':'#E8E8E6');
 if(location.pathname==='/'){
  let saved;try{saved=localStorage.getItem('wase-language');}catch{}
  const candidates=Array.isArray(navigator.languages)&&navigator.languages.length?navigator.languages:[navigator.language];
  const preferred=supported.includes(saved)?saved:candidates.map(value=>String(value||'').toLowerCase().split('-')[0]).find(value=>supported.includes(value))||'en';
  location.replace('/'+preferred+'/'+location.search+location.hash);return;
 }
 const destination=link=>{
  const url=new URL(link.getAttribute('href'),location.href);
  if(url.origin!==location.origin||!supported.includes(url.pathname.split('/')[1]))return;
  // Preserve a validated selected output, never unrelated/private query strings.
  url.search='';url.hash=location.hash==='#converter'?'#converter':'';
  if(document.body?.dataset.catalogue==='true'){
   const target=document.getElementById('target'),value=target?.querySelector('.format-value')?.textContent?.trim();
   if(value&&/^[a-z0-9][a-z0-9._+-]{0,63}$/i.test(value)&&Array.isArray(target._formats)&&target._formats.includes(value))url.searchParams.set('to',value.toLowerCase());
  }
  link.href=url.pathname+url.search+url.hash;
 };
 const sync=()=>document.querySelectorAll('.language a').forEach(destination);
 const bind=()=>{
  sync();
  if(typeof MutationObserver==='function'){
   // Keep actual hrefs ready for copy-link and browsers that navigate directly.
   // Observe only selected-value text, never the large format catalogue or queue.
   const observer=new MutationObserver(sync);
   document.querySelectorAll('.format-select .format-value').forEach(value=>observer.observe(value,{childList:true,characterData:true,subtree:true}));
  }
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
 // Runs before normal navigation, including modified clicks and keyboard activation.
 const activate=event=>{
  if(event.type==='auxclick'&&event.button!==1)return;
  const link=event.target.closest?.('.language a');if(!link)return;
  destination(link);
  const lang=link.lang?.toLowerCase().split('-')[0];if(supported.includes(lang))try{localStorage.setItem('wase-language',lang);}catch{}
 };
 document.addEventListener('click',activate,true);
 document.addEventListener('auxclick',activate,true);
 document.addEventListener('contextmenu',event=>{const link=event.target.closest?.('.language a');if(link)destination(link);},true);
})();
