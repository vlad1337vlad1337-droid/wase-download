import fs from 'node:fs';import {pairs as baseline} from '../site/src/strings.js';
const root=process.argv[2]||'../work/conversion-corpus';
const readLines=path=>fs.readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const merged=new Map();
for(const name of ['results-discovery.jsonl','results.jsonl'])for(const i of [0,1,2,3])for(const r of readLines(`${root}/shard-${i}/report/${name}`))merged.set(r.input+':'+r.output,r);
const results=[...merged.values()];
const http=new Map(readLines(root+'/http-results.jsonl').map(r=>[r.input+':'+r.output,r]));
const fixtureList=JSON.parse(fs.readFileSync(root+'/manifest.json'));const fixtures=Object.fromEntries(fixtureList.map(v=>[v.input,v]));const byFile=Object.fromEntries(fixtureList.map(v=>[v.path.split('/').pop(),v]));
const slugPart=value=>value.toLowerCase().replace(/[^a-z0-9.-]+/g,'-');
const pairs={},receipts=[];
for(const result of results){
 if(result.status!=='passed'||result.input===result.output||http.get(result.input+':'+result.output)?.status!=='passed')continue;
 // JPG/JPEG and TIFF/TIF are aliases; publish the explicitly tested canonical spelling.
 if(['jpeg','tif'].includes(result.input)||['jpeg','tif'].includes(result.output))continue;
 const existing=Object.entries(baseline).find(([,p])=>p[0].toLowerCase()===result.input&&p[1].toLowerCase()===result.output)?.[0];
 const slug=existing||slugPart(result.input)+'-to-'+slugPart(result.output);
 if(pairs[slug]&&pairs[slug].join(':')!==[result.input,result.output].map(v=>v.toUpperCase()).join(':'))throw new Error('Pair slug collision');
 pairs[slug]=[result.input.toUpperCase(),result.output.toUpperCase()];
 receipts.push({...result,httpVerification:http.get(result.input+':'+result.output),fixtureSHA256:byFile[result.fixture]?.sha256,fixtureSource:byFile[result.fixture]?.source});
}
fs.writeFileSync('site/data/verified-pairs.json',JSON.stringify(pairs,null,2)+'\n');
fs.mkdirSync('deploy/seo',{recursive:true});fs.writeFileSync('deploy/seo/verified-receipts.json',JSON.stringify(receipts,null,2)+'\n');
const coverage=JSON.parse(fs.readFileSync(root+'/plan.json')).inputs.map(input=>{const cases=results.filter(v=>v.input===input);return{input,fixture:!!fixtures[input],tested:cases.length,passed:cases.filter(v=>v.status==='passed').length,failed:cases.filter(v=>v.status==='failed').length,unvalidated:cases.filter(v=>v.status==='produced-unvalidated').length};});
fs.writeFileSync('deploy/seo/input-verification.json',JSON.stringify(coverage,null,2)+'\n');
console.log('HTTP-confirmed pairs eligible for localized pages:',Object.keys(pairs).length);
