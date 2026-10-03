import test from 'node:test';
import assert from 'node:assert/strict';
import {outputMime,previewKind,previewLimit,resultsComplete} from '../site/src/result-preview-policy.js';
test('preview assigns valid MIME to aliases and never executes document content',()=>{
 assert.equal(outputMime('JPEG'),'image/jpeg');assert.equal(outputMime('SVG'),'image/svg+xml');
 assert.equal(previewKind('html'),'text');assert.equal(previewKind('js'),'text');assert.equal(previewKind('svg'),'image');
 assert.equal(previewKind('pdf'),'pdf');assert.equal(previewKind('docx'),'unavailable');
 assert.equal(previewKind('mp3'),'audio');assert.equal(previewKind('webm'),'video');
});
test('preview limits decoding and primary download requires every result',()=>{
 assert.equal(previewLimit('text'),1048576);assert.equal(previewLimit('image'),33554432);
 assert.equal(resultsComplete([]),false);assert.equal(resultsComplete([{status:'done',result:{}}]),true);
 assert.equal(resultsComplete([{status:'done',result:{}},{status:'failed'}]),false);
 assert.equal(resultsComplete([{status:'done'}]),false);
});
