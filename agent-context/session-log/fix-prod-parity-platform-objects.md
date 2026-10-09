# Session Log: fix/prod-parity-platform-objects

### session v1: Production schema parity fails on platform-provisioned public objects

- **Timestamp:** 2026-10-09T15:35:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/prod-parity-platform-objects`
- **Head before commit:** `7473aa4`

---

#### Objective

Production deploy run 35647572168 applied all 116 migrations successfully and then failed the
schema parity check: `Effective public schema drift: expected=c27ec70d… observed=619ab456…`. Find
the cause and fix it, so the next approved run can get past this step.

---

#### Diagnosis

The sanitized diagnostic is written to `RUNNER_TEMP` and the evidence upload only runs on success,
so the failing run left nothing to diagnose from. Diagnosed instead from the databases themselves:
Dev passes this same check, so Dev is a known-good post-migration state, and a read-only inventory
of `public` (relations, columns, constraints, indexes, policies, functions, triggers, ACLs) from
both hosted projects isolates what Prod has that a migration-pure database does not.

Of 6,227 inventory rows the comparison found exactly one structural difference:

- Prod has `public.rls_auto_enable` (SECURITY DEFINER), backing the `ensure_rls` event trigger.
  Dev has neither the function nor the trigger. No migration creates it, it belongs to no
  extension, so `pg_dump --schema=public` emits it and a fresh replay can never match.

This is a platform-provisioning difference by project age: Prod was created 2026-04, Dev 2025-04,
and Supabase installs `ensure_rls` into new projects. It is the same platform behaviour that
migration `20260920100000_enable_rls_on_service_only_tables.sql` already accounts for at the table
level; the function itself was still being compared.

The 107 ACL differences found alongside it (Prod grants carry Postgres 17's `MAINTAIN` bit, Dev's
pre-upgrade grants do not) are not part of the fingerprint: the dump is taken with
`--no-privileges`. They are noted in the docs so the next reader does not chase them.

---

#### Actions Taken

- `scripts/verify-supabase-schema-parity.mjs`: new `stripPlatformManagedObjects`, applied inside
  `dumpPublicSchemaFromParityContainer` so the fingerprint, the object manifest and the sanitized
  diagnostic all describe our schema. The list holds exact identities only
  (`public.rls_auto_enable(…)`), so anything else in `public` still has to be accounted for.
  Expected-side fingerprints do not change, because a fresh replay never had the object: no stored
  Dev baseline or repair manifest is invalidated.
- `.github/workflows/supabase-deploy.yml`: upload the sanitized diagnostic on a failed deploy
  (`failure() && mode == 'deploy'`), so the next drift failure is diagnosable from the artifact.
- `docs/engineering/supabase-deployments.md`: a "Platform-provisioned objects in `public`" section
  covering the rule, the deliberately narrow list and what it takes to add to it, the privileges
  that are outside the fingerprint, and the fact that identities in the diagnostic are hashed.
- `tests/supabase-delivery-parity.test.ts`: the platform function on the observed side alone now
  leaves the comparison passing; a similarly named non-platform function still drifts; the strip
  happens at the dump boundary; the failure upload exists.

---

#### Validation Notes

- Read-only throughout against both hosted databases: `supabase db query --linked --project-ref`
  with SELECT-only inventory queries. Nothing was changed on Production.
- Parity suite green. No local Supabase stack was started (host at memory pressure); CI's
  fresh-schema replay covers the replay side.

---

#### Reflections

The check was right to fail: Prod's public schema genuinely differed from the replay. What was
wrong is that the fingerprint claimed to verify our migrations while comparing objects we do not
own. Worth keeping the list narrow — the value of this check is that an unexplained object in
`public` is a finding, not noise.

---

#### Suggested Next Steps

- Noak has to approve another Production run after this merges: the `Production` environment gate
  is per-run.
- On that run, verify migration 116 applies, parity passes, and the Edge Functions and evidence
  steps complete.

### session v2: Codex review on PR #270

- **Timestamp:** 2026-10-09T16:10:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/prod-parity-platform-objects`
- **Head before commit:** `5525947`

---

#### Objective

Codex left two findings on #270. Both were right, and the second one mattered more than the first.

---

#### Actions Taken

- **Match only the zero-argument platform function.** The allowlist pattern accepted any argument
  list, so an overload such as `public.rls_auto_enable(text)` — which the platform does not create —
  would have been stripped from both dumps and could never be reported. The pattern now matches
  `public.rls_auto_enable()` exactly, and a test asserts an overload still drifts.
- **Version the filtered fingerprint.** The attestation still called itself
  `pg17-public-schema-normalized-v2`, but that identifier is defined in the evidence contract as
  normalizing the direct `pg_dump` output with every remaining mismatch blocking. Stripping an
  object before hashing is weaker, so recording it under the same name would have made old
  full-schema attestations indistinguishable from filtered ones. The emitted algorithm is now
  `pg17-public-schema-platform-filtered-v3`, and the two validators
  (`scripts/verify-supabase-environment-manifest.mjs`, `lib/release-readiness/evidence-manifest.ts`),
  the manifest JSON schema `const`, the contract doc, `supabase-deployments.md`, the fixtures and
  the tests move with it.
- The contract doc now defines v3 as v2 plus the strip, lists the exact identity, states what it
  takes to add one, and records that v2 and v3 attestations are not comparable. The historical
  `goal-158-delivery-integrity-evidence.json` keeps v2: it attests what was verified at the time.
- `tests/fixtures/production-readiness/manifest-valid.json`: the approval scope digest covers the
  algorithm string, so it was recomputed with the repo's own `approvalScopeSha256`.

---

#### Validation Notes

- Affected suites green: parity, environment manifest, production-readiness evidence contract,
  goal-158 delivery integrity (93 tests). Typecheck clean, lint clean.
- Local worker count capped at 2; the full jsdom suite is not run locally on this host. CI's
  `validate` and `Supabase fresh-schema replay` are the evidence.

---

#### Reflections

The versioning finding is the kind worth taking seriously: the code was correct but the evidence it
emitted claimed a stronger property than it had. An attestation that quietly changes meaning under a
fixed name is worse than one that fails loudly, because every downstream consumer keeps trusting it.

---

#### Suggested Next Steps

- Second deep review pass, then merge once all six conditions hold.
- Noak approves another Production run after this reaches main.
