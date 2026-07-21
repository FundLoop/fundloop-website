# Landing page theory branch log

### session v1: rotating prosperity thesis

- timestamp: 2026-07-21T14:21:42.000Z
- agent: Codex
- branch: codex/landing-page-theory
- head: origin/dev at session start
- objective: Add a progressively slowing rotating hero thesis and an editorial Theory of Change section to the localized public homepage.
- actions: Added 19 localized hero prefixes with a fixed mutual-prosperity suffix, restored the networked-economy thesis above the supporting hero body, added reduced-motion and stable accessible-heading behavior, introduced the capitalism/basic-income/pluralism narrative section, and constrained the mobile hero grid so long phrases wrap without viewport clipping.
- tests and validation: Focused rotating-title and i18n tests, lint, typecheck, production build, and desktop/mobile Playwright smoke passed before publish. Browser smoke confirmed live title rotation, Theory section placement, responsive wrapping, and zero console errors; ignored screenshots are under `output/playwright/landing-*.png`.
- reflections: The active checkout did not contain the referenced “Is FundLoop for Normal Companies or Crypto?” heading, so the Theory section sits at the equivalent narrative boundary before “How the loop works.”
- suggested next steps: Review the final phrase and manifesto copy in product context. The progressive delay resets to two seconds after every complete 19-prefix cycle.
