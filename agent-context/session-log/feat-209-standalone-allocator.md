# Session Log: feat/209-standalone-allocator

### session v1: Allocator parity harness scaffold, work in progress (#216)

- **Timestamp:** 2026-09-18T08:30:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/209-standalone-allocator`
- **Head before commit:** `d4ef7a5`

---

#### Objective

Start the website side of #216: a deterministic parity harness that feeds identical synthetic inputs to the embedded calculator and, later, to the standalone `FundLoop/fundloop-allocator` engine, and compares result digests.

---

#### Actions Taken

- Added `tests/support/allocator-parity-fixtures.ts`. It has a seeded mulberry32 generator, 50 fixture specs spanning 1 to 10,000 users (score shape, cap multiple, minor-unit scale, sub-minor residue, currency, source topology), and `computeParityOutcome`, which reduces a result to canonical SHA-256 digests. It has no repository-specific imports, so it can be copied byte-for-byte into the allocator repo.
- Added `tests/allocator-parity-harness.test.ts`, which checks every fixture against `tests/fixtures/allocator-parity/golden-v1.json`. The expected-results file is regenerated only with `ALLOCATOR_PARITY_WRITE=1`.
- Generated `golden-v1.json` from `dev` @ `d4ef7a5`.

---

#### Validation Notes

- `pnpm vitest run tests/allocator-parity-harness.test.ts`: 3/3 pass.
- `tsc --noEmit` and scoped ESLint pass.
- **Known gap:** 33 of 50 outcomes record `funded_allocation_v2_invariant_failed` because of calculator bug #251 (`exactSourceConserved` sums 18-decimal truncated strings). The file records current behaviour faithfully, but those fixtures don't yet prove numeric parity.

---

#### Reflections

The synthetic sweep found a production bug on its first run: every existing calculator test used cohort sizes that divide evenly. Parity on error codes is still parity, but it isn't meaningful coverage.

---

#### Suggested Next Steps

- After #251 is fixed, regenerate `golden-v1.json` and confirm 50/50 successful outcomes.
- Copy the fixture module and expected-results file into `fundloop-allocator` and add the matching harness there (#216).

### session v2: Keep allocator work in fundloop-website; add signed request verifier (#217)

- **Timestamp:** 2026-09-18T11:30:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/209-standalone-allocator`
- **Head before commit:** `5dc130e`

---

#### Objective

Stop splitting #209 work across two repositories while the allocator is still changing, and land #217 here.

---

#### Decision

The user chose to pause the standalone repository and develop all allocator work in `fundloop-website` for now. Later, the allocator will be extracted again from this repo and will **completely replace** the current `FundLoop/fundloop-allocator` contents.

- `FundLoop/fundloop-allocator` (private) stays frozen at seed commit `3bfd8e1`. The unpushed local branch `feat/217-signing-security` (`a09a421`) there is superseded by this commit.
- Allocator-bound code should stay free of app-specific imports (Next.js, UI, Supabase clients) so the later extraction is a copy, not a refactor.

---

#### Actions Taken

- Added `lib/cubid/verify-signed-request.ts`, the reference verifier for requests signed by `PrivateCubidAllocatorClient`. It enforces required headers, contract version, client and environment binding, key windows (`notBeforeMs`/`notAfterMs`/`revoked`), ±5 minute skew, canonical body, the Ed25519 signature, and per-key nonce replay (claimed only after the signature verifies). Status mapping: 422 malformed, 403 caller or key not permitted, 401 authenticity or freshness failure.
- Added `tests/allocator-security-signing.test.ts` (25 tests): canonical JSON, the 10-line signing string, skew boundaries, replay, tampering, wrong and unknown keys, status mapping, minute-by-minute rotation with no downtime, and the client switching to the secondary key end to end.
- Updated the parity harness comments so they no longer claim a copy lives in the allocator repo.

---

#### Validation Notes

- `tsc --noEmit`, scoped ESLint: pass.
- Vitest: security suite 25/25, parity harness 3/3, existing client tests pass.
- `deno check lib/cubid/verify-signed-request.ts`: no errors in the new file. `Buffer` is imported from `node:buffer`; the existing client still has that pre-existing gap.

---

#### Reflections

`canonicalJsonStringify` sorts keys with `localeCompare`, which differs from code-point order (`a,B,_x,Z` sorts to `_x,a,B,Z` rather than `B,Z,_x,a`). This is harmless while every contract key is lowercase snake_case, but it is a cross-language interoperability risk for any other verifier. Decide the canonical ordering before Goal 3.

---

#### Suggested Next Steps

- Fix #251, then regenerate the parity file and finish #216.
- Pin canonical key ordering in the contract.
- When the allocator is ready to extract, re-seed `FundLoop/fundloop-allocator` from this repo and force-replace its history.
