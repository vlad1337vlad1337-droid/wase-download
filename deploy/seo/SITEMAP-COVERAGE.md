# Conversion and Sitemap audit — 2026-10-04

## Current public catalogue and pages

These counts are derived from the filtered source catalogue, published pair list and locale list. They describe declarations and page coverage, not successful conversion of every possible file. The last complete static coverage report is [`catalogue-coverage.json`](catalogue-coverage.json); a new release must run the checks below again.

| Measure | Count |
| --- | ---: |
| Public declared input identifiers | 885 |
| Unique public declared output identifiers | 517 |
| Public declared directional combinations | 143,995 |
| Same-format declarations | 372 |
| Cross-format declarations | 143,623 |
| Published representative-tested directions | 2,681 |
| Languages | 13 |
| Canonical pair and utility pages | 34,918 |
| Language-specific child Sitemaps | 13 |

The input picker may show 886 choices because it includes **AUTO**. AUTO is an input detection option, not an additional file format. The raw converter registry previously advertised 915 identifiers; device names, pseudo-formats and unsuitable directions are filtered before public discovery. In particular, ordinary still-photo-to-video synthesis is excluded; a declaration is not an all-to-all product.

The source includes 2,845 historical admitted pairs. Current public policy retains 2,673 of them, plus eight original separately checked directions, giving 2,681 published pages per language. Multiplying `(2,681 + 5 utility pages) × 13 languages` gives 34,918 canonical URLs. The five utility pages are the converter home, format directory, developers, privacy and about pages. Each language also has 885 per-input configuration directories; these use `noindex,follow` and stay outside Sitemap. Error pages and retired directions stay outside Sitemap too.

English, Russian, simplified Chinese, Spanish, French, German, Portuguese, Italian, Turkish, Japanese, Korean, Arabic and Hindi are published. The last complete report records zero canonical/Sitemap coverage issues. That report is a static delivery check, not proof that Google, Yandex or an AI provider has indexed or selected a page.

## Completed current representative audit — 2026-10-04

[`current-conversion-audit-20261004.json`](current-conversion-audit-20261004.json) records the completed local run, immutable image/source hashes, resource limits and separate fixes. [`current-input-coverage-20261004.csv`](current-input-coverage-20261004.csv) contains one row for **each of the 885 public inputs**, including declared targets, current passes/failures, untested targets and missing fixtures. The full local evidence additionally enumerates all 143,995 declared directions; no declaration is treated as a successful test.

The frozen bulk run completed **2,982 distinct directions in 437.5 seconds**: all **2,681 published directions passed**, while one representative direction for each of 301 additional input identifiers produced 215 passes and 86 failures. Every selected specimen was hash-checked. It used two isolated ARM64 workers, each limited to 0.7 CPU and 768 MiB, with no network access and a read-only root. This is actual worker execution, not an HTTP test of production.

The failures revealed a shared 3G2 encoder bug: FFmpeg selected unavailable AMR by default. Explicit MPEG-4/AAC selection corrected all 57 affected cases. A separate 136-case regression covered these inputs for both 3G2 and 3GP plus ordinary media fixtures; every case passed exact container-brand/codec checks and a one-second decode. Raster-to-SVG testing also found partial alpha becoming opaque. A vector alpha mask now preserves it within the existing 120-second pipeline deadline, with a 15-second mask-tracing allowance. All 14 declared raster inputs for this path passed targeted worker checks; eight content/fast-path/failure cases verified alpha 64, alpha 128, a gradient, partial alpha with transparent outer margins, opaque RGB/RGBA, fully transparent input, and rejection when mask generation fails. Generated markup is compatible with the existing client sanitizer allowlists; rendering after equivalent attribute stripping produced identical pixels. No bitmap is embedded in the SVG. These small fixtures are not a promise of lossless tracing of arbitrary photographs.

Combining the frozen run with these **separately versioned** delta checks gives evidence for **3,070 distinct directions: 3,048 passes and 22 remaining specimen failures**. There are current specimens for **423 inputs**; **462 inputs still have no runtime fixture**. Of the 423 tested inputs, 401 have representative passing directions and 22 still require sample/engine follow-up. Most declared targets of those inputs remain untested with current code. The records do not claim a complete all-to-all run or that every file in a passed format will succeed. No new conversion landing pages were admitted merely because a raw declaration existed.

A final nine-case validator delta recovered seven previously unrecognized valid outputs (ADTS, FFMETA, Markdown and Beamer), correctly kept empty X3DB → 3MF output rejected, and passed a new OBJ → 3MF mesh fixture. The three FFMETA results contain metadata only, not media or subtitle payload. The 22 remaining cases include five missing companion/document-context cases, four RAW sample/decoder issues, four extension/type mismatches, and nine individual engine, subtype, OCR, invalid-sample or empty-geometry limitations. Their exact input/output, reason and fixture provenance are included in the public JSON. Failed specimens are not silently retired or relabelled as universal format failures.

The bulk validator hash is `07d46af27ef31ceae7c18344cb48468f368bb44ed41ae5d408852652947ccb8a`; the later font-only validation fix and alpha/media engine changes have their own hashes and regressions below and in the JSON. The untouched conversion paths retain the frozen run's evidence. There was no second full-matrix run against the final combined revision, and no production bulk load.

## Historical conversion evidence

The following numbers preserve the earlier 2026-10-03 sweep. They are **not** counts from a new complete run with the strengthened validator.

| Historical measure | Count |
| --- | ---: |
| Raw input identifiers | 915 |
| Raw unique declared output identifiers | 521 |
| Raw declared cross-format pairs | 153,406 |
| Inputs with representative fixtures | 156 |
| Raw inputs without fixtures | 759 |
| Unique local container cases exercised | 20,448 |
| Outputs passing the then-current structural/decoder checks | 2,875 |
| Outputs produced but not validated as the requested type | 3,001 |
| Cases failing on the selected sample, engines or timeout | 14,572 |
| New pairs passing historical HTTP checks | 2,845 |

The discovery sweep was followed by validation of 5,999 cases that had produced output. Of 2,846 candidates sent through the actual HTTP broker, 2,845 passed and STW → TXT returned HTTP 422; that failing pair was excluded. Eight original converters outside that newly admitted list passed a separate HTTP regression check, including TAR.GZ → ZIP. Multi-file DZI ZIPs, GIF → JPG, EPUB → TXT, PDF → SVG, fonts, and corrupt-PNG rejection followed by recovery were also checked.

[`verified-receipts.json`](verified-receipts.json) preserves source sample provenance/hash, selected engine, output hash/size and HTTP status for the original new admissions. [`input-verification.json`](input-verification.json) preserves coverage and gaps across the original raw registry. Samples came from official Apache Tika and Assimp repositories with Git blob/SHA256 verification, or from our own generated test content. The raw corpus stays outside the public repository. These files are historical evidence and must not be relabelled as current comprehensive verification.

Bulk execution was local ARM64 Docker against the pinned converter image, without networking, with a read-only root filesystem, isolated writable job directories and bounded CPU, RAM and deadlines. Production is AMD64; its representative HTTP receipts are separate. Success on one sample does not prove every file variant, codec, document feature, animation, visual fidelity or availability now. Failed samples likewise do not establish that an entire format is impossible.

## Validator correction and limits

The 2026-10-04 audit reproduced false acceptance by the old validator: an ordinary ZIP could pass as ODT/ODP, an eight-byte PNG signature could pass as a PNG image, and a two-byte JPEG SOI marker could pass as JPEG. The corrected validator rejects these cases. This establishes a weakness in the old admission test; it does **not** establish that the saved historical outputs were corrupt. Their receipts remain unchanged pending targeted revalidation.

PNG validation now walks complete chunks, checks CRCs, IHDR fields, palette/data ordering and the final IEND. JPEG validation walks frame and scan segments through EOI, including escaped entropy bytes and restart markers. These are structural checks: neither is a full pixel decode or a visual-quality guarantee. ODT/ODP validation requires the exact format mimetype and correctly nested namespaced document content, then checks ZIP integrity. Package validation bounds the total uncompressed size to 200 MiB and entries to 5,000, rejects duplicates and encrypted entries, and parses XML incrementally. The bounds prevent an unbounded ZIP integrity/decompression pass.

The font check now also distinguishes unwrapped TTF/OTF from WOFF and WOFF2 containers. The previous `TTFont.getBestCmap()` check alone accepted a valid font in the wrong wrapper. TrueType outlines in an unwrapped `.otf` remain valid according to [Microsoft's OpenType filename guidance](https://learn.microsoft.com/en-us/typography/opentype/spec/recom#filenames); requiring every OTF to use CFF would incorrectly reject legitimate fonts. The worker uses [FontForge generation](https://fontforge.org/docs/scripting/python/fontforge.html) for outline conversion and [fontTools flavour serialization](https://fonttools.readthedocs.io/en/latest/ttLib/ttFont.html) for web containers. Five synthetic-font regression tests cover wrapper rejection and all 12 worker directions among four formats, with CFF/glyf output checks on our own two-glyph font. They ran in the pinned local image without networking, at 0.3 CPU / 256 MiB, in 2.912 seconds; this small fixture is not a guarantee of preserving every font feature.

The larger candidate matrix uses the earlier frozen validator SHA256 `07d46af27ef31ceae7c18344cb48468f368bb44ed41ae5d408852652947ccb8a`. The later font-only correction has SHA256 `580b4b5b1f460f367a9b713f33d894239b832c2681d7888f1571d903fc53114d` and separate font regression evidence. Results from these checks must not be described as one completed run against a single revision.

The final validator is `33d6ab58d7c4f4256124ecde3483a58eafbf414e026578fd050576c33731f1eb`. Its runtime-tested gap snapshot `ee7c901c90001a36f60a8fc0b76c66c857a0c433545bdc8229ede36fd06b4870` differs only in a corrected comment; their Python ASTs are identical. This additional delta concerns no currently published target format, so it does not relabel the 2,681-pair bulk evidence.

The relevant primary specifications are [W3C PNG, third edition](https://www.w3.org/TR/png-3/) and [OASIS OpenDocument 1.3 packages](https://docs.oasis-open.org/office/OpenDocument/v1.3/os/part2-packages/OpenDocument-v1.3-os-part2-packages.html). `python3 tests/output-validation.py` covers valid generated images/documents and the reproduced invalid cases. Decoder checks for other target formats are narrower or engine-specific; an unsupported validator is not evidence of universal conversion support.

Public admission of PDF/TXT/PDB directions is now independent of converter enumeration order: their established public categories are explicitly set before policy filtering. This corrects the observed 55-direction drift; it is not a claim that the remaining catalogue taxonomy is exhaustive or unambiguous.

## Bounded execution and release checks

Engine choices remain limited to declared capabilities and at most three attempts, each with a fresh output directory and unique container name. Failed-attempt artifacts cannot enter successful downloads. Conversion inputs and outputs are cleaned up after success, cancellation and errors. Production retains one conversion at a time, eight waiting jobs, 100 MiB input / 200 MiB output limits, a 180-second total request deadline and the existing aggregate 35% CPU quota. No bulk conversion sweep runs on the VPN server.

`npm run build` generates static localized HTML after asset bundling. `node scripts/audit-seo.mjs deploy/seo/catalogue-coverage.json` checks canonical/Sitemap coverage in both directions, internal resources, links, metadata, and the 50,000-URL / 50-MB child-map limits. Only published pairs and utility pages enter Sitemap. Untested input configuration pages are discoverable by ordinary HTML navigation, but are not presented as verified conversion landing pages. The static catalogue and read-only MCP expose **declared** availability; that field must not be interpreted as a successful live conversion check.

The release also runs relevant discovery, policy, engine-order, output-validation, archive-security and SEO tests. A newly prepared matrix plan or an in-progress run is not completed evidence. Its engine, validator and fixture hashes, resource limits, outcomes and omissions must be recorded before adding a new coverage claim.

`/sitemap.xml` is a Sitemap index linked from `robots.txt`. Canonical URLs, reciprocal hreflang and visible localized HTML provide ordinary search and AI-reader discovery. No fabricated lastmod, popularity, review count, hidden keywords or hundreds of thousands of unsupported combinations are generated. See [Google Sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Google scaled-content policy](https://developers.google.com/search/docs/essentials/spam-policies#scaled-content) and [Yandex Sitemap guidance](https://yandex.ru/support/webmaster/ru/controlling-robot/sitemap). Delivery and Sitemap inclusion do not guarantee indexing, ranking or AI citations.

## Scope of saved production delivery evidence

Release `d93dffc` was deployed after CI with backend backup and atomic static symlink replacement. [`production-http-core.json`](production-http-core.json) records its representative AMD64 HTTP results, including corrupt-input rejection and subsequent successful conversion. [`live-delivery.json`](live-delivery.json) records the then-published 8,574 canonical URLs across three languages: all final responses were HTTP 200 HTML; six initial transport failures succeeded on targeted retry. These are evidence for that earlier release and URL set, not a current live check of all 34,918 URLs or of every conversion.
