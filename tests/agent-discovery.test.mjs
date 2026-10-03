// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {buildAgentDiscovery,writeAgentDiscovery,discoveryFacts,mcpExamples} from '../scripts/agent-discovery.mjs';
import {discoveryHandler} from '../backend/discovery.mjs';
import {publicCatalogue} from '../backend/conversion-policy.mjs';
import {pairs} from '../site/src/published-pairs.js';
import {localeCodes} from '../site/src/locales.js';
const catalogue=publicCatalogue(JSON.parse(readFileSync(new URL('../site/data/catalog.json',import.meta.url),'utf8')));
const options={catalogue,pairs,localeCodes};
const documents=buildAgentDiscovery(options);

test('AI navigation derives declarations, published evidence and language counts from the build',()=>{
 const manifest=JSON.parse(documents['verified-conversions.json']);
 assert.equal(manifest.counts.declaredInputs,Object.keys(catalogue.inputs).length);
 assert.equal(manifest.counts.declaredOutputs,new Set(catalogue.groups.flat()).size);
 assert.equal(manifest.counts.declaredDirections,Object.values(catalogue.inputs).reduce((n,index)=>n+catalogue.groups[index].length,0));
 assert.equal(manifest.pairs.length,Object.keys(pairs).length);
 assert.deepEqual(manifest.languages,localeCodes);
 assert.equal(manifest.evidence.guaranteesArbitraryFiles,false);
 assert.equal(manifest.evidence.liveHealthCheck,false);
 for(const {from,to,slug}of manifest.pairs){assert.deepEqual(pairs[slug].map(v=>v.toLowerCase()),[from,to]);assert.ok(catalogue.groups[catalogue.inputs[from]].includes(to));}
 assert.match(documents['llms.txt'],/community-format navigation aid/);
 assert.match(documents['api-guide.md'],/not a universal crawler protocol/);
});

test('optional llms index links every locale and only admitted example conversion pages',()=>{
 const index=documents['llms.txt'];
 for(const lang of localeCodes)for(const path of ['', 'formats/', 'developers/', 'privacy/'])assert.ok(index.includes(`https://wase.download/${lang}/${path}`));
 for(const path of ['api-guide.md','llms-full.txt','verified-conversions.json','formats.json','sitemap.xml'])assert.ok(index.includes('https://wase.download/'+path));
 const examples=[...index.matchAll(/https:\/\/wase\.download\/en\/([^/)]+-to-[^/)]+)\//g)].map(m=>m[1]);
 assert.ok(examples.length>5);assert.ok(examples.every(slug=>pairs[slug]));
 assert.ok(!index.includes('400000'));assert.ok(!index.includes('agents.json'));assert.match(index,/does not upload files/);
});

test('discovery counts update for another valid published build instead of stale marketing totals',()=>{
 const small={catalogue:{inputs:{png:0,jpg:0,txt:1},groups:[['svg','webp'],['pdf']],categories:{png:'image',jpg:'image',txt:'document'},limits:{fileMB:80,batch:5}},pairs:{'png-to-svg':['PNG','SVG'],'txt-to-pdf':['TXT','PDF']},localeCodes:['en','ru']};
 const facts=discoveryFacts(small);assert.deepEqual(facts.counts,{declaredInputs:3,declaredOutputs:3,declaredDirections:5,representativeTestedDirections:2,localizedCanonicalPages:14});
 assert.deepEqual(facts.categories,{image:2,document:1});const docs=buildAgentDiscovery(small);
 assert.match(docs['llms.txt'],/80 MiB per file/);assert.match(docs['llms.txt'],/5 files per batch/);
 assert.match(docs['api-guide.md'],/one HTTP upload request still contains one file|a single HTTP upload request still contains one file/);
});

test('generated agent guide has valid Markdown fences and accurate upload/response semantics',()=>{
 const guide=documents['api-guide.md'];
 assert.equal((guide.match(/^```/gm)||[]).length,12);
 assert.ok(!/^``(?:sh|text)$/m.test(guide));assert.ok(!guide.includes('\\`'));
 assert.match(guide,/--data-binary '@input\.png'/);assert.match(guide,/Content-Disposition/);
 assert.match(guide,/application\/octet-stream/);assert.match(guide,/Multi-file exports return a ZIP/);
 assert.match(guide,/HTTP 200; inspect both the HTTP status and the JSON body/);
 assert.match(guide,/user has chosen the file and authorized uploading it/);
 assert.match(guide,/No remote URL fetching is implemented/);
 assert.match(guide,/JPG\/JPEG may have different declared target lists/);
 assert.match(guide,/Temporary server inputs and outputs are deleted after success, cancellation or error cleanup/);
 assert.match(guide,/\*\*429\*\*/);assert.match(guide,/Retry-After/);
});

async function invoke(handler,message){
 const bytes=Buffer.from(JSON.stringify(message)),req=Readable.from([bytes]);req.method='POST';req.headers={'content-type':'application/json','content-length':String(bytes.length),accept:'application/json, text/event-stream','mcp-protocol-version':'2025-06-18'};req.socket={remoteAddress:'127.0.0.1'};req.complete=true;
 const res=new EventEmitter();res.headers={};res.destroyed=false;res.headersSent=false;
 res.setHeader=(name,value)=>{res.headers[name.toLowerCase()]=value;};res.writeHead=(status,headers={})=>{res.statusCode=status;for(const [name,value]of Object.entries(headers))res.setHeader(name,value);res.headersSent=true;return res;};
 res.end=body=>{res.body=body?String(body):'';res.emit('finish');return res;};res.destroy=()=>{res.destroyed=true;res.emit('close');};
 await handler(req,res);return {...res,payload:res.body?JSON.parse(res.body):null};
}

test('all documented MCP requests execute against the actual read-only discovery handler',async()=>{
 const handler=discoveryHandler({matrix:{png:{svg:['vtracer']},txt:{pdf:['libreoffice']}},categories:{png:'image',txt:'document'}},new Set(['https://wase.download']),100);
 const init=await invoke(handler,mcpExamples.initialize);assert.equal(init.statusCode,200);assert.equal(init.payload.result.protocolVersion,'2025-06-18');
 const notification=await invoke(handler,mcpExamples.initialized);assert.equal(notification.statusCode,202);assert.equal(notification.payload,null);
 const tools=await invoke(handler,mcpExamples.listTools);assert.deepEqual(tools.payload.result.tools.map(tool=>tool.name),['list_formats','conversion_info']);assert.ok(tools.payload.result.tools.every(tool=>tool.annotations.readOnlyHint));
 const list=await invoke(handler,mcpExamples.listFormats);assert.deepEqual(list.payload.result.structuredContent.formats,[{from:'png',category:'image',outputs:1}]);
 const info=await invoke(handler,mcpExamples.conversionInfo);assert.equal(info.payload.result.structuredContent.declared,true);assert.equal(info.payload.result.structuredContent.limits.fileMB,100);
 const unknown=await invoke(handler,{...mcpExamples.conversionInfo,params:{name:'conversion_info',arguments:{from:'missing',to:'svg'}}});assert.equal(unknown.payload.result.structuredContent.declared,false);
 assert.ok(!tools.payload.result.tools.some(tool=>/upload|convert_file|execute/.test(tool.name)));
});

test('agent manifest rejects invented published pairs, duplicate evidence and invalid origins',()=>{
 const small={catalogue:{inputs:{png:0},groups:[['svg']],categories:{png:'image'},limits:{fileMB:100,batch:20}},pairs:{'png-to-svg':['PNG','SVG']},localeCodes:['en']};
 assert.throws(()=>buildAgentDiscovery({...small,pairs:{'png-to-mp4':['PNG','MP4']}}),/absent from public catalogue/);
 assert.throws(()=>buildAgentDiscovery({...small,pairs:{...small.pairs,'png-to-svg-copy':['PNG','SVG']}}),/Duplicate/);
 for(const base of ['http://wase.download','https://wase.download/untrusted/path/','https://user:password@wase.download/','https://wase.download/?query=1'])assert.throws(()=>buildAgentDiscovery({...small,base}),/public HTTPS origin/);
 assert.throws(()=>buildAgentDiscovery({...small,localeCodes:['invented']}),/Unknown published locale/);
});

test('writer produces deterministic static documents without API calls or remote file access',()=>{
 const folder=mkdtempSync(join(tmpdir(),'wase-agent-guide-'));
 try{const written=writeAgentDiscovery(folder,options);assert.deepEqual(written,Object.keys(documents));for(const file of written)assert.equal(readFileSync(join(folder,file),'utf8'),documents[file]);assert.deepEqual(buildAgentDiscovery(options),documents);}
 finally{rmSync(folder,{recursive:true,force:true});}
});
