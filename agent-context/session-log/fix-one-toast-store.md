# Session Log: fix/one-toast-store

### session v1: One toast store, and a renderer mounted for it

- **Timestamp:** 2026-10-10T22:52:29Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/one-toast-store`
- **Head before commit:** `72c5546`

---

#### Objective

Found while reviewing #281: no toast in this application has ever been shown. Split out of that PR
at HBIC's request, because turning 38 call sites visible is a user-visible change and belongs on its
own.

---

#### What was wrong

`components/ui/use-toast.ts` and `hooks/use-toast.ts` are **byte-identical** copies of the same
reducer, 194 lines each. Two copies of a module-level store are two stores: 27 components dispatch
into the first and 11 into the second, and they cannot see each other.

`components/ui/toaster.tsx` is the only renderer, it subscribes to the second, and it was mounted
nowhere. So every `toast(...)` call in the application — the auth modal's "OTP sent" and its
sign-in failures, save confirmations, onboarding progress — was pushed into an in-memory store that
nothing rendered.

---

#### Actions Taken

- `components/ui/use-toast.ts` is now a re-export of `hooks/use-toast`. Both import paths keep
  working, so no call site changed, and there is one store rather than two to keep in sync.
- `<Toaster />` is mounted once in the locale layout, inside the providers.

---

#### What this changes for a person

Messages the application has always intended to show will now appear. That is the point, and it is
also the risk: 38 call sites start rendering at once, and any of them that fires more often than its
author expected will be visible for the first time. Worth a look in preview rather than only in
tests.

---

#### Tests and Validation

- `tests/toast-store.test.ts`: one implementation rather than two, both import paths intact, the
  renderer subscribing to the store both paths now reach, and the renderer mounted inside the
  providers after `{children}`.
- 187 node files / 1414 tests and 35 dom / 101, all green; typecheck 0, lint 0.

---

#### Reflections

The duplication is what made this invisible: two files with identical contents look like a tidy
re-export until you notice each one declares its own `memoryState`. Byte-identical copies of
anything stateful are worth treating as a bug on sight.
