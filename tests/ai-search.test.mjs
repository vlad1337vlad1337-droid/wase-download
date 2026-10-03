// SPDX-License-Identifier: MIT
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchBots,searchMetadata} from '../scripts/search-metadata.mjs';
import {localeCodes,languageTag} from '../site/src/locales.js';
import {developerCopy} from '../site/src/developer-copy.js';
const read=path=>readFileSync(path,'utf8');

test('public search and AI readers share a wildcard policy that excludes all API operations',()=>{
 const policy=read('dist/robots.txt').replace(/#.*$/gm,'');
 const users=[...policy.matchAll(/^User-agent:\s*(\S+)/gm)].map(match=>match[1]);
 assert.deepEqual(users,['*']); // No specific bot group can lose API exclusions.
 assert.match(policy,/^Allow: \/$/m);assert.match(policy,/^Disallow: \/api\/$/m);assert.match(policy,/^Disallow: \/api\$$/m);
 assert.match(policy,/^Sitemap: https:\/\/wase.download\/sitemap.xml$/m);
 for(const bot of searchBots)assert.ok(!policy.includes(bot),bot+' must retain the same public policy');
 assert.ok(!/Crawl-delay|Disallow:\s*\/$/m.test(policy));
});

test('localized HTML identifies the real application and publisher without synthetic ratings',()=>{
 for(const lang of localeCodes)for(const route of ['', 'epub-to-txt/', 'developers/']){
  const canonical=`https://wase.download/${lang}/${route}`,html=read(`dist/${lang}/${route}index.html`);
  const schemas=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(match=>JSON.parse(match[1]));
  assert.equal(schemas.length,2);assert.equal(schemas[0].url,canonical);assert.equal(schemas[0].inLanguage,languageTag(lang));
  assert.ok(schemas[0].description.length>20);assert.equal(schemas[0].publisher['@id'],'https://wase.download/#organization');
  const entity=schemas[1]['@graph'];assert.equal(entity[0]['@type'],'Organization');assert.deepEqual(entity[0].sameAs,['https://github.com/vlad1337vlad1337-droid/wase-download']);
  assert.equal(entity[1]['@type'],'WebSite');assert.deepEqual(entity[1].inLanguage,localeCodes.map(languageTag));
  assert.match(html,/index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1/);
  assert.ok(!/(?:aggregateRating|reviewCount|SearchAction|speakable)/.test(JSON.stringify(schemas)));
 }
});

test('static guidance remains meaningful before any script executes and the loader is opt-in',()=>{
 for(const lang of localeCodes){
  const html=read(`dist/${lang}/epub-to-txt/index.html`);
  assert.match(html,/<h1>[^<]+<\/h1>/);assert.match(html,/<ol><li>[^<]+<\/li>/);
  assert.ok(html.includes(`<noscript><p>`));assert.ok(html.includes(developerCopy[lang].noScript));
  assert.ok(!/<html[^>]+class="[^"]*is-booting/.test(html));
  assert.match(html,/\.boot-screen\{display:none\}/);
  const main=html.match(/<main>([\s\S]*?)<\/main>/)?.[1];assert.ok(main&&main.includes('conversion-guide'));
 }
});

test('developer pages link readable evidence and explain the read-only MCP versus file upload',()=>{
 for(const lang of localeCodes){
  const html=read(`dist/${lang}/developers/index.html`),copy=developerCopy[lang];
  for(const key of ['docs','instructions','apiGuide','catalogue','evidence','declared','verified','readOnly','initialize','upload'])assert.ok(typeof copy[key]==='string'&&copy[key].trim().length>0,lang+': '+key);
  for(const path of ['/api-guide.md','/llms.txt','/llms-full.txt','/formats.json','/verified-conversions.json'])assert.ok(html.includes(`href="${path}"`),lang+path);
  assert.ok(html.includes('conversion_info'));assert.ok(html.includes('POST /api/convert?from=png&amp;to=svg'));
  assert.ok(!html.includes('undefined'));
 }
});

test('nonverified catalogues and errors retain noindex; snippet allowance cannot reverse it',()=>{
 for(const lang of localeCodes){
  assert.match(read(`dist/${lang}/404.html`),/<meta name="robots" content="noindex,follow">/);
  assert.match(read(`dist/${lang}/formats/png/index.html`),/<meta name="robots" content="noindex,follow">/);
 }
});

test('structured data and social descriptions cannot break out into executable HTML',()=>{
 const title='</script><script>bad()</script>',metadata=searchMetadata({title,description:'"<unsafe>',lang:'en',path:'/en/'});
 assert.ok(!metadata.includes('<script>bad()'));assert.ok(!metadata.includes('content=""<unsafe>'));
 const schema=JSON.parse(metadata.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);assert.equal(schema.name,title+' · wase.download');
});
