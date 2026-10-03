import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {unzipSync} from 'fflate';
import {zipFiles,brandedFile} from '../backend/output-stream.mjs';
import {brandedParts} from '../backend/output-brand.mjs';
test('streamed ZIP preserves distinct files and branding without a whole-result buffer',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-stream-')),signal=new AbortController().signal;
 try{const a=join(dir,'a'),b=join(dir,'b'),archive=join(dir,'bundle.zip');await writeFile(a,'hello');await writeFile(b,Buffer.alloc(1024*1024,7));await zipFiles([{path:a,name:'a.txt'},{path:b,name:'folder/b.bin'}],archive,signal);
  const output=await brandedFile(archive,'zip',signal),chunks=[];for await(const chunk of output.stream)chunks.push(chunk);const data=Buffer.concat(chunks);assert.equal(data.length,output.length);const files=unzipSync(data);assert.equal(Buffer.from(files['a.txt']).toString(),'hello');assert.equal(files['folder/b.bin'].length,1024*1024);assert.ok(data.includes(Buffer.from('Created by wase.download')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('file streaming matches existing PNG, JPEG, SVG and opaque branding byte for byte',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wase-brand-')),signal=new AbortController().signal;
 try{const png=await readFile(new URL('./fixtures/logo.png',import.meta.url));for(const [extension,bytes]of [['png',png],['jpg',Buffer.concat([Buffer.from([255,216]),Buffer.alloc(100000)])],['svg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>')],['pdf',Buffer.alloc(100000)]]){const path=join(dir,extension);await writeFile(path,bytes);const output=await brandedFile(path,extension,signal),chunks=[];for await(const chunk of output.stream)chunks.push(chunk);const result=Buffer.concat(chunks);assert.equal(result.length,output.length);assert.deepEqual(result,Buffer.concat(brandedParts(bytes,extension)));}}
 finally{await rm(dir,{recursive:true,force:true});}
});
