// SPDX-License-Identifier: MIT
(()=>{
 const root=document.documentElement;
 let saved;try{saved=localStorage.getItem('wase-theme')}catch{}
 root.dataset.theme=saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',root.dataset.theme==='dark'?'#141414':'#E8E8E6');
 root.classList.add('is-booting');
 let finished=false,initialized=false,recoveryPending=false;
 const recoveryCopy={
  en:['The interface could not start. Page information is still available.','Try again'],
  ru:['Не удалось запустить интерфейс. Информация на странице доступна.','Попробовать снова'],
  zh:['界面未能启动。页面信息仍可阅读。','重试'],
  es:['La interfaz no pudo iniciarse. La información de la página sigue disponible.','Reintentar'],
  fr:['L’interface n’a pas pu démarrer. Les informations de la page restent disponibles.','Réessayer'],
  de:['Die Oberfläche konnte nicht starten. Die Informationen auf der Seite bleiben verfügbar.','Erneut versuchen'],
  pt:['A interface não pôde iniciar. As informações da página continuam disponíveis.','Tentar novamente'],
  it:['L’interfaccia non si è avviata. Le informazioni della pagina restano disponibili.','Riprova'],
  tr:['Arayüz başlatılamadı. Sayfadaki bilgiler hâlâ kullanılabilir.','Yeniden dene'],
  ja:['画面を起動できませんでした。ページの情報は引き続き読めます。','再試行'],
  ko:['화면을 시작하지 못했습니다. 페이지 정보는 계속 읽을 수 있습니다.','다시 시도'],
  ar:['تعذّر تشغيل الواجهة. تبقى معلومات الصفحة متاحة.','حاول مجددًا'],
  hi:['इंटरफ़ेस शुरू नहीं हो सका। पेज की जानकारी अब भी उपलब्ध है।','फिर कोशिश करें']
 };
 const reveal=()=>{
  if(finished)return;finished=true;clearTimeout(failSafe);
  root.classList.remove('is-booting');
  const screen=document.getElementById('boot-screen');
  if(screen){screen.classList.add('is-leaving');setTimeout(()=>screen.remove(),400)}
 };
 const clearRecovery=()=>{
  const panel=document.getElementById('startup-recovery');if(panel)panel.hidden=true;
  const converter=document.getElementById('converter');if(converter){converter.inert=false;converter.removeAttribute('aria-disabled');}
 };
 const recover=()=>{
  if(initialized){reveal();return;}
  reveal();
  let panel=document.getElementById('startup-recovery');
  if(!panel){
   if(document.readyState==='loading'){
    if(!recoveryPending){recoveryPending=true;document.addEventListener('DOMContentLoaded',()=>{recoveryPending=false;recover();},{once:true});}
    return;
   }
   // Also support an older cached HTML page served with the newer bootstrap.
   if(!document.body)return;
   panel=document.createElement('aside');panel.id='startup-recovery';panel.className='startup-recovery';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
   document.body.insertBefore(panel,document.body.firstChild);
  }
  const [message,retry]=recoveryCopy[document.documentElement.lang.split('-')[0]]||recoveryCopy.en;
  const text=document.createElement('p');text.textContent=message;
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=retry;
  button.addEventListener('click',()=>window.location.reload());
  panel.replaceChildren(text,button);panel.hidden=false;
  const converter=document.getElementById('converter');if(converter){converter.inert=true;converter.setAttribute('aria-disabled','true');}
 };
 // Keep one short animation cycle, but never trap visitors if startup fails.
 const minimum=new Promise(resolve=>setTimeout(resolve,1700));
 const failSafe=setTimeout(recover,6500);
 window.__waseFinishBoot=(ready=Promise.resolve())=>{
  // Reaching this call proves the app installed its handlers. Catalogue readiness
  // is separate: a slow optional request must not be reported as a failed app.
  initialized=true;root.dataset.appReady='true';clearRecovery();
  const fonts=document.fonts?Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,800))]):Promise.resolve();
  Promise.all([minimum,fonts,Promise.resolve(ready).catch(()=>{})]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(reveal)));
 };
 window.addEventListener('error',event=>{
  if(initialized)return;
  const script=document.querySelector('script[type="module"][src]');
  if(event.target===script||(script&&event.filename===script.src))recover();
 },true);
 window.addEventListener('pageshow',event=>{if(event.persisted)reveal()});
})();
