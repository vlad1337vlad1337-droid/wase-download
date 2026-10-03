import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {sitemapURLs} from '../scripts/sitemap-urls.mjs';
test('localized error pages have usable links and stay out of search indexing',()=>{
 const listed=sitemapURLs('dist');
 for(const lang of ['ru','en','zh']){
  const html=readFileSync(`dist/${lang}/404.html`,'utf8');
  assert.match(html,/data-error-page="true"/);assert.match(html,/noindex,follow/);
  assert.equal((html.match(/<h1>/g)||[]).length,1);assert.ok(!listed.includes(`https://wase.download/${lang}/404.html`));
  assert.ok(html.includes(`class="primary" href="/${lang}/"`));assert.ok(html.includes(`href="/${lang}/formats/"`));
  for(const [,link]of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   const target=new URL(link,'https://wase.download');if(target.origin!=='https://wase.download')continue;
   const path='dist'+target.pathname;assert.ok(existsSync(path)||existsSync(path+'index.html'),link);
  }
 }
});
