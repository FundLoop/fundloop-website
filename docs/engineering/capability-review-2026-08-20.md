# FundLoop Dev capability review — 2026-08-20

Assessment timestamp: 2026-08-20, America/Toronto

## Scope and evidence labels

This review describes the last fully promoted `dev` baseline before PR #234:
`9f821d8410a18b863249fd5353a98a584728fe91`. PR #234 is a documentation and
candidate-boundary change; its eventual merge SHA must be verified separately
before it can replace this baseline.

Evidence labels are deliberately narrow:

- **in code**: a typed implementation and repository tests exist;
- **local-real**: the behavior ran locally against controlled fixtures;
- **sandbox-real**: a named provider sandbox path ran;
- **deployed on Supabase Dev**: exact-SHA deployment and parity certification passed;
- **hosted-public**: an unauthenticated route returned expected public output on Vercel;
- **hosted-authenticated**: a role-specific flow ran against one Vercel/Supabase Dev pair;
- **production-enabled**: the production control is explicitly enabled and authorized.

Passing CI, deploying a function, or receiving HTTP 200 is not broader workflow,
provider, professional, financial, or production proof.

## Immutable promoted baseline

| Evidence | Exact result |
| --- | --- |
| Git | `dev` SHA `9f821d8410a18b863249fd5353a98a584728fe91` (PR #233 merge) |
| Application CI | GitHub Actions run `32350265094`, passed |
| Supabase drift | GitHub Actions run `32350265092`, passed |
| Supabase deployment | GitHub Actions run `32350265099`, passed on exact-SHA rerun after one transient post-deploy HTTP 500; database deployment, all 64 Edge Functions, source parity, safe hosted denial, and immutable environment-manifest certification passed |
| Vercel Dev | deployment `6CymEiKDJjxy7kgq9h6vHcX2Axo3`, Git status success |
| Vercel Main project | deployment `Ea1EbJZ5VoQ9QJ7TYYYm1BxNvT5y`, Git status success; this is a deployment target status, not a `main` branch promotion claim |
| Hosted public smoke | `https://fundloop-website.vercel.app/en`, `/es`, `/fr`, and `/api/internal/health` returned HTTP 200 after the exact-SHA deployments |
| Local app gates | Node 22 Vitest: 195 files and 1,132 tests; lint, typecheck, and production build passed during PR #233 repair |
| Local database gates | Canonical reset and `pnpm test:db`: 22/22 passed during PR #232 repair, including the four-epoch race/lifecycle, Stripe intake, and exactly-three-month boundary |

The first Supabase deployment attempt successfully deployed all functions but its
post-deploy source download received HTTP 500. The exact same SHA was rerun and
completed source parity and certification. This is recorded as a transient
provider read failure, not hidden as an initial clean run.

## Capability assessment

| Capability | Strongest current evidence | Honest boundary |
| --- | --- | --- |
| Multilingual public product story | in code; hosted-public for English, Spanish, and French | Public rendering works. This does not prove authenticated workflows. |
| Founder, user, and operator application shells | in code; local component/contract coverage | Hosted role-specific acceptance was not rerun because the required shared credentials and protection-bypass environment were unavailable. |
| Supabase schema and Edge command inventory | deployed on Supabase Dev at the promoted baseline | Deployment and source parity are current. They do not prove every command with a real provider/account fixture. |
| Four-epoch funded allocation | local-real; database race, calculation, close, report, and conservation coverage | No claim of a hosted multi-persona economic cycle. |
| Exactly-three-month claims | local-real; database boundary and lifecycle coverage | #182 is on `dev`; authenticated hosted acceptance remains unproved. |
| Stripe Pay by Bank intake | local-real database coverage | No current hosted provider-account acceptance claim. |
| Base and Stripe payout control planes | in code; bounded local/sandbox evidence from Feature #118 | No real payout or production value flow was run. |
| Public reporting routes | in code; hosted-public route smoke from PR #232 | Public route availability is not proof of authenticated founder/user/operator report generation or complete report contents. |
| MCP surfaces | in code; repository tests; deployed functions included in parity inventory | No claim that the whole monthly economy is safely agent-operable against hosted provider state. |
| Legal/accounting review packets | exact-hash draft packets and strict local verifiers on `dev` | Every packet remains `DRAFT - NOT APPROVED - NOT EFFECTIVE`; no qualified conclusion is claimed. |
| Governance-bound cutover | production activation contract requires 15 exact, current, resolved gate records; deployed on Supabase Dev | #184 remains blocked on real qualified conclusions. Deployment cannot supply professional authority. |
| Financial cutover and opening balances | fail-closed control plane, local tests, production hard-disable | #170 remains incomplete: no authorized production preflight, opening posting, cutover, or rollback/forward-fix execution was performed. |
| Production value flow | safe hosted denial certified by Supabase deployment | **Not production-enabled.** No deployment, merge, or test authorizes it. |

## Hosted acceptance boundary

Authenticated hosted acceptance is **unavailable**, not passed. The environment
did not provide the remote base/Supabase pairing, persona/operator credentials,
E2E secret, service-role credential, or Vercel protection-bypass cookie required
to run the repo-owned persona harness safely. No local fixture, component test,
preview deployment, or public route smoke is relabelled as hosted acceptance.

Consequences:

- #183 remains open and `In Review`;
- the founder-to-operator-to-user hosted smoke required by #172 is not satisfied;
- privacy-negative and authenticated report checks are not claimed;
- #172 cannot be certified complete from this PR alone.

## Governance and cutover boundary

PR #233 made the governance evaluator production code and bound it to the real
Edge activation contract. It rejects missing domains, duplicates, malformed or
future approval timestamps, expired review dates, and unresolved conditional
conclusions. That is repository-owned denial evidence only.

Real qualified Canadian legal, accounting/tax, privacy/retention,
sanctions/KYC/KYB, custody, and unclaimed-property conclusions are still absent.
Therefore #184, dependent #170, Goal 3 publication #189, and final candidate
certification #172 remain incomplete. No draft packet is effective.

## Candidate decision

The promoted Dev baseline is technically coherent enough to continue controlled
Dev testing: app CI, database regression coverage, Supabase parity/deployment,
Vercel deployment, and public smoke are green. It is **not a certified Feature
#118 release candidate** under #172 because mandatory authenticated hosted and
qualified-professional evidence is missing.

PR #234 may merge this corrected evidence snapshot to `dev`. After merge, bind
the resulting SHA to new CI, Supabase classification/deployment behavior, Vercel
deployment IDs, and public smoke. Keep #172 open until the missing hosted and
professional gates are independently satisfied; do not promote to `main` or
enable value flow on the strength of this document.

## Highest-priority next evidence

1. Provide the approved hosted Vercel/Supabase Dev credential set and run the
   founder, verified-user, and operator harness with privacy-negative checks.
2. Obtain qualified conclusions against the immutable legal/accounting packet
   hashes and record every condition and engineering disposition.
3. Run the authorized read-only production preflight and non-production
   prepare/rollback tabletop required by #170 without posting value.
4. Regenerate the production-readiness manifest against the final merged SHA;
   require every prerequisite gate to pass rather than editing blockers away.
