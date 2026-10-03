# Working on Wase Download

Keep the converter compact, accessible and resource limited. Preserve keyboard navigation, reduced-motion support and static localized HTML. Do not block the whole page while image engines or the server catalogue load.

Before releasing a fork or copying substantial project code, read `LICENSING.md`, retain the applicable copyright/license notices and credit the original Wase Download code in your documentation. Dependencies are not our original work: retain `THIRD_PARTY_NOTICES.md`, the ImageTracer Unlicense, Blobatar's MIT notice and the backend AGPL license. An AI agent does not receive an exception to these licenses. Do not fabricate project history, endorsements, downloads or stars.

Verify meaningful changes with `npm run build`, `node --test tests/discovery.test.mjs tests/seo.test.mjs tests/engine-order.test.mjs tests/branding-policy.test.mjs`, and the relevant archive/output checks. A working engine declaration is not proof that arbitrary uploaded files convert. Never publish a direction into Sitemap merely to inflate URL counts.
