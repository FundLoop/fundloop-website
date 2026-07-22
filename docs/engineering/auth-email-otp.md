# Email OTP Authentication

FundLoop's public auth modal uses Supabase email OTP login:

- request: `supabase.auth.signInWithOtp({ email })`
- verify: `supabase.auth.verifyOtp({ email, token, type: "email" })`
- expected result: a browser Supabase session is created and the App Router shell can read it after `router.refresh()`

The email template or delivery service must send the numeric login OTP token for this flow. In Supabase templates, that means using `{{ .Token }}` for the sign-in OTP path. A recovery email is not interchangeable with this flow; recovery events require the recovery verification type and are not treated as normal login OTP evidence by FundLoop.

## Preview Failure Pattern

On 2026-07-22, the Preview URL `https://fundloop-website-h9rysotde-cubid-team.vercel.app/en` showed `verifyOtp: Started` and `verifyOtp: Finished` in the browser console, but the page remained unauthenticated.

The corresponding Supabase Auth audit entry around `2026-07-22 02:35:54 UTC` on the linked FundLoop Dev project recorded:

- action: `user_recovery_requested`
- error: none
- `auth.users.recovery_sent_at` updated at the same timestamp
- `auth.users.last_sign_in_at` did not update

That means Supabase generated or delivered a recovery flow at that timestamp, not a successful login OTP session.

## Handler Expectations

The auth modal must not treat a no-error OTP response as success unless a session exists. If `verifyOtp` returns no error but no `data.session`, FundLoop checks `auth.getSession()` once and then shows a destructive error instead of silently closing the modal.

When diagnosing future failures, check:

- Supabase Auth audit action near the email send timestamp
- `auth.users.recovery_sent_at`, `confirmation_sent_at`, and `last_sign_in_at`
- browser console for the safe `verifyOtp: No browser session created` warning
- whether the email template/delivery service is sending a login OTP token rather than a recovery token
