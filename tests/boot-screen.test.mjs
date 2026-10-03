import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bootHead,bootMarkup} from '../scripts/boot-screen.mjs';
import {localeCodes} from '../site/src/locales.js';
import {strings} from '../site/src/strings.js';

test('all locales start with their translated converter title, four corner mascots and no dot spinner',()=>{
 for(const lang of localeCodes){
  const html=bootMarkup(lang);
  assert.match(html,new RegExp(`is-first" lang="${lang}"`));
  assert.ok(html.includes(`--word-index:0">${strings[lang].title}</span>`));
  assert.equal((html.match(/class="boot-corner boot-corner-/g)||[]).length,4);
  assert.equal((html.match(/class="boot-word/g)||[]).length,4);
  assert.doesNotMatch(html,/boot-dots|<i>/);
  assert.match(html,/aria-hidden="true"/);
 }
});

test('loader critical CSS provides a reduced-motion static title and local font only',()=>{
 assert.match(bootHead,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(bootHead,/\.boot-word\.is-first\{opacity:1\}/);
 assert.match(bootHead,/pointer-events:none/);
 assert.match(bootHead,/\/fonts\/caveat-converter-v1.woff2/);
 assert.doesNotMatch(bootHead,/https?:/);
});

test('handwritten subset contains every Latin and Cyrillic title character',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../site/data/boot-font.json',import.meta.url),'utf8'));
 const font=readFileSync(new URL(`../site/public/fonts/${manifest.file}`,import.meta.url));
 assert.equal(createHash('sha256').update(font).digest('hex'),manifest.sha256);
 const available=new Set(manifest.codepoints);
 for(const lang of ['en','ru','es','fr','de','pt','it','tr']){
  for(const character of strings[lang].title)assert.ok(available.has(character.codePointAt(0)),`${lang}: missing ${character}`);
 }
});
