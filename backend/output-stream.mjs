import {createReadStream} from 'node:fs';
import {open,readFile,stat} from 'node:fs/promises';
import {Zip,ZipPassThrough} from 'fflate';
import {brandedParts} from './output-brand.mjs';

// ZIP output is written in small chunks, rather than duplicating 200 MB in RAM.
export async function zipFiles(files,path,signal){
 const file=await open(path,'wx',0o600);let chunks=[],failure;
 const zip=new Zip((error,data)=>{if(error)failure=error;else chunks.push(data);});
 const flush=async()=>{if(failure)throw failure;for(const chunk of chunks){signal.throwIfAborted();let offset=0;while(offset<chunk.length){const {bytesWritten}=await file.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}}chunks=[];};
 try{for(const source of files){signal.throwIfAborted();const entry=new ZipPassThrough(source.name);zip.add(entry);await flush();for await(const chunk of createReadStream(source.path,{highWaterMark:65536,signal})){entry.push(chunk);await flush();}entry.push(new Uint8Array(),true);await flush();}zip.end();await flush();}
 finally{zip.terminate();await file.close();}
}
export async function brandedFile(path,extension,signal){
 const {size}=await stat(path);const ext=extension.toLowerCase();let start=0,end=size,prefix=[],suffix=[];
 if(['png','jpg','jpeg'].includes(ext)){
  const file=await open(path,'r');let head;try{head=Buffer.alloc(Math.min(size,33));await file.read(head,0,head.length,0);}finally{await file.close();}
  const parts=brandedParts(head,ext);if(parts.length>1){start=head.length;prefix=parts;}
 }else if(ext==='svg'&&size<=5*1024*1024){prefix=brandedParts(await readFile(path,{signal}),ext);start=size;
 }else if(ext==='zip'){
  const offset=Math.max(0,size-65557),file=await open(path,'r');let tail;try{tail=Buffer.alloc(size-offset);await file.read(tail,0,tail.length,offset);}finally{await file.close();}
  const parts=brandedParts(tail,ext);if(parts.length>1){end=offset;suffix=parts;}
 }
 const length=end-start+prefix.reduce((n,p)=>n+p.length,0)+suffix.reduce((n,p)=>n+p.length,0);
 async function* stream(){for(const part of prefix){signal.throwIfAborted();yield part;}if(end>start)yield*createReadStream(path,{start,end:end-1,highWaterMark:65536,signal});for(const part of suffix){signal.throwIfAborted();yield part;}}
 return {length,stream:stream()};
}
