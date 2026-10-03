import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {zipSync,unzipSync} from 'fflate';
import {brandedParts,brandBlob,CREDIT} from '../backend/output-brand.mjs';import {usablePair,publicCatalogue,publicRegistry} from '../backend/conversion-policy.mjs';
const join=parts=>Buffer.concat(parts.map(v=>Buffer.from(v)));
test('PNG metadata preserves every original byte and uses a valid small chunk',async()=>{const original=fs.readFileSync('tests/fixtures/logo.png'),parts=brandedParts(original,'png'),out=join(parts);assert.equal(parts.length,3);assert.deepEqual(Buffer.concat([out.subarray(0,33),out.subarray(33+parts[1].length)]),original);assert.equal(new DataView(parts[1].buffer).getUint32(0),parts[1].length-12);assert.ok(out.includes(Buffer.from(CREDIT)));assert.deepEqual(Buffer.from(await (await brandBlob(new Blob([original]),'png')).arrayBuffer()),out);});
test('SVG UTF-8 and BOM remain valid and existing credit is not duplicated',()=>{const original=Buffer.from('\ufeff<svg xmlns="http://www.w3.org/2000/svg"><text>Привет</text></svg>');const out=join(brandedParts(original,'svg'));assert.ok(out.toString().includes('<svg xmlns="http://www.w3.org/2000/svg"><!-- '+CREDIT+' -->'));assert.ok(out.toString().includes('Привет'));assert.deepEqual(join(brandedParts(out,'svg')),out);});
test('SVG branding preserves XML comments, quoted attributes, declarations and document types',async()=>{
 const fixtures=[
  '<!-- Documentation example <svg> -->\n<svg xmlns="http://www.w3.org/2000/svg"/>',
  '<svg xmlns="http://www.w3.org/2000/svg" data-note="a > b"><path/></svg>',
  "<svg xmlns='http://www.w3.org/2000/svg' data-note='a > b'><path/></svg>",
  '\ufeff<?xml version="1.0" encoding="UTF-8"?>\n<?example literal="<svg>"?>\n<svg xmlns="http://www.w3.org/2000/svg"><text>中文 Привет</text></svg>',
  '<!DOCTYPE svg [<!-- bracket [ and fake <svg> --><!ENTITY sample "example > text">]>\n<svg xmlns="http://www.w3.org/2000/svg"><text>&sample;</text></svg>'
 ];
 for(const source of fixtures){
  const original=Buffer.from(source),parts=brandedParts(original,'svg'),out=join(parts);
  assert.equal(parts.length,3);assert.deepEqual(join([parts[0],parts[2]]),original,'no original document bytes rewritten');
  const parsed=spawnSync('python3',['-c','import sys,xml.etree.ElementTree as ET; root=ET.fromstring(sys.stdin.buffer.read()); assert root.tag=="{http://www.w3.org/2000/svg}svg"'],{input:out,timeout:2000});
  assert.equal(parsed.status,0,parsed.stderr?.toString());
  assert.deepEqual(Buffer.from(await (await brandBlob(new Blob([original]),'svg')).arrayBuffer()),out);
  assert.deepEqual(join(brandedParts(out,'svg')),out,'credit remains idempotent');
 }
});
test('JPEG metadata keeps the entire compressed image untouched',()=>{const original=Buffer.from([255,216,255,224,0,2,255,217]),parts=brandedParts(original,'jpg');assert.deepEqual(join([parts[0],parts[2]]),original);assert.equal(parts[1][1],254);assert.ok(join(parts).includes(Buffer.from(CREDIT)));});
test('ZIP credit preserves entry names, bytes and CRC, including large archive tails',async()=>{const original=zipSync({'data.bin':new Uint8Array(80000).fill(42)},{level:0});const out=join(brandedParts(original,'zip'));assert.deepEqual(unzipSync(out),unzipSync(original));assert.ok(out.includes(Buffer.from(CREDIT)));assert.deepEqual(Buffer.from(await (await brandBlob(new Blob([original]),'zip')).arrayBuffer()),out);assert.deepEqual(join(brandedParts(out,'zip')),out);});
test('opaque files are never rewritten merely to add a credit',()=>{const original=new Uint8Array([1,2,3]);assert.equal(brandedParts(original,'ttf')[0],original);});
test('file policy blocks device names and implicit still-photo video synthesis, retaining real media tools',()=>{const raw=JSON.parse(fs.readFileSync('site/data/catalog.json'));assert.equal(usablePair('3fr','mp4',raw.categories),false);assert.equal(usablePair('png','av1.mp4',raw.categories),false);assert.equal(usablePair('gif','mp4',raw.categories),true);assert.equal(usablePair('mp4','mp3',raw.categories),true);const publicData=publicCatalogue(raw);assert.ok(!('alsa' in publicData.inputs));assert.ok(!publicData.groups[publicData.inputs['3fr']].includes('mp4'));assert.ok(publicData.groups[publicData.inputs['3fr']].includes('png'));});
test('file policy excludes ImageMagick generators and network/display targets, preserving real text files',()=>{
 const raw=JSON.parse(fs.readFileSync('site/data/catalog.json')),data=publicCatalogue(raw);
 for(const input of ['canvas','caption','clipboard','gradient','label','null','plasma','xc','http','https','ftp','screenshot'])assert.ok(!(input in data.inputs),input);
 assert.ok('txt' in data.inputs);assert.ok('text' in data.inputs);assert.ok('c' in data.inputs);assert.ok('data' in data.inputs);assert.ok('x' in data.inputs);
 assert.ok(data.groups.every(group=>!group.includes('null')&&!group.includes('clipboard')));
 const registry=publicRegistry({matrix:{caption:{txt:['imagemagick','pandoc']},png:{caption:['imagemagick'],txt:['other']},http:{png:['imagemagick']}},categories:{}});
 assert.deepEqual(registry.matrix.caption.txt,['pandoc']);assert.deepEqual(registry.matrix.png,{txt:['other']});assert.ok(!registry.matrix.http);
 const collision=publicCatalogue({inputs:{caption:0},groups:[['txt']],categories:{},fileFormats:['caption']});assert.ok('caption' in collision.inputs);
});
