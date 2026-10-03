# Third-party notices

- ImageTracer 1.2.6, Andras Jankovics: The Unlicense / public domain. Original source and full license retained in `imagetracer_v1.2.6.js` and `LICENSES/Unlicense.txt`.
- @jsquash/webp 1.5.0: Apache License 2.0, derived from Google Squoosh. Copyright notices and Apache license supplied in `site/public/licenses/`.
- libwebp encoder distributed by jSquash: BSD-style license. Notice retained in `site/public/licenses/`.
- Vite and Playwright are development tools and are not required on the production web server. See their distributions for their licenses.

- ConvertX (C4illin and contributors), AGPL-3.0; pinned upstream container with original converter modules. Complete fork source: https://github.com/vlad1337vlad1337-droid/wase-converter-engine. Server adapter licensed AGPL-3.0.
- VTracer is supplied in the ConvertX image; upstream source https://github.com/visioncortex/vtracer.

- fflate 0.8.3, MIT; archive packaging also used in Wase Chat.
- Lucide 1.50.0, ISC; icons rendered into static HTML at build time.
- shadcn/ui neutral button/focus/disabled patterns adapted from the Wase Chat design library, MIT; notice included. Brand palette and local Inter fonts reused from the user-owned Wase Chat app.

- Inter / Inter Tight, SIL Open Font License 1.1; original fonts hosted locally without alteration.
- Caveat, Copyright 2014 The Caveat Project Authors, SIL Open Font License 1.1. Small greeting and converter-title font subsets are hosted locally; full notice: `site/public/licenses/caveat-OFL.txt`. Source: https://github.com/google/fonts/tree/main/ofl/caveat.

## Blobatar

Local decorative SVG characters are generated at build time with [Alain00/blobatar](https://github.com/Alain00/blobatar), version 2.7.0. MIT License, Copyright (c) 2026 Alain. The full license is available at `site/public/licenses/blobatar-MIT.txt`. No external avatar service or runtime animation library is used.

## PDF.js

PDF result previews use [Mozilla PDF.js](https://github.com/mozilla/pdf.js), `pdfjs-dist` 6.3.289, Apache License 2.0. The library and its worker are loaded only when a PDF preview opens. The full Apache license is retained in `site/public/licenses/pdfjs-APACHE-2.0.txt`. Locally bundled standard fonts keep their Foxit and Liberation notices in the same directory; PDF.js image-decoder notices are retained there as well. Preview canvases contain the first page, without scripting, interactive annotations, or embedded HTML.
