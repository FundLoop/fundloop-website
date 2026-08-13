# Goal #158 delivery-integrity certification

Status: pre-publication evidence for Task #187, observed 2026-08-13. The adjacent
[machine-readable record](./goal-158-delivery-integrity-evidence.json) binds the exact
run, artifact, SHA, inventory, control, and authority values summarized here.

## Certified Dev baseline

The certified baseline is merge SHA
`ae8c5a38d6740646fa0e7d48f2e820e81a5e8726` on `dev`:

- Supabase Deploy run `31689293304`, attempt 2, passed; environment-manifest artifact
  `9177162146` verifies with manifest SHA-256
  `9631ac409cb77afde7a381825dc311e19fe63ef64d9f04429036b61bd75ad81c`.
- All 96 tracked migrations equal all 96 observed migrations. The immutable inventory
  digest is `92d51cb1c74e608f3d46e55f8b1b2c3eccfecddad1ae6da9e379d44977e42996`.
- PostgreSQL 17 normalized expected and observed public schemas both hash to
  `ed8a9289bac4364102fb212daad390ef47756b3128afc2c01486ecdef4762133`.
- All 62 expected Edge Functions are observed `ACTIVE`; all expected and observed
  source closures match. The inventory digest is
  `e91fcf6eb2e4720b4ceccb4f4c9ae6d494fdb659e923ec72b108630f908f4389`.
- Read-only drift run `31690575339`, artifact `9177325011`, independently retained
  that certification with no unexplained migration, schema, function, source, or
  value-flow drift.

Both downloaded manifests passed the repository verifier. A fresh safe hosted read
returned the public MCP health shape over the Dev Edge gateway with HTTP 200 using
the project-matched public anon credential; only its body digest is recorded. A
fresh unauthenticated POST to `epoch-allocation-close` returned HTTP 401. The
manifests read 14 value-flow control tables with zero enabled and the aggregate
Production value-flow enabled count remained zero.

## Promotion controls

Owner/admin REST read-back confirmed protected `dev` and `main` require PRs, current
branches, `CI / validate`, `CI / Supabase fresh-schema replay`, and `Supabase dry-run`.
Administrator enforcement, linear history, resolved conversations, and force-push
and deletion denial are active.

FundLoop currently has one eligible collaborator. The protected branches therefore
have an approval count of zero: enforcing a write-authorized approval would require
the sole author to review their own PR and deadlock delivery. Human review remains a
procedural Goal publication requirement. Add a second qualified collaborator before
raising this live count.

`Production` requires reviewer `KazanderDad` (`98373366`), permits only exact branch
`main`, and denies administrator bypass. Rehearsal run `31691571764` reached that
approval boundary with no step started, then correctly rejected its `dev` source
branch. Current `main` does not yet contain the dispatch trigger; repeating the exact
main-ref pause is deferred to the human release boundary after reviewed promotion.

## Publication and authority boundary

This record certifies the already-merged Dev baseline and the pre-publication Goal 1
branch. It does not certify the pending Task #162/#187 commit until the concluding PR
is merged and the merge SHA receives its own CI-owned Dev deployment and drift
manifest. Green pre-merge checks are not hosted proof.

No Production deployment is approved. Professional decisions, cutover, go-live,
payouts, and real value flow remain disabled and require their separately scoped
human authorities.

## Pre-publication validation

Node 22.23.2 focused deployment, workflow, manifest, source-readback, evidence-contract,
and Goal-certification suites passed 127/127. The task-owned replay ran with the exact
pinned Supabase CLI 2.113.0, applied 96/96 migrations, passed three representative SQL
suites, rejected the deliberate invalid migration with SQLSTATE `42P01`, retained the
valid history, and stopped its disposable stack. `CI=1 pnpm check` passed ESLint,
177 test files/915 tests, TypeScript, and the production build with 165 generated
pages.

An initial command found the machine-wide Supabase CLI at 2.101.0. That disposable
stack was stopped during database bootstrap before repository migrations, and the
complete replay was restarted through the pinned 2.113.0 package. An unauthenticated
MCP health probe was also denied at the Edge gateway; the intended safe health read
then passed with the project-matched public anon credential. These setup findings did
not weaken a gate or mutate a shared environment.
