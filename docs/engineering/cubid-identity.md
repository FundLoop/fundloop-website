# CUBID Identity and Snapshot Model

Last reviewed: 2026-04-15

This document describes the current FundLoop-to-CUBID integration shape after Sessions 14 through 16.

## Scope

FundLoop now treats CUBID as the identity authority for publish- and payout-adjacent trust signals, while still keeping lightweight local app fields on `public.users`.

The current model is intentionally split:

- `public.users`
  - lightweight app contract
  - `cubid_id`
  - `cubid_identity_status`
  - `primary_email_identity`
  - `cubid_score`
- `public.cubid_identity_snapshots`
  - normalized synced snapshot for the latest CUBID view
  - authoritative full/legal name
  - current email and phone
  - discovered and verified stamp types
  - raw identity and stamp payloads
  - last sync timestamp and last sync error metadata

## Authority Model

FundLoop now treats CUBID as the authority for identity fields and trust signals, while FundLoop remains the authority for app-local profile preferences.

- CUBID-managed identity
  - full/legal name
  - primary email
  - primary phone
  - provider and social stamps
  - verification state
  - CUBID score
- FundLoop-managed profile and preferences
  - display name
  - profile headline
  - bio
  - occupation
  - location
  - interests
  - visibility settings
  - wallets and product preferences

If CUBID does not yet provide a managed field, FundLoop should show it as read-only and pending. The app should not silently fall back to local editing for CUBID-owned fields.

Legacy local values may still exist for compatibility. In the UI they are treated as a fallback state rather than the canonical source of truth.

## Current Commands

- `user-cubid-resolve-email`
  - ensures the authenticated user has a CUBID user id based on email
  - updates the lightweight fields on `public.users`
- `user-cubid-sync-profile`
  - ensures the CUBID user id first if needed
  - fetches identity, score, user data, and stamps
  - normalizes and upserts `public.cubid_identity_snapshots`
  - stores normalized `primary_name`, `primary_email`, and `primary_phone`
  - strengthens `users.cubid_identity_status` when the snapshot proves more than the prior local state
  - mirrors stronger identity state back into lightweight `public.users` fields without clearing previously good values on transient upstream failures

Publish remains blocked only on linkage:

- `linked`
- `verified`

Phone and extra provider stamps improve profile completion but do not block publish in Session 14.

## Browser Bridge

Session 14 uses the local CUBID v2 packages:

- `@cubid/api`
- `@cubid/web2`
- `@cubid/web2-react`

The browser does not receive `CUBID_API_KEY`.

Instead:

- Supabase Edge Functions handle email resolution and snapshot sync
- authenticated internal Next route handlers proxy:
  - phone OTP start
  - phone OTP verify
  - verified stamp persistence
- a small browser `CubidWeb2Client` wrapper feeds `PhoneOtpForm`
- provider connection buttons use CUBID-hosted allow-flow URLs and rely on a later snapshot refresh

## Snapshot Shape

The current `public.cubid_identity_snapshots` row is the normalized read boundary for identity-aware UI and later operator tooling. Important fields include:

- `cubid_user_id`
- `primary_name`
- `primary_email`
- `primary_phone`
- `cubid_score`
- `available_stamp_types`
- `verified_stamp_types`
- `last_synced_at`
- `last_sync_error_code`
- `last_sync_error_message`

The raw upstream payloads remain stored for auditability:

- `raw_identity`
- `raw_stamps`

Session 16 intentionally does not add a separate child table for stamps yet.

## Profile Completion

FundLoop now shows a hybrid profile-completion score:

- local profile fields combined: 60%
  - display name
  - profile headline
  - bio
  - occupation
  - location
  - at least one interest
- linked CUBID identity: 20%
- verified phone: 10%
- at least one extra verified provider stamp: 10%

This score is visible in:

- user onboarding extended identity step
- workspace home
- workspace account
- founder account

## UI Ownership Rules

Signed-in surfaces should render identity in two explicit groups:

- CUBID-managed identity
  - read-only values from the synced snapshot
  - pending states when CUBID has not provided a value yet
  - legacy-local fallback only as an explanatory compatibility state
- FundLoop-managed profile
  - editable local profile/preferences fields
  - public-facing display controls

Public participant profiles should:

- prefer `display_name` as the main headline
- show the CUBID-backed full/legal name as a secondary verified identity field when available
- show lightweight trust cues based on linkage / verification state and score without turning the page into an operator dashboard

## Operator Visibility

The first operator-facing identity health surface now lives at `/admin/identity`.

It is intentionally read-only in the current phase and focuses on:

- stale snapshots
- missing snapshots
- snapshot sync errors
- current linkage status and last sync timestamps

Cross-user or impersonated resync actions remain out of scope for this phase.

## Current Limits

- provider OAuth is still CUBID-hosted and refresh-on-return
- no separate normalized child table for individual stamps yet
- no monthly locking of snapshot state yet
- no full CUBID widget or stamp orchestration inside FundLoop yet

Those deeper behaviors remain future sessions on top of this snapshot contract.
