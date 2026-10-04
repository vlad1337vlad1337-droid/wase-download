// SPDX-License-Identifier: MIT
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../site/src/boot-screen.css',import.meta.url),'utf8');
const bootstrapVersion=createHash('sha256').update(readFileSync(new URL('../site/public/boot.js',import.meta.url))).digest('hex').slice(0,16);
export const bootHead=`<style id="boot-critical">${css}</style><script src="/boot.js?v=${bootstrapVersion}"></script>`;
const mascot=(index,position)=>{
 const svg=readFileSync(new URL(`../site/public/mascots/boot-${index}.svg`,import.meta.url),'utf8')
  .replace('class="helper-gaze"','class="boot-gaze"').replace('class="helper-eyes"','class="boot-eyes"');
 return `<span class="boot-friend boot-friend--${position}">${svg}</span>`;
};
const crew=mascot(1,'left')+mascot(0,'center')+mascot(2,'right');
export function bootMarkup(){
 return `<div id="boot-screen" class="boot-screen" aria-hidden="true"><div class="boot-signature"><div class="boot-crew">${crew}</div><div class="boot-wordmark">wase<span>.download</span></div><svg class="boot-underline" viewBox="0 0 260 26" aria-hidden="true"><defs><linearGradient id="boot-colors" x1="0" x2="1"><stop stop-color="#7e73e4"/><stop offset=".58" stop-color="#0097aa"/><stop offset="1" stop-color="#d6593a"/></linearGradient></defs><path d="M5 15Q101 2 253 9" stroke="url(#boot-colors)" pathLength="1"/><path d="M65 23Q144 9 224 16" stroke="#7e73e4" pathLength="1"/></svg></div></div>`;
}
