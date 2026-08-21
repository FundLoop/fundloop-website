source: https://hackmd.io/WRv6GQlbS52mqLfyyv27Tg?both=

# FundLoop Migration

Welcome to the FundLoop refactor and migration initiative. 

We currently have two different code bases, both messy and AI generated. One outlines the broader website with minimal functionality everywhere (incl. for the projects section.) The other codebase only covers the Projects section with a lot more detail, and is intended to plug into, replace and superseed that part of the broader website.

As we evolve the FundLoop platform into a unified, production-ready architecture, your task is to consolidate the overall site structure, starting from the `fundloop/` repository, and adding the more complete and feature-rich “projects” functionality found in `fundloop-projects/`. This migration is not just about moving code — it's about streamlining how we represent projects across the ecosystem, improving modularity, and preparing the app for deeper integrations like Cubid identity verification and human scoring. Our goal is to make this codebase easier to extend, easier to maintain, and more aligned with the values of transparency and participation that define FundLoop.

Please read this full **migration checklist** carefully before you begin.

# FundLoop Target State

Proposed **amalgamated project structure** that merges the **overall architecture from `fundloop/`** with the **robust “projects” functionality from `fundloop-projects/`**, eliminating redundancy and clarifying responsibility across folders.

---

## 🧱 Amalgamated FundLoop Project Structure

```plaintext
fundloop/                          # Main project root (now unified)
│
├── app/                          # Next.js App Router entrypoint
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Homepage or default view
│   ├── globals.css               # Imported in layout
│   ├── actions.ts                # Server-side actions
│   ├── dashboard/                # Main dashboard view (if any)
│   ├── people/                    # New
│   │   ├── page.tsx              # Public people index view
│   │   └── [id]/                 # Dynamic people detail pages
│   │       └── page.tsx
│   ├── projects/                 # Fully migrated from fundloop-projects
│   │   ├── page.tsx              # Project index view
│   │   └── [id]/                 # Dynamic project detail pages
│   │       └── page.tsx
│   └── auth/                     # Sign-in / sign-up / profile routes
│       └── ...
│
├── components/                  # UI components (shared and domain-specific)
│   ├── ui/                      # Shadcn-style primitives
│   ├── common/                  # Site-wide components (nav, footer, layout, etc.)
│   ├── auth/                    # Login, signup, etc.
│   └── projects/                # Fully adopted from fundloop-projects
│       ├── project-card.tsx
│       ├── project-details.tsx
│       ├── donate-button.tsx
│       ├── ...
│
├── hooks/                       # Reusable custom React hooks
│   ├── use-active-org-members.ts
│   ├── use-toast.ts
│   └── ...
│
├── context/                     # Global state providers (e.g. simulation, auth)
│   └── simulation-context.tsx
│
├── lib/                         # Utility functions & API helpers
│   ├── supabase-client.ts       # Supabase setup
│   ├── auth.ts                  # Login, logout, session logic
│   ├── utils.ts                 # General-purpose utilities
│   └── ...
│
├── types/                       # Global TS types
│   ├── database.types.ts        # Auto-generated Supabase types
│   ├── user.ts                  # Custom user-related types
│   └── ...
│
├── public/                      # Static assets
│   ├── favicon.ico
│   ├── placeholder-*.png|svg
│   └── ...
│
├── styles/                      # Tailwind and custom CSS
│   └── globals.css
│
├── utils/                       # Dev-only tooling and mock data
│   └── mock-data.ts
│
├── database/                    # Prisma or Supabase migrations (if used)
│   └── ...
│
├── tailwind.config.ts          # Tailwind CSS config
├── next.config.mjs             # Next.js config
├── tsconfig.json               # TypeScript paths and settings
├── package.json                # Project dependencies
└── .gitignore
```

---

## 🔄 Key Integration Rules

| Task | Action |
|------|--------|
| **Project pages** | Use all routes and components from `fundloop-projects` (`app/projects/`, `components/projects/`) |
| **Context, hooks, types** | Use `simulation-context.tsx`, `use-active-org-members.ts`, etc. from `fundloop-projects` |
| **Keep global structure** | Keep `fundloop/` base structure — especially homepage, auth, and shared layout |
| **Deduplicate UI components** | Merge `components/ui/` folders and remove duplicates |
| **Style consistency** | Ensure all styles resolve through `globals.css` and unified Tailwind config |
| **Sim mode & dashboards** | If `fundloop/` has simulation or admin logic, embed that cleanly into the merged views using contexts |

---

## 🧠 Optional Enhancements

| Enhancement | Purpose |
|-------------|---------|
| **Route guards** | Protect `/projects/[id]` for authenticated users |
| **Supabase RLS integration** | Tie components directly to Supabase row-level security (currently turned off) |
| **Breadcrumbs & metadata** | Improve navigation and SEO by adding head/meta and breadcrumbs |
| **Layout reusability** | Extract shared layout logic (e.g., nav/sidebar) into `components/common/layout.tsx` |

---

# Migration Checklist

Here’s a detailed and extensive to fully integrate the `fundloop-projects/` features into the broader `fundloop/` codebase — along with steps for the **Cubid SDK** and user scoring widget.

---

## ✅ PHASE 1: Pre-Merge Preparation

### 🔹 General Setup
- [ ] Ensure both `fundloop/` and `fundloop-projects/` are on up-to-date branches
- [ ] Backup both directories
- [ ] Set up a test branch: `merge/projects-module`

---

## ✅ PHASE 2: Merge “Projects” Functionality

### 📁 `app/projects/` Route
- [ ] Replace `fundloop/app/projects/` with `fundloop-projects/app/projects/`
- [ ] Confirm dynamic route `projects/[id]/page.tsx` works with fallback or ISR strategy
- [ ] Verify routing and layout still work under `app/layout.tsx`

### 📁 `components/projects/`
- [ ] Copy full `components/projects/` directory from `fundloop-projects/`
- [ ] Remove any older placeholders or partial components from `fundloop/`
- [ ] Register new components in Storybook (if used) or document usage

### 🧠 Contexts
- [ ] Copy `simulation-context.tsx` from `fundloop-projects/context/`
- [ ] Hook it into `app/layout.tsx` or a central provider wrapper
- [ ] Confirm simulation toggles (e.g., `SimulationBanner`) respond correctly

### 🧲 Hooks
- [ ] Move `use-active-org-members.ts`, `use-local-storage.tsx`, and others from `fundloop-projects/hooks/` to `fundloop/hooks/`
- [ ] Remove duplicates in `fundloop/hooks/`

### 🧩 Shared UI Components
- [ ] Merge `components/ui/` folders
  - [ ] Deduplicate components like `button.tsx`, `card.tsx`, `toast.tsx`
  - [ ] Keep newer, Shadcn-style components as the canonical source
- [ ] Test global accessibility of all shared UI components

---

## ✅ PHASE 3: Tailwind, Types, Utilities

### 🖌 Styling
- [ ] Merge Tailwind config from `fundloop-projects/tailwind.config.ts` if enhanced
- [ ] Replace `globals.css` only if project-specific styles are included
- [ ] Run `tailwind build` to verify no class collisions

### 🧾 Types
- [ ] Replace or merge `types/database.types.ts` to reflect Supabase schema
- [ ] Ensure project-related DB types are still accurate
- [ ] Re-run codegen if using Supabase type generation

### 🧪 Utilities
- [ ] Add any useful dev-only tools from `utils/` (e.g., `mock-data.ts`) into a merged `fundloop/utils/` folder

---

## ✅ PHASE 4: Supabase Integration

- [ ] Ensure the Supabase client is set up in `lib/`
- [ ] Confirm that project data, donation history, and public members list resolve from Supabase correctly
- [ ] Integrate `use-active-org-members.ts` with correct `organization_id` context
- [ ] Remove the yellow "auth session simulator" banner from the top of the `fundloop-projects/` and replace it with proper Subabase auth
---

## ✅ PHASE 5: Cubid SDK Integration

### 1. **Install SDK**
```bash
npm install cubid-sdk
# or
pnpm add cubid-sdk
```

### 2. **Create Matching Cubid User**
- [ ] On login or page load, call `cubid.ensureUser({ uuid })` to ensure each `auth.user.id` has a Cubid user
- [ ] Store the returned `cubid_id` in Supabase `users` table if not already present

### 3. **Embed Cubid Widget**
- [ ] Place the Cubid Widget in the onboarding area or profile settings page
- [ ] Allow users to either:
  - [ ] Connect a wallet and prove Gitcoin Passport score
  - [ ] Or verify phone number
- [ ] Save resulting verification or score into the `users` table (or cache via Cubid API)

### 4. **Show Human Score Badge**
- [ ] Add visual indicator of “verified human” or “Cubid score: X” near project comments, donation buttons, or in profile menus

---

## ✅ PHASE 6: Final QA & Cleanup

- [ ] Rebuild and test navigation to `/projects`, `/projects/[id]`
- [ ] Confirm donation buttons and simulation mode work
- [ ] Check mobile responsiveness and UI consistency
- [ ] Run lint and type checks (`eslint .`, `tsc --noEmit`)
- [ ] Remove deprecated components and pages
- [ ] Remove duplicate entries in `package.json`
- [ ] Test Cubid integration with a fresh account

---

# What Comes Next - Soon TM


### 1. 👤 **User Pages & Roles**
- Introduce **public-facing user pages** with opt-in visibility
- Role-based logic:
  - **Builders**: contribute code or infrastructure
  - **Admins**: manage projects or organizations
  - **Members**: active participants in projects
- All roles may qualify for **citizen salary** if participation thresholds are met
- Public profiles may include badges, contributions, and social links

---

### 2. 🛡️ **Cubid-Integrated Profiles**
- Ensure all users are matched with a **Cubid ID**
- Embed Cubid widget for users to:
  - Prove Gitcoin Passport score via wallet
  - Or verify phone number
- Store and display **human score** and badge (e.g. “Verified Human”)

---

### 3. 💸 **Standard Donation Flows**
- Implement reusable donation flow components (e.g., `DonateButton`)
- Add steps for:
  - Donor **confirmation and receipt**
  - Project team **review & acknowledgment**
  - Transparent **receipt reporting**
- Show donation history on both project and user pages

---

### 4. 💰 **Payout Preferences**
- Allow users to choose between **crypto or fiat** payouts
- Incentivize users who **opt into dual support** (fiat+crypto) with bonuses
- Add payout configuration section to user settings

---

### 5. 🔐 **zkActivitySum Integration**
- Integrate privacy-preserving proof that user has been active in ≥3 projects
- Projects report participation events to zkActivitySum
- Generate proof on user side without revealing which projects they used

---

### 6. 🧾 **Citizen Salary System**
- Define eligibility based on:
  - Cubid score
  - zkActivitySum proof of activity
  - Payout preference (bonus for flexibility)
- Run monthly salary round, auto-distribute to qualified users
- Add claim UX for users to receive or defer payments

---
