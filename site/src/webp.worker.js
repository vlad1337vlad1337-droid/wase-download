import webpEncoder from '@jsquash/webp/codec/enc/webp_enc.js';
import wasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import { defaultOptions } from '@jsquash/webp/meta.js';
self.onmessage=async({data})=>{
 try{const module=await webpEncoder({locateFile:()=>wasmUrl});const result=module.encode(new Uint8ClampedArray(data.pixels),data.width,data.height,{...defaultOptions,quality:data.quality*100});if(!result)throw new Error('encode');const bytes=result.buffer;self.postMessage({bytes},[bytes]);}catch{self.postMessage({error:'encode'});}
};
