// SPDX-License-Identifier: MIT
// Notify only proven, locally built canonical pages. Importing this file never sends requests.
import {readFile, writeFile, realpath, stat} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const HOST = 'https://wase.download';
export const ENDPOINT = 'https://api.indexnow.org/indexnow';
export const BATCH_LIMIT = 10_000;
const XML_LIMIT = 16 * 1024 * 1024;
const HTML_LIMIT = 2 * 1024 * 1024;
const RESPONSE_LIMIT = 4096;

function xmlText(value) {
  const decoded = value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, entity => {
    const named = {'&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'"};
    if (named[entity]) return named[entity];
    const numeric = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 0x10ffff) throw new Error('Invalid XML entity');
    return String.fromCodePoint(numeric);
  });
  if (/&[^\s<]*;/.test(decoded)) throw new Error('Unsupported XML entity');
  return decoded.trim();
}

export function productionURL(value, kind = 'page') {
  // Reject encoded separators and dot segments before URL normalization can hide them.
  if (typeof value !== 'string' || /[\s\\\x00-\x1f]|%(?:2e|2f|5c|00)/i.test(value)) throw new Error(`Unsafe ${kind} URL`);
  const url = new URL(value);
  if (url.origin !== HOST || url.username || url.password || url.search || url.hash || value !== url.href) throw new Error(`Noncanonical ${kind} URL: ${value}`);
  if (url.pathname.split('/').some(part => part === '.' || part === '..') || /\/\//.test(url.pathname)) throw new Error(`Unsafe ${kind} path`);
  if (kind === 'page' && /^\/(?:api|results?|jobs)(?:\/|$)|^\/\./i.test(url.pathname)) throw new Error(`Nonpublic page URL: ${value}`);
  if (kind === 'page' && !url.pathname.endsWith('/')) throw new Error(`Expected a canonical directory page: ${value}`);
  if (kind === 'sitemap' && !/^\/[a-zA-Z0-9_./-]+\.xml$/.test(url.pathname)) throw new Error(`Invalid sitemap URL: ${value}`);
  return url;
}

async function localFile(directory, pathname, limit) {
  const root = await realpath(directory);
  const filename = resolve(root, '.' + pathname);
  if (filename !== root && !filename.startsWith(root + sep)) throw new Error('Path leaves release directory');
  let actual;
  try { actual = await realpath(filename); } catch { throw new Error(`Missing built file: ${pathname}`); }
  if (!actual.startsWith(root + sep)) throw new Error('Symlink leaves release directory');
  const info = await stat(actual);
  if (!info.isFile() || info.size > limit) throw new Error(`Invalid or oversized built file: ${pathname}`);
  return readFile(actual, 'utf8');
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([, name,, value]) => [name.toLowerCase(), xmlText(value)]));
}

export function pageDigest(html, expectedURL) {
  const canonicals = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0])).filter(a => (a.rel || '').toLowerCase() === 'canonical');
  if (canonicals.length !== 1 || canonicals[0].href !== expectedURL) throw new Error(`Canonical mismatch: ${expectedURL}`);
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  const directives = metas.filter(a => ['robots', 'bingbot', 'googlebot'].includes((a.name || '').toLowerCase())).map(a => a.content || '').join(',');
  if (/\b(?:noindex|none)\b/i.test(directives)) throw new Error(`Sitemap contains noindex page: ${expectedURL}`);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1];
  if (!main || !/<h1\b/i.test(main)) throw new Error(`Missing static main/H1: ${expectedURL}`);
  const text = main.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const links = [...main.matchAll(/<a\b[^>]*>/gi)].map(match => attributes(match[0]).href || '').sort();
  const schemas = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(match => attributes(match[1]).type === 'application/ld+json').map(match => JSON.parse(match[2]));
  const description = metas.find(a => a.name?.toLowerCase() === 'description')?.content || '';
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || '';
  // Asset fingerprints, decorative SVGs, boot animations and theme controls do not change this digest.
  return createHash('sha256').update(JSON.stringify({title, description, directives, text, links, schemas})).digest('hex');
}

export async function readCanonicalPages(directory) {
  const pending = [HOST + '/sitemap.xml'], visited = new Set(), pages = new Map();
  while (pending.length) {
    const location = pending.shift();
    if (visited.has(location)) continue;
    if (visited.size >= 512) throw new Error('Too many sitemap files');
    visited.add(location);
    const url = productionURL(location, 'sitemap');
    const xml = await localFile(directory, url.pathname, XML_LIMIT);
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('External XML entities are forbidden');
    const isIndex = /<sitemapindex\b/.test(xml), isSet = /<urlset\b/.test(xml);
    if (isIndex === isSet || !xml.includes(isIndex ? '</sitemapindex>' : '</urlset>')) throw new Error(`Invalid sitemap: ${location}`);
    const locations = [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/g)].map(match => xmlText(match[1]));
    if (!locations.length || locations.length > 50_000) throw new Error(`Invalid sitemap size: ${location}`);
    for (const entry of locations) {
      if (isIndex) { productionURL(entry, 'sitemap'); pending.push(entry); continue; }
      const pageURL = productionURL(entry);
      if (pages.has(entry)) throw new Error(`Duplicate sitemap page: ${entry}`);
      if (pages.size >= 1_000_000) throw new Error('Too many canonical pages');
      const html = await localFile(directory, pageURL.pathname + 'index.html', HTML_LIMIT);
      pages.set(entry, pageDigest(html, entry));
    }
  }
  return pages;
}

export function readKey(value) {
  const key = value.trim();
  if (!/^[a-f0-9]{32}$/.test(key)) throw new Error('Expected the project public 32-hex IndexNow key');
  return key;
}

export function contentManifest(pages) {
  return {version: 1, host: 'wase.download', digest: 'sha256-semantic-html-v1', pages: Object.fromEntries([...pages].sort(([a], [b]) => a.localeCompare(b)))};
}

export function validateManifest(value) {
  if (value?.version !== 1 || value.host !== 'wase.download' || value.digest !== 'sha256-semantic-html-v1' || !value.pages || Array.isArray(value.pages) || typeof value.pages !== 'object') throw new Error('Invalid previous manifest');
  const entries = Object.entries(value.pages);
  if (entries.length > 1_000_000) throw new Error('Previous manifest is too large');
  for (const [url, digest] of entries) {
    productionURL(url);
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid previous content digest');
  }
  return new Map(entries);
}

export async function createPlan({directory = 'dist', previousDirectory, previousManifest, keyFile = 'deploy/seo/indexnow-key.txt', requireBuiltKey = false} = {}) {
  if (previousDirectory && previousManifest) throw new Error('Choose --previous-dir or --previous-manifest, not both');
  const key = readKey(await readFile(keyFile, 'utf8'));
  if (requireBuiltKey) {
    const localKey = await localFile(directory, `/${key}.txt`, RESPONSE_LIMIT);
    if (readKey(localKey) !== key) throw new Error('Built IndexNow key differs from source key');
  }
  const current = await readCanonicalPages(directory);
  let previous = previousDirectory ? await readCanonicalPages(previousDirectory) : null;
  if (previousManifest) {
    const info = await stat(previousManifest);
    if (!info.isFile() || info.size > 256 * 1024 * 1024) throw new Error('Invalid or oversized previous manifest');
    previous = validateManifest(JSON.parse(await readFile(previousManifest, 'utf8')));
  }
  const urlList = [...current.keys()].filter(url => !previous || previous.get(url) !== current.get(url)).sort();
  return {
    key, host: 'wase.download', keyLocation: `${HOST}/${key}.txt`,
    canonicalCount: current.size, changedCount: urlList.length,
    omittedPreviousCount: previous ? [...previous.keys()].filter(url => !current.has(url)).length : 0,
    comparison: previous ? 'semantic-content-diff' : 'all-current-canonical-pages',
    urlList, manifest: contentManifest(current),
    batches: Array.from({length: Math.ceil(urlList.length / BATCH_LIMIT)}, (_, i) => urlList.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT))
  };
}

async function responseText(response) {
  const chunks = []; let size = 0;
  if (!response.body) return '';
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > RESPONSE_LIMIT) { await response.body.cancel?.().catch(() => {}); throw new Error('IndexNow response exceeded size limit'); }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function submitPlan(plan, {fetchImpl = fetch} = {}) {
  if (plan.host !== 'wase.download' || plan.keyLocation !== `${HOST}/${readKey(plan.key)}.txt`) throw new Error('Invalid submission host or key');
  for (const batch of plan.batches) {
    if (!batch.length || batch.length > BATCH_LIMIT) throw new Error('Invalid batch size');
    for (const url of batch) productionURL(url);
  }
  if (!plan.batches.length) return {ok: true, receipts: [], message: 'No changed canonical pages; nothing sent.'};
  const keyResponse = await fetchImpl(plan.keyLocation, {method: 'GET', redirect: 'error', headers: {Accept: 'text/plain'}, signal: AbortSignal.timeout(5000)});
  if (keyResponse.status !== 200 || readKey(await responseText(keyResponse)) !== plan.key) throw new Error('Public IndexNow key verification failed');
  const receipts = [];
  for (const batch of plan.batches) {
    let response;
    try {
      response = await fetchImpl(ENDPOINT, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: {'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json'},
        body: JSON.stringify({host: plan.host, key: plan.key, keyLocation: plan.keyLocation, urlList: batch})
      });
      const text = await responseText(response);
      receipts.push({status: response.status, count: batch.length, received: response.status === 200 || response.status === 202, retryAfter: response.headers.get('retry-after')?.slice(0, 128) || null, response: text});
    } catch (error) {
      return {ok: false, receipts, error: String(error.message || error), message: 'Stopped without retrying; receipt does not prove indexing.'};
    }
    if (response.status !== 200 && response.status !== 202) return {ok: false, receipts, message: 'Stopped on non-success response without retrying. Respect Retry-After before a later explicit run.'};
  }
  return {ok: true, receipts, message: 'URLs received by IndexNow; this does not guarantee crawling, indexing, ranking or AI citations.'};
}

export function parseArguments(args) {
  const options = {directory: 'dist', keyFile: 'deploy/seo/indexnow-key.txt', submit: false};
  for (let i = 0; i < args.length; i++) {
    const argument = args[i];
    if (argument === '--submit') { options.submit = true; continue; }
    if (argument === '--help') { options.help = true; continue; }
    const names = {'--dir': 'directory', '--previous-dir': 'previousDirectory', '--previous-manifest': 'previousManifest', '--manifest-out': 'manifestOut', '--key-file': 'keyFile', '--report': 'report'};
    if (!names[argument] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid argument: ${argument}`);
    options[names[argument]] = args[++i];
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/indexnow.mjs [--dir dist] [--previous-dir previous-release | --previous-manifest old.json] [--manifest-out new.json] [--key-file deploy/seo/indexnow-key.txt] [--report report.json] [--submit]\nDry run by default. --manifest-out records small semantic digests before replacing dist. --submit sends only current sitemap canonical pages; API/MCP/results are excluded. Previous-only URLs are reported but not submitted.');
    return;
  }
  const plan = await createPlan({...options, requireBuiltKey: options.submit});
  if (options.manifestOut) await writeFile(resolve(options.manifestOut), JSON.stringify(plan.manifest) + '\n', {mode: 0o600});
  const result = options.submit ? await submitPlan(plan) : {ok: true, receipts: [], message: 'Dry run; no network requests sent.'};
  const report = {createdAt: new Date().toISOString(), submitted: options.submit, endpoint: ENDPOINT, host: plan.host, keyLocation: plan.keyLocation, canonicalCount: plan.canonicalCount, changedCount: plan.changedCount, omittedPreviousCount: plan.omittedPreviousCount, comparison: plan.comparison, batchCount: plan.batches.length, urlList: plan.urlList, ...result};
  if (options.report) await writeFile(resolve(options.report), JSON.stringify(report, null, 2) + '\n', {mode: 0o600});
  const {urlList, ...summary} = report;
  console.log(JSON.stringify({...summary, sampleURLs: urlList.slice(0, 10)}, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`IndexNow: ${error.message}`); process.exitCode = 1; });
}
