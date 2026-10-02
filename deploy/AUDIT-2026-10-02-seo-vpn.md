# SEO and live VPN audit — 2026-10-02 follow-up

## SEO changes

33 tested conversion pages per language, plus home/privacy/about/formats/developers: **114 sitemap URLs** (previously 78). Twelve additional image pairs were verified through the actual local Docker/API pipeline with output file signatures before publishing. The complete declared 915-input catalogue remains discoverable in static HTML and JSON; engine declarations are not arbitrary-file guarantees.

Localized pair pages now contain source/target-specific facts, three concrete conversion steps, limitations and related internal links. PNG transparency, SVG rasterization/tracing, JPG/JPEG aliases, GIF still-image behavior, document layout, audio quality, archive repacking and font/3D restrictions are explained. These are static HTML under a compact disclosure, so the tool stays uncluttered and crawlers do not need JavaScript for this information. Home/about metadata now describes the actual broad file product in each language. No keyword lists, invisible keyword blocks, fabricated traffic or millions of empty pair URLs.

All 114 generated URLs have the correct canonical, localized hreflang, nonempty description, H1 and valid JSON-LD. Every declared input has targets in the catalogue. API paths are excluded from crawling; unknown routes retain real 404. Existing root/locale behavior is preserved. A sitemap is a discovery hint, not proof of indexing or ranking. Search Console query/impression data is needed to measure actual demand; no search-volume or position numbers have been invented.

Sources: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview ; https://developers.google.com/search/docs/appearance/title-link ; https://developers.google.com/search/docs/essentials/spam-policies#scaled-content

## Critical ingress fix

A live 26-profile probe found TLS failures on all four trial ingress profiles. Nginx logs showed repeated `768 worker_connections are not enough while connecting to upstream`. The two-stage stream forwarding consumes several nginx connection slots per client; the distribution default was inadequate.

With a protected backup, `nginx -t` and graceful reload, main nginx configuration was changed to **worker_connections 8192** and **worker_rlimit_nofile 16384**. Systemd's existing hard limit permits this. The new worker really has 16384 descriptors; no new exhaustion messages appeared in the sampled interval. Older workers retain current sessions while draining; they were not killed.

After the fix, DE/FI/PL/AT passed HTTPS certificate verification, the expected exit IP and a real 4 MiB download (1.25–1.45 s). The other 22 published TCP/XHTTP profiles passed the preceding sweep with 1 MiB transfers. Temporary users/cores/configurations were removed and checked absent. Only four primary profiles use the new ingress; other countries/backups were not migrated further.

## All-node SSH and health

FI/NL/PL/DE/AT/FR/RO/CZ/US/VN/EST/KZ/UK passed fresh SSH health inspection. The Russian bridge's saved ProxyJump through the old server timed out; explicit `ssh -J ww vpn-ru` through the new main server worked. Personal SSH configuration was not silently changed. Thus all 14 nodes were inspected.

No audited node showed recent kernel OOM, segfault or storage errors; running VPN containers were healthy. NL has one CPU, load about 1.33 and a roughly 741 MB container, so capacity headroom is limited. AT has an existing failed GRUB boot-record unit; its VPN process and data transfer work. This audit does not justify a risky bootloader change or reboot.

## Reachability and public surface limits

A focused 11-port scan from the Russian application server showed direct 443 reachability restrictions on several foreign nodes, despite successful published relay paths. It also confirmed that the Russian bridge still exposes 2053/8443/9443, and that backup/control services on other nodes use 47000/62050/62051. Therefore the whole fleet cannot honestly be called fingerprint-free. These are existing production paths; closing them indiscriminately could break control or fallback connections. New ingress public listeners remain 22/80/443 only.

VPN bytes are forwarded as VPN bytes; a normal converter website on the same host does not transform them into conversion requests. Artificial cover traffic adds load and cannot establish immunity from censorship or reputation blocks. This run fixed a demonstrated capacity failure without inventing disguise claims or changing working backup transports.

Final release: frontend `98b3bdc`, atomic release `20261002T202801Z`; GitHub Actions 37060753061 passed. All 114 public sitemap URLs were checked for HTTP 200, text/html and exact canonical. Nginx and API are active; available memory is about 1.4 GB after release.
