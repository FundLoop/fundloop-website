# Session Log: feat/275-sign-in-with-cubid-ui

### session v1: The Sign in with Cubid UI, and a guard for SQL text assertions

- **Timestamp:** 2026-10-10T21:01:13Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/275-sign-in-with-cubid-ui`
- **Head before commit:** `72c5546`

---

#### Objective

The follow-up #280 deliberately left out: the sign-in action, connecting and disconnecting on the
account page, and somewhere for the callback's outcome to be read. Plus the shared test helper HBIC
asked for after two rounds of SQL assertions that turned out to be satisfiable by something other
than the SQL.

---

#### A finding that changes an acceptance criterion

The Wondr HBIC established that Cubid has no Google sign-in and no provider-hint parameter, which
settles #275 decision 4 — FundLoop sends no hint, which is what it already did. But the knock-on is
larger than the decision, and I checked Cubid's own specification rather than inferring from the
absence of Google:

> `passkey-first-auth-and-account-recovery-prd.md` §3.1 — "A new user may create a CUBID account
> using only a passkey. **No email, phone, or OAuth stamp is required before account creation.**"

And the prompt that would later collect one "must not interrupt SIWC relying-party redirects" —
which is exactly our redirect back.

The recorded default for a Cubid account with no email is to refuse, and the reasoning I wrote down
for it was "a Google-federated account always has one". There is no Google path, so that reasoning
is false and the no-email case is the **expected** path for a new Cubid user, not an edge. The
journey still completes — sign in by email, then connect Cubid in settings — but acceptance 1 as
reworded says "returns to FundLoop signed in", and that does not pass in one step.

Recorded on #275 with the two ways out: FundLoop collects and verifies an address itself after a
Cubid sign-in (one flow, reusing the existing OTP and `intent=link`), or the criterion is reworded
to the two-step journey. That is a product call, so I put it to Noak rather than taking it.

---

#### Actions Taken

- `tests/support/sql-text.ts`: `readMigration`, `statementsOnly`, `sqlSlice`, `sqlFunctionBody`
  and `expectSqlOrder`. It guards the three ways these assertions stop asserting: a comment
  satisfying a negative match, a stale anchor producing an empty slice, and `indexOf` returning -1
  so an ordering assertion passes when the thing being ordered is absent. Two of the three have
  already happened here, one PR apart; the third I found while adopting the helper.
- `tests/cubid-subject-link-migration.test.ts` adopted it and now contains no raw `indexOf`.
- `components/auth/cubid-outcome-notice.tsx`: turns `?cubid=<outcome>` into one message and strips
  the parameter. The vocabulary is closed and the copy lives in the component, so nothing an issuer
  or an attacker can influence reaches the screen; an unknown code falls back to a generic refusal.
- `components/account/cubid-sign-in-panel.tsx`: its own card, deliberately not part of the existing
  Cubid panel, which shows the Passport API integration. Connect sends the person through
  `intent=link`; disconnect asks first and says what it costs.
- `supabase/functions/cubid-identity-disconnect` with
  `lib/auth/cubid-identity-disconnect-command.ts` and `lib/edge-functions/cubid-identity-contract.ts`:
  a typed Edge Function command, because the recorded exception in the engineering doc covers the
  OIDC callback only and disconnecting has no cookie semantics. It takes no arguments, so one person
  can never disconnect another's.
- `lib/auth/cubid-link-status.ts`: whether a link exists and when, never the pairwise subject.
- The auth modal gains the action, behind a `cubidSignInAvailable` flag threaded through the
  navigation context, so an unconfigured deployment shows nothing rather than an action that fails.

---

#### Tests and Validation

- `tests/cubid-identity-disconnect-command.test.ts` (8): the happy path, nothing connected, the
  refusal to remove the only way in, an unreadable account, a database failure, an unrecognised
  outcome, and the contract refusing a payload that names a target or a response it cannot read.
- `tests/cubid-sign-in-panel.test.tsx` (7): hidden when unconfigured, the link round trip, the
  confirmation, backing out, the revoked count, and that a failed disconnect does not flip the card
  to "not connected".
- `tests/cubid-outcome-notice.test.tsx` (5): the message, the parameter being stripped, the rest of
  the query string surviving, the email-taken copy, and an unknown code not being echoed.
- Full node and dom suites green; typecheck and lint clean.

---

#### Suggested Next Steps

1. The repo-wide sweep of `tests/support/sql-text.ts`: 24 migration test files use negative matchers
   on raw SQL text and 10 slice it by index. Each needs a judgement about whether the comments
   matter, so it is a mechanical-but-not-blind PR of its own rather than something to bury here.
2. Acceptance 1's open half on #275, once Noak decides.
3. Terms acceptance at first sign-in, still a counsel question.

### session v2: Codex review on #281 — the flow had never been reachable

- **Timestamp:** 2026-10-10T22:43:28Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/275-sign-in-with-cubid-ui` (PR #281)
- **Head before commit:** `a1e8315`

---

#### A CI failure I missed before anything else

`validate` was red from the moment I opened #281. The two new `.tsx` tests used top-level
`await import(...)`, which vitest accepts and `tsc --noEmit` rejects. I ran lint and both test
projects after adding them and did not re-run typecheck, which is the one gate that catches it.

The obvious fix — a static import — broke the mocks, because `vi.mock` is hoisted above the imports
and my factories close over ordinary top-level `const`s that do not exist yet at that point. The
dynamic import had been hiding that. `vi.hoisted` is the construct for it, and both files use it
now.

---

#### The two P1s, which meant none of this worked

- **`/auth/cubid/*` was being locale-redirected away from its handlers.**
  `shouldSkipLocaleRouting` exempts `/api/`, `/oauth/` and `/.well-known/` — not `/auth/`. So
  `/auth/cubid/start` became `/<locale>/auth/cubid/start`, where no handler exists, and the
  callback URL registered at Cubid would have lost its authorization code the same way. Those
  routes shipped in #280 and have never been reachable. `/auth/` is exempt now, with the reasoning
  written where the other prefixes are explained, and `tests/proxy.test.ts` covers both paths plus
  the bare `/auth`, which keeps the ordinary handling.
- **Signed-out visitors were told Cubid sign-in was unavailable.** `emptyNavigationContext()`
  carried my hardcoded `false`, and that is the context every signed-out request gets — exactly the
  people the action exists for. It derives the flag now, and a test asserts the literal is gone and
  that both construction sites compute it.

Both were wiring, and neither showed in a test of the pieces. A test per unit and none of the path.

---

#### The five P2s

- **A malformed body ran the destructive unlink.** `parseJsonBody` failing became `{}`, which the
  no-argument validator accepts. The route parses the body itself now: empty is fine, unparseable is
  `invalid_payload`.
- **`unlink_cubid_subject` locked one subject and deleted them all.** The schema allows one mapping
  per `(issuer, user_id)`, so several issuers are representable, and a concurrent first redemption
  under an unlocked second mapping could issue a token after the disconnect deleted it. New
  migration `20261010070000`: every mapping is locked, in `(issuer, subject)` order so two calls
  cannot take them in opposite orders, and a mapping appearing after the read is a `conflict`
  rather than a silent delete.
- **The account page threw where no service-role key is set**, which local and preview deployments
  support by design. The status read short-circuits when Cubid is unavailable and catches the
  construction besides.
- **`expectSqlOrder` proved the wrong thing** for "the lock precedes every read": it searches for
  the second anchor after the first, so a read added *above* the lock would leave a read below it to
  satisfy the check. New `expectSqlBeforeEvery` compares against the first occurrence.
- **No toast renderer was mounted, and there were two stores.** See below.

---

#### One fix that went wider than this PR

`components/ui/use-toast.ts` and `hooks/use-toast.ts` were byte-identical copies of the same
reducer — two separate in-memory stores, 27 components dispatching into one and 11 into the other —
and `components/ui/toaster.tsx`, the only renderer, was mounted nowhere and subscribes to the
second. **Every toast in the application has been invisible**, not only mine.

I collapsed the duplicate into a re-export and mounted the renderer once. That is broader than this
PR's subject and I would normally leave it alone, but the alternative was shipping a notice that
says nothing while the auth modal's own toasts stay dead in the same dialog. Flagged for review
rather than slipped in.

---

#### Tests and Validation

- New: `tests/cubid-unlink-every-issuer-migration.test.ts` (9), `tests/cubid-sign-in-availability.test.ts`
  (5), the proxy exemptions, and the Edge Function's body handling asserted against its source the
  way this repository checks its other functions.
- 189 node files / 1431 tests and 37 dom / 113, all green. Typecheck 0, lint 0 — this time in that
  order.

---

#### Reflections

Two of the seven were wiring, and the reason I did not catch them is that I tested every piece and
never the path: the panel renders, the command works, the verifier verifies, and the URL the person
clicks was being redirected into a 404. The cheap check I skipped was asking "what does the browser
actually request, and who answers it".

### session v3: The toast fix split out, and a local notice instead

- **Timestamp:** 2026-10-10T22:50:23Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/275-sign-in-with-cubid-ui` (PR #281)
- **Head before commit:** `e61633c`

---

#### Objective

HBIC asked for the toast fix to be its own PR: collapsing the duplicate store and mounting the
renderer turns on 38 call sites that have never rendered, which is a user-visible change and not
what #281 is about. Mine to choose how #281 says anything in the meantime.

---

#### The choice

`CubidOutcomeNotice` renders its own banner rather than dispatching a toast. The alternative —
leave the toast dispatch and wait for the other PR — would have shipped a notice that silently does
nothing, which is the thing I objected to in the first place.

Keeping it as a banner afterwards is probably right regardless: a sign-in result is worth leaving on
screen until it is dismissed, which a toast is not. A failure renders as `role="alert"` and a
success as `role="status"`, so a screen reader announces the one that interrupts and not the one
that does not.

---

#### Two bugs found while writing it

- **A dismissed notice came back.** The first version wrote the outcome into state from the effect,
  whose dependencies include `useRouter()`'s return value — a fresh object every render — so any
  re-render re-raised a notice the person had just dismissed. The dismiss test caught it, which is
  the test earning its place.
- **Writing state from an effect is a lint error here**, and the rule is right. The outcome is now
  captured by `useState`'s initializer on the first render and the effect only cleans the URL. That
  assumes the component mounts with the parameter present, which the 303 from the callback
  guarantees; the comment says so, and says it is deliberately not built for the parameter
  appearing during a soft navigation, because nothing in this flow does that.

---

#### Also recorded

`docs/engineering/sign-in-with-cubid.md` now states that both `/auth/cubid/*` paths must be exempt
from locale routing, why, and that the routes shipped in #280 without the exemption and were
unreachable until #281 added it. That is the kind of thing a third route would get wrong the same
way.

---

#### Tests and Validation

- The notice's test is rewritten for the rendered form: nothing without an outcome, the message, the
  URL cleanup, the rest of the query string surviving, staying until dismissed, alert versus status,
  the email-taken copy, and an unknown code not being echoed.
- 189 node files / 1431 tests and the dom project green; typecheck 0, lint 0.
