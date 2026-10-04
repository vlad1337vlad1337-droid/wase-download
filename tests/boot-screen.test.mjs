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
  assert.equal((html.match(/data-boot-body/g)||[]).length,50);
  assert.equal((html.match(/<img /g)||[]).length,50);
  assert.equal((html.match(/alt=""/g)||[]).length,50);
  assert.deepEqual([...new Set([...html.matchAll(/src="([^"]+)"/g)].map(match=>match[1]))].sort(),[0,1,2,3].map(i=>`/mascots/boot-${i}.svg`));
  assert.match(html,/aria-hidden="true"/);
  assert.doesNotMatch(html,/boot-corner|boot-word|boot-brand|boot-swoosh|<svg|<canvas|<script/);
 }
});

test('only the initial triangle is positioned in markup; rain has no scripted landing grid',()=>{
 const html=bootMarkup('en');
 for(let row=0;row<5;row++)assert.equal((html.match(new RegExp(`--row:${row};`,'g'))||[]).length,5-row);
 assert.doesNotMatch(html,/--(?:portrait-)?[xy]:|--delay:|--entry-turn:/);
 assert.doesNotMatch(bootHead,/@keyframes|boot-fall|animation-delay/);
});

test('critical CSS provides an immediately visible static reduced-motion fallback',()=>{
 assert.match(bootHead,/@media\(prefers-reduced-motion:reduce\)\{\s*\.boot-rain\{display:none\}/);
 assert.match(bootHead,/\.boot-face--falling\{display:none\}/);
 assert.match(bootHead,/\.is-physics \.boot-face\.is-active\{display:block\}/);
 assert.match(bootHead,/pointer-events:none/);
 assert.match(bootHead,/transition:opacity \.4s ease-out/);
 assert.doesNotMatch(bootHead,/https?:|@font-face|as="font"|infinite|clip-path/);
 assert.equal((bootHead.match(/as="image"/g)||[]).length,4);
});

test('bootstrap and optional local physics URLs are versioned from current contents',()=>{
 const version=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex').slice(0,16);
 assert.ok(bootHead.includes(`src="/boot.js?v=${version('../site/public/boot.js')}"`));
 assert.ok(bootHead.includes(`data-engine="/vendor/matter-0.20.0.min.js?v=${version('../site/public/vendor/matter-0.20.0.min.js')}"`));
 assert.ok(bootHead.includes(`data-physics="/boot-physics.js?v=${version('../site/public/boot-physics.js')}"`));
 assert.equal((bootHead.match(/<script /g)||[]).length,1,'decorative engine loading cannot defer app startup');
});
