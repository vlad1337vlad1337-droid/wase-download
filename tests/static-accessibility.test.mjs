// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {page} from '../scripts/generate.mjs';
import {strings} from '../site/src/strings.js';
import {localeCodes,textDirection} from '../site/src/locales.js';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const escape=value=>String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

test('format controls expose their localized purpose and live selected value to agents and screen readers',()=>{
 for(const lang of localeCodes){
  const html=page(lang,'epub-to-txt'),t=strings[lang];
  for(const id of ['source','target']){
   const label=id==='source'?t.sourceFormat:t.targetFormat;
   assert.ok(html.includes(`aria-labelledby="${id}-label ${id}-value"`),`${lang}: ${id} purpose`);
   assert.ok(html.includes(`<span id="${id}-label" class="sr-only">${escape(label)}</span>`),`${lang}: ${id} translated label`);
   assert.match(html,new RegExp(`<span id="${id}-value" class="format-value" dir="ltr">(?:EPUB|TXT)<\\/span>`),`${lang}: ${id} selected value`);
  }
  const labels=[...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(labels.length,new Set(labels).size,`${lang}: unique ids`);
 }
});

test('server-default HTML never exposes a browser-only privacy promise before processing mode is known',()=>{
 for(const lang of localeCodes){
  const html=page(lang),bottom=html.match(/<div class="converter-bottom">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(bottom,lang);assert.match(bottom,/<span hidden>/,`${lang}: mode-specific note starts hidden`);
  assert.ok(bottom.includes(escape(strings[lang].local)),`${lang}: bounded browser-only copy`);
  assert.equal(strings[lang].saving,strings[lang].local,`${lang}: no stale queue/account advertising`);
 }
});

test('Arabic pages retain RTL prose while protocol examples and format identifiers remain LTR',()=>{
 const html=page('ar','developers');
 assert.ok(html.includes(`<html lang="ar" dir="${textDirection('ar')}">`));
 const examples=[...html.matchAll(/<pre([^>]*)>([\s\S]*?)<\/pre>/g)];
 assert.ok(examples.length>=3);assert.ok(examples.every(([,attributes])=>attributes.includes('dir="ltr"')));
 const converter=page('ar','png-to-svg');
 for(const match of converter.matchAll(/<button([^>]*data-format="[^"]+"[^>]*)>/g))assert.ok(match[1].includes('dir="ltr"'));
});

test('all generated pages reference the normalized language bootstrap content version',()=>{
 const source=readFileSync('site/public/language.js','utf8').replace(/const supported=\[[^\]]*\]/,'const supported='+JSON.stringify(localeCodes));
 const version=createHash('sha256').update(source).digest('hex').slice(0,16);
 for(const lang of localeCodes)for(const route of ['','formats/png','developers','404']){
  const html=page(lang,route);assert.ok(html.includes(`<script src="/language.js?v=${version}"></script>`),`${lang}/${route}: content-versioned bootstrap`);
  assert.ok(!html.includes('<script src="/language.js"></script>'));
 }
});
