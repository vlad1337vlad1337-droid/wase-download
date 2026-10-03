import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bootHead,bootMarkup} from '../scripts/boot-screen.mjs';
import {localeCodes} from '../site/src/locales.js';

test('all locales get a bounded decorative pile using only the four original mascot assets',()=>{
 for(const lang of localeCodes){
  const html=bootMarkup(lang);
  assert.equal((html.match(/boot-face--resting/g)||[]).length,15);
  assert.equal((html.match(/boot-face--falling/g)||[]).length,35);
  assert.equal((html.match(/<img /g)||[]).length,50);
  assert.equal((html.match(/alt=""/g)||[]).length,50);
  assert.deepEqual([...new Set([...html.matchAll(/src="([^"]+)"/g)].map(match=>match[1]))].sort(),[0,1,2,3].map(i=>`/mascots/boot-${i}.svg`));
  assert.match(html,/aria-hidden="true"/);
  assert.doesNotMatch(html,/boot-corner|boot-word|boot-brand|boot-swoosh|<svg|<canvas|<script/);
 }
});

test('arrival cadence fills the screen within the 1700ms boot minimum',()=>{
 const html=bootMarkup('en');
 const delays=[...html.matchAll(/--delay:(\d+)ms/g)].map(match=>Number(match[1]));
 assert.equal(delays.length,35);
 assert.ok(Math.min(...delays)>=150,'initial triangle has a visible first beat');
 assert.ok(Math.max(...delays)+640<=1700,'last arrival settles before boot minimum');
 assert.equal(new Set(delays).size,35,'arrivals are staggered');
 for(const match of html.matchAll(/--(?:portrait-)?([xy]):([\d.]+)v[wh]/g)){
  assert.ok(Number(match[2])>0&&Number(match[2])<100,`landing stays within viewport: ${match[0]}`);
 }
});

test('critical CSS supports a still reduced-motion pile and portrait landing positions',()=>{
 assert.match(bootHead,/@media\(prefers-reduced-motion:reduce\)\{\s*\.boot-rain\{display:none\}/);
 assert.match(bootHead,/@media\(max-aspect-ratio:1\/1\)/);
 assert.match(bootHead,/--landing-y:var\(--portrait-y\);left:var\(--portrait-x\)/);
 assert.match(bootHead,/pointer-events:none/);
 assert.match(bootHead,/transition:opacity \.4s ease-out/);
 assert.doesNotMatch(bootHead,/https?:|@font-face|as="font"|infinite|clip-path/);
 assert.equal((bootHead.match(/as="image"/g)||[]).length,4);
});

test('bootstrap URL is versioned from its current contents',()=>{
 const code=readFileSync(new URL('../site/public/boot.js',import.meta.url));
 const version=createHash('sha256').update(code).digest('hex').slice(0,16);
 assert.ok(bootHead.includes(`<script src="/boot.js?v=${version}"></script>`));
});
