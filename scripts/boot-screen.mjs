// SPDX-License-Identifier: MIT
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../site/src/boot-screen.css',import.meta.url),'utf8');
const bootstrapVersion=createHash('sha256').update(readFileSync(new URL('../site/public/boot.js',import.meta.url))).digest('hex').slice(0,16);
const mascotPreloads=[0,1,2,3].map(i=>`<link rel="preload" href="/mascots/boot-${i}.svg" as="image" type="image/svg+xml">`).join('');
export const bootHead=`<style id="boot-critical">${css}</style>${mascotPreloads}<script src="/boot.js?v=${bootstrapVersion}"></script>`;

const decimal=value=>Number(value.toFixed(3));
const face=(kind,index,style)=>`<span class="boot-face boot-face--${kind}" style="${style}"><img src="/mascots/boot-${index}.svg" width="180" height="180" alt="" draggable="false"></span>`;

export function bootMarkup(){
 // The resting pile is visible on the first frame. Five staggered rows form
 // a triangle; the original Blobatar SVGs keep their unmodified faces.
 const pile=[];
 for(let row=0;row<5;row++){
  const count=5-row;
  for(let column=0;column<count;column++){
   const index=pile.length;
   const turn=(index*17+row*9)%35-17;
   pile.push(face('resting',(index+row)%4,`--column:${column-(count-1)/2};--row:${row};--turn:${turn}deg`));
  }
 }

 // Thirty-five arrivals share four tiny cached images. Their landing grid
 // changes from 7 x 5 to 5 x 7 in portrait, preserving complete coverage.
 const rain=Array.from({length:35},(_,index)=>{
  const column=index%7,row=4-Math.floor(index/7);
  const portraitColumn=index%5,portraitRow=6-Math.floor(index/5);
  const jitter=((index*19)%9-4)*.4;
  const x=decimal((column+.5)*100/7+(column===0||column===6?0:jitter));
  const y=decimal((row+.5)*20+jitter);
  const portraitX=decimal((portraitColumn+.5)*20+(portraitColumn===0||portraitColumn===4?0:jitter));
  const portraitY=decimal((portraitRow+.5)*100/7+jitter*.6);
  const turn=(index*29)%43-21;
  const delay=180+index*22+(index*13)%17;
  const style=`--x:${x}vw;--y:${y}vh;--portrait-x:${portraitX}vw;--portrait-y:${portraitY}vh;--turn:${turn}deg;--entry-turn:${turn+(index%2?48:-48)}deg;--drift:${(index%5-2)*12}px;--delay:${delay}ms`;
  return face('falling',(index*3+Math.floor(index/7))%4,style);
 }).join('');

 return `<div id="boot-screen" class="boot-screen" aria-hidden="true"><div class="boot-pile">${pile.join('')}</div><div class="boot-rain">${rain}</div></div>`;
}
