// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {HOST, ENDPOINT, BATCH_LIMIT, productionURL, pageDigest, readCanonicalPages, createPlan, contentManifest, validateManifest, submitPlan, parseArguments} from '../scripts/indexnow.mjs';

const key = '0123456789abcdef0123456789abcdef';
const xml = (root, urls) => `<?xml version="1.0"?><${root}>${urls.map(url => `<${root === 'sitemapindex' ? 'sitemap' : 'url'}><loc>${url}</loc></${root === 'sitemapindex' ? 'sitemap' : 'url'}>`).join('')}</${root}>`;
const html = (url, text = 'Convert tested files', {asset = 'app-old.js', noindex = false} = {}) => `<!doctype html><html><head><title>Converter</title><meta name="description" content="Tested directions"><link rel="canonical" href="${url}">${noindex ? '<meta name="robots" content="noindex,follow">' : ''}<script src="/${asset}"></script><script type="application/ld+json">{"url":"${url}"}</script></head><body><header>Theme control</header><main><h1>Converter</h1><p>${text}</p><a href="/en/">Home</a><svg><text>Decoration</text></svg></main><footer>Footer</footer></body></html>`;
async function fixture(t, urls = [HOST + '/en/', HOST + '/ru/png-to-svg/']) {
  const directory = await mkdtemp(join(tmpdir(), 'wase-indexnow-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  await writeFile(join(directory, 'sitemap.xml'), xml('sitemapindex', [HOST + '/sitemap-en-1.xml']));
  await writeFile(join(directory, 'sitemap-en-1.xml'), xml('urlset', urls));
  for (const url of urls) {
    const path = join(directory, new URL(url).pathname);
    await mkdir(path, {recursive: true});
    await writeFile(join(path, 'index.html'), html(url));
  }
  const keyFile = join(directory, 'source-key.txt');
  await writeFile(keyFile, key + '\n');
  return {directory, keyFile, urls};
}
const submission = batches => ({host: 'wase.download', key, keyLocation: `${HOST}/${key}.txt`, batches});

test('production URL rejects alternate hosts, credentials, query, hash, traversal and unsafe paths', () => {
  for (const url of ['http://wase.download/en/', 'https://www.wase.download/en/', 'https://evil.example/en/', 'https://user@wase.download/en/', `${HOST}/en/?v=1`, `${HOST}/en/#x`, `${HOST}/en/../ru/`, `${HOST}/%2e%2e/en/`, `${HOST}/en/%2F/`, `${HOST}/en\\x/`, `${HOST}//en/`, `${HOST}/en`, `${HOST}/api/`, `${HOST}/result/`, `${HOST}/.git/`]) assert.throws(() => productionURL(url), url);
  assert.equal(productionURL(`${HOST}/ru/epub-to-txt/`).pathname, '/ru/epub-to-txt/');
});

test('reads only sitemap canonical pages and rejects missing, noindex and mismatched HTML', async t => {
  const f = await fixture(t);
  assert.equal((await readCanonicalPages(f.directory)).size, 2);
  const target = join(f.directory, 'ru/png-to-svg/index.html');
  await writeFile(target, html(f.urls[1], '', {noindex: true}));
  await assert.rejects(readCanonicalPages(f.directory), /noindex/);
  await writeFile(target, html(HOST + '/ru/other/'));
  await assert.rejects(readCanonicalPages(f.directory), /Canonical mismatch/);
  await rm(target);
  await assert.rejects(readCanonicalPages(f.directory), /Missing built file/);
});

test('rejects external sitemap references, XML entities and duplicate sitemap pages', async t => {
  const f = await fixture(t);
  await writeFile(join(f.directory, 'sitemap.xml'), xml('sitemapindex', ['https://evil.example/sitemap.xml']));
  await assert.rejects(readCanonicalPages(f.directory), /Noncanonical/);
  await writeFile(join(f.directory, 'sitemap.xml'), '<!DOCTYPE sitemapindex [<!ENTITY x SYSTEM "file:///etc/passwd">]><sitemapindex><sitemap><loc>&x;</loc></sitemap></sitemapindex>');
  await assert.rejects(readCanonicalPages(f.directory), /External XML entities/);
  await writeFile(join(f.directory, 'sitemap.xml'), xml('urlset', [f.urls[0], f.urls[0]]));
  await assert.rejects(readCanonicalPages(f.directory), /Duplicate/);
});

test('rejects symlinks that leave the release directory', async t => {
  const f = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'wase-indexnow-outside-'));
  t.after(() => rm(outside, {recursive: true, force: true}));
  await writeFile(join(outside, 'index.html'), html(f.urls[0]));
  await rm(join(f.directory, 'en'), {recursive: true});
  await symlink(outside, join(f.directory, 'en'));
  await assert.rejects(readCanonicalPages(f.directory), /Symlink leaves/);
});

test('semantic digest ignores assets and decoration, and changes with visible content, metadata or links', () => {
  const url = HOST + '/en/';
  const first = html(url);
  const equivalent = html(url, 'Convert tested files', {asset: 'app-new.js'}).replace('Theme control', 'Different UI').replace('Decoration', 'Other SVG');
  assert.equal(pageDigest(first, url), pageDigest(equivalent, url));
  for (const changed of [html(url, 'Different conversion instructions'), first.replace('Tested directions', 'New privacy terms'), first.replace('href="/en/"', 'href="/ru/"')]) assert.notEqual(pageDigest(first, url), pageDigest(changed, url));
});

test('dry plan supports small manifests before key deployment and filters semantic changes', async t => {
  const f = await fixture(t);
  const initial = await createPlan(f);
  assert.equal(initial.changedCount, 2);
  assert.equal(initial.batches.length, 1);
  await assert.rejects(createPlan({...f, requireBuiltKey: true}), /Missing built file/);
  const previousManifest = join(f.directory, 'previous.json');
  await writeFile(previousManifest, JSON.stringify(initial.manifest));
  const unchanged = await createPlan({...f, previousManifest});
  assert.equal(unchanged.changedCount, 0);
  await writeFile(join(f.directory, 'ru/png-to-svg/index.html'), html(f.urls[1], 'Updated verified example'));
  const changed = await createPlan({...f, previousManifest});
  assert.deepEqual(changed.urlList, [f.urls[1]]);
  await writeFile(join(f.directory, key + '.txt'), key);
  assert.equal((await createPlan({...f, requireBuiltKey: true})).changedCount, 2);
  await assert.rejects(createPlan({...f, previousManifest, previousDirectory: f.directory}), /Choose/);
});

test('rejects foreign or malformed previous manifests', () => {
  const good = contentManifest(new Map([[HOST + '/en/', 'a'.repeat(64)]]));
  assert.equal(validateManifest(good).size, 1);
  for (const value of [{...good, host: 'evil.example'}, {...good, digest: 'unknown'}, {...good, pages: {'https://evil.example/': 'a'.repeat(64)}}, {...good, pages: {[HOST + '/en/']: 'not-a-digest'}}]) assert.throws(() => validateManifest(value));
});

test('submission verifies public key, uses only fixed endpoint and bounds batch sizes', async () => {
  const calls = [];
  const batches = [Array.from({length: BATCH_LIMIT}, (_, i) => `${HOST}/en/test-${i}/`), [HOST + '/ru/']];
  const result = await submitPlan(submission(batches), {fetchImpl: async (url, options) => {
    calls.push({url, options});
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(options.method === 'GET' ? key : '', {status: options.method === 'GET' ? 200 : 202});
  }});
  assert.equal(result.ok, true);
  assert.equal(calls[0].url, HOST + '/' + key + '.txt');
  assert.equal(calls.slice(1).every(c => c.url === ENDPOINT), true);
  assert.equal(JSON.parse(calls[1].options.body).urlList.length, BATCH_LIMIT);
  assert.equal(result.receipts.length, 2);
  assert.match(result.message, /does not guarantee/);
  await assert.rejects(submitPlan(submission([Array(BATCH_LIMIT + 1).fill(HOST + '/en/')])), /Invalid batch size/);
});

test('429, 5xx and network failures stop without continuing or retrying', async () => {
  for (const status of [429, 500, 503]) {
    const calls = [];
    const result = await submitPlan(submission([[HOST + '/en/'], [HOST + '/ru/']]), {fetchImpl: async (url, options) => {
      calls.push(url);
      return options.method === 'GET' ? new Response(key) : new Response('Try later', {status, headers: {'Retry-After': '120'}});
    }});
    assert.equal(calls.length, 2);
    assert.equal(result.ok, false);
    assert.equal(result.receipts[0].status, status);
    assert.equal(result.receipts[0].retryAfter, '120');
  }
  let calls = 0;
  const result = await submitPlan(submission([[HOST + '/en/'], [HOST + '/ru/']]), {fetchImpl: async (_, options) => {
    calls++;
    if (options.method === 'GET') return new Response(key);
    throw new DOMException('Deadline', 'TimeoutError');
  }});
  assert.equal(calls, 2);
  assert.equal(result.ok, false);
  assert.match(result.error, /Deadline/);
});

test('invalid public key prevents any submission; empty diff performs no network calls', async () => {
  let calls = 0;
  await assert.rejects(submitPlan(submission([[HOST + '/en/']]), {fetchImpl: async () => {calls++; return new Response('wrong');}}), /Expected the project public/);
  assert.equal(calls, 1);
  const result = await submitPlan(submission([]), {fetchImpl: async () => {throw new Error('Must not fetch');}});
  assert.equal(result.ok, true);
  assert.deepEqual(result.receipts, []);
});

test('oversized remote bodies and foreign submission plans are rejected before further calls', async () => {
  let calls = 0;
  await assert.rejects(submitPlan(submission([[HOST + '/en/']]), {fetchImpl: async () => {calls++; return new Response('a'.repeat(4097));}}), /size limit/);
  assert.equal(calls, 1);
  await assert.rejects(submitPlan({...submission([[HOST + '/en/']]), host: 'evil.example'}, {fetchImpl: async () => {throw new Error('Must not fetch');}}), /Invalid submission host/);
});

test('CLI is dry by default and requires explicit --submit', () => {
  assert.equal(parseArguments([]).submit, false);
  assert.equal(parseArguments(['--submit']).submit, true);
  assert.equal(parseArguments(['--previous-manifest', '/tmp/old.json', '--manifest-out', '/tmp/new.json']).previousManifest, '/tmp/old.json');
  assert.throws(() => parseArguments(['--endpoint', 'https://evil.example']));
  assert.throws(() => parseArguments(['--dir']));
});
