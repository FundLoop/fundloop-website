# Session Log: chore/test-node-environment

### session v1: Split Vitest into node and dom projects

- **Timestamp:** 2026-10-09T18:35:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `chore/test-node-environment`
- **Head before commit:** `7473aa4`

---

#### Objective

The full local suite could not finish on this machine: 23 of 206 files failed to start a worker and
one page test timed out at 15s, which looked like memory exhaustion. The cause was narrower than
that. Every suite was paying for jsdom, including the 167 that never touch a DOM.

---

#### Actions Taken

- `vitest.config.ts` now defines two projects with `extends: true`, so each states only its
  difference: `node` for `tests/**/*.test.ts` with no environment and no setup file, `dom` for
  `tests/**/*.test.tsx` in jsdom with `tests/setup.ts`. `pnpm test` runs both; `--project node`
  runs the fast half.
- `tests/vitest-projects.test.ts` keeps the split honest: it fails if a `.test.ts` file references
  `document`, `window`, `localStorage`, `sessionStorage`, `matchMedia`, `navigator`,
  testing-library or jsdom, so adding a DOM dependency to the node project names its own cause
  rather than surfacing as a `ReferenceError`.
- `docs/engineering/env-and-testing.md` documents the split and what to do when a `.test.ts` file
  genuinely needs a DOM.

---

#### Validation Notes

- Verified first that no `.test.ts` file uses a browser API, so the split changes no suite's
  meaning: all 203 non-e2e suites are accounted for, 168 in node and 35 in dom.
- `node` project: 168 files, 1069 tests, 35.6s. `dom` project: 35 files, 101 tests, 96.9s.
  **Both together: 203 files, 1170 tests, 137s, all passing** — the first complete local suite run
  of this session. Typecheck and lint clean.

---

#### Reflections

I spent a long time treating this as a memory problem, killing runs and capping workers, when the
cheap diagnostic was to ask what the slow part actually was: `environment: 4410s` in the run summary
against `tests: 96s`. The environment was the whole cost, and it was being paid 206 times for 35
suites' benefit.

---

#### Suggested Next Steps

- None. This stands alone and does not change any suite's behaviour.
