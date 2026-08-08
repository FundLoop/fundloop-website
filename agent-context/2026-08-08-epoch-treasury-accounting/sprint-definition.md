# Feature definition: settlement-backed epoch treasury and auditable payouts

Status: brainstorm complete; published and vetted for implementation
Last updated: 2026-08-08
Issue kind: Feature
Repository: `FundLoop/fundloop-website`
Project: `FundLoop Project`
GitHub Feature: [#118](https://github.com/FundLoop/fundloop-website/issues/118)

## Working objective

Replace promise-based monthly contribution accounting with a settlement-backed,
multi-currency cash-flow and double-entry accounting system that:

- runs monthly FundLoop epochs using Pacific calendar-month cutoffs;
- allocates only funds that have settled into FundLoop-controlled custody;
- separates epoch assets from earned platform assets;
- accepts initial fiat funding through Stripe and initial crypto funding on Base;
- assesses project, base-platform, and user-selected fees at distinct stages;
- supports inventory- and provenance-constrained user payouts;
- rolls expired, unrequested balances into a later epoch after a three-month claim window;
- records native quantities and canonical USD equivalents in an auditable ledger; and
- extends the existing local-first persona harness as capabilities become executable.

This is a living definition. Confirmed decisions are authoritative for later design
and issue scoping. Items under Open decisions remain unresolved and must not be
treated as approved implementation requirements.

## Terminology

- **Collection epoch:** the Pacific calendar month to which a settled receipt is
  canonically attributed.
- **Allocation overlap:** the first hours or days of the following month during
  which the closed collection epoch is reconciled, fee-processed, valued, and
  allocated.
- **Epoch treasury:** FundLoop-owned assets operationally segregated for epoch
  allocation and best-effort payout; not escrow or user-owned funds.
- **Platform treasury:** assets earned by FundLoop through project, base-platform,
  and user-selected fees.
- **Rail:** an intake or payout system, initially Stripe fiat or Base crypto.
- **Asset:** fiat identified by ISO currency code, a token identified by chain ID
  and contract address, or a native chain asset identified by chain ID and a
  native-asset marker.

## Confirmed product and cash-flow decisions

### 1. Epoch calendar and settlement attribution

1. The canonical cutoff is midnight in `America/Los_Angeles` at the end of each
   calendar month. The IANA timezone applies daylight-saving changes automatically.
2. A contribution counts only once it is irrevocably settled or available:
   - Stripe funds must be available for payout from the relevant Stripe balance.
   - Base transfers must meet the configured finality threshold.
3. The settlement timestamp, not the founder's declared month, determines the
   canonical collection epoch.
4. The submitted or intended month is retained as audit metadata.
5. A receipt that settles after cutoff is assigned to the collection epoch open
   when it settles.
6. A receipt incorrectly attributed to a past month is forwarded to the current
   open collection epoch rather than back-posted into the closed month.
7. There is no fixed allocation completion time. Processing advances through
   controls and gates and completes when all gates are clear, typically four to
   five business days into the month.
8. The manual payout window opens only after all required allocation gates clear.
   Opening the window triggers an email notification to all eligible users.
9. If processing is incomplete, users may view the payout surface but cannot
   submit a payout request until credits exist and the window is open.
10. Each participating project must have both a valid active-user list and its
    accompanying settled payment in place before month end. If either is missing,
    both inputs move together to the next collection epoch.
11. Projects receive a validation tool that can be run and rerun before month end
    to inspect the exact payment, user-list, and derived numbers FundLoop currently
    holds for them.
12. During the external review period, ending no later than one business day after
    month end and before locking, a project may only approve its frozen inputs or
    opt out of the current epoch. Opting out rolls both its list and settled funds
    to the next epoch.
13. No project may add, replace, correct, or backdate inputs after month end.

### 2. Treasury separation and custody

1. Platform and epoch assets are physically and logically separated for every
   supported rail.
2. Epoch funds may share one safeguarded custody account per rail and asset;
   project and epoch ownership are separated by immutable ledger dimensions rather
   than by creating a wallet or bank account for every project or month.
3. A designated rail clearing account may temporarily hold gross settled funds.
   It must sweep the earned project fee to the platform treasury and the net
   contribution to the epoch treasury within a defined service window.
4. Base uses separate Safe multisig wallets for platform and epoch treasuries.
5. Safe master keys are not stored in Supabase, Vercel, or application code.
6. A limited private signer may be stored as a Vercel secret for user payouts below
   an approved threshold. Its Safe role, spending allowance, threshold, rotation,
   revocation, and incident controls remain to be designed.
7. A single authorized admin may perform financial control actions. The system
   relies on complete immutable audit evidence rather than a mandatory maker-checker
   workflow. Safe threshold approval still applies where configured at the wallet.

### 3. Initial rails and assets

1. Initial Stripe fiat currencies are USD and CAD.
2. Initial Stripe intake is limited to bank-transfer-style funding for clear
   receipt and settlement reconciliation. Cards and pull-based bank debits are
   deferred until reserve and dispute policies exist.
3. Stripe fiat payout uses Stripe Connect onboarding and an eligible connected
   bank destination. FundLoop stores provider identifiers and readiness state, not
   raw bank credentials.
4. Initial Base assets are allowlisted contract deployments of:
   - USDC;
   - USDT; and
   - PYUSD.
5. Token symbols are display metadata and are never sufficient identifiers.
6. Fiat is identified by ISO currency code. Tokens are identified by chain ID and
   contract address. Versioned metadata includes symbol, decimals, issuer, and
   pegged fiat.
7. A stablecoin is paused for new intake and allocation when observable market
   value moves outside plus or minus 0.3% of its declared fiat peg.

### 4. Fee model

All fee policies are versioned and snapshotted when the relevant economic event
occurs. Later policy edits never rewrite prior events.

#### Project fee

1. Each `project x rail` combination has an approved percentage.
2. The initial default is 1%.
3. An authorized operator may assign a negotiated, versioned project-specific
   percentage within platform policy bounds and with an effective date.
4. For each `project x rail x epoch`, settled contributions are aggregated, the
   percentage is calculated once, and the fee is clamped once:
   - Stripe fiat: USD-equivalent minimum $10 and maximum $100.
   - Base crypto: USD-equivalent minimum $5 and maximum $50.
5. The contributing payment must cover the minimum fee and leave a positive net
   amount for the epoch treasury.
6. The project fee is earned before or while net funds move to the epoch treasury.
7. If a project opts out during reconciliation, the already-earned project fee is
   not reversed. The net settled contribution rolls to the next epoch without a
   second project fee on the same payment. The base fee applies only when the
   contribution enters allocation.

#### Base platform fee

1. After cutoff and project-fee sweeps, all settled epoch assets are aggregated by
   rail across all projects.
2. A versioned 2.5% base platform fee is assessed separately on each rail's net
   epoch balance.
3. The base fee has no additional minimum or maximum at launch.
4. Base fees are moved to the matching platform treasury before allocation.

#### User-selected fee

1. Policy minimum: 0%.
2. Suggested default: 5%.
3. Maximum: 100%.
4. A user may change the percentage within those bounds.
5. The selected rate is snapshotted when the reserving payout request is created.
6. The fee is deducted in the same rail and asset as the payout and transferred to
   the matching platform treasury.
7. At 100%, the claim is settled entirely as a platform contribution and no
   recipient transfer is required.
8. FundLoop pays provider, Stripe, network, and execution costs from platform funds
   and records them as rail expenses against fee revenue. Those costs do not
   silently reduce the user's payout beyond the selected fee.

### 5. Monthly FX and valuation

1. Project central accounting and allocation are denominated in functional USD.
2. Every financial posting preserves both:
   - exact native quantity and exact asset identity; and
   - functional USD value and the valuation snapshot used.
3. Receipts are initially recorded using settlement-time spot value.
4. Exchange rates are fixed for each monthly epoch.
5. On the first day of the following month, immediately before allocation
   calculations, the system takes the immutable monthly FX snapshot and performs
   the only scheduled rebalancing/revaluation for that epoch.
6. No daily or continuous unrealized FX revaluation is performed.
7. Allocation uses the fixed monthly epoch rates.
8. Native payout quantity uses the originating epoch's locked rate, not a new
   request-time quote.
9. The difference between locked USD value and market value when assets move is
   recognized as a realized treasury gain or loss; it does not alter the user's
   locked claim.
10. Open monetary balances are next revalued during the following first-of-month
    process, unless an explicit exceptional accounting event requires a linked
    journal entry.
11. Price sources use a documented fallback chain. Every snapshot records source,
    observation time, raw value, and evidence hash.
12. If every configured source is exhausted, one authorized admin may enter a
    reasonable manual rate and continue. The exhaustion evidence, entered rate,
    rationale, actor, and timestamp are immutable audit data.

### 6. Allocation and payout entitlements

1. Allocation is canonically based on settled, applied epoch treasury assets, not
   contribution promises or founder-entered USD equivalents.
2. A user's eligible payout shortlist for an epoch is the union of exact
   `rail x asset` combinations with settled contributions from projects whose
   submitted active-user lists included that user.
3. Inventory is pooled by `epoch x rail x asset` across projects. Project
   participation establishes asset eligibility; individual project balances are
   not reserved for particular users.
4. Every withdrawal preserves proportional project-source attribution.
5. Availability shown in the UI is informational. Inventory is atomically reserved
   only when a valid payout request commits.
6. Simultaneous requests are ordered by database commit order with a durable,
   deterministic sequence number.
7. Users may request a partial USD amount up to their available balance.
8. Credits are consumed oldest-first.
9. Each payout request uses one exact `rail x asset x destination`. A user may
   submit multiple requests to split a balance.
10. The native amount is calculated using each originating epoch's locked FX rate.
11. If no eligible rail retains enough available inventory, the user may create a
    queued request for fulfillment during the next epoch.
12. The next epoch fulfills queued requests through an inventory exchange rather
    than consuming unbacked new distributable value: matching new-epoch assets are
    exchanged for equal locked-USD backing assets from the older epoch.
13. The privileged carryover batch runs after the new epoch is funded,
    fee-processed, allocated, and reconciled, but before its manual payout window
    opens. Queued requests are processed oldest-first.
14. A valid request made before expiry reserves the conditional award balance until
    it is paid, rejected, or cancelled. Requested balances do not expire merely because the
    original epoch reaches its lifespan limit.
15. Initial minimum payout amounts are USD-equivalent $10 for Stripe fiat and $5
    for Base stablecoins, evaluated using the originating epoch's fixed FX rate.

### 7. Three-month epoch-treasury lifespan

1. An epoch's allocation becomes claimable after allocation is published in the
   following month.
2. Users have the following three complete payout months to request their claim.
3. Example: January earnings become claimable in February and remain requestable
   through April 30 Pacific time.
4. On May 1, January balances that were never requested are removed from old user
   payables and rolled into the April epoch before April allocation.
5. The receiving epoch values rolled native assets using its newly locked monthly
   rate.
6. Rollover preserves the complete original epoch, project, asset, and journal
   provenance.
7. Resulting valuation differences are recognized separately as FX gains or losses.

### 8. Reversals, disputes, and losses

1. A reversal, chargeback, or reorganization discovered before allocation removes
   the receipt from the distributable pool.
2. A loss discovered after allocation is absorbed initially by the platform risk
   reserve.
3. The system creates a project receivable and recovers the loss from later project
   contributions.
4. Completed user payouts are not clawed back.

### 9. Project validation and cohort privacy

1. Project-facing validation may run repeatedly before cutoff and during the
   one-business-day external review period, but post-cutoff inputs remain frozen.
2. Project admins receive tentative project-input analytics and estimated
   allocation effects before the opt-out deadline.
3. Post-cutoff project actions are limited to approval or withdrawal from the
   current epoch.
4. A user enters allocation only with a valid and whitelisted Cubid ID.
5. A valid, whitelisted user receives an allocation proportional to the user's
   Cubid uniqueness score under the versioned allocation algorithm.
6. Invalid Cubid IDs and whitelisting failures are excluded. Project admins see
   the affected project's validation and whitelisting failures without gaining
   cross-project identity visibility.
7. A user with a whitelisting failure can see that status and remedy it through the
   user workflow at any time. Remediation after cutoff affects only an epoch whose
   inputs have not yet locked or a later epoch, according to the final gate design.
8. A user who self-identifies as, or becomes, greylisted or blacklisted because of
   a project upload is notified by email.
9. Users are pseudonymous in project and public review material, with no
   cross-project traceability.
10. Project eligibility requires valid KYB and responsible-staff KYC before
    participation. Sanctions and jurisdiction are rechecked every epoch before
    locking, and a material status change blocks participation immediately.
11. A project with funds but no valid user list rolls both the funds and project
   participation forward to the next epoch; it does not enter the current communal
   pool.
12. A withdrawn project's net funds and user list enter the next epoch as a linked
    draft. The project may amend the list before the next cutoff and must validate
    and approve the package again.
13. Preliminary public trends may publish exact project totals and user counts but
    never user identifiers. The detailed design must still assess whether exact
    small-cohort numbers create prohibited cross-project inference.
14. Public users see aggregate outcomes; projects see their own detailed
    contribution and pseudonymous cohort results; users see their own project-source
    breakdown; authorized operators see the complete audit dataset.
15. The project opt-out clock starts only when the email provider first accepts the
    reconciliation email for delivery. Merely queuing an email does not start the
    clock.
16. Failed reconciliation email delivery retries through the next FundLoop business
    day and alerts operators. If no delivery is accepted, the project package rolls
    forward and cannot lock into the current epoch.
17. A FundLoop business day is Monday through Friday excluding holidays in a
    versioned FundLoop calendar, evaluated in `America/Los_Angeles`.
18. Project silence after accepted delivery and the opt-out deadline is treated as
    approval because the package was already validated before cutoff. Delivery and
    non-response evidence are immutable.
19. Cubid status is rechecked during reconciliation and snapshotted again at
    `locking`. A whitelisting remedy completed before lock includes the user in the
    current epoch; a remedy after lock applies to the next eligible epoch.
20. Before lock, a greylisted user is excluded until remedied. After lock, the
    user's unpaid conditional award enters review hold without reallocation or expiry, and the
    user and operator are notified.
21. Before lock, a blacklisted user is excluded. After lock, unpaid execution stops
    and the conditional award enters compliance hold pending an authorized resolution. It
    is not silently redistributed and completed payouts are not clawed back.
22. Within the applicable allocation cohort, the locked Cubid uniqueness score is
    used directly as a proportional weight: user score divided by the sum of
    eligible scores, subject to the versioned project/source allocation rules.
23. Cubid is queried during reconciliation and again at lock. A prior validated
    snapshot may be used during an outage only within a configured short TTL;
    otherwise the user remains unresolved and cannot lock.
24. Projects see only a project-scoped pseudonymous identifier, failure category,
    remediation state, and inclusion outcome for failed users. Raw Cubid evidence,
    another project's identifier, and cross-project membership remain private.

### 10. Legal ownership, payout, privacy, and consent intent

The following is confirmed product intent but must be converted into truthful,
enforceable language by qualified counsel for every jurisdiction in which FundLoop
operates.

1. FundLoop takes legal ownership of funds submitted by projects.
2. Project submissions are non-refundable as of right. FundLoop may attempt a
   refund in its discretion and on a best-effort basis, without guaranteeing one.
3. FundLoop is not an escrow provider. The epoch treasury is an internal
   operational segregation and never represents user escrow.
4. Allocations, credits, payout availability, and payout requests do not transfer
   ownership of funds to a user. Ownership transfers only when a payout is actually
   processed under the legally approved definition of processing.
5. Payouts are made on a best-effort basis. FundLoop does not guarantee that a user
   will receive a payout or the user's preferred currency, token, or rail.
6. The Terms must disclose the project fee, base fee, user-selected fee, expiry,
   rollover, holds, currency availability, and provider/chain risks clearly at the
   relevant project and user actions.
7. FundLoop does not sell, rent, or voluntarily disclose user personal data to
   unrelated third parties. The Privacy Notice must truthfully disclose necessary
   processors, legally compelled disclosures, Cubid/Stripe processing, email and
   hosting providers, and public-chain transaction exposure rather than make an
   impossible absolute no-sharing claim.
8. Personal profiles are private by default. Public profile publication requires a
   separate affirmative opt-in and must be reversible prospectively.
9. Inviting a person to a project does not add them to the project. Membership and
   project-member profile sharing begin only after that person affirmatively accepts
   the invitation.
10. After acceptance, the member's approved personal-profile fields are shared with
    other authorized members of that project, not with unrelated projects.
11. Terms, Privacy Notice, public-profile consent, invitation acceptance, and
    material policy changes are versioned and recorded with actor, version,
    timestamp, locale, and source surface.
12. The policy implementation must be derived from an actual data-flow inventory.
    A published privacy promise is not allowed to contradict runtime provider or
    application behavior.

## Confirmed accounting architecture

### Canonical ledger

1. The financial source of truth is an immutable double-entry journal.
2. Operational payment, credit, withdrawal, intent, batch, and reconciliation
   tables are workflow projections and control surfaces, not competing ledgers.
3. Posted journal entries are never edited or deleted.
4. Corrections use linked reversal and replacement entries in the current open
   period.
5. Reopening a closed accounting period requires explicit approval and produces a
   replacement close artifact.

### Hybrid chart-of-accounts granularity

Cash and treasury accounts are fine-grained only at independently reconcilable
boundaries:

```text
legal owner
  x treasury purpose
  x external custody account
  x rail or network
  x fiat currency or exact token
```

Illustrative asset accounts:

```text
Epoch Treasury - Stripe - USD
Epoch Treasury - Stripe - CAD
Epoch Treasury - Base Safe - USDC - <contract>
Epoch Treasury - Base Safe - USDT - <contract>
Epoch Treasury - Base Safe - PYUSD - <contract>

Platform Treasury - Stripe - USD
Platform Treasury - Stripe - CAD
Platform Treasury - Base Safe - USDC - <contract>
Platform Treasury - Base Safe - USDT - <contract>
Platform Treasury - Base Safe - PYUSD - <contract>
```

Project, user, and epoch do not create new cash accounts. They are mandatory
posting dimensions alongside payment, payout, fee policy, source event, custody
account, rail, and asset identifiers.

### Allocation artifacts

1. Allocation calculations are immutable, versioned artifacts linked to the
   balanced journals that transfer value from epoch-held liabilities to user
   payables.
2. Calculation artifacts explain and reproduce postings but are not a second
   financial ledger.
3. USD summary reports are derived from canonical journal lines that also preserve
   native quantities.

### FX accounts

1. Realized and unrealized FX are separate accounts.
2. FX postings retain asset, rail, epoch, and cause dimensions.
3. Causes include monthly revaluation, payout, conversion, rollover, and treasury
   transfer.

### Accounting classification requiring revision

1. The earlier proposal treated epoch assets as restricted assets matched by user
   liabilities. The later confirmed legal intent says FundLoop owns submitted funds
   and users acquire no ownership merely through allocation or request. These
   positions cannot be treated as simultaneously resolved.
2. The architecture Task must obtain accountant and counsel approval for whether
   project receipts are revenue, deferred revenue, designated funds, conditional
   award commitments, or another classification, and when any payout expense or
   payable is recognized.
3. Until that decision, `user earnings payable` and similar account names in the
   draft design are illustrative only. Implementation must not create a legal or
   accounting promise that contradicts the approved Terms.
4. Physical platform/epoch treasury separation remains a confirmed operational
   control even if FundLoop legally owns both balances.
5. Project, base-platform, and user-selected fee presentation and recognition must
   be reconciled with the final gross-funds ownership model.

## Confirmed epoch state machine

```text
collecting
  -> reconciling
  -> valuing
  -> fee_processing
  -> carryover_payouts
  -> locking
  -> allocating
  -> reviewing
  -> payout_readying
  -> payout_open
  -> expired
  -> closed
```

State triggers and controls:

1. The Pacific month-end cutoff cron moves the epoch from `collecting` to
   `reconciling` and freezes project inputs.
2. FundLoop sends each project its reconciliation email after producing the frozen
   preliminary package. The approval/opt-out deadline is midnight Pacific at the
   end of the next FundLoop business day after that email is sent and must complete
   before `locking`.
3. The expiry cron runs at `month_end_cutoff + lifespan_months`, initially three
   months, and moves the epoch to `expired`.
4. When a current epoch's `carryover_payouts` stage successfully harvests and
   exchanges the eligible residue of prior expired epochs, those prior epochs move
   to `closed`.
5. Every stage is idempotent and keyed by epoch, stage, input-manifest hash, and
   attempt. Identical inputs reuse completed results; changed inputs create a new
   linked attempt without deleting history.
6. Gates are classified as hard or soft. Hard financial-integrity gates cannot be
   overridden. One admin may acknowledge and override soft warnings with an
   immutable reason and audit event.
7. Custody reconciliation applies an explained review tolerance separately to each
   `custody account x asset` balance. The tolerance is the larger of USD $1 or 0.1%
   of that balance. Native discrepancies still require evidence; the tolerance
   determines warning versus hard blocker, not whether a discrepancy is recorded.
8. The orchestrator opens the payout window automatically after every hard gate
   passes and all soft warnings are cleared or acknowledged. An admin may pause
   automatic opening before the final gate.
9. New manual payout requests pause at cutoff while previously reserved payouts
   continue. Requests reopen after `payout_readying` completes.
10. Email delivery is asynchronous and retryable. Delivery failures are visible
    operational exceptions but do not reverse an opened payout window.
11. Each ready epoch produces an immutable, hash-linked close package containing
    custody reconciliation, applied receipts, fee journals, FX snapshot, allocation
    inputs/results, approved user award records, rollover activity, queued-payout results,
    exceptions, and final gate decisions.

## Post-month-end operating outline

### Stage 1: `collecting`

Purpose: build a complete, project-verifiable monthly input package before cutoff.

Process:

1. Accept Stripe and Base payment instructions, independently observe settlement
   or finality, and attribute each receipt by canonical settlement timestamp.
2. Accept and validate the project's active-user list.
3. Pair the list and accompanying payment as one epoch-participation package.
4. Continuously expose project-input analytics through a project validation tool:
   - submitted versus accepted payment amounts;
   - settlement/finality state;
   - canonical epoch assignment;
   - active-user record counts and validation failures;
   - current fee policy and tentative fee amounts;
   - latest indicative FX and tentative USD equivalents; and
   - readiness warnings that would cause rollover.
5. Permit projects to correct inputs before cutoff.
6. At Pacific month end, freeze inputs and start `reconciling` by cron.
7. Forward every payment settling after cutoff to the newly open collection epoch.

Exit gate:

- Month-end cutoff artifact exists and every project package is frozen with a
  deterministic input-manifest hash.

### Stage 2: `reconciling`

Purpose: prove that every candidate project package is complete, externally backed,
eligible, and ready for final valuation.

Process:

1. Reconcile Stripe receipts to available Stripe balances and provider events.
2. Reconcile Base receipts to finalized onchain events and epoch treasury balances.
3. Pair each valid active-user list with its settled payment. If either is missing
   or invalid, roll the entire project package to the next epoch.
4. Forward late, past-attributed, duplicate, reversed, or unmatched receipts to the
   correct open epoch or suspense workflow without mutating closed-period truth.
5. Produce project-input analytics and a tentative allocation pre-calculation using
   indicative rates solely for review; it is not a financial posting or final
   allocation.
6. Let project admins rerun their frozen validation package and then choose only:
   - approve the current epoch package; or
   - withdraw and roll the package to the next epoch.
7. Send the project reconciliation email after its frozen preliminary package is
   available. Start the deadline only when the provider accepts delivery, then
   close approval/opt-out at midnight Pacific at the end of the next FundLoop
   business day and before `locking`. Retry failures through the next business day;
   if delivery is never accepted, roll the package forward.
8. Publish rough, explicitly preliminary trend estimates:
   - participating project names;
   - total tentative USD-equivalent amount;
   - total tentative user count;
   - expected average payout range; and
   - prominent preliminary/changeable labeling.
9. Public trends may use exact project totals and exact user counts, but must never
   include user identifiers or a cross-project identity key.
10. Vet candidate users for valid, whitelisted Cubid IDs. Exclude invalid IDs and
    whitelisting failures, expose the relevant failure state to the submitting
    project and affected user, notify users who identify as or become greylisted or
    blacklisted, and retain uniqueness scores for proportional allocation.
    Recheck during reconciliation and at lock; use cached passing evidence only
    within the configured short outage TTL.
11. Vet candidate amounts for clean provenance, final settlement, and preliminary
    FX reasonability. Final rate approval occurs in `valuing`.
12. Vet projects for allowed jurisdiction, sanctions status, KYB, and responsible
    staff KYC/clearance.
13. Email each project its preliminary reconciliation status and the exact
    approve-or-opt-out deadline.
14. Record every discrepancy. A discrepancy inside the larger-of-$1-or-0.1%
    tolerance may proceed only through the defined warning/acknowledgement path;
    unexplained hard failures block the project or epoch.
15. Treat no response after accepted delivery and deadline as approval, preserving
    immutable evidence of delivery and non-response.

Exit gates:

- Every included receipt is externally reconciled and final.
- Every included project has an approved frozen list/payment pair.
- Every included user has a valid, whitelisted Cubid ID and a captured uniqueness
  score; excluded users have an explicit failure state.
- Required sanctions, KYB, and KYC checks are current and passing.
- Rolled or withdrawn projects are excluded deterministically.
- The external review/opt-out period has ended.

### Stage 3: `valuing`

Purpose: establish the one immutable monthly FX snapshot used by fees, allocation,
rollover, and payouts originating from the epoch.

Process for every required currency and token:

1. **Get primary:** request the configured primary rate and capture raw evidence.
2. **Get fallback:** when unavailable or invalid, walk the approved fallback chain
   and retain evidence from every failed source.
3. **Check reasonability:** compare source freshness, cross-rates, prior-month rate,
   market deviations, and stablecoin peg tolerance.
4. **Pre-analyze:** calculate anticipated revaluation, depeg exposure, and effect on
   distributable value without posting.
5. **Review:** present rates, warnings, fallback use, and projected gains/losses to
   the operator.
6. **Approve:** accept the validated source set; after all automated sources are
   exhausted, one admin may approve a reasonable manual rate with rationale.
7. **Post:** freeze the epoch FX snapshot, journal the once-monthly unrealized
   revaluation, and hash-link all source evidence and approvals.

Exit gates:

- Every included asset has one approved fixed monthly USD rate.
- No included stablecoin exceeds the plus-or-minus 0.3% depeg threshold.
- Monthly revaluation postings balance and reconcile to native quantities.

### Stage 4: `fee_processing`

Purpose: recognize and segregate earned platform fees before allocating restricted
epoch assets.

Process:

1. Finalize each `project x rail x epoch` settled gross amount.
2. Calculate the snapshotted project-fee percentage once and apply the rail's
   USD-denominated minimum and maximum once.
3. Prove that each project package leaves a positive net epoch contribution.
4. Journal and sweep project fees to the matching platform treasury.
5. Aggregate remaining balances by rail across all included projects.
6. Calculate the 2.5% base platform fee per rail using the fixed monthly rates.
7. Journal and sweep base fees to the matching platform treasury.
8. Reconcile platform and epoch treasury native balances after the sweeps.

Exit gates:

- Fee policies and snapshots are complete.
- Fee journals balance.
- Platform and epoch treasury balances reconcile within the approved review
  tolerance, with every discrepancy classified.

### Stage 5: `carryover_payouts`

Purpose: prioritize valid payout requests deferred from prior epochs and harvest
expired, unrequested value without underfunding the current allocation.

Process:

1. Identify prior queued payout requests in durable oldest-first order.
2. Identify prior epochs whose three-month lifespan has expired.
3. Exclude every valid reserved/requested claim from unrequested-balance harvest.
4. Exchange current-epoch eligible inventory for equal locked-USD backing assets
   from older epochs when fulfilling queued requests.
5. Execute and reconcile the privileged payout batch.
6. Transfer expired, unrequested native assets and full provenance into the current
   epoch at the current epoch's locked monthly rates.
7. Journal realized gains/losses and every inter-epoch inventory movement.
8. Close a previous expired epoch only after its harvest and carryover obligations
   complete successfully.

Exit gates:

- Privileged queued requests are settled or have explicit blocking exceptions.
- Current-epoch distributable value remains fully backed after inventory exchanges.
- Eligible prior epochs are closed or carry a documented hard blocker.

### Stage 6: `locking`

Purpose: create the immutable, final allocation input package after the project
opt-out period and every financial preparation stage.

Process:

1. Confirm the opt-out deadline has passed.
2. Freeze included projects, settled/applied receipts, accepted user lists, Cubid
   evidence, eligibility checks, native balances, fee results, fixed FX rates,
   carryover results, and project-source dimensions.
3. Prove that the distributable pool is based only on reconciled epoch treasury
   assets after fees and carryover activity.
4. Produce a deterministic lock manifest and input hash.
5. Reject any later attempt to add, correct, or backdate a project input.

Exit gate:

- One immutable allocation manifest balances by rail, asset, native quantity, and
  functional USD.

### Stage 7: `allocating`

Purpose: deterministically turn the locked, cash-backed pool into conditional user
allocation results.

Process:

1. Run the versioned allocation algorithm against the locked manifest.
2. Preserve per-user project-source attribution and eligible `rail x asset` union.
3. Calculate user USD entitlements using the epoch's fixed monthly rates.
4. Calculate native payout guides using the same originating-epoch rates.
5. Prove conservation by project, rail, asset, and total functional USD.
6. Produce immutable calculation inputs, outputs, version, and reproducibility hash.
7. Do not open payouts or post final user award/accounting records until review
   completes.

Exit gate:

- The allocation run is deterministic, balanced, reproducible, and free of hard
  eligibility or funding failures.

### Stage 8: `reviewing`

Purpose: independently validate allocation integrity and reasonableness before
creating spendable user claims.

Process:

1. Confirm every allocation control and accounting check is green.
2. Rerun the allocation from the locked manifest and prove byte-for-byte or
   mathematically defined deterministic equivalence.
3. Compare results with tentative estimates and prior epochs; classify material
   deviations and outliers.
4. Prepare the detailed outcome listing:
   - projects that withdrew;
   - total included value and user count per project;
   - value harvested and transferred from previous epochs;
   - deduplicated net user count; and
   - minimum, mean, median, and maximum available payouts.
5. Review privacy thresholds before any public release.
6. Require one authorized admin to approve the reviewed allocation package. The
   approval is bound to the exact locked manifest and allocation-result hashes.

Exit gates:

- Independent rerun is consistent.
- Outcomes are internally approved as mathematically and economically reasonable.
- Detailed reporting package is complete and privacy-safe.

### Stage 9: `payout_readying`

Purpose: convert approved allocation results into funded, externally executable
user claims and prepare public/operator evidence.

Process:

1. Post the accountant-approved conditional-award or payout-accounting entries from
   the approved allocation artifact.
2. Publish the privacy-safe detailed outcome listing, including:
   - withdrawn projects;
   - included value and user count per project;
   - harvested and transferred prior-epoch value;
   - net user count; and
   - minimum, mean, median, and maximum available payouts.
3. Align and validate project-fee, base-fee, user-fee, minimum-payout, batch, Safe,
   provider, and execution thresholds.
   Initial minimum payouts are $10 USD-equivalent for Stripe and $5 USD-equivalent
   for Base, using originating-epoch fixed rates.
4. Confirm every supported payout asset has sufficient operational inventory or a
   visible depletion state.
5. Seed the Base paymaster with the approved gas budget and verify its funding,
   policy, and pause controls.
6. Validate Stripe Connect and Base destination readiness without exposing private
   destination data.
7. Generate the immutable, hash-linked close package.
8. Determine notification recipients and enqueue localized payout-window emails.

Exit gates:

- User liabilities reconcile to restricted assets.
- Payout thresholds, signer/paymaster controls, routes, and inventory are ready.
- Close package exists and all hard gates pass.

### Stage 10: `payout_open`

Purpose: let users reserve and receive claims using eligible, funded rails and
assets.

Process:

1. Open the manual payout window automatically after final gates clear unless an
   admin pause is active.
2. Emit the durable opening event and send asynchronous user notifications.
3. Show each user only eligible `rail x asset x destination` combinations with
   sufficient current inventory.
4. Accept partial USD-denominated requests, consume credits oldest-first, and
   calculate native amounts at each originating epoch's fixed rate.
5. Atomically reserve credits and exact native inventory in deterministic commit
   order.
6. Snapshot the user-selected fee and transfer it in the payout asset to the
   platform treasury.
7. Execute below-threshold Base payouts through the limited signer policy and
   route other payouts through their required approval path.
8. Mark a claim paid only after external settlement/finality and balanced journals.
9. Queue inventory-depleted but otherwise valid requests for the next privileged
   carryover batch.

Exit behavior:

- The window remains available according to the epoch lifespan policy, subject to
  the next month-end processing pause.

### Stage 11: `expired`

Purpose: end new claims against unrequested balances after the three-month lifespan.

Process:

1. At `month_end_cutoff + lifespan_months`, run the expiry cron.
2. Stop new requests against unrequested balances from the expired epoch.
3. Preserve timely requested/reserved liabilities until paid, rejected, or
   cancelled.
4. Prepare unrequested balances and native assets for harvest by the current
   epoch's `carryover_payouts` stage.
5. Publish expiry and pending-harvest evidence.

Exit gate:

- Expired unrequested value is deterministically identified and no longer
  withdrawable from the old epoch.

### Stage 12: `closed`

Purpose: finalize an epoch after expiry residue and carryover obligations are
resolved.

Process:

1. Confirm a later epoch's `carryover_payouts` stage successfully harvested all
   eligible unrequested value.
2. Confirm no unresolved custody balance, unjournaled movement, or unclassified
   exception remains.
3. Preserve requested liabilities that legally remain payable through their linked
   successor/carryover records rather than leaving mutable balances in the closed
   epoch.
4. Publish the final close artifact and make the epoch read-only.

Exit gate:

- The epoch is financially exhausted or all remaining obligations are represented
  by explicit successor records, and its final audit package is immutable.

## Expected end-to-end cash flow

```text
Project payment instruction
  -> Stripe bank transfer or Base stablecoin transfer
  -> rail clearing and independent settlement/finality reconciliation
  -> canonical settlement timestamp assigns collection epoch
  -> project fee to platform treasury
  -> net contribution to epoch treasury
  -> month-end Pacific cutoff
  -> reconcile frozen project list/payment packages
  -> one-business-day approve-or-opt-out review
  -> first-of-month fixed FX snapshot and revaluation
  -> project-fee finalization and 2.5% base fee per rail
  -> privileged carryover payout batch and expired-epoch harvest
  -> immutable allocation lock
  -> funded allocation calculation and independent rerun
  -> conditional-award accounting, reports, thresholds, and paymaster readiness
  -> allocation gates clear
  -> payout window opens and users are emailed
  -> user chooses eligible funded rail, asset, amount, destination, and fee
  -> inventory and credits reserved atomically
  -> user fee to platform treasury
  -> recipient payout and external reconciliation
  -> conditional award control balance cleared only after verified settlement
```

## Open decisions

The following are intentionally unresolved:

1. Exact hard/soft gate catalog, exception classes, and which soft exceptions may
   still permit payout opening.
2. Email templates, localization, delivery provider, and detailed handling for
   delayed epochs or users without payout-ready routes. The confirmed audience is
   users with a positive new claim, eligible rolled claim, or queued-request status
   change; delivery is asynchronous and non-blocking.
3. Authoritative FX source hierarchy for Stripe fiat and Base stablecoins.
4. Stablecoin depeg recovery and reactivation policy.
5. Exact Stripe account and clearing/sweep architecture.
6. Exact Safe thresholds, limited hot-signer allowance, transaction ceiling,
   velocity limit, monitoring, rotation, revocation, and emergency pause.
7. Definition and funding target for the platform risk reserve.
8. Chargeback receivable recovery order when a project stops contributing.
9. Partial payout rounding, dust, and insufficient gas or provider-fee behavior.
10. Cancellation and rejection behavior for reserved and queued requests.
11. Whether queued requests may span multiple future epochs and their terminal
    failure/escalation policy.
12. Exact journal event taxonomy, account numbering, close-package serialization,
    trial balance, and reconciliation report contracts.
13. Data retention, evidence hashing, audit export, and privacy/redaction rules.
14. Migration and backfill treatment for existing payments, monthly cycles,
    bookkeeping credits, withdrawal reservations, and payout-intent records.
15. Production legal, tax, custody, money-transmission, sanctions, KYC/KYB, and
    accounting-review gates.
16. Initial implementation slicing, non-goals, rollout environments, and feature
    flags.
17. Exact email-provider event mapping and the initial versioned FundLoop holiday
    calendar entries.
18. Exact preliminary and final public-report schema and anti-correlation controls;
    exact project totals and user counts are confirmed, without user identifiers.
19. Paymaster provider, gas-budget policy, replenishment threshold, and emergency
    pause behavior.
20. Numeric Cubid cached-evidence TTL and the authorized resolution workflow for
    greylisted or blacklisted post-lock liabilities.
21. Applicable legal jurisdictions, governing law, dispute terms, and qualified
    counsel/accountant approval of the requested ownership and best-effort model.
22. Exact event at which a payout is legally and financially "processed," and the
    corresponding revenue, award, expense, payable, tax, and abandoned-funds model.
23. Exact service-provider/data-recipient inventory, retention schedule, user-rights
    process, and legally required/public-chain disclosure language.
24. Approved personal-profile fields visible publicly and to accepted project
    members, consent withdrawal effects, and member-removal visibility behavior.

## Scoping phase status

- Phase 1, brainstorm and narrowing: complete.
- Phase 2, durable architecture/design: draft complete in
  `docs/engineering/settlement-backed-epoch-treasury.md`; Task #120 owns its final
  review.
- Phase 3, Feature/Goal/Task scaffold: published as Feature #118 and recorded in
  `agent-context/2026-08-08-epoch-treasury-accounting/issue-tree.md`.
- Phases 4 through 6, executable Task/Goal/parent finalization: complete, including
  the legal/privacy Goal and Tasks.
- GitHub issue creation and vetting: complete. Feature #118 remains `Scoped`; its
  26 executable Goal and Task descendants are `Ready`, with native blockers
  controlling implementation order.

## Preliminary non-goals

These are confirmed Feature boundaries:

- Stripe cards and pull-based debit intake;
- Base assets other than allowlisted USDC, USDT, and PYUSD deployments;
- arbitrary ERC-20 intake or payout;
- networks other than Base;
- fiat currencies other than USD and CAD;
- continuous or daily FX revaluation;
- backdating settled receipts into closed epochs;
- using contribution promises as allocatable cash;
- a wallet, account, or GL account per project, user, or epoch;
- editing or deleting posted journal entries; and
- automatic clawback of completed user payouts.

## Required pre-implementation artifact

Before executable Goals begin, the Feature requires a direct child design Task that
produces a durable engineering design covering:

- epoch state machine and gate contract;
- custody and trust boundaries;
- cash-flow sequence and fee journals;
- multi-currency chart of accounts;
- journal and operational schema;
- Stripe and Base adapter contracts;
- payout and inventory-reservation state machines;
- monthly FX snapshot and rollover algorithms;
- reconciliation and close reports;
- migration/backfill plan;
- threat model and operational controls; and
- test strategy, including extensions to the existing local persona harness.

No implementation Goal should begin until Task #120 is reviewed, Task #121 records
qualified legal and accounting approval, and the first executable Goal or Task is
unblocked under the vetted dependency graph.

## Interview continuation protocol

1. Continue with batches of ten questions.
2. Each question provides one proposed answer and two alternatives.
3. After the user responds to each batch, update this file before presenting the
   next batch.
4. Never move an interview proposal into Confirmed decisions without explicit user
   agreement.
5. The GitHub Feature and issue tree were created only after final confirmation;
   future amendments must preserve the published decision record and blocker graph.
