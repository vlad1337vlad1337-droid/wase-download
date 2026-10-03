// SPDX-License-Identifier: MIT
import {readFileSync} from 'node:fs';
import {strings} from '../site/src/strings.js';

const css=readFileSync(new URL('../site/src/boot-screen.css',import.meta.url),'utf8');
export const bootHead=`<style id="boot-critical">${css}</style><link rel="preload" href="/fonts/caveat-converter-v1.woff2" as="font" type="font/woff2" crossorigin><script src="/boot.js"></script>`;
export function bootMarkup(lang){
 const sequence=[lang,...['en','ru','zh','es'].filter(code=>code!==lang)].slice(0,4);
 return `<div id="boot-screen" class="boot-screen" aria-hidden="true"><div class="boot-corners">${[0,1,2,3].map(i=>`<span class="boot-corner boot-corner-${i}"><img src="/mascots/boot-${i}.svg" width="180" height="180" alt=""></span>`).join('')}</div><div class="boot-stage"><div class="boot-greetings">${sequence.map((code,i)=>`<span class="boot-word${i===0?' is-first':''}" lang="${code}" dir="${code==='ar'?'rtl':'ltr'}" style="--word-index:${i}">${strings[code].title}</span>`).join('')}</div><div class="boot-signature"><p class="boot-brand">wase.download</p><svg class="boot-swoosh" viewBox="0 0 360 74" preserveAspectRatio="none" fill="none"><path pathLength="1" d="M8 22C75 2 231 2 352 12M76 64C146 41 272 39 326 49" stroke="#8173e8" stroke-width="3" stroke-linecap="round"/></svg></div></div></div>`;
}
