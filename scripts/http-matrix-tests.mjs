import fs from 'node:fs';import {unzipSync} from 'fflate';
const root='../work/conversion-corpus',origin=process.env.MATRIX_ORIGIN||'http://127.0.0.1:5191';
const receipts=JSON.parse(fs.readFileSync('deploy/seo/verified-receipts.json'));
const report=root+'/http-results.jsonl';const completed=new Set(fs.existsSync(report)?fs.readFileSync(report,'utf8').trim().split('\n').filter(Boolean).map(v=>{const r=JSON.parse(v);return r.input+':'+r.output;}):[]);
let next=0,done=completed.size;
async function worker(){for(;;){const index=next++;if(index>=receipts.length)return;const v=receipts[index],key=v.input+':'+v.output;if(completed.has(key))continue;const started=Date.now();let result={input:v.input,output:v.output,status:'failed'};try{
 const response=await fetch(`${origin}/api/convert?from=${encodeURIComponent(v.input)}&to=${encodeURIComponent(v.output)}`,{method:'POST',headers:{'X-Real-IP':`local-matrix-${index}`},body:fs.readFileSync(root+'/files/'+v.fixture),signal:AbortSignal.timeout(190000)});const data=Buffer.from(await response.arrayBuffer());
 result.http=response.status;result.bytes=data.length;result.zipped=response.headers.get('content-type')?.includes('application/zip')||false;
 if(response.status!==200)throw Error('HTTP '+response.status);
 if(!data.length)throw Error('Empty output');
 if(result.zipped){const files=unzipSync(data);if(!Object.keys(files).length)throw Error('Empty ZIP');}
 result.status='passed';
}catch(error){result.error=error.message;}
 result.seconds=(Date.now()-started)/1000;fs.appendFileSync(report,JSON.stringify(result)+'\n');done++;if(done%50===0||result.status==='failed')console.log(`${done}/${receipts.length}: ${key} ${result.status} ${result.seconds}s`,{flush:true});
}}
await Promise.all(Array.from({length:4},worker));
console.log('HTTP matrix complete',receipts.length);
