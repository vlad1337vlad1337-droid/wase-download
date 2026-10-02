import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('all sitemap URLs resolve to static localized HTML with consistent metadata',()=>{
 const xml=read('dist/sitemap.xml'),urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.equal(urls.length,78);assert.equal(new Set(urls).size,urls.length);
 for(const url of urls){const pathname=new URL(url).pathname,file='dist'+pathname+'index.html';assert.ok(existsSync(file),file);const html=read(file);assert.ok(html.includes(`<link rel="canonical" href="${url}">`));assert.equal((html.match(/hreflang=/g)||[]).length,4);assert.match(html,/<h1>/);assert.match(html,/<meta name="description" content="[^\"]+">/);const schema=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1];assert.equal(JSON.parse(schema).url,url);}
});
test('declared catalogue is visible without JavaScript and every input has targets',()=>{
 const data=JSON.parse(read('dist/formats.json'));assert.equal(Object.keys(data.inputs).length,915);
 const html=read('dist/en/formats/index.html');for(const [input,group]of Object.entries(data.inputs)){assert.ok(html.includes(input.toUpperCase()),input);assert.ok(data.groups[group]?.length,input);}
 assert.match(read('dist/robots.txt'),/Sitemap: https:\/\/wase.download\/sitemap.xml/);assert.match(read('dist/llms.txt'),/read-only MCP/);
});
