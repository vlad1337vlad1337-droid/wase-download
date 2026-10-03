# Contributing

Start with `npm ci`, `npm run build`, then `npm run preview`. The interface is static HTML with a small browser module; no React runtime is needed. The wider server converters are isolated Docker jobs described in `backend/README.md`.

Before a change, read `AGENTS.md` and `LICENSING.md`. Keep original copyright notices and third-party licenses. Do not commit credentials, private uploaded files or customer content.

For a conversion bug, include input/output extensions, whether you used browser or server mode, your browser/version, and a small public or self-created sample when possible. An engine's declared matrix is not sufficient proof of conversion. Validate the output and document losses such as animation, materials, fonts or precision.

For interface changes, check desktop and narrow mobile layouts, keyboard/Escape handling, dark theme and reduced motion. Avoid global preloading gates and permanent requestAnimationFrame loops. Mascots are decorative and must never capture file-upload or scroll input.

Run the checks listed in `AGENTS.md`. New indexable pair pages require actual conversion receipts; irrelevant synthetic transformations and capture-device names should not become SEO promises.
