// SPDX-License-Identifier: MIT
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../site/src/boot-screen.css',import.meta.url),'utf8');
const bootstrapVersion=createHash('sha256').update(readFileSync(new URL('../site/public/boot.js',import.meta.url))).digest('hex').slice(0,16);
const physicsVersion=createHash('sha256').update(readFileSync(new URL('../site/public/boot-physics.js',import.meta.url))).digest('hex').slice(0,16);
const engineVersion=createHash('sha256').update(readFileSync(new URL('../site/public/vendor/matter-0.20.0.min.js',import.meta.url))).digest('hex').slice(0,16);
const mascotPreloads=[0,1,2,3].map(i=>`<link rel="preload" href="/mascots/boot-${i}.svg" as="image" type="image/svg+xml">`).join('');
export const bootHead=`<style id="boot-critical">${css}</style>${mascotPreloads}<script src="/boot.js?v=${bootstrapVersion}" data-engine="/vendor/matter-0.20.0.min.js?v=${engineVersion}" data-physics="/boot-physics.js?v=${physicsVersion}"></script>`;

const scales=[150,175,150,175];
const face=(kind,index,style='')=>`<span class="boot-face boot-face--${kind}" data-boot-body style="--art-size:${scales[index]}%;${style}"><img src="/mascots/boot-${index}.svg" width="180" height="180" alt="" draggable="false"></span>`;

export function bootMarkup(){
 // This static triangle also serves reduced-motion and missing-engine visitors.
 const pile=[];
 for(let row=0;row<5;row++){
  const count=5-row;
  for(let column=0;column<count;column++){
   const index=pile.length,turn=(index*17+row*9)%25-12;
   pile.push(face('resting',(index+row)%4,`--column:${column-(count-1)/2};--row:${row};--turn:${turn}deg`));
  }
 }
 // Spawn timing, motion and collisions belong exclusively to the physics world.
 const rain=Array.from({length:35},(_,index)=>face('falling',(index*3+Math.floor(index/7))%4)).join('');
 return `<div id="boot-screen" class="boot-screen" aria-hidden="true"><div class="boot-pile">${pile.join('')}</div><div class="boot-rain">${rain}</div></div>`;
}
