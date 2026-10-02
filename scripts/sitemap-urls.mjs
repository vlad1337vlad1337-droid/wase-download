import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function sitemapURLs(root,file='sitemap.xml',seen=new Set()){
 if(seen.has(file))throw new Error('Sitemap cycle');seen.add(file);
 const xml=readFileSync(resolve(root,file),'utf8');
 const locations=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 if(locations.length>50000||Buffer.byteLength(xml)>50*1024*1024)throw new Error('Sitemap exceeds protocol limits');
 if(!xml.includes('<sitemapindex'))return locations;
 return locations.flatMap(url=>{const u=new URL(url);if(u.origin!=='https://wase.download'||!/^\/sitemap-[a-z]+-\d+\.xml$/.test(u.pathname))throw new Error('Invalid child sitemap');return sitemapURLs(root,u.pathname.slice(1),seen);});
}
