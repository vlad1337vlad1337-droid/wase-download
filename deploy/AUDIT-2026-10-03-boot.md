# Startup and layout follow-up

Original Blobatar eye geometry restored, with larger responsive mascot bodies and no hands. Decorative shapes remain pointer-transparent and are clipped horizontally on mobile without blocking scrolling.

Category list now sets `flex-wrap: nowrap`: CAD stays after Vector and is reached by vertical scrolling. At 390 × 844 the list has 526px content in a 500px viewport; CAD became visible at scrollTop 26 with no horizontal overflow.

Early same-origin `/boot.js` applies the saved theme before the stylesheets and first content rendering. Critical inline CSS uses the already permitted style policy; no inline script exemption or CSP relaxation. The small mascot boot screen waits for synchronous UI initialization, two render frames and at most 350ms of font readiness. It does not wait for catalogue, conversions, image engines or analytics. A separate 1,800ms fail-safe reveals content if the app fails to start. There is no body scroll lock and the overlay does not intercept pointer events. Back-forward cache restores the visible page. Without JS, no boot class is set and static content remains visible.

18 Node checks passed, including boot readiness independent of catalogue, blocked-storage fallback, deadline reveal and saved dark theme. Light/dark local browser refresh revealed the interface and removed the boot screen. Exact appearance during a real iOS reload has not been measured in this change.

GitHub README banner is generated with built-in imagegen, saved at `.github/assets/banner-generated.png`; generation prompt is alongside it. Existing runtime SVG mascots are unchanged in origin and still retain Blobatar's attribution.
