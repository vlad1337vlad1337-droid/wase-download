import fs from 'node:fs';import {sitemapURLs} from './sitemap-urls.mjs';
const urls=sitemapURLs('dist'),results=[];let next=0;
async function worker(){while(next<urls.length){const url=urls[next++];try{const r=await fetch(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(20000)});results.push({url,status:r.status,type:r.headers.get('content-type')});}catch(e){results.push({url,status:0,error:e.message});}if(results.length%500===0)console.log(results.length+'/'+urls.length);}}
await Promise.all(Array.from({length:8},worker));const failures=results.filter(r=>r.status!==200||!r.type?.includes('text/html'));
fs.writeFileSync('deploy/seo/live-delivery.json',JSON.stringify({checkedAt:new Date().toISOString(),total:urls.length,failures,results},null,2)+'\n');console.log({total:urls.length,failures:failures.length});if(failures.length)process.exitCode=1;
