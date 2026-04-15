# CUBID Identity and Snapshot Model

Last reviewed: 2026-04-15

This document describes the current FundLoop-to-CUBID integration shape after Session 14.

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
  - current email and phone
  - discovered and verified stamp types
  - raw identity and stamp payloads
  - last sync timestamp and last sync error metadata

## Current Commands

- `user-cubid-resolve-email`
  - ensures the authenticated user has a CUBID user id based on email
  - updates the lightweight fields on `public.users`
- `user-cubid-sync-profile`
  - ensures the CUBID user id first if needed
  - fetches identity, score, and stamps
  - normalizes and upserts `public.cubid_identity_snapshots`
  - strengthens `users.cubid_identity_status` when the snapshot proves more than the prior local state

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

## Profile Completion

FundLoop now shows a hybrid profile-completion score:

- local profile fields combined: 60%
  - full name
  - display name
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

## Current Limits

- provider OAuth is still CUBID-hosted and refresh-on-return
- no separate normalized child table for individual stamps yet
- no monthly locking of snapshot state yet
- no full CUBID widget or stamp orchestration inside FundLoop yet

Those deeper behaviors remain future sessions on top of this snapshot contract.
