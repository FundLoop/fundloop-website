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
