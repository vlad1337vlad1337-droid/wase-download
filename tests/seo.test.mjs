import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sitemapURLs} from '../scripts/sitemap-urls.mjs';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {strings} from '../site/src/strings.js';
import {localeCodes,languageTag,textDirection} from '../site/src/locales.js';
import {pairs as publishedPairs} from '../site/src/published-pairs.js';
import {publicCatalogue} from '../backend/conversion-policy.mjs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
test('all sitemap URLs resolve to static localized HTML with consistent metadata',()=>{
 const urls=sitemapURLs('dist');
 assert.ok(urls.length>0);assert.equal(new Set(urls).size,urls.length);
 for(const url of urls){const pathname=new URL(url).pathname,file='dist'+pathname+'index.html';assert.ok(existsSync(file),file);const html=read(file);assert.ok(html.includes(`<link rel="canonical" href="${url}">`));assert.equal((html.match(/hreflang=/g)||[]).length,localeCodes.length+1);assert.match(html,/<h1>/);assert.match(html,/<meta name="description" content="[^\"]+">/);const schema=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1];assert.equal(JSON.parse(schema).url,url);assert.equal(JSON.parse(schema).inLanguage,languageTag(pathname.split('/')[1]));}
});
test('declared catalogue is visible without JavaScript and every input has targets',()=>{
 const data=JSON.parse(read('dist/formats.json'));assert.equal(Object.keys(data.inputs).length,Object.keys(publicCatalogue(JSON.parse(read('site/data/catalog.json'))).inputs).length);assert.ok(!('alsa' in data.inputs));
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


test('every published locale has complete translated UI, privacy and error dictionaries',()=>{
 assert.deepEqual(Object.keys(strings),localeCodes);
 const check=(reference,value,path)=>{for(const[key,expected]of Object.entries(reference)){const actual=value[key];assert.notEqual(actual,undefined,`${path}.${key}`);if(Array.isArray(expected)){assert.ok(Array.isArray(actual),`${path}.${key}`);assert.ok(actual.length,`${path}.${key}`);}else if(expected&&typeof expected==='object')check(expected,actual,`${path}.${key}`);else assert.ok(typeof actual==='string'&&actual.trim(),`${path}.${key}`);}};
 for(const [lang,t]of Object.entries(strings)){
  check(strings.en,t,lang);assert.equal(t.privacySections.length,5,lang);
  if(lang!=='en'){assert.notEqual(t.title,strings.en.title,lang);assert.notEqual(t.lead,strings.en.lead,lang);assert.notEqual(t.privacyText,strings.en.privacyText,lang);}
  const html=read(`dist/${lang}/jpg-to-svg/index.html`);
  assert.ok(html.includes(`<html lang="${languageTag(lang)}" dir="${textDirection(lang)}">`),lang);
  assert.ok(html.includes(`<h1>`)&&!html.includes('undefined'),lang);
  if(lang!=='en'){assert.ok(!html.includes('How to convert JPG to SVG'),lang);assert.ok(!html.includes('Trace JPG into editable SVG paths.'),lang);}
  assert.ok(html.includes(`aria-label="${t.coffee}"`),lang);
  for(const kind of ['privacy','about','formats','developers'])assert.ok(existsSync(`dist/${lang}/${kind}/index.html`),lang+kind);
 }
});

test('all locales publish the same verified pair set and exclude unverified catalogues and errors',()=>{
 const urls=sitemapURLs('dist');
 for(const lang of localeCodes){const paths=urls.filter(url=>url.startsWith(`https://wase.download/${lang}/`)),set=new Set(paths);assert.equal(paths.length,Object.keys(publishedPairs).length+5,lang);for(const slug of Object.keys(publishedPairs))assert.ok(set.has(`https://wase.download/${lang}/${slug}/`),lang+slug);assert.ok(!paths.some(url=>url.includes('/404.html')||url.includes('/formats/format-')),lang);}
});

test('automatic language selection honors a supported preference and falls back to browser languages',()=>{
 const source=read('dist/language.js');
 const select=(saved,languages,path='/')=>{let redirect=null;runInNewContext(source,{document:{documentElement:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:key=>key==='wase-language'?saved:null},matchMedia:()=>({matches:false}),navigator:{languages,language:languages[0]},location:{pathname:path,search:'?a=1',hash:'#converter',replace:url=>{redirect=url}}});return redirect;};
 assert.equal(select('fr',['ru-RU']),'/fr/?a=1#converter');assert.equal(select('invalid',['ar-EG','en-US']),'/ar/?a=1#converter');assert.equal(select(null,['ko-KR']),'/ko/?a=1#converter');assert.equal(select(null,['zz-ZZ']),'/en/?a=1#converter');assert.equal(select('de',['de-DE'],'/ru/png-to-svg/'),null);
});
