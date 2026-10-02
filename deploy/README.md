# Deployment checklist

1. Build with `npm ci && npm run build` in CI or locally; transfer only `dist/` to the intended server. The frontend is static; broad conversions require the isolated Node/Docker broker.
2. Install a release with `scripts/release.sh /path/to/dist`. Keep the prior release path for rollback. To roll back, create `current.next` pointing to it and atomically replace `current` with `mv -Tf` on Linux.
3. Choose one serving configuration. `Caddyfile.website` provides standalone public HTTPS with ACME. `nginx-site.conf` is only a localhost origin behind a separately configured public frontend. Do not accidentally expose 8080 to the internet.
4. Point the domain A record at the intended server. Create an AAAA record only if IPv6 delivery and firewall are configured and verified. Confirm DNS, certificate hostname/chain/expiry and renewal. Do not enable HSTS preload before verifying the entire domain setup.
5. Public HTML should revalidate; hashed assets may cache for a year. Unknown URLs must return 404, not a fake successful single-page-app response. Test the MIME type `application/wasm`, worker loading and SVG export under the production CSP.
6. Main localized URLs are `/en/`, `/ru/` and `/zh/`. Root selects a saved preference or browser language, with English fallback. Users can choose a different language.
7. Add `wase.download` to Google Search Console (Domain property, DNS TXT verification) and Yandex Webmaster. Submit `https://wase.download/sitemap.xml` in each verified account. `GOOGLE_SITE_VERIFICATION` and `YANDEX_SITE_VERIFICATION` optionally render account-provided meta tokens at build time for URL-based verification. Domain-property DNS verification still requires its TXT record. Wordstat is a keyword research service, not a place to submit a site.
8. Create a dedicated Yandex Metrika counter for this domain. Set its real numeric ID in `VITE_METRIKA_ID` at build time. Tracking stays disabled by default and runs only after consent. Do not reuse a different product's counter. Test acceptance and revocation; images and filenames are not event parameters, and Webvisor is disabled.
9. Test in a physical Safari/iPhone and Chrome/Android, including native screenshot paste, large files, cancellation and downloads. Automated WebKit is useful but does not prove acceptance on every iOS version.

Production host: 150.251.143.215. Nginx serves the static release and loopback API. Both public names use DNS only, Let’s Encrypt certificates and TLS 1.2. Public TCP listeners are 22, 80 and 443; private 8443 accepts the website stream. Certificate renewal reloads nginx. Account verification and Metrika identifiers remain unset.

## Server-mode activation

Install the broker from backend/README.md on the dedicated conversion host, then review/install wase-download-api.service. `PUBLIC_ORIGINS=https://wase.download`, loopback port 5189 and request limits are required. Nginx and Caddy examples proxy /api to this broker. Do not expose the upstream ConvertX UI or Docker socket. A site build alone enables browser mode; server mode activates only after /api/formats succeeds.

Root language selection uses a small local script. Explicit language pages are static and crawlable. Search-console verification meta tags are generated from GOOGLE_SITE_VERIFICATION / YANDEX_SITE_VERIFICATION during the build. Neither ownership verification nor analytics is activated without the real user-provided account identifiers.

Public production HTTPS is multiplexed on port 443. The website terminates TLS on private 127.0.0.1:8443 with PROXY protocol; stream routing passes encrypted VPN connections onward. `stream.example.conf.template` documents the four-country trial without publishing operational upstream addresses. Replace placeholders before validating with nginx -t. Only DE/FI/PL/AT primary TCP subscriptions were changed; other countries and XHTTP backup profiles retain previous routes.
