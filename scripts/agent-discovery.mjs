// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const languageNames={en:'English',ru:'Русский',zh:'简体中文',es:'Español',fr:'Français',de:'Deutsch',pt:'Português',it:'Italiano',tr:'Türkçe',ja:'日本語',ko:'한국어',ar:'العربية',hi:'हिन्दी'};
const preferredExamples=['png-to-svg','jpg-to-svg','svg-to-png','png-to-webp','webp-to-png','txt-to-pdf','html-to-txt','epub-to-txt','wav-to-mp3','zip-to-tar-gz','tar-gz-to-zip','woff2-to-ttf','ttf-to-otf','pdf-to-svg'];
export const mcpExamples={
 initialize:{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'wase-discovery-example',version:'1.0.0'}}},
 initialized:{jsonrpc:'2.0',method:'notifications/initialized'},
 listTools:{jsonrpc:'2.0',id:2,method:'tools/list'},
 listFormats:{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'list_formats',arguments:{category:'image',limit:20}}},
 conversionInfo:{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'conversion_info',arguments:{from:'png',to:'svg'}}}
};

export function discoveryFacts({catalogue,pairs,localeCodes,base='https://wase.download'}){
 const origin=new URL(base);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw new TypeError('Discovery base must be a public HTTPS origin');
 if(!catalogue?.inputs||!Array.isArray(catalogue.groups)||!pairs||!Array.isArray(localeCodes)||!localeCodes.length)throw new TypeError('Missing published catalogue, pairs or locales');
 const languages=[...new Set(localeCodes)];if(languages.some(code=>!languageNames[code]))throw new TypeError('Unknown published locale');
 const inputs=Object.keys(catalogue.inputs).sort(),outputs=new Set(),categories={};let declaredDirections=0;
 for(const input of inputs){const group=catalogue.groups[catalogue.inputs[input]];if(!Array.isArray(group)||!group.length)throw new TypeError('An input has no declared targets');declaredDirections+=group.length;for(const output of group)outputs.add(output);const category=catalogue.categories?.[input]||'other';categories[category]=(categories[category]||0)+1;}
 const verified=Object.entries(pairs).sort(([a],[b])=>a.localeCompare(b)).map(([slug,pair])=>{
  if((!/^[a-z0-9][a-z0-9.-]*$/.test(slug)||slug.includes('..'))||!Array.isArray(pair)||pair.length!==2)throw new TypeError('Invalid published pair');
  const [from,to]=pair.map(value=>String(value).toLowerCase());if(!catalogue.groups[catalogue.inputs[from]]?.includes(to))throw new TypeError(`Published direction is absent from public catalogue: ${slug}`);
  return {from,to,slug};
 });
 if(new Set(verified.map(({from,to})=>from+':'+to)).size!==verified.length)throw new TypeError('Duplicate published direction');
 const fileMB=catalogue.limits?.fileMB,batch=catalogue.limits?.batch;if(!Number.isFinite(fileMB)||fileMB<=0||!Number.isInteger(batch)||batch<1)throw new TypeError('Missing operational limits');
 return {base:origin.origin,languages,counts:{declaredInputs:inputs.length,declaredOutputs:outputs.size,declaredDirections,representativeTestedDirections:verified.length,localizedCanonicalPages:(verified.length+5)*languages.length},categories,limits:{fileMB,batch},verified};
}

function markdownGuide(facts){
 const {base,counts,limits}=facts;
 const post=(message)=>`curl --fail --max-time 15 '${base}/api/mcp' \\\n  --header 'Content-Type: application/json' \\\n  --header 'Accept: application/json, text/event-stream' \\\n  --header 'MCP-Protocol-Version: 2025-06-18' \\\n  --data '${JSON.stringify(message)}'`;
 return `# Wase Download: API and agent guide

Wase Download is a self-hosted file converter. It requires no account or third-party conversion API key. Public conversion instructions are static localized HTML and are readable without executing the app. File conversion is a separate operation that uploads a file when the user chooses server processing.

## Capabilities and evidence

The deployed build declares **${counts.declaredInputs} input identifiers**, **${counts.declaredOutputs} output identifiers** and **${counts.declaredDirections} directional combinations** after filtering devices, pseudo-formats and ordinary still-image-to-video synthesis. Targets depend on the input; formats are not an all-to-all matrix.

**${counts.representativeTestedDirections} published directions** have representative-fixture validation and successful HTTP conversion evidence. This is not a guarantee for every file, codec, font, document feature, animation or visual result. The full published list is [verified-conversions.json](${base}/verified-conversions.json). Its evidence is historical representative testing, not a live health check of every pair.

- [Static catalogue](${base}/formats.json): public declarations from this build.
- [Runtime catalogue](${base}/api/formats): declarations reported by the running broker.
- [Human format directory](${base}/en/formats/): tested conversion pages and the declared catalogue.
- [Audit source](https://github.com/vlad1337vlad1337-droid/wase-download/tree/master/deploy/seo): receipts, fixture coverage and known gaps.

Both catalogues use \`inputs\`, \`groups\`, \`categories\` and \`limits\`. To obtain a source's targets, read \`groups[inputs[source]]\`. An unknown source has no group. Identifiers are exact lower-case strings: for example \`jpg\`, \`jpeg\` and \`tar.gz\` are catalogue keys, not MIME types. JPG/JPEG may have different declared target lists; select a key actually present in the catalogue instead of assuming universal aliases. Neither MIME sniffing nor a filename extension proves a file is valid.

## Read-only MCP discovery

Endpoint: **${base}/api/mcp**. It is stateless Streamable HTTP using JSON-RPC 2.0 and JSON responses. There are exactly two public tools: \`list_formats\` and \`conversion_info\`. They read metadata only. They do not accept file bytes or file URLs, start conversion jobs, run commands, create download links, or expose user files.

Use the official MCP client to initialize and negotiate a supported protocol version. The implementation supports \`2025-06-18\`, \`2025-03-26\` and \`2024-11-05\`; these examples use \`2025-06-18\`. It does not open an SSE stream: GET returns 405. POST notifications without an id return 202 with no body. No persistent session id is required.

Initialize:

\`\`\`\`sh
${post(mcpExamples.initialize)}
\`\`\`

Send the initialized notification after the initialization response, then discover tools:

\`\`\`\`sh
${post(mcpExamples.initialized)}
${post(mcpExamples.listTools)}
\`\`\`

Find declared inputs in the image category:

\`\`\`\`sh
${post(mcpExamples.listFormats)}
\`\`\`

\`list_formats\` accepts optional \`category\`, \`query\`, \`offset\` and \`limit\`. Categories are \`image\`, \`vector\`, \`document\`, \`ebook\`, \`audio\`, \`archive\`, \`video\`, \`presentation\`, \`font\` and \`cad\`. Default limit is 40, maximum 100; query/category strings are at most 32 characters. \`nextOffset\` is null on the last page. The result's \`formats[].outputs\` is a declared output count, not a tested count.

Check PNG to SVG, or omit \`to\` to list a source's declared outputs:

\`\`\`\`sh
${post(mcpExamples.conversionInfo)}
\`\`\`

Read \`result.structuredContent\` directly. It is also serialized in \`result.content[0].text\`. A pair result contains \`declared: true\` or \`false\`; that field does not mean a representative or arbitrary file was tested. Unknown sources and unsupported pairs return \`declared: false\`, not an instruction to upload anyway. A JSON-RPC \`error\` can be returned with HTTP 200; inspect both the HTTP status and the JSON body.

MCP requests are limited to 16 KiB with bounded body read time, per-client/global request rates and connection occupancy. Unknown tools/arguments and JSON-RPC batches are rejected. Unapproved browser Origin values receive 403. Rate limiting returns 429 and \`Retry-After: 60\`. Discovery is public, but clients should reuse metadata and avoid repeated polling.

## Explicit file conversion over HTTP

The MCP tools cannot convert. The separate HTTP upload operation is:

\`\`\`text
POST ${base}/api/convert?from=png&to=svg
Content-Type: application/octet-stream
Body: one file's original binary bytes
\`\`\`

Use this operation only when the user has chosen the file and authorized uploading it for conversion. No remote URL fetching is implemented. There is no multipart form, remote-file URL parameter, API token requirement or separate polling/download endpoint. Browser cross-origin requests are restricted by Origin checks.

Example with a user-selected local file, after checking the pair:

\`\`\`sh
curl --fail --max-time 210 \\
  --request POST '${base}/api/convert?from=png&to=svg' \\
  --header 'Content-Type: application/octet-stream' \\
  --data-binary '@input.png' \\
  --dump-header response.headers \\
  --output result.bin
\`\`\`

Verify curl succeeded and the response is HTTP 200 before treating the output as a converted file. Read \`Content-Disposition\` for the result filename. A single result normally uses \`application/octet-stream\`, even when its extension is SVG, PNG, PDF or another type. Multi-file exports return a ZIP with \`application/zip\`; do not assume the requested target guarantees the response is a single file or infer the result solely from Content-Type. Validate a downloaded file before opening it in another tool. Conversion credit identifies Wase Download and does not transfer ownership of the input.

The server limit is **${limits.fileMB} MiB per input file** and **200 MiB aggregate output**, with one active conversion and at most eight waiting jobs on the current deployment. The app permits **${limits.batch} files per UI batch**, processed one by one; a single HTTP upload request still contains one file. The total server request deadline is 180 seconds, so resource-limited large files may fail or disconnect rather than complete immediately. Do not repeatedly retry an expensive failed conversion.

The optional browser-only image fallback is a separate narrower path: 20 MiB per file, 16 megapixels and an 8192-pixel edge, with bounded tracing resolution. It is not a general API for documents, archives, video or CAD. It processes supported images on the visitor's device. Browser and server results or available targets may differ. Photos traced to SVG are approximations, not lossless vector images.

### Error handling

- **400**: the \`from\`/\`to\` pair is absent from the public runtime catalogue.
- **403**: an unapproved Origin header was supplied.
- **413**: the request exceeds the input limit.
- **422**: the supplied file could not be converted/validated, or no engine produced a safe valid output. Try a valid smaller file or another declared output; do not claim success.
- **429**: rate, occupancy or waiting-queue limit. Honor \`Retry-After\` (currently 60 seconds) and avoid parallel retries.
- **404**: unknown API path/method outside the supported discovery route.
- **405/415 on MCP**: method or request Content-Type is unsupported.
- **500 or interrupted connection**: unexpected failure, cancellation or a deadline; no result is guaranteed. Do not present partial bytes as a completed conversion.

## File privacy and retention

Temporary server inputs and outputs are deleted after success, cancellation or error cleanup. There is no public user-file URL, persistent history or resumable download id; the converted output is returned in the original response. Conversion containers have networking disabled and bounded CPU/memory. Browsing documentation or calling MCP discovery does not upload files. Browser-only image processing remains local. A client that uploads through the HTTP API is using server processing, not local processing. See the [privacy policy](${base}/en/privacy/) for the site and optional analytics.

## Discovery and indexing

Localized HTML, normal internal links, canonical URLs, reciprocal language alternatives and [Sitemap](${base}/sitemap.xml) are the normal web-discovery surface. The [llms.txt index](${base}/llms.txt) and this plain-text guide are optional aids for agents. The llms.txt format is a community proposal; it is not a universal crawler protocol, provider registration, ranking signal or promise of indexing/citation. Different search and AI providers choose what to crawl, index or cite.

## Standards and source

- [MCP transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [llms.txt proposal](https://llmstxt.org/)
- [Project source and licenses](https://github.com/vlad1337vlad1337-droid/wase-download)
`;
}

export function buildAgentDiscovery(options){
 const facts=discoveryFacts(options),{base,languages,counts,limits,verified}=facts;
 const examples=preferredExamples.filter(slug=>options.pairs[slug]);
 const languageLinks=languages.map(lang=>`- [${languageNames[lang]}](${base}/${lang}/): converter, [formats](${base}/${lang}/formats/), [developers](${base}/${lang}/developers/), [privacy](${base}/${lang}/privacy/).`).join('\n');
 const exampleLinks=examples.map(slug=>`- [${options.pairs[slug].join(' → ')}](${base}/en/${slug}/): representative-tested direction; input-specific limitations still apply.`).join('\n');
 const guide=markdownGuide(facts);
 const index=`# Wase Download

> Self-hosted file conversion with static instructions in ${languages.length} languages. No account or third-party conversion API key. Read-only MCP discovers declared capabilities; file upload is a separate user-authorized operation.

The public build declares ${counts.declaredInputs} inputs, ${counts.declaredOutputs} outputs and ${counts.declaredDirections} directional combinations. ${counts.representativeTestedDirections} published directions have representative-fixture HTTP evidence. Declarations and fixture success do not guarantee arbitrary files. Server processing accepts up to ${limits.fileMB} MiB per file; the app permits ${limits.batch} files per batch, processed individually. Optional browser image processing has separate, narrower limits.

## Documentation

- [Formats](${base}/en/formats/): human-readable tested pages and declared format directory.
- [Developers](${base}/en/developers/): HTTP upload API and read-only MCP.
- [API and agent guide](${base}/api-guide.md): exact requests, response handling, limits, errors and file privacy.
- [Public catalogue](${base}/formats.json): input-dependent declared targets; no uploaded files.
- [Representative-tested directions](${base}/verified-conversions.json): complete published pair list and evidence boundary.
- [Privacy](${base}/en/privacy/): server deletion, browser processing and optional analytics.
- [Sitemap](${base}/sitemap.xml): canonical pages admitted for web indexing.

## Languages

${languageLinks}

## Example conversions

${exampleLinks}

## Optional

- [Expanded plain-text guide](${base}/llms-full.txt): API guide, language navigation and representative examples in one document.
- [Source and licenses](https://github.com/vlad1337vlad1337-droid/wase-download): MIT interface/tooling, separate AGPL server integration and retained upstream licenses.

This llms.txt is a voluntary community-format navigation aid, not a provider registry or guarantee of indexing, ranking or citations. MCP endpoint: ${base}/api/mcp (list_formats, conversion_info). Metadata discovery does not upload files; remote URL conversion is not implemented.
`;
 const full=guide+`\n## Localized navigation\n\n${languageLinks}\n\n## Representative conversion pages\n\n${exampleLinks}\n`;
 const manifest={schemaVersion:1,site:base,description:'Project-specific published conversion evidence manifest. This JSON is not an AI-provider registration standard.',languages,counts,limits:{...limits,unit:'MiB',batchAppliesTo:'UI batch; one file per HTTP upload'},evidence:{scope:'Published directions admitted after representative-file validation and successful historical HTTP checks',guaranteesArbitraryFiles:false,liveHealthCheck:false},urlTemplate:base+'/{language}/{slug}/',pairs:verified};
 return {'llms.txt':index,'llms-full.txt':full,'api-guide.md':guide,'verified-conversions.json':JSON.stringify(manifest)+'\n'};
}

export function writeAgentDiscovery(outputDirectory,options){
 const documents=buildAgentDiscovery(options);mkdirSync(outputDirectory,{recursive:true});
 for(const [name,contents]of Object.entries(documents))writeFileSync(join(outputDirectory,name),contents);
 return Object.keys(documents);
}
