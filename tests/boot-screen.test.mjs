import test from 'node:test';
import assert from 'node:assert/strict';
import {bootHead,bootMarkup} from '../scripts/boot-screen.mjs';
import {localeCodes} from '../site/src/locales.js';

test('all locales start with their own greeting, four corner mascots and no dot spinner',()=>{
 for(const lang of localeCodes){
  const html=bootMarkup(lang);
  assert.match(html,new RegExp(`is-first" lang="${lang}"`));
  assert.equal((html.match(/class="boot-corner boot-corner-/g)||[]).length,4);
  assert.equal((html.match(/class="boot-word/g)||[]).length,4);
  assert.doesNotMatch(html,/boot-dots|<i>/);
  assert.match(html,/aria-hidden="true"/);
 }
});

test('loader critical CSS provides reduced-motion static greeting and local font only',()=>{
 assert.match(bootHead,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(bootHead,/\.boot-word\.is-first\{opacity:1\}/);
 assert.match(bootHead,/pointer-events:none/);
 assert.match(bootHead,/\/fonts\/caveat-greetings-v1.ttf/);
 assert.doesNotMatch(bootHead,/https?:/);
});
