// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseAutoTarget} from '../site/src/auto-target.js';
import {browserSelection} from '../site/src/browser-fallback.js';
import {page} from '../scripts/generate.mjs';
import {localeCodes} from '../site/src/locales.js';
import {publicCatalogue} from '../backend/conversion-policy.mjs';

for(const [inputs,outputs,categories,want] of [
 [['JPEG'],['JPG','PNG','SVG'],{},'PNG'],
 [['PNG'],['PNG','WEBP','SVG'],{},'WEBP'],
 [['JPEG','PNG'],['PNG','WEBP'],{},'WEBP'],
 [['EPUB'],['PDF','TXT'],{epub:'ebook'},'PDF'],
 [['MP3'],['MP3','WAV'],{mp3:'audio'},'WAV'],
 [['MP4'],['MP4','WEBM'],{mp4:'video'},'WEBM'],
 [['TTF'],['WOFF2','OTF'],{ttf:'font'},'WOFF2'],
 [['ZIP'],['ZIP','TAR'],{zip:'archive'},'TAR'],
 [['SVG'],['PNG','SVG'],{},'PNG'],
 [['DOCX'],[],{docx:'document'},null],
])test(`AUTO: ${inputs.join('+')} resolves to ${want}`,()=>assert.equal(chooseAutoTarget(inputs,outputs,categories),want));

test('AUTO remains undecided until a file is known, including server fallback',()=>{
 assert.deepEqual(browserSelection('AUTO','AUTO'),{source:'AUTO',target:'AUTO'});
 assert.deepEqual(browserSelection('EPUB','TXT'),{source:'AUTO',target:'AUTO'});
 assert.deepEqual(browserSelection('PNG','SVG'),{source:'PNG',target:'SVG'});
});
test('every declared source resolves only to an advertised output',()=>{
 const catalogue=publicCatalogue(JSON.parse(readFileSync(new URL('../site/data/catalog.json',import.meta.url))));
 for(const [source,group] of Object.entries(catalogue.inputs)){
  const outputs=catalogue.groups[group].map(value=>value.toUpperCase());
  const target=chooseAutoTarget([source],outputs,catalogue.categories);
  assert.ok(outputs.includes(target),`${source}: ${target}`);
  assert.notEqual(target,'AUTO');
 }
});
test('all locale homes start AUTO → AUTO, explicit pair pages keep their output',()=>{
 for(const locale of localeCodes){
  assert.match(page(locale),/data-source="AUTO" data-target="AUTO"/);
  assert.match(page(locale),/id="target-value"[^>]*>AUTO</);
  assert.match(page(locale,'png-to-svg'),/data-source="PNG" data-target="SVG"/);
  assert.match(page(locale,'png-to-svg'),/id="target-value"[^>]*>SVG</);
 }
});
