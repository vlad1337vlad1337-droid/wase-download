# wase.download

A free image converter with English, Russian and Simplified Chinese pages. Select a file, drop images or paste a screenshot with Ctrl/Cmd+V. The browser image mode processes files on the device. Optional server mode uses self-hosted ConvertX in one isolated, offline container per job; no third-party conversion API or account is required.

This repository is a fork of [ImageTracer](https://github.com/jankovicsandras/imagetracerjs). The original tracing engine and its Unlicense are preserved. `UPSTREAM_README.md` documents the engine. WebP export on Safari uses locally hosted jSquash/libwebp WebAssembly; see `THIRD_PARTY_NOTICES.md`.

## Features

- Inputs: PNG, JPEG, WebP, GIF, BMP, supported self-contained SVG.
- Outputs: true vector SVG, PNG, JPEG, WebP, BMP and PNG-based ICO.
- Per-file results and downloads, up to 12 files per batch.
- SVG detail/color controls, raster quality/size controls.
- Heavy tracing and Safari WebP encoding run in cancellable Web Workers.
- Light/dark themes, mobile layouts and keyboard-accessible format menus.
- Static localized HTML, canonical/hreflang, structured data, sitemap and robots.txt.
- Optional Yandex Metrika; disabled without a real counter and explicit consent. No Webvisor or file-name events.

## Run

Node.js 22.12+:

```sh
npm ci
npm run dev
```

Visit http://127.0.0.1:5188/ru/ (or `/en/`, `/zh/`).

```sh
npm run build
npm run preview
npx playwright install chromium webkit
npm test
# With the local converter API running:
RUN_SERVER_TESTS=1 npm test
```

`dist/` is a complete static site. Browser-only mode does not require an upload server. Server mode requires the local Node.js broker and Docker; see backend/README.md. Production compilation should happen in CI, not during a public page request or on every web-server restart.

## Limits

20 MB per file, 12 files per batch, 16 megapixels and an 8192-pixel input edge. SVG tracing downscales to at most 768/1024/1536 pixels for Simple/Balanced/Detailed, with 16/32/64 colors. Photographs are approximated, not losslessly vectorized. GIF output uses the first frame. ICO has a maximum edge of 256 pixels. JPEG and BMP use a white background for transparency.

Browser mode supports the six output formats above. Server mode reads its catalogue from the pinned ConvertX image (900 input extensions and 511 output extensions in this build). These are declared engine capabilities, not a claim that every arbitrary input file or pair has been tested. Available targets depend on the input extension. SVG scripts, external resources, embedded raster images and unsupported constructs are rejected; ordinary paths, shapes, text and gradients are supported.

Clipboard formats and browser permissions vary. Paste keyboard shortcuts use the native paste event. The optional clipboard button shows a useful fallback when clipboard read is unavailable. Automated synthetic paste tests verify the event handling; physical iOS clipboard/device acceptance still needs a real-device check.

## Deployment and search

`deploy/nginx-site.conf` serves the site through a private local HTTP listener; an HTTPS frontend must provide the public host. `deploy/Caddyfile.website` is a standalone HTTPS website template. These are alternatives, not configurations to install together on the same public ports. `scripts/release.sh` installs a prebuilt release atomically; retain prior releases to roll back.

See `deploy/README.md` for certificates, caching, analytics and Search Console / Yandex Webmaster verification. Wordstat is keyword research, not a website registration tool.

## Design and integration

Tool-first layout: queue, status, settings, error and download are inside the upload surface. Recommendations from [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) informed visible feedback, compact spacing, focus and recovery. The current user-requested Wase Chat brand uses monochrome tokens and local Inter fonts; shadcn control-state patterns and Lucide SVGs were adapted from that design library. ZIP packaging uses fflate, already used by Wase Chat. No copied third-party logos or fabricated customer endorsements.

ConvertX fork: https://github.com/vlad1337vlad1337-droid/wase-converter-engine . The adapter does not expose the upstream unauthenticated application. ConvertX and server adapter are AGPL-3.0; original ImageTracer remains under its upstream Unlicense.

Language is selected on the root page using the saved manual preference, then browser languages (EN/RU/ZH), with English fallback. Explicit locale URLs are preserved for sharing and SEO. The complete public catalogue is grouped/deduplicated; format menus render at most 120 matching entries and search the complete catalogue without creating thousands of hidden DOM buttons.

The compact UI uses custom keyboard-operable menus for all selectors. Decorative Blobatar characters are generated locally at build time, remain outside the file controls, and never intercept taps. FAQ and suggested format sections are omitted from the tool screen; localized conversion pages remain available for direct links and indexing.

AVIF export explicitly uses FFmpeg/libaom with one thread and a 50-second limit: the upstream Vips AVIF encoder is unavailable in this pinned image. AVIF/HEIC/HEIF/JXL vectorization first normalizes to PNG before tracing rather than embedding a raster inside an SVG.
