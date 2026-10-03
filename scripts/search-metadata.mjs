// SPDX-License-Identifier: MIT
import {localeCodes,languageTag} from '../site/src/locales.js';

export const searchBots=['Googlebot','Google-Extended','bingbot','YandexBot','YandexAdditional','YandexAdditionalBot','OAI-SearchBot','ChatGPT-User','GPTBot','Claude-SearchBot','Claude-User','ClaudeBot','PerplexityBot','Perplexity-User','Applebot','Applebot-Extended'];
const base='https://wase.download';
const repository='https://github.com/vlad1337vlad1337-droid/wase-download';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');

// A single wildcard policy also covers unknown/new crawlers. Specific groups
// must not accidentally override the API exclusion or imply privileged access.
export function robotsText(){
 return `# Public HTML, assets and documentation are open to search and AI crawlers.\n# Search: Googlebot, bingbot, YandexBot, YandexAdditional, YandexAdditionalBot,\n# OAI-SearchBot, Claude-SearchBot, PerplexityBot, Applebot.\n# User-initiated readers: ChatGPT-User, Claude-User, Perplexity-User.\n# The existing allow policy for GPTBot, ClaudeBot, Google-Extended and\n# Applebot-Extended is retained; training controls are separate from search.\n# robots.txt is a crawl policy, not API authentication or a firewall bypass.\nUser-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /api$\nSitemap: ${base}/sitemap.xml\n`;
}

export function searchMetadata({title,description,lang,path,kind=null,pair=null,indexable=true}){
 if(!localeCodes.includes(lang)||!path.startsWith(`/${lang}/`))throw new TypeError('Unknown page locale');
 const url=base+path,website=base+'/#website',organization=base+'/#organization';
 const primary={
  '@context':'https://schema.org','@type':kind?'WebPage':'WebApplication',
  '@id':url+'#page',name:title+' · wase.download',description,url,
  inLanguage:languageTag(lang),isAccessibleForFree:true,
  isPartOf:{'@id':website},publisher:{'@id':organization},
  ...(kind?{}:{applicationCategory:'MultimediaApplication',operatingSystem:'Web browser',
   offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},
   softwareHelp:{'@type':'CreativeWork',url:base+`/${lang}/developers/`},
   ...(pair?{about:pair.map(format=>({'@type':'Thing',name:format}))}:{})})
 };
 const entities={'@context':'https://schema.org','@graph':[
  {'@type':'Organization','@id':organization,name:'Wase Download',alternateName:'wase.download',
   url:base+'/',logo:{'@type':'ImageObject',url:base+'/apple-touch-icon.png'},sameAs:[repository]},
  {'@type':'WebSite','@id':website,name:'Wase Download',alternateName:'wase.download',url:base+'/',
   inLanguage:localeCodes.map(languageTag),publisher:{'@id':organization}}
 ]};
 return `<meta name="robots" content="${indexable?'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1':'noindex,follow'}"><meta property="og:site_name" content="Wase Download"><meta property="og:image:alt" content="Wase Download"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)} · wase.download"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${base}/social.png"><link rel="alternate" type="text/plain" href="/llms.txt" title="Wase Download agent documentation"><script type="application/ld+json">${json(primary)}</script><script type="application/ld+json">${json(entities)}</script>`;
}
