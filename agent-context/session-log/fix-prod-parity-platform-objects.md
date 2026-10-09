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

### session v3: Provenance verification before excluding a platform object

- **Timestamp:** 2026-10-09T16:20:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/prod-parity-platform-objects`
- **Head before commit:** `b9b5e1c`

---

#### Objective

Codex's third finding: matching an identity alone discards the object's definition from both dumps,
so parity could certify an altered SECURITY DEFINER event-trigger function, or silently omit a
function a migration starts creating under that name. Correct, and the most serious of the three.

---

#### Actions Taken

- Each allowlist entry is now pinned to the platform's definition digest and catalog attributes:
  zero-argument signature, SECURITY DEFINER, owner `postgres`, `search_path=pg_catalog`, referenced
  by the `ensure_rls` event trigger, and `sha256(pg_get_functiondef())` =
  `dd9ce3fd…f271`, read read-only from Production.
- `stripPlatformManagedObjects(dump, identities)` now drops only identities the caller passes, so a
  name match can no longer remove anything by itself. `platformManagedCandidates` finds candidates,
  `platformManagedProvenanceSql` + `evaluatePlatformManagedProvenance` verify one against the
  observed catalog, and `dumpObservedPublicSchema` strips only what verified. A candidate that
  fails any check stays in the comparison, so the fingerprint reports it as drift, and the job logs
  which check failed.
- `dumpExpectedPublicSchema` asserts a fresh replay contains none of these identities. If a
  migration starts creating one, the job fails and the entry has to be removed rather than
  excluded — otherwise parity would quietly stop covering an object we own.
- Exclusions are recorded in the parity attestation and the diagnostic as
  `platformManagedExclusions` (identity, event trigger, verified digest), so what was left out of
  the fingerprint is stated rather than dropped.
- Contract doc and deployments doc updated with the verification, the fail-closed behaviour and the
  re-pinning rule. The digest is a reviewed constant: a platform change fails parity until re-pinned.

---

#### Validation Notes

- Parity suite 24 tests; environment manifest, evidence contract and goal-158 suites 71 tests; all
  green. Typecheck and lint clean. Workers capped at 2, no full jsdom suite locally.
- New tests cover each rejection reason (definition digest, security definer, owner, config, event
  trigger, not-found, ambiguous), that an unverified identity is not stripped, that an overload and
  a similar name are not candidates, and that a migration-owned identity in the replay throws.

---

#### Reflections

The first version traded a false failure for a blind spot, which is the wrong trade for a check whose
whole value is that an unexplained object in `public` is a finding. Pinning the digest keeps the
exclusion narrow and makes a platform change loud instead of invisible. Worth noting the cost: when
Supabase next changes that function, Production deploys fail until someone re-pins the digest — the
docs say so, and that is the intended direction to fail.

---

#### Suggested Next Steps

- Second deep review pass over the three fixes, then merge when all six conditions hold.
- Noak approves another Production run after this reaches main.

### session v4: The docs I edited are bound into a counsel review packet

- **Timestamp:** 2026-10-09T19:10:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/prod-parity-platform-objects`
- **Head before commit:** `462873f`

---

#### Objective

CI `validate` failed on this branch: `evidence digest mismatch:
docs/engineering/production-readiness-evidence-contract.md`. I did not know that document was
digest-bound, so this is a coupling worth recording rather than just fixing.

---

#### What was actually wrong

`docs/legal/review-drafts/counsel-review-packet.json` binds the exact bytes of the documents and
sources a qualified counsel will review. Two of its bound artifacts are files this branch edits:

- `docs/engineering/production-readiness-evidence-contract.md` (the v3 algorithm definition), and
- `lib/release-readiness/evidence-manifest.ts` (the validator that now requires v3).

Changing either invalidates its recorded digest, and the packet's own `packetSha256` with it.

The packet is explicitly `DRAFT - NOT APPROVED - NOT EFFECTIVE`, with a null reviewer, null
decisions and no effective date — the verifier asserts all of that, so a fabricated approval cannot
be slipped in. Refreshing a bound digest while the packet is in draft is therefore the intended
workflow: otherwise a bound document could never be corrected before counsel reads it. I refreshed
only the two digests whose files genuinely changed, and recomputed `packetSha256` with the repo's
own `counselReviewPacketDigest`, so the canonicalization is the verifier's own rather than my
approximation of it.

**Worth a human's attention even so:** when counsel does review this packet, they will review the
new bytes of the evidence contract, which now describe a fingerprint algorithm that excludes
platform-provisioned objects. That is a real change in what the contract promises, and it is the
substance of this PR rather than an incidental edit.

---

#### A mistake of my own, recorded because it cost time

I chased three further "failures" in `tests/production-readiness-evidence-contract.test.ts` that
were an artifact of my own tooling: the scratch Vitest config I was using to avoid jsdom had the
*oauth* worktree hardcoded as its root, so `@` resolved to another branch's code while the fixtures
came from this one. The config now derives its root from `process.cwd()`. The lesson is the obvious
one — a tool that silently points at the wrong tree produces failures that look like code bugs.

---

#### Validation Notes

- Counsel and accounting packet suites pass; the full node project passes: 167 files, 1070 tests.
- Typecheck and lint clean.

---

#### Suggested Next Steps

- Unchanged: second review pass, then merge.

### session v5: Codex review — verify the bytes, and keep the record durable

- **Timestamp:** 2026-10-09T19:50:00Z
- **Head before commit:** `bb2bc2c`

---

#### Objective

Two findings, both correct, and the first one is the kind that matters: it described a way for the
check to pass without ever verifying what it removed.

---

#### Actions Taken

- **Bound verification to the dumped snapshot.** The dump and the catalog query are two observations
  of a mutable database, so a definition altered between them could be stripped on the strength of
  the other observation. Each entry now pins `bodySha256` = `sha256(pg_proc.prosrc)`, which is
  exactly the text pg_dump emits between a function's dollar quotes. `extractDumpSection` and
  `extractDumpedFunctionBody` pull those bytes out of the dump, and they are compared with the same
  pinned digest the catalog query is checked against. Both observations must now meet one reviewed
  constant, and a mismatch leaves the object in the comparison so the fingerprint reports drift.
- **Carried exclusions into the durable manifest.** `buildEnvironmentManifest` dropped
  `platformManagedExclusions`, so the immutable manifest did not say what its v3 fingerprint had
  omitted — directly contradicting the contract I had just written. The field is now propagated, the
  environment-manifest validator rejects an entry without both digests, and the manifest JSON schema
  requires it.
- Contract doc updated with the two-observation rule and the durable record; the counsel packet's
  digest for that document re-bound, since it is one of its bound artifacts.

---

#### Validation Notes

- Full node project: 167 files, 1072 tests passing. Typecheck and lint clean.
- New tests cover the section and body extraction, including the cases that return null, the pinned
  body digest as a rejection reason, and the manifest propagation and schema requirement.

---

#### Reflections

The first finding is worth keeping in mind beyond this PR: I had verified *a* definition, not *the*
definition. Checking the live catalog felt rigorous because it used a digest, but the bytes being
removed came from a different read. Verifying the artifact in hand is the only version of this that
means anything.

---

#### Suggested Next Steps

- Unchanged: second review pass, then merge in HBIC's order.
