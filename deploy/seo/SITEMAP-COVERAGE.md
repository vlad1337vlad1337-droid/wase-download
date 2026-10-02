# Sitemap and catalogue coverage — 2026-10-02

## Verified counts

| Measure | Count |
| --- | ---: |
| Declared input extensions | 915 |
| Unique declared output extensions | 521 |
| Directional engine declarations | 153,786 |
| Same-format declarations | 380 |
| Cross-format declarations | 153,406 |
| Published conversion pairs | 33 |
| Published canonical HTML pages, including three languages and utility pages | 114 |
| Published canonical pages absent from Sitemap | 0 |
| Unpublished declared cross-format pairs | 153,373 |

The count of 916 is not the count of input extensions in the pinned catalogue. AUTO is a selector mode, not a file format. The catalogue is not an all-to-all Cartesian product. Direction matters, aliases are still extensions, and a declaration is not a successful conversion test. For example, generic engine output lists can declare semantically inappropriate media targets. Do not turn every declaration into a promise of a working converter.

## Reproducible audit

Run `npm run build`, then `node scripts/audit-seo.mjs` or `node scripts/audit-seo.mjs path/to/report.json`.

The audit scans every built HTML file, compares canonical pages against Sitemap in both directions, verifies internal resources/links, unique titles, descriptions, one H1, reciprocal localized hreflang, structured-data URLs and published pairs against the catalogue. It checks the 50,000 URL / 50 MB protocol limits. Tests include deliberate missing Sitemap entries and broken links, so the checks demonstrably catch regressions. CI already runs the SEO test file after each build.

The root language chooser intentionally canonicalizes to `/en/`; it is excluded from Sitemap. Generated locale folders are rebuilt from scratch, preventing obsolete pages from silently surviving a removed route. Static HTML supplies metadata and guidance before JavaScript executes. API paths are excluded from crawling; private conversion results are not indexable routes.

## Coverage limit and expansion criteria

All existing canonical HTML pages are covered. The remaining 153,373 declarations do **not** currently have SEO landing pages. Blind expansion to three languages would create 460,218 cross-format URLs, not prove their usefulness or operation.

For a new published pair: verify a representative input through the actual conversion pipeline, validate output structure/content, document material format limitations, add localized useful guidance, and add the pair to the shared route source. Generation adds it to Sitemap automatically; CI checks coverage and links. Large future sitemaps must be split and referenced by a sitemap index before exceeding protocol limits. No artificial lastmod, hidden keywords, fabricated popularity or traffic.

Google recommends canonical URLs in Sitemap and treats submission as a discovery hint, not an indexing guarantee. Its scaled-content policy concerns mass pages created primarily to manipulate rankings without helping users; programmatic generation itself is not prohibited.

Sources:
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/essentials/spam-policies#scaled-content
