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
