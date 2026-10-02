import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {page,inputRoutes} from './generate.mjs';
import {strings} from '../site/src/strings.js';
import {pairs} from '../site/src/published-pairs.js';
const base='https://wase.download',template=readFileSync('dist/en/index.html','utf8');
const script=template.match(/<script type="module"[^>]+src="\/assets\/[^\"]+"[^>]*><\/script>/)?.[0];
const css=template.match(/<link rel="stylesheet"[^>]+href="\/assets\/[^\"]+"[^>]*>/)?.[0];
if(!script||!css)throw new Error('Missing compiled converter assets');
const sitemaps=[];
for(const lang of Object.keys(strings)){
 const paths=['',...Object.keys(pairs),'privacy','about','formats','developers'];
 for(const path of [...Object.keys(pairs),...Object.values(inputRoutes)]){
  const dir=`dist/${lang}/${path}`;mkdirSync(dir,{recursive:true});
  const html=page(lang,path).replace('<script type="module" src="/src/app.js"></script>',script).replace('<link rel="stylesheet" href="/src/style.css">',css);
  writeFileSync(`${dir}/index.html`,html);
 }
 // Chunking also handles future growth without violating the 50k URL limit.
 for(let offset=0;offset<paths.length;offset+=50000){
  const file=`sitemap-${lang}-${1+offset/50000}.xml`;sitemaps.push(base+'/'+file);
  const urls=paths.slice(offset,offset+50000).map(path=>`${base}/${lang}/${path?path+'/':''}`);
  writeFileSync('dist/'+file,`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`<url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`);
 }
}
writeFileSync('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps.map(url=>`<sitemap><loc>${url}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
console.log(`Generated ${Object.keys(inputRoutes).length} format pages per language; ${sitemaps.length} child sitemaps.`);
