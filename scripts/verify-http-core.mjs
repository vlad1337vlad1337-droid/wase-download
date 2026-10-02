import fs from 'node:fs';import {zipSync,unzipSync} from 'fflate';
const origin=process.env.MATRIX_ORIGIN||'http://127.0.0.1:5191',root='../work/conversion-corpus/files';
const results=[];
async function convert(from,to,data,expected=200){const start=Date.now();const r=await fetch(`${origin}/api/convert?from=${from}&to=${to}`,{method:'POST',body:data,signal:AbortSignal.timeout(185000)});const b=Buffer.from(await r.arrayBuffer());const record={from,to,status:r.status,bytes:b.length,seconds:(Date.now()-start)/1000};results.push(record);console.log(record);if(r.status!==expected)throw Error(`${from}→${to}: HTTP ${r.status}`);return b;}
const pairs=[['txt','pdf'],['ttf','otf'],['svg','jpg'],['svg','webp'],['webp','jpg'],['png','ico'],['png','bmp'],['gif','jpg'],['epub','txt'],['pdf','svg'],['woff2','ttf']];
for(const [from,to]of pairs)await convert(from,to,fs.readFileSync(root+'/input.'+from));
const zipped=zipSync({'folder/hello.txt':new TextEncoder().encode('Wase core audit')});
const tar=await convert('zip','tar.gz',Buffer.from(zipped));const back=await convert('tar.gz','zip',tar);if(new TextDecoder().decode(unzipSync(back)['folder/hello.txt'])!=='Wase core audit')throw Error('Archive content changed');
const dzi=unzipSync(await convert('png','dzi',fs.readFileSync(root+'/input.png')));if(!Object.keys(dzi).some(v=>v.endsWith('.dzi'))||!Object.keys(dzi).some(v=>/\.jpe?g$/.test(v)))throw Error('Incomplete tiled image');
await convert('png','svg',Buffer.from('corrupt input'),422);await convert('png','svg',fs.readFileSync(root+'/input.png'));
fs.writeFileSync(process.env.CORE_REPORT||'/tmp/wase-http-core.json',JSON.stringify({origin,checkedAt:new Date().toISOString(),results},null,2)+'\n');
