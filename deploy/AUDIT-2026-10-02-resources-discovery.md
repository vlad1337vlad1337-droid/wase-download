# Resource, UI and discovery audit — 2026-10-02

## Verified resource behavior

The deployed host has one CPU and 2 GB RAM. Node and Docker jobs share `wase-conversion.slice`: cpu.max = `35000 100000`, MemoryHigh 1100 MB, MemoryMax 1300 MB. API child cap 15%, converter child cap 25%, one active job. Real Docker inspection confirmed CgroupParent, 250000000 NanoCpus, 768 MB memory, no network and a read-only root. A synthetic 1200-paragraph HTML document produced a real 258177-byte PDF in 8.73 seconds.

A four-country published-route check ran concurrently from the Russian application host. DE, FI, PL and AT each connected, showed the expected exit and downloaded 4 MiB with verified HTTPS. Downloads took 1.28–5.29 seconds; this establishes current reachability, not guaranteed latency or proof that conversion has zero performance impact. The temporary diagnostic user/core were removed and absence checked. No other primary or XHTTP subscription route changed.

## Public surface

Real external checks from a separate Linux host found TCP 22/80/443 open. Report-related 2053/8443/9443, 7881/8080 and the API/stream loopback ports did not answer. Server listener inspection agrees: only SSH/HTTP/HTTPS bind publicly, with no public UDP VPN listener. This is a focused port audit, not a completed 65535-port scan. Local Mac socket checks are unreliable while the user's tunnel intercepts connections.

Website TLS 1.2 and a publicly trusted Let's Encrypt certificate remain. REALITY TLS behavior is separate. SNI stream forwarding does not consume the converter cgroup budget. Restricting ports and serving a real website cannot guarantee invisibility, prevent IP reputation blocks or certify immunity from RKN/TSPU. No such promise is made.

## UI and tests

Catalogue loading uses a small mascot in reserved space, no full-page overlay or scroll lock. Slow-catalogue tests verify upload/example controls remain available and the upload button does not move when the catalogue arrives. Hover no longer changes mascot animation duration. Mobile mascots occupy a deliberate row; reduced motion stops decoration. Category filters use compact labelled grids with counts. Existing 34 frontend cases and four new loading/animation cases passed in Chromium and WebKit. Emulation is not a physical iPhone acceptance test.

Ten archive safety tests passed. The read-only MCP endpoint passed an official SDK client initialization/tool-list/tool-call check and rejection cases. All 78 sitemap URLs have generated static HTML, canonical, four hreflang alternatives and valid JSON-LD; all 915 declared input extensions appear in the static catalogue.

## Search and AI

21 tested conversion examples × 3 languages, plus home/privacy/about/catalogue/developers pages = 78 sitemap URLs. Full capabilities live in static category pages and `/formats.json`; millions of untested thin pair pages are deliberately not generated. `llms.txt` is a convenience link index, not a special indexing requirement or ranking guarantee. `/api/mcp` exposes only public capabilities, never conversion or remote file retrieval.

The existing Google domain property is verified and Sitemap was submitted. Googlebot fetched the earlier sitemap with HTTP 200, but Search Console initially reported a processing error/zero discovered pages. Submission does not prove indexing. Check the current console state separately. Yandex and AI search crawlers also fetched robots.txt successfully. Metrika remains inactive without a real counter ID and consent.

GitHub project/profile are branded with real Blobatar artwork, attribution and documented capabilities. No fabricated history, customers or popularity.

## Final production checks

Code release `6613bca` is live. Four additional production tests passed with the new CPU budget: real vector download, two-visitor queue, EPUB/PPTX/PDF/ODP round trips and WebM. The official MCP SDK connected to the public endpoint and listed both tools. Unknown URLs return 404. All job containers and test files were removed; API NRestarts=0, memory approximately 60 MB. Let's Encrypt certificates are valid through 2026-12-31. GitHub Actions run 37058851079 passed build, metadata/MCP and archive checks.

Googlebot fetched the new 78-URL Sitemap with HTTP 200 at 20:11:33 UTC. Search Console live URL inspection explicitly confirmed “URL available to Google” and “Page can be indexed”; the homepage indexing request was accepted. The Sitemap report still showed the initial processing error at the last check, so search indexing is pending rather than claimed complete.
