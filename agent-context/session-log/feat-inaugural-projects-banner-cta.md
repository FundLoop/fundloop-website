# Session Log: feat/inaugural-projects-banner-cta

## Session v1: Add Inaugural Projects Site-Wide Banner CTA and Epoch 1 Onboarding Notice

- **Timestamp:** 2026-08-21T17:26:00Z
- **Agent:** Antigravity (Gemini 3.7 Flash)
- **Branch:** `feat/inaugural-projects-banner-cta`
- **Head:** `b399e26`

---

### Objective

1. Sync local `dev` with remote `origin/dev`.
2. Add a site-wide high-converting announcement banner CTA across public pages seeking inaugural projects for Epoch 1, linking directly into the project onboarding flow (`/?onboarding=project`).
3. Add a clear notice card in the project onboarding flow (`ProjectSignupFlow` basics screen) indicating that projects joining now will be part of the inaugural cohort "Epoch 1".
4. Provide full localization across English (`en`), Spanish (`es`), and French (`fr`).

---

### Actions Taken

- **Created `components/inaugural-banner.tsx`:**
  - Client-side announcement banner component with high-converting chip badge ("Inaugural Cohort"), sparkles icon, compelling copy, and direct CTA link to `/?onboarding=project`.
  - Implemented dismissal state using `useSyncExternalStore` and `sessionStorage` with safe fallbacks and zero hydration mismatch.
- **Updated `app/[locale]/(public)/layout.tsx`:**
  - Rendered `<InauguralBanner />` at the top of the public layout above `<Navbar />`.
- **Updated `components/project-signup-flow.tsx`:**
  - Added an "Inaugural Batch • Epoch 1" callout notice on the project setup `basics` screen to inform founders that onboarding now registers them as part of the inaugural cohort for Epoch 1.
- **Updated `i18n/messages/en.ts`, `i18n/messages/es.ts`, and `i18n/messages/fr.ts`:**
  - Added localized strings for `inauguralBanner` (badge, message, cta, dismiss).
- **Created `tests/inaugural-banner.test.tsx`:**
  - Unit tests verifying banner rendering, link routing to `/?onboarding=project`, dismissal behavior, and session persistence.

---

### Validation

- `pnpm vitest run tests/inaugural-banner.test.tsx tests/project-signup-flow.test.tsx` passed (`7/7` tests).
- `pnpm typecheck` passed (0 errors).
- `pnpm lint` passed with `--max-warnings=0`.
- `pnpm build` completed successfully, generating 165 static and dynamic App Router routes.

---

### Suggested Next Steps

- Add "What is the Fund Loop" visual and interactive dual-persona hover feature to the landing page.

## Session v2: Add "What is the Fund Loop" Visual and Interactive Dual-Persona Hover CTAs

- **Timestamp:** 2026-08-21T17:31:00Z
- **Agent:** Antigravity (Gemini 3.7 Flash)
- **Branch:** `feat/inaugural-projects-banner-cta`
- **Head:** `92a6a60`

---

### Objective

1. Under "Choose your path" above "Where do you fit in the loop" on the landing page, add a new section heading "What is the Fund Loop?".
2. Create a simplified, brand-aligned visual diagram following FundLoop's color schema (`#101b1a` / `#ff7844` / `#34d399`), inspired by `fundloop-for-all.png`.
3. Add a dynamic interactive hover feature:
   - Hovering over the project/company side highlights that flow and presents a clickable CTA: *"This is me, I run a company which would like to participate"* (linking to `/?onboarding=project`).
   - Hovering over the user/participant side highlights that flow and presents a clickable CTA: *"This is me, I'd like to participate and get a monthly income"* (linking to `/?onboarding=user`).
4. Support full localization across English (`en`), Spanish (`es`), and French (`fr`).

---

### Actions Taken

- **Created `components/marketing/what-is-fundloop-visual.tsx`:**
  - Interactive SVG & CSS vector diagram component displaying the 4 core loop nodes (People, Participation, Projects, Mutual Distribution) centered around the FundLoop protocol core.
  - Interactive hover state management with smooth glow transitions and responsive touch accessibility.
  - Dual dynamic clickable persona CTAs routing to `/?onboarding=project` and `/?onboarding=user`.
- **Updated `app/[locale]/(public)/page.tsx`:**
  - Inserted the new "What is the Fund Loop?" heading and `WhatIsFundLoopVisual` above the "Where do you fit in the loop" dual-fork cards.
- **Updated `i18n/messages/en.ts`, `i18n/messages/es.ts`, and `i18n/messages/fr.ts`:**
  - Added localized strings for `whatIsFundLoop` (title, body, node descriptions, and dynamic CTAs).
- **Created `tests/what-is-fundloop-visual.test.tsx`:**
  - Unit tests verifying rendering of all 4 loop nodes, protocol hub, dynamic CTAs, routing attributes, and hover state handlers.

---

### Validation

- `pnpm vitest run tests/what-is-fundloop-visual.test.tsx tests/inaugural-banner.test.tsx` passed (`6/6` tests).
- `pnpm typecheck` passed (0 errors).
- `pnpm lint` passed with `--max-warnings=0`.
- `pnpm build` verified clean Next.js App Router production build across all 165 routes.

---

### Suggested Next Steps

- Open PR from `feat/inaugural-projects-banner-cta` into `dev`.

