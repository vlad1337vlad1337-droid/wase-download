// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicRegistry,publicCatalogue,catalogueResponse,unavailableOutputs,engineAllowed} from '../backend/conversion-policy.mjs';
import {pairs} from '../site/src/published-pairs.js';

const shipped=publicCatalogue(JSON.parse(readFileSync(new URL('../site/data/catalog.json',import.meta.url))));
const outputs=input=>shipped.groups[shipped.inputs[input]]||[];
const receipts=JSON.parse(readFileSync(new URL('../deploy/output-validation-receipts-2026-10-30.json',import.meta.url)));

test('targets that can never pass output validation are not advertised',()=>{
 for(const [input,index]of Object.entries(shipped.inputs))for(const output of shipped.groups[index])assert.ok(!unavailableOutputs.has(output),`${input} -> ${output}`);
 const removed=new Set(Object.values(receipts.removed).flat());
 for(const output of unavailableOutputs)assert.ok(removed.has(output),`${output} needs a receipt`);
});

test('valuable outputs restored by validators stay available',()=>{
 for(const [input,output]of [['csv','xlsx'],['epub','mobi'],['json','yaml'],['json','toml'],['obj','glb'],['obj','gltf'],['markdown','latex'],['markdown','rst'],['docx','odt'],['csv','ods'],['mp4','ts'],['mp4','vob'],['mp4','wma'],['mp4','264'],['mp4','dpx'],['mp3','rso'],['mp3','adx'],['txd','jpg'],['b3d','stl'],['b3d','stp'],['png','psd'],['png','mtv'],['svg','emf'],['bmp','dxf']])
  assert.ok(outputs(input).includes(output),`${input} -> ${output}`);
 const restored=new Set(receipts.restored.map(entry=>entry.output));
 for(const output of ['xlsx','mobi','azw3','glb2','ts','wma','latex','fb2','dxf','emf'])assert.ok(restored.has(output),output);
});

test('engine-specific mislabels are removed without dropping working engines',()=>{
 const categories={png:'image',mp4:'video',obj:'cad',csv:'document',tif:'image'};
 const registry=publicRegistry({matrix:{png:{exr:['imagemagick'],x:['graphicsmagick'],mtv:['imagemagick'],pdf:['imagemagick']},mp4:{exr:['ffmpeg','imagemagick'],mtv:['imagemagick'],json:['imagemagick'],pdf:['imagemagick'],png:['libheif','ffmpeg']},obj:{x:['assimp']},csv:{mat:['vips']},tif:{mat:['graphicsmagick','vips']}},categories});
 assert.deepEqual(registry.matrix.png,{mtv:['imagemagick'],pdf:['imagemagick']});
 assert.deepEqual(registry.matrix.mp4,{exr:['ffmpeg'],pdf:['imagemagick'],png:['libheif','ffmpeg']});
 assert.deepEqual(registry.matrix.obj,{x:['assimp']});
 assert.equal(registry.matrix.csv,undefined);assert.deepEqual(registry.matrix.tif,{mat:['graphicsmagick']});
 assert.equal(engineAllowed('mp4','mtv','imagemagick',categories),false);assert.equal(engineAllowed('png','mtv','imagemagick',categories),true);
 for(const output of ['mtv','json'])assert.ok(!outputs('mp4').includes(output),'mp4 -> '+output);
});

test('every published landing page is a pair the API accepts',()=>{
 for(const [slug,[input,output]]of Object.entries(pairs)){
  const index=shipped.inputs[input.toLowerCase()];
  if(index!==undefined)assert.ok(shipped.groups[index].includes(output.toLowerCase()),slug);
 }
 for(const slug of ['mp4-to-mtv','mp4-to-json'])assert.ok(!pairs[slug],slug);
 assert.ok(pairs['jpg-to-sixel']&&pairs['gif-to-mxf'],'input-dependent targets with receipts stay');
 assert.ok(pairs['png-to-svg']&&pairs['txd-to-png']);
});

test('API body groups identical output lists once and keeps limits',()=>{
 const body=catalogueResponse({matrix:{png:{svg:[],jpg:[]},gif:{jpg:[],svg:[]},mp3:{wav:[]}},categories:{png:'image'}},{fileMB:100,batch:20});
 assert.deepEqual(body,{groups:[['jpg','svg'],['wav']],inputs:{png:0,gif:0,mp3:1},categories:{png:'image'},limits:{fileMB:100,batch:20}});
});

test('engine fixes from the evidence run stay wired in',()=>{
 const engine=readFileSync(new URL('../backend/engine.mjs',import.meta.url),'utf8');
 const still=engine.match(/const stillFrames=new Set\('([^']+)'/)[1].split(' ');
 for(const format of ['dpx','tga','xwd','jp2','qoi','exr','png','jpg'])assert.ok(still.includes(format),format);
 assert.ok(!still.some(format=>unavailableOutputs.has(format)));
 assert.match(engine,/const monoAudio=\{rso:\[\],gsm:\['-ar','8000'\]\}/);
 assert.match(engine,/'-ac','1'/);assert.match(engine,/`-f\$\{output\}2`/);
});
