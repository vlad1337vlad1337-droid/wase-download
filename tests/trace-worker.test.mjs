import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {build} from 'vite';

function request(){
 const width=64,height=48,pixels=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const offset=(y*width+x)*4,inside=x>8&&x<40&&y>8&&y<40;
  pixels.set(inside?[244,73,55,255]:[250,249,246,255],offset);
 }
 return {data:{width,height,pixels:pixels.buffer,detail:'balanced',colors:16}};
}
function assertVector(result){
 assert.equal(result.error,undefined);assert.match(result.svg,/<svg\b/);
 assert.match(result.svg,/<path\b/);assert.match(result.svg,/viewBox="0 0 64 48"/);
 assert.doesNotMatch(result.svg,/<image\b|base64,/i);
}

test('native ES module preserves the original tracing algorithm and license',async()=>{
 const upstream=await readFile(new URL('../imagetracer_v1.2.6.js',import.meta.url),'utf8');
 const adapted=await readFile(new URL('../site/src/vendor/imagetracer.js',import.meta.url),'utf8');
 const algorithm=upstream.split("(function(){ 'use strict';\n\n")[1].split('// export as AMD module')[0];
 assert.ok(algorithm.length>40000);assert.ok(adapted.includes(algorithm));
 assert.ok(adapted.includes('The Unlicense / PUBLIC DOMAIN'));
 const {default:tracer}=await import('../site/src/vendor/imagetracer.js');
 assert.equal(tracer.versionnumber,'1.2.6');assert.equal(typeof tracer.imagedataToSVG,'function');
});

test('unbundled tracing worker accepts pixels without relying on CommonJS interop',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'self'),results=[];
 const self={postMessage:result=>results.push(result)};
 Object.defineProperty(globalThis,'self',{configurable:true,value:self});
 try{
  await import('../site/src/trace.worker.js');self.onmessage(request());
  assert.equal(results.length,1);assertVector(results[0]);
 }finally{if(previous)Object.defineProperty(globalThis,'self',previous);else delete globalThis.self;}
});

test('production worker bundle returns actual vector paths with the same module wrapper',async()=>{
 // Build only this worker, in memory. Never touch the full site or its dist tree.
 const output=await build({configFile:false,root:fileURLToPath(new URL('../site',import.meta.url)),logLevel:'silent',build:{write:false,emptyOutDir:false,copyPublicDir:false,minify:true,rollupOptions:{input:fileURLToPath(new URL('../site/src/trace.worker.js',import.meta.url)),output:{format:'iife'}}}});
 const outputs=Array.isArray(output)?output:[output];
 const script=outputs.flatMap(result=>result.output).find(asset=>asset.type==='chunk'&&asset.isEntry);
 assert.ok(script?.code);
 const results=[],self={postMessage:result=>results.push(result)};
 runInNewContext(script.code,{self,Uint8ClampedArray},{timeout:2000});
 self.onmessage(request());assert.equal(results.length,1);assertVector(results[0]);
});
