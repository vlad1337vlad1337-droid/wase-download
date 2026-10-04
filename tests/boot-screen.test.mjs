import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bootHead,bootMarkup} from '../scripts/boot-screen.mjs';
import {localeCodes} from '../site/src/locales.js';

test('every locale gets the same compact, decorative brand lockup',()=>{
 for(const lang of localeCodes){
  const html=bootMarkup(lang);
  assert.equal((html.match(/class="boot-friend boot-friend--/g)||[]).length,3);
  assert.match(html,/wase<span>\.download<\/span>/);
  assert.match(html,/class="boot-underline"/);
  assert.match(html,/aria-hidden="true"/);
  assert.doesNotMatch(html,/boot-pile|boot-rain|<canvas|<script|<img|data-boot-body/);
  assert.ok(Buffer.byteLength(html)<5000,'the complete graphic is inline and small');
 }
});

test('decoration needs no image downloads, physics engine or animation JS',()=>{
 assert.equal((bootHead.match(/<script /g)||[]).length,1);
 assert.doesNotMatch(bootHead+bootMarkup(),/(?:src|href)="https?:\/\/|data-engine|data-physics|as="image"|as="font"|infinite/);
 assert.match(bootHead,/\.boot-wordmark\{[^}]*font-size:clamp/);
 assert.match(bootHead,/width:min\(420px,calc\(100% - 40px\)\)/);
 assert.match(bootHead,/max-height:380px/);
});

test('motion is finite, decorative and disabled for reduced-motion preference',()=>{
 assert.match(bootHead,/@media\(prefers-reduced-motion:reduce\)\{\.boot-screen,\.boot-screen \*\{animation:none!important;transition:none!important\}\}/);
 assert.match(bootHead,/pointer-events:none/);
 assert.match(bootHead,/transition:opacity \.4s ease-out/);
 assert.doesNotMatch(bootHead,/infinite|backdrop-filter|filter:blur/);
});

test('bootstrap URL is versioned from its actual contents',()=>{
 const version=createHash('sha256').update(readFileSync(new URL('../site/public/boot.js',import.meta.url))).digest('hex').slice(0,16);
 assert.ok(bootHead.includes(`src="/boot.js?v=${version}"`));
});
