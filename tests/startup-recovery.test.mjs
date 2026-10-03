// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createThemeController} from '../site/src/theme-policy.js';
import {themeCopy} from '../site/src/theme-copy.js';
import {localeCodes} from '../site/src/locales.js';

const bootCode=readFileSync('site/public/boot.js','utf8');
const languageCode=readFileSync('site/public/language.js','utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function node(){return {hidden:true,children:[],attributes:{},events:{},classList:{add(){},remove(){}},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},addEventListener(key,listener){this.events[key]=listener;},replaceChildren(...children){this.children=children;},remove(){this.removed=true;}};}
function boot({lang='en',early=false,cached=false}={}){
 const classes=new Set(),timers=[],events={},domEvents={},elements={'boot-screen':node(),converter:node()},theme=node(),script={src:'https://wase.download/assets/app-test.js'};
 if(!early&&!cached)elements['startup-recovery']=node();
 const root={lang,dataset:{},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}};
 const document={documentElement:root,readyState:early?'loading':'complete',fonts:{ready:Promise.resolve()},getElementById:id=>elements[id]||null,querySelector:selector=>selector.startsWith('meta')?theme:script,createElement:()=>node(),addEventListener:(name,fn)=>domEvents[name]=fn,body:{firstChild:null,insertBefore(element){elements[element.id]=element;}}};
 let reloads=0;
 const window={addEventListener:(name,fn)=>events[name]=fn,location:{reload(){reloads++;}}};
 vm.runInNewContext(bootCode,{document,window,localStorage:{getItem:()=>null},matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},clearTimeout:timer=>{timer.cleared=true;},requestAnimationFrame:fn=>fn()});
 return {document,root,classes,timers,events,domEvents,elements,window,theme,script,get reloads(){return reloads;}};
}

test('missing app reveals readable content and a localized manual retry without a reload loop',()=>{
 for(const lang of localeCodes){const b=boot({lang});b.timers.find(timer=>timer.ms===6500).fn();
  assert.equal(b.classes.has('is-booting'),false);assert.equal(b.elements['startup-recovery'].hidden,false);assert.equal(b.elements.converter.inert,true);
  const [message,retry]=b.elements['startup-recovery'].children;assert.ok(message.textContent.length>10);assert.ok(retry.textContent);assert.equal(b.reloads,0);retry.events.click();assert.equal(b.reloads,1);
 }
});
test('module error before parsing completes schedules recovery once after DOMContentLoaded',()=>{
 const b=boot({early:true});b.events.error({target:b.script});b.events.error({target:b.script});
 assert.equal(b.classes.has('is-booting'),false);assert.equal(b.elements['startup-recovery'],undefined);assert.ok(b.domEvents.DOMContentLoaded);
 b.elements['startup-recovery']=node();b.document.readyState='interactive';b.domEvents.DOMContentLoaded();
 assert.equal(b.elements['startup-recovery'].hidden,false);assert.equal(b.elements.converter.inert,true);assert.equal(b.reloads,0);
});
test('a newer bootstrap creates recovery for cached HTML without a placeholder',()=>{
 const b=boot({cached:true});b.events.error({target:b.script});assert.equal(b.elements['startup-recovery'].hidden,false);assert.equal(b.elements['startup-recovery'].attributes.role,'status');
});
test('a late initialized app clears recovery without changing its disabled control state',async()=>{
 const b=boot();b.events.error({target:b.script});b.elements.converter.disabled=true;
 b.window.__waseFinishBoot();assert.equal(b.root.dataset.appReady,'true');assert.equal(b.elements['startup-recovery'].hidden,true);assert.equal(b.elements.converter.inert,false);assert.equal(b.elements.converter.disabled,true);
 b.timers.find(timer=>timer.ms===1700).fn();await flush();assert.equal(b.reloads,0);
});
test('a ready app waiting for catalogue is not mistaken for a broken module',()=>{
 const b=boot();b.window.__waseFinishBoot(new Promise(()=>{}));b.timers.find(timer=>timer.ms===6500).fn();
 assert.equal(b.classes.has('is-booting'),false);assert.equal(b.elements['startup-recovery'].hidden,true);assert.equal(b.elements.converter.inert,false);
});
test('an unrelated resource error does not interrupt startup',()=>{
 const b=boot();b.events.error({target:{src:'/other.css'}});assert.equal(b.classes.has('is-booting'),true);assert.equal(b.elements['startup-recovery'].hidden,true);
});

function language({catalogue=true,value='JPEG',formats=['PNG','JPEG'],href='/en/formats/png/',hash='#converter',saved=null,dark=false,readyState='complete'}={}){
 const events={},storage={},theme=node(),root={dataset:{}},observed=[],valueSpan={textContent:value},sourceSpan={textContent:'PNG'},link={lang:'en',getAttribute:()=>href,set href(value){this.destination=value;}},target={_formats:formats,querySelector:()=>valueSpan};
 let changed;
 const document={readyState,documentElement:root,body:{dataset:{catalogue:String(catalogue)}},querySelector:()=>theme,querySelectorAll:selector=>selector.startsWith('.language')?[link]:[sourceSpan,valueSpan],getElementById:()=>target,addEventListener:(name,fn)=>events[name]=fn};
 class MutationObserver{constructor(callback){changed=callback;}observe(value,options){observed.push({value,options});}}
 vm.runInNewContext(languageCode,{document,URL,MutationObserver,location:{pathname:'/ru/formats/png/',origin:'https://wase.download',href:'https://wase.download/ru/formats/png/?to=JPEG&token=private'+hash,search:'?to=JPEG&token=private',hash},navigator:{languages:['ru']},localStorage:{getItem:()=>saved,setItem:(key,value)=>storage[key]=value},matchMedia:()=>({matches:dark})});
 return {link,root,theme,storage,observed,domReady(){document.readyState='interactive';events.DOMContentLoaded?.();},mutate(value,formats){valueSpan.textContent=value;if(formats)target._formats=formats;changed?.();},click(type='click',button=0){events[type]({type,button,target:{closest:()=>link}});}};
}
test('actual language hrefs are ready after DOM parsing and track selected format text without clicking',()=>{
 const l=language({readyState:'loading'});assert.equal(l.link.destination,undefined);l.domReady();
 assert.equal(l.link.destination,'/en/formats/png/?to=jpeg#converter');assert.equal(l.observed.length,2);
 for(const entry of l.observed)assert.deepEqual(JSON.parse(JSON.stringify(entry.options)),{childList:true,characterData:true,subtree:true});
 l.mutate('PNG');assert.equal(l.link.destination,'/en/formats/png/?to=png#converter');
 l.mutate('JPEG',['PNG']);assert.equal(l.link.destination,'/en/formats/png/#converter');
});
test('language click, middle click and context-menu preserve only a validated output and converter anchor',()=>{
 for(const type of ['click','auxclick','contextmenu']){const l=language();l.click(type,type==='auxclick'?1:0);assert.equal(l.link.destination,'/en/formats/png/?to=jpeg#converter');assert.ok(!l.link.destination.includes('private'));}
});
test('unsupported output, private hash and non-catalogue pages do not gain a conversion query',()=>{
 for(const settings of [{value:'SECRET'},{value:'PNG&token=private',formats:['PNG&token=private']},{catalogue:false}]){const l=language({...settings,hash:'#private'});l.click();assert.equal(l.link.destination,'/en/formats/png/');}
 const external=language({href:'https://other.example/en/'});external.click();assert.equal(external.link.destination,undefined);
});
test('language bootstrap synchronizes the browser theme color with saved and system appearance',()=>{
 for(const [saved,dark,expected] of [['dark',false,'#141414'],['light',true,'#E8E8E6'],[null,true,'#141414']]){const l=language({saved,dark});assert.equal(l.theme.attributes.content,expected);}
});
test('footer theme controller synchronizes theme-color on manual and automatic changes',()=>{
 const code=readFileSync('site/src/theme.js','utf8').replace(/^import .*;\n/gm,'').replace('export function initTheme','function initTheme');
 const meta=node(),media={matches:true,addEventListener(name,listener){this.listener=listener;}},root={dataset:{}};
 const context={createThemeController,themeCopy,document:{body:{dataset:{lang:'en'}},documentElement:root,querySelector:selector=>selector.startsWith('meta')?meta:null,addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>media};
 vm.runInNewContext(code+'\nglobalThis.controller=initTheme();',context);
 assert.equal(meta.attributes.content,'#141414');context.controller.choose('light');assert.equal(meta.attributes.content,'#E8E8E6');context.controller.choose('auto');assert.equal(meta.attributes.content,'#141414');media.matches=false;media.listener();assert.equal(meta.attributes.content,'#E8E8E6');
});
