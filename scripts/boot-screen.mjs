// SPDX-License-Identifier: MIT
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../site/src/boot-screen.css',import.meta.url),'utf8');
export const bootHead=`<style id="boot-critical">${css}</style><link rel="preload" href="/fonts/caveat-greetings-v1.ttf" as="font" type="font/ttf" crossorigin><script src="/boot.js"></script>`;
const words={en:'Hello!',ru:'Привет!',zh:'你好!',es:'¡Hola!',fr:'Bonjour!',de:'Hallo!',pt:'Olá!',it:'Ciao!',tr:'Merhaba!',ja:'こんにちは!',ko:'안녕!',ar:'مرحباً!',hi:'नमस्ते!'};
export function bootMarkup(lang){
 const sequence=[lang,...['en','ru','es','zh'].filter(code=>code!==lang)].slice(0,4);
 return `<div id="boot-screen" class="boot-screen" aria-hidden="true"><div class="boot-corners">${[0,1,2,3].map(i=>`<span class="boot-corner boot-corner-${i}"><img src="/mascots/boot-${i}.svg" width="180" height="180" alt=""></span>`).join('')}</div><div class="boot-stage"><div class="boot-greetings">${sequence.map((code,i)=>`<span class="boot-word${i===0?' is-first':''}" lang="${code}" dir="${code==='ar'?'rtl':'ltr'}" style="--greeting-index:${i}">${words[code]}</span>`).join('')}</div><svg class="boot-swoosh" viewBox="0 0 280 24" fill="none"><path d="M8 17C49 6 201 5 270 10M72 21C126 13 212 12 244 15" stroke="#8173e8" stroke-width="3" stroke-linecap="round"/></svg></div></div>`;
}
