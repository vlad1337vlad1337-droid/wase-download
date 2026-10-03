import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {audit,auditLocalReferences} from '../scripts/audit-seo.mjs';
import {localeCodes,languageTag} from '../site/src/locales.js';
import {publicCatalogue} from '../backend/conversion-policy.mjs';

test('SEO audit checks links on noindex, retired and 404 screens without publishing them',()=>{
 const directory=mkdtempSync(join(tmpdir(),'wase-seo-links-')),base='https://wase.download';
 const save=(path,html)=>{const file=join(directory,path);mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,html);};
 try{
  const alternates=localeCodes.map(lang=>`<link rel="alternate" hreflang="${languageTag(lang)}" href="${base}/${lang}/">`).join('')+`<link rel="alternate" hreflang="x-default" href="${base}/en/">`;
  for(const lang of localeCodes){const url=`${base}/${lang}/`;save(`${lang}/index.html`,`<title>Home ${lang}</title><link rel="canonical" href="${url}"><meta name="description" content="Convert files">${alternates}<script type="application/ld+json">${JSON.stringify({url})}</script><h1>Converter</h1>`);}
  save('sitemap.xml',`<urlset>${localeCodes.map(lang=>`<url><loc>${base}/${lang}/</loc></url>`).join('')}</urlset>`);
  save('formats.json',JSON.stringify(publicCatalogue(JSON.parse(readFileSync(new URL('../site/data/catalog.json',import.meta.url),'utf8')))));
  const screens={
   'en/404.html':'<meta name="robots" content="noindex,follow"><body data-error-page="true"><a href="/en/">Home</a></body>',
   'en/formats/png/index.html':`<link rel="canonical" href="${base}/en/formats/png/"><meta name="robots" content="noindex,follow"><a href="/en/">Home</a>`,
   'en/retired-to-png/index.html':`<link rel="canonical" href="${base}/en/formats/png/"><meta name="robots" content="noindex,follow"><body data-retired="true"><a href="/en/formats/png/">Continue</a></body>`
  };
  for(const [path,html]of Object.entries(screens))save(path,html);
  const valid=audit({directory});assert.deepEqual(valid.issues,[]);assert.equal(valid.canonicalPages,localeCodes.length);
  for(const [path,html]of Object.entries(screens))save(path,html+`<a href="/missing-${path.split('/')[1]}/">Broken</a><img src="/missing-resource.svg">`);
  const broken=audit({directory});assert.equal(broken.issues.length,6);
  for(const path of Object.keys(screens)){const route='/'+path.replace(/index\.html$/,'');assert.ok(broken.issues.some(issue=>issue.startsWith(`${route}: broken link /missing-`)),route);assert.ok(broken.issues.includes(`${route}: broken link /missing-resource.svg`),route);}
  assert.equal(broken.sitemapURLs,localeCodes.length);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('malformed and traversal-encoded local references are reported without aborting the audit',()=>{
 const issues=auditLocalReferences('<a href="/%zz">Bad</a><a href="/%2e%2e%2foutside">Escape</a><a href="https://example.org/">External</a>','https://wase.download/en/',{directory:'/tmp/wase-seo-test',localExists:()=>true});
 assert.deepEqual(issues,['invalid link /%zz','unsafe local link /%2e%2e%2foutside']);
});
