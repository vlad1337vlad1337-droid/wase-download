import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sitemapURLs} from '../scripts/sitemap-urls.mjs';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('all sitemap URLs resolve to static localized HTML with consistent metadata',()=>{
 const urls=sitemapURLs('dist');
 assert.ok(urls.length>0);assert.equal(new Set(urls).size,urls.length);
 for(const url of urls){const pathname=new URL(url).pathname,file='dist'+pathname+'index.html';assert.ok(existsSync(file),file);const html=read(file);assert.ok(html.includes(`<link rel="canonical" href="${url}">`));assert.equal((html.match(/hreflang=/g)||[]).length,4);assert.match(html,/<h1>/);assert.match(html,/<meta name="description" content="[^\"]+">/);const schema=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1];assert.equal(JSON.parse(schema).url,url);}
});
test('declared catalogue is visible without JavaScript and every input has targets',()=>{
 const data=JSON.parse(read('dist/formats.json'));assert.equal(Object.keys(data.inputs).length,903);assert.ok(!('alsa' in data.inputs));
 const html=read('dist/en/formats/index.html');for(const [input,group]of Object.entries(data.inputs)){assert.ok(html.includes(input.toUpperCase()),input);assert.ok(data.groups[group]?.length,input);}
 assert.match(read('dist/robots.txt'),/Sitemap: https:\/\/wase.download\/sitemap.xml/);assert.match(read('dist/llms.txt'),/read-only MCP/);
});

test('pair pages include useful format guidance and related internal links',()=>{
 const html=read('dist/ru/svg-to-png/index.html');assert.match(html,/Как преобразовать SVG в PNG/);assert.match(html,/прозрачностью/);assert.match(html,/векторные фигуры/);assert.match(html,/class="conversion-links"/);assert.match(read('dist/ru/png-to-jpg/index.html'),/JPG и JPEG/);
});

 test('every canonical built page is included and all internal links and hreflang resolve',async()=>{const {audit}=await import('../scripts/audit-seo.mjs');const result=audit();assert.deepEqual(result.issues,[]);assert.equal(result.canonicalPages,result.sitemapURLs);});

test('coverage audit rejects missing pages and broken internal links',async()=>{
 const {audit}=await import('../scripts/audit-seo.mjs');const file='dist/sitemap-en-1.xml',original=read(file);
 try{writeFileSync(file,original.replace(/<url><loc>[^<]+<\/loc><\/url>/,''));assert.ok(audit().issues.some(v=>v.includes('missing from sitemap')));}finally{writeFileSync(file,original);}
 const page='dist/en/index.html',html=read(page);
 try{writeFileSync(page,html.replace('</main>','<a href="/missing-audit-link/">Test</a></main>'));assert.ok(audit().issues.some(v=>v.includes('broken link /missing-audit-link/')));}finally{writeFileSync(page,html);}
});

test('new published pairs have sample provenance and a successful real HTTP receipt',()=>{
 const pairs=JSON.parse(read('site/data/verified-pairs.json')),receipts=JSON.parse(read('deploy/seo/verified-receipts.json'));
 const proof=new Map(receipts.map(r=>[r.input.toUpperCase()+':'+r.output.toUpperCase(),r]));
 for(const pair of Object.values(pairs)){const receipt=proof.get(pair.join(':'));assert.ok(receipt,pair.join(':'));assert.equal(receipt.httpVerification.status,'passed');assert.equal(receipt.httpVerification.http,200);assert.match(receipt.fixtureSHA256,/^[a-f0-9]{64}$/);assert.match(receipt.sha256,/^[a-f0-9]{64}$/);assert.ok(receipt.bytes>0);}
 assert.ok(!Object.values(pairs).some(p=>p.join(':')==='STW:TXT'));
});
