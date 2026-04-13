# Repo TODO

## Wallet App Production Readiness (Recommended Order)

- Replace the remaining mock and local-only payment operations with production-backed flows.
  The biggest repo-backed gaps are `app/projects/[slug]/payments/page.tsx` and `app/admin/payments/page.tsx`, which still save, confirm, or mutate payment state in local UI state instead of the database.
- Lock payment confirmation to the right actor and surface the real operational state clearly.
  Project admins should be able to create obligations and submit crypto receipts, but internal FundLoop admins should own final receipt confirmation and reconciliation.
- Add project-side payment-method management outside onboarding.
  Teams need a settings or payments-management surface to add, disable, reorder, and set a default crypto route after initial setup.
- Ship deployment-safe chain configuration and wallet environment validation.
  Add per-environment contract manifests, validate `NEXT_PUBLIC_REOWN_PROJECT_ID` and chain RPC settings at startup, and make the active intake contracts and treasury routes auditable without manual copy/paste.
- Build the onchain reconciliation layer that moves submitted receipts into confirmed or failed states.
  The current wallet UX can store a tx receipt, but production readiness still requires confirmation depth rules, reorg handling, and an indexer/accounting pass that updates `awaiting_confirmation`.
- Add remote-safe end-to-end coverage for the real wallet and payment flows.
  Prioritize authenticated project-payment tests for wallet connect, chain switching, token approval, stablecoin deposit submission, and admin confirmation against shared remote-backed data.
- Add observability for wallet and payment failures.
  Capture wallet-connect failures, chain mismatch loops, receipt-recording failures, payment-save failures, and admin confirmation errors before broader launch.
- Clean up launch paper cuts in the runtime and build environment.
  The repo targets Node 22.x, but this checkout is currently on Node 25.8.2; `next build` also still warns about inferred workspace root and existing Recharts sizing during static generation.

## Environment, Deployment, and Release Readiness

- Populate all env variables.
- Add a real `NEXT_PUBLIC_REOWN_PROJECT_ID` so wallet connect works outside placeholder mode. The missing env is already surfaced in `components/project-crypto-payment-dialog.tsx`.
- Deploy the intake contracts on Base, Ethereum, and Celo, then populate the contract and treasury settings the migration expects. Right now the code safely disables zero-address routes, but that also means crypto payments are not live yet.
- Add contract deployment manifests per chain and environment so the app can consume verified addresses and ABI versions without manual copy/paste.
- Add a contract upgrade and ownership runbook covering deployer, treasury rotation, allowed-token updates, and emergency disable procedures.

## Supabase, Database, and Local Data Workflows

- Push the tracked Supabase migrations to the linked remote project so the live DB matches the app code. The big ones are `20260324213000_resumable_onboarding.sql` and `20260324150000_crypto_collection_rails.sql`.
- Make `supabase/seed.sql` reliably replayable for local resets. The repo is much healthier now, but local DB bootstrapping is still weaker than it should be.
- Replace the current local seed dump approach with a stable, replayable seed workflow for local Supabase resets; the first pass intentionally prioritized canonicalizing the remote schema and shrinking the seed over perfect local replay.
- Persist the chosen crypto `periodId` on a first-class database column or linked payment-events table instead of only in onchain submission metadata and notes.

## Crypto Collection Rails, Contracts, and Treasury Intake

- Decide how we want to handle pricing for non-stablecoin routes. The current code correctly blocks direct USD-to-volatile-asset submission until quote/oracle support exists, so native ETH/CELO payments are not truly complete yet.
- Add quote and pricing support before allowing direct native-asset payments; the current dialog correctly blocks volatile assets because the V1 scope stopped at stablecoin-safe submission.
- Implement the project-specific deposit-address fallback path that was intentionally deferred while shipping the smart-contract-first crypto collection V1.
- Add auto-sweep functionality for deterministically generated deposit addresses into the FundLoop treasury.
- Extend onchain payment attribution beyond the current month-only `periodId` approach if business needs later require explicit year or invoice-level identity.
- Add token allowlist governance rules and admin tooling for enabling or disabling supported assets per chain.

## Fiat Rails, Onramp, and Offramp

- Add a fiat payment route.
- Add the fiat onramp layer that was explicitly left out of the crypto rails session.
- Build a fiat off-ramp so users can collect payouts in fiat.
- Build a Superfluid-based off-ramp so users can receive streaming payments.

## Onchain Indexing, Accounting, and Reconciliation

- Add an indexer/accounting pass for onchain submissions so `awaiting_confirmation` can move to real confirmed/credited states.
- Build the full indexer and accounting engine layer that watches onchain deposits, reconciles them against obligations, and advances payment states beyond `awaiting_confirmation`.
- Add confirmation depth and reorg handling rules for onchain submissions before they are treated as credited payments.
- Add an indexer view to visualize the on-chain data.

## Payments Product and Project Finance Operations

- Fill in the remaining business-usable admin workflows: reviewing project payment submissions, reconciling monthly obligations, and managing project payment methods from settings instead of only onboarding.
- Add project payment-method management UI under settings so teams can add, disable, reorder, and mark a default crypto route after onboarding.
- Add post-onboarding management screens so project teams can edit crypto routes after signup instead of relying mainly on onboarding-time setup.
- Add a production readiness pass for the payments page UX: clearer copy around USD-denominated obligations, explicit stablecoin-only messaging, and better empty/error states when no crypto routes are configured.

## Onboarding, Auth, and User-Flow Verification

- Run authenticated end-to-end smoke tests against the real remote-backed app for:
  - new user onboarding and resume-from-draft
  - new project onboarding and publish
  - project payments page
  - crypto payment submission path
- Add full remote-backed onboarding draft verification after the onboarding migration is pushed to the linked Supabase project; earlier sessions intentionally stopped at local and partial smoke coverage because the remote DB was not yet aligned.
- Do a targeted UX pass on onboarding copy, missing empty states, and auth redirect edges now that the main architecture is in place.
- Add an admin view for inactive onboarding drafts so support can help users resume stuck onboarding flows without making those drafts public.

## Testing, QA, and Reliability

- Add a remote-safe Playwright fixture strategy that creates unique test users/projects and cleans them up without resetting the shared Supabase database.
- Add end-to-end coverage for wallet connect, chain switching, approval, and contract write flows once deployed addresses and real envs are available; that was explicitly deferred during the crypto V1 implementation.
- Add observability for the critical flows: auth redirect failures, onboarding save/publish failures, payment submission failures, and wallet-connect errors.

## Content, Landing Pages, and Site UX

- Separate the landing experience into dedicated sales-pitch pages for founders, users, and other roles instead of relying on one generic homepage.
- Revisit the linked explainer blog posts and align their copy with the current onboarding, payment, and crypto collection flow.
- Clean up the API page.
- Do a visual QA pass on the tightened footer across tablet and desktop breakpoints; the code was intentionally adjusted conservatively first, with visual tuning left for later.
- Display the people of FundLoop as a dynamic graph rather than a static table.

## Profiles, Identity, and Cubid Integration

- Evaluate moving user profiles, or parts of them, out of the FundLoop UI and instead leveraging Cubid's user profiles.

## Economics, ZK, and Agent Participation

- Build a simple first version of the zk calculator.
- Add a fractional component to the zk calculator, leveraging users' Cubid scores.
- Add features to distinguish human-serving bots and autonomous bots, and give them partial pay where appropriate.

## Communication, Support, and Community Features

- Add a chat bot.
- Add external notifications for user feedback and similar inbound events.
- Enable the "chat with founders" feature.

## Developer Platform, SDK, MCP, and Documentation

- Build a low-priority MCP server for FundLoop.
- Build an SDK for developers.
- Document the technical architecture, user journey, and functional architecture.
