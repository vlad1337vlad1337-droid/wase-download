import {readdirSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {sitemapURLs} from './sitemap-urls.mjs';
import {strings} from '../site/src/strings.js';
import {pairs} from '../site/src/published-pairs.js';
const base='https://wase.download',root=resolve('dist');
const read=p=>readFileSync(p,'utf8');
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(p,e.name)):e.name.endsWith('.html')?[resolve(p,e.name)]:[]);
export function audit(){
 const issues=[],xml=read(resolve(root,'sitemap.xml'));
 const urls=sitemapURLs(root),listed=new Set(urls),pages=new Map(),titles=new Set();
 if(urls.length!==listed.size)issues.push('Duplicate sitemap URLs');

 for(const file of walk(root)){
  const html=read(file),path='/'+relative(root,file).replaceAll('\\','/').replace(/index\.html$/,''),url=base+path;
  if(html.includes('data-error-page="true"')){
   if(!/^\/(en|ru|zh)\/404\.html$/.test(path)||!html.includes('noindex,follow')||listed.has(url))issues.push(`${path}: invalid error page indexing`);
   continue;
  }
  const canonical=html.match(/<link rel="canonical" href="([^"]+)"/),title=html.match(/<title>([^<]+)<\/title>/)?.[1];
  if(!canonical){issues.push(`${path}: missing canonical`);continue;}
  // The language chooser at / intentionally duplicates /en/; it is not a canonical page.
  if(canonical[1]!==url){if(html.includes('data-retired="true"')&&html.includes('noindex,follow')&&/^https:\/\/wase\.download\/(en|ru|zh)\/formats\/[^/]+\/$/.test(canonical[1])&&existsSync(resolve(root,'.'+new URL(canonical[1]).pathname,'index.html')))continue;if(path!=='/')issues.push(`${path}: unexpected canonical ${canonical[1]}`);continue;}
  if(/<meta name="robots" content="noindex,follow"/.test(html)){if(!/^\/(en|ru|zh)\/formats\/[^/]+\/$/.test(path))issues.push(`${path}: unexpected noindex`);continue;}
  pages.set(url,html);
  if(!listed.has(url))issues.push(`${path}: canonical page missing from sitemap`);
  if(!title||titles.has(title))issues.push(`${path}: missing or duplicate title`);titles.add(title);
  if((html.match(/<h1(?:\s[^>]*)?>/g)||[]).length!==1)issues.push(`${path}: expected one H1`);
  if(!/<meta name="description" content="[^"]+"/.test(html))issues.push(`${path}: missing description`);
  if(/<meta[^>]+(?:noindex|nofollow)/i.test(html))issues.push(`${path}: blocked indexing`);
  const schema=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
  try{if(JSON.parse(schema).url!==url)issues.push(`${path}: schema URL mismatch`);}catch{issues.push(`${path}: invalid structured data`);}
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   const target=new URL(m[1].replaceAll('&amp;','&'),url);if(target.origin!==base)continue;
   const local=resolve(root,'.'+decodeURIComponent(target.pathname));
   if(!existsSync(local)&&!existsSync(resolve(local,'index.html')))issues.push(`${path}: broken link ${target.pathname}`);
  }
  const alternates=[...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)];
  if(alternates.length!==Object.keys(strings).length+1)issues.push(`${path}: incomplete hreflang`);
  for(const [,language,target]of alternates){
   const targetFile=resolve(root,'.'+new URL(target).pathname,'index.html');
   if(!existsSync(targetFile))continue;
   const other=read(targetFile);
   if(!other.includes(`hreflang="${path.startsWith('/zh/')?'zh-CN':path.split('/')[1]}" href="${url}"`))issues.push(`${path}: hreflang not reciprocal (${language})`);
  }
 }
 for(const url of urls)if(!pages.has(url))issues.push(`${url}: sitemap entry is not an existing canonical HTML page`);
 const catalogue=JSON.parse(read(resolve(root,'formats.json'))),categories={};let declared=0,same=0;
 const outputs=new Set();
 for(const [input,group]of Object.entries(catalogue.inputs)){
  const targets=catalogue.groups[group],category=catalogue.categories[input];
  if(!Array.isArray(targets)||!targets.length){issues.push(`${input}: no declared targets`);continue;}
  categories[category]??={inputs:0,declaredPairs:0};categories[category].inputs++;categories[category].declaredPairs+=targets.length;
  declared+=targets.length;for(const target of targets){outputs.add(target);if(input===target)same++;}
 }
 for(const [slug,[a,b]]of Object.entries(pairs)){
  const targets=catalogue.groups[catalogue.inputs[a.toLowerCase()]]||[];
  if(!targets.includes(b.toLowerCase()))issues.push(`${slug}: published pair absent from declared catalogue`);
 }
 return {canonicalPages:pages.size,sitemapURLs:urls.length,publishedPairs:Object.keys(pairs).length,languages:Object.keys(strings),inputFormats:Object.keys(catalogue.inputs).length,outputFormats:outputs.size,declaredPairs:declared,sameFormatPairs:same,crossFormatPairs:declared-same,unpublishedCrossFormatPairs:declared-same-Object.keys(pairs).length,categories,issues};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const result=audit();if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.issues.length)process.exitCode=1;}
