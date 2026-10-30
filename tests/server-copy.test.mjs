// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serverCopy,serverErrorCodes,statusCode,fillCopy} from '../site/src/server-copy.js';
import {localeCodes} from '../site/src/locales.js';

test('every locale translates every server error code and progress state',()=>{
 for(const lang of localeCodes){
  const copy=serverCopy[lang];assert.ok(copy,lang);
  assert.match(copy.targetUnavailable,/\{source\}/);assert.match(copy.targetUnavailable,/\{target\}/);assert.match(copy.uploading,/\{percent\}/);
  assert.deepEqual(Object.keys(copy.errors).sort(),[...serverErrorCodes].sort(),lang);
  assert.match(copy.errors.too_large,/\{limit\}/);assert.match(copy.errors.engine_failed,/\{target\}/);
  if(lang!=='en')for(const code of serverErrorCodes)assert.notEqual(copy.errors[code],serverCopy.en.errors[code],`${lang}.${code} must not inherit English`);
 }
 assert.equal(fillCopy(serverCopy.ru.errors.too_large,{limit:100}),'Файл больше серверного лимита 100 МБ.');
});

test('every code the broker sends has a message; status fallback covers proxies',()=>{
 const server=readFileSync(new URL('../backend/server.mjs',import.meta.url),'utf8');
 const sent=new Set([...server.matchAll(/fail\(req,res,\d+,'([a-z_]+)'/g)].map(match=>match[1]));
 for(const code of sent)if(code!=='forbidden')assert.ok(serverErrorCodes.includes(code),code);
 for(const code of ['empty','unsupported_pair','too_large','timeout','paused','engine_failed','rate_limited'])assert.ok(sent.has(code),code);
 assert.deepEqual([413,429,400,504,408,502,503,500,422].map(statusCode),['too_large','rate_limited','unsupported_pair','timeout','timeout','paused','paused','engine_failed','engine_failed']);
});

test('server uploads report progress and map failures by code',()=>{
 const app=readFileSync(new URL('../site/src/app.js',import.meta.url),'utf8');
 assert.match(app,/new XMLHttpRequest\(\)/);assert.match(app,/xhr\.upload\.onprogress=/);assert.match(app,/className='file-progress'/);
 // The bar must be attached after the status joins the row (a detached
 // status.after() silently dropped it).
 assert.match(app,/info\.append\(status\);if\(i\.status==='working'&&serverMode\(\)\)\{const bar=[^}]*info\.append\(bar\);\}/);assert.doesNotMatch(app,/status\.after\(bar\)/);
 // A retried file must not keep an old pause/limit code that stops the batch.
 assert.match(app,/delete i\.error;delete i\.errorCode;i\.status='working'/);assert.match(app,/if\(i\.status==='failed'&&\['paused','rate_limited'\]\.includes\(i\.errorCode\)\)break;/);
 assert.match(app,/if\(!file\.size\)throw new Error\('empty'\)/,'empty files are rejected before upload');
 assert.doesNotMatch(app,/fetch\(`\/api\/convert/);
});
