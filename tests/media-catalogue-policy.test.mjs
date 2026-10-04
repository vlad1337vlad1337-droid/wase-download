import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicCatalogue,publicRegistry} from '../backend/conversion-policy.mjs';

test('FFmpeg muxer labels cannot advertise sound or subtitles for uploaded images',()=>{
 const outputs=['wma','dts','caf','srt','h261','mxf','png','svg','pdf','mp4'];
 const targets=Object.fromEntries(outputs.map(output=>[output,['ffmpeg']]));
 const registry=publicRegistry({matrix:{png:targets,gif:targets,mp4:targets},categories:{png:'image',gif:'image',mp4:'video',wma:'document',dts:'document',caf:'document',srt:'document',h261:'document',mxf:'document',svg:'vector',pdf:'document'}});
 assert.deepEqual(Object.keys(registry.matrix.png),['png','svg','pdf']);
 assert.deepEqual(Object.keys(registry.matrix.gif),['h261','mxf','png','svg','pdf','mp4']);
 assert.deepEqual(Object.keys(registry.matrix.mp4),outputs);
 assert.equal(registry.categories.wma,'audio');
 assert.equal(registry.categories.mxf,'video');
 const cached=publicCatalogue({inputs:{png:0,gif:0,mp4:0},groups:[outputs],categories:registry.categories});
 for(const input of ['png','gif','mp4'])assert.deepEqual(cached.groups[cached.inputs[input]],Object.keys(registry.matrix[input]));
});

test('shipped catalogue retains real transformations but rejects the observed PNG sound choices',()=>{
 const raw=JSON.parse(readFileSync(new URL('../site/data/catalog.json',import.meta.url)));
 const data=publicCatalogue(raw),targets=input=>data.groups[data.inputs[input]];
 for(const input of ['png','jpg','jpeg','gif','svg']){
  for(const output of ['wma','dts','caf','cvg','mp2','mka','ac4','bit','srt','ass','js'])assert.ok(!targets(input).includes(output),input+' -> '+output);
 }
 for(const input of ['png','jpg','jpeg','svg'])for(const output of ['a64','cpk','drc','psp','flm','chk'])assert.ok(!targets(input).includes(output),input+' -> '+output);
 for(const [input,output]of [['png','svg'],['png','pdf'],['gif','mp4'],['gif','ogg'],['mp4','mp3'],['mp3','wma'],['lrc','ass'],['3fr','png']])assert.ok(targets(input).includes(output),input+' -> '+output);
});

test('SEO uses the same stable media categories as the runtime catalogue',async()=>{
 const {pairs}=await import('../site/src/published-pairs.js');
 const raw=JSON.parse(readFileSync(new URL('../site/data/catalog.json',import.meta.url)));
 const data=publicCatalogue(raw);
 // Raw engine discovery labels FLV/MPEG/MPG as images on some hosts.
 // Their existing video and audio conversions must retain their landing pages.
 for(const slug of ['flv-to-mp4','flv-to-mp3','mpeg-to-adts','mpg-to-adts']){
  assert.ok(pairs[slug],slug);
  const [input,output]=pairs[slug].map(value=>value.toLowerCase());
  assert.ok(data.groups[data.inputs[input]].includes(output),slug);
 }
 for(const [slug,pair]of Object.entries(pairs)){
  const [input,output]=pair.map(value=>value.toLowerCase());
  if(data.inputs[input]!==undefined)assert.ok(data.groups[data.inputs[input]].includes(output),slug);
 }
 for(const slug of ['png-to-wma','png-to-mxf','jpeg-to-hevc','gif-to-m4a'])assert.ok(!pairs[slug],slug);
});
