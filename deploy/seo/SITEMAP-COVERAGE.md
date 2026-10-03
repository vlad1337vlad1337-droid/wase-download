# Conversion and Sitemap audit — 2026-10-03

## What was actually tested

| Measure | Count |
| --- | ---: |
| Declared input identifiers | 915 |
| Unique declared output identifiers | 521 |
| Declared cross-format pairs | 153,406 |
| Input formats with representative fixtures | 156 |
| Input identifiers without fixtures | 759 |
| Unique conversion cases exercised in isolated local containers | 20,448 |
| Outputs passing structural/decoder checks | 2,875 |
| Outputs produced but not validated as the requested type | 3,001 |
| Cases failing on the selected sample, engines or timeout | 14,572 |
| New canonical pairs passing actual HTTP API requests | 2,845 |
| Published pairs including separately rechecked original pages | 2,853 |
| Localized canonical pages including utility pages | 8,574 |
| Canonical pages absent from Sitemap | 0 |
| Child Sitemaps | 3 |

The registry is not a list of 915 fully supported uploaded-file formats. For example, FFmpeg advertises device identifiers such as `alsa`, `lavfi`, and `x11grab`; those are not ordinary uploaded files. Directional declarations are not an all-to-all product. Three languages applied blindly to all declared cross-format pairs would produce 460,218 pages, without proving their converters work.

The 20,448-case discovery sweep was followed by decoder validation of 5,999 cases that had produced output. Of the canonical new pairs eligible after that sweep, 2,846 went through the actual HTTP broker: 2,845 passed and STW → TXT returned HTTP 422. STW → TXT was excluded from new published pages. Eight original converters not in the new admitted list passed a separate HTTP regression check, including TAR.GZ → ZIP. That check also covered multi-file DZI ZIPs, GIF → JPG, EPUB → TXT, PDF → SVG, fonts, and recovery after a corrupt PNG.

## Limits of the evidence

Bulk execution was local ARM64 Docker, against the pinned converter image, with networking disabled, read-only root filesystem, isolated writable job directories, bounded CPU/RAM and timeouts. Production is AMD64; production representative HTTP checks are recorded separately. Bulk success does not prove every file of a format, visual fidelity, animation preservation, or success for the 759 identifiers lacking fixtures. A failed representative file may be malformed, metadata-only, unsupported by a chosen engine, or exceed the test timeout. These reports do not assert that its entire format is impossible.

All newly admitted pairs have the actual source sample hash/provenance, selected engine, output hash/size and HTTP status in `verified-receipts.json`. `input-verification.json` lists all 915 inputs, including gaps. Third-party samples come from the official Apache Tika and Assimp repositories, with Git blob/SHA256 verification; generated samples contain our own simple test content. The raw corpus stays outside the public repository.

## Fixes and bounded execution

Engine choices remain limited to declared capabilities and at most three attempts. Each attempt receives a fresh output directory and a unique container name. Invalid or mislabeled output is rejected rather than downloaded. GIF → JPG explicitly exports the first frame. Failed-attempt artifacts cannot leak into successful downloads. The HTTP slot is released after response completion and cleanup, including errors.

Production retains one conversion at a time, an eight-job waiting limit, 100 MB input / 200 MB output limits, a 180-second total job deadline, and the existing aggregate 35% CPU quota. The bulk audit never ran on the VPN server.

## Static page and Sitemap coverage

`npm run build` generates static localized pair pages and 915 per-input configuration directories in each language. Only verified pair and utility pages enter the language-specific child Sitemaps. Untested input directories use `noindex,follow`. The catalogue groups verified links by source format; each published pair is reachable through normal HTML links. Canonical, reciprocal hreflang, titles/descriptions, structured data, internal resources and exact Sitemap coverage are audited across the full build.

`node scripts/audit-seo.mjs deploy/seo/catalogue-coverage.json` checks all built pages, both directions of Sitemap coverage, links, and the 50,000 URL / 50 MB limit. `node --test tests/discovery.test.mjs tests/seo.test.mjs tests/engine-order.test.mjs` includes negative missing-page/broken-link checks. Archive security and output type checks run in CI. Build expansion happens after asset bundling, so thousands of page routes do not inflate the converter's client JavaScript.

The site already uses `/sitemap.xml`; it is now a Sitemap index. Search engines can discover its child maps through the existing submitted address and `robots.txt`. This is delivery and discovery readiness, not a claim that these pages have already been indexed or ranked. Generic long-tail guidance is a starting point; richer format-specific examples and constraints remain useful editorial work.

Official sources:
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- https://developers.google.com/search/docs/essentials/spam-policies#scaled-content
- https://yandex.ru/support/webmaster/ru/controlling-robot/sitemap

Both Google and Yandex explicitly decline to guarantee indexing of every submitted URL. No fabricated lastmod, popularity, review count or hidden keyword text is added.

## Production delivery evidence

Code release `d93dffc` was installed with a backend backup and atomic static symlink replacement after GitHub CI passed. Actual production HTTP regression checks passed on AMD64, including the deliberately rejected corrupt input followed by a successful conversion; see `production-http-core.json`. EPUB → TXT was also exercised through the public browser interface, reaching a downloadable result and ZIP action.

All 8,574 canonical Sitemap URLs were checked over public HTTPS. Six initial transport errors succeeded on targeted retry; `live-delivery.json` preserves both the initial failures and successful rechecks. All final results are HTTP 200 HTML. Child Sitemaps, robots, non-indexable input directories and a genuine unknown-path 404 were checked separately. This confirms URL delivery, not search-engine indexing.
