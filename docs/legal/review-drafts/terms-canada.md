# DRAFT - NOT APPROVED - NOT EFFECTIVE

## Fundloop Canada Inc. Terms of Service review draft

- Document status: counsel-review draft only
- Document identifier: `fundloop-terms-ca-review-draft-2026-08-08`
- Effective date: none
- Intended initial territory: Canada
- Proposed governing law and venue: Ontario, Canada, subject to counsel and
  non-waivable law

> Reviewer instruction: This text expresses product intent. It must not be
> published as effective Terms or used to accept live funds or execute live payouts
> until the production approval gate in [README.md](./README.md) is complete.

## 1. Parties and scope

These proposed Terms would govern access to FundLoop services supplied by Fundloop
Canada Inc. (`FundLoop`, `we`, `us`) to Canadian project operators and individual
users. The services are intended to support project contributions, monthly
allocation calculations, conditional award records, and possible payouts through
available fiat or crypto rails.

The product is experimental. Features, providers, supported assets, operating
cadence, availability, and eligibility may change or be suspended. Acceptance of
an experimental warning would be required before a project submits a contribution,
but that warning would not waive mandatory rights or permit FundLoop to bypass a
legal, regulatory, settlement, identity, sanctions, treasury, or payout control.

## 2. Eligibility and authority

The proposed service would be limited initially to persons and entities in Canada.
An individual must be at least 18 and legally capable of contracting. A person
acting for a project represents that they are authorized to bind it and submit its
user list and funds.

FundLoop may require identity, business, authority, source-of-funds, sanctions,
fraud, tax, or other checks. Provider screening does not guarantee eligibility.
FundLoop may reject, pause, or hold activity when evidence is incomplete,
inconsistent, prohibited, or reasonably requires review.

## 3. Accounts and security

Users would be responsible for accurate account information, secure credentials,
wallet and payout destinations, and prompt notice of unauthorized access. A wallet
connection is not proof of identity or ownership. FundLoop may require additional
authentication before a sensitive action.

Users must not evade limits, submit another person's information without authority,
replay requests, manipulate identity/uniqueness evidence, interfere with monthly
processing, or use FundLoop for unlawful activity.

## 4. Project packages and settlement cutoff

A monthly project package would require both:

1. a valid, versioned active-user list; and
2. the accompanying contribution fully settled before midnight at the end of the
   calendar month in `America/Los_Angeles`.

Declarations, promises, pending transfers, and provider authorizations are not
cash received. A package missing either component at cutoff would move in full to
the next open month. A late receipt or receipt incorrectly attributed to a past
month would enter the current open month rather than being backdated.

After cutoff, a project could approve its frozen reconciliation package or opt out
and roll it forward before the stated deadline. The final Terms and product copy
must explain any proposed silence-as-approval rule prominently and counsel must
confirm whether it is enforceable for the intended project population.

## 5. Proposed ownership and no-refund model

Product intent is that a project makes an unconditional contribution to FundLoop
and transfers legal title to the submitted funds when FundLoop receives finally
settled value. The project would have no contractual right to direct the later
allocation and no contractual refund right after settlement.

FundLoop could attempt a refund in its sole discretion and on a best-effort basis,
subject to available funds, provider capability, compliance review, prior fees,
costs, irreversible transactions, and operational feasibility. A discretionary
refund would not create an ongoing refund entitlement or course of dealing.

This proposed clause is expressly subject to non-waivable consumer, payment,
insolvency, trust, restitution, mistake, fraud, sanctions, and other applicable
law. Counsel must determine whether the intended product functions and user
expectations are consistent with the ownership model; labels such as `owned by
FundLoop` and `not escrow` are not dispositive.

## 6. No escrow, deposit, trust, or stored-value promise

FundLoop does not intend to offer escrow, a deposit account, a trust account,
stored value, a bank account, or a project-controlled custodial balance. Project
contributions are not intended to be held for return to the contributing project.

The final clause depends on counsel's classification under the Retail Payment
Activities Act and other applicable law. If the actual service is found to hold
end-user funds or perform regulated payment functions, FundLoop must implement the
required registration, safeguarding, risk, incident, and disclosure controls before
production rather than relying on this clause.

## 7. Fees

The proposed fee model has three separately disclosed components:

- a project fee assessed once for each `project x rail x epoch` on aggregate settled
  contributions, using the accepted percentage and applicable rail minimum/maximum;
- a base platform fee, initially 2.5% per rail, deducted after reconciliation and
  valuation and before allocation; and
- a user-selected fee deducted during payout, within the displayed minimum and up
  to 100%, using the chosen payout asset.

Provider, network, gas, foreign-exchange, tax, or other costs must be disclosed
separately and not hidden inside a quoted payout. Final presentation, tax treatment,
and gross-versus-net accounting require professional approval.

## 8. Conditional awards; no pre-payout user ownership

Allocation would create a conditional, revocable memorandum record used to
administer possible future payouts. Product intent is that an allocation,
notification, displayed balance, approval, reservation, or payout request does not
transfer ownership of funds to a user and does not by itself create escrow, a
deposit, wages, an investment, a stored-value account, or a presently enforceable
debt.

A user would own received value only after the applicable provider or blockchain
transfer is final and FundLoop has reconciled it as `payout_processed`. Counsel and
an accountant must approve the final contractual and recognition event. The final
Terms must not describe conditional records as guaranteed earnings, salary,
commission, yield, deposits, or investments.

## 9. Payout requests and best-effort execution

FundLoop would attempt eligible payouts on a best-effort basis only. A request is
not execution, settlement, or a guarantee. A payout may be delayed, queued, held,
rejected, cancelled, rerouted where authorized, or remain unavailable because of
identity, sanctions, fraud, provider, network, liquidity, inventory, destination,
tax, technical, or legal constraints.

FundLoop does not guarantee a requested currency, token, chain, rail, timing,
amount, exchange value, or successful transfer. A user's selectable inventory would
be limited to assets and rails contributed by their associated projects and still
available when the request is atomically reserved. If no eligible inventory is
available, a request may be queued for a later privileged batch without creating
unbacked value.

Initial automated Base signer limits are intended to be $20 per payout, $500 per
rolling 24-hour window, and $5,000 per epoch. These limits constrain automation;
they do not define a user's entitlement or eliminate compliance duties.

## 10. Expiry and carryover

An epoch's unrequested conditional awards are intended to remain requestable for
three complete payout months. At expiry, unrequested value may be removed from the
old memorandum cohort and carried into the next applicable epoch. A request validly
reserved before expiry would remain governed by its queue, hold, rejection,
cancellation, and settlement rules rather than expiring automatically.

Final copy must state exact dates and examples at the decision point. Counsel and
the accountant must review abandoned-property, limitation, revenue, tax, and
contract consequences before production.

## 11. Supported rails, assets, and exchange rates

Initial intended rails are Stripe USD/CAD bank-transfer flows and Base
USDC/USDT/PYUSD. Support is identified by exact fiat code or chain ID and token
contract address, not symbol alone. FundLoop may pause an asset or rail, including
when a stablecoin moves outside its permitted peg tolerance.

Monthly allocation and user-eligibility calculations would use a fixed approved
USD-equivalent rate for the epoch. That management rate may differ from the rate
required for financial statements or tax. Users bear market and conversion risk
except where non-waivable law requires otherwise.

## 12. Public blockchain disclosures

Base transactions are public and persistent. Wallet addresses, tokens, amounts,
destinations, timestamps, transaction hashes, contract interactions, and derived
relationships may be visible, copied, analyzed, or linked to identity by anyone.
FundLoop cannot delete or guarantee confidentiality of confirmed public-chain data.
Users must review the destination and disclosure before authorizing an onchain
payout route.

## 13. Projects, Cubid, and profile sharing

FundLoop may use Cubid identifiers, whitelist state, uniqueness scores, and hold
signals to determine eligibility. A project may see project-scoped validation
failures and pseudonymous results, but pseudonymous data is not necessarily
anonymous.

A project invitation would not create membership or share a personal profile until
the invitee affirmatively accepts the disclosed project, role, fields, and policy
version. Public profile publication would require a separate optional opt-in and
could be withdrawn prospectively. Neither choice would erase records FundLoop must
retain for security, legal, financial, or audit purposes.

## 14. Taxes and user responsibility

Projects and users are responsible for obtaining their own tax advice and providing
information reasonably required for reporting. FundLoop may withhold, report,
restrict, or request documentation where law requires. The final Terms must reflect
the accountant's Canadian GST/HST, income, crypto-asset, and information-reporting
analysis and must not shift a non-waivable FundLoop obligation to a user.

## 15. Service providers and third-party terms

FundLoop expects to rely on providers including Supabase, Vercel, Cubid, Stripe,
email services, Base/Ethereum infrastructure, RPC providers, Safe, paymaster
services, and financial institutions. Provider terms, privacy practices,
availability, geography, and eligibility may apply. Stripe connected-account users
may need to accept Stripe-hosted agreements and complete Stripe requirements.

FundLoop remains responsible for its own obligations and does not represent that a
provider's screening, onboarding, or contract discharges them.

## 16. Suspension, holds, and termination

FundLoop may suspend access, freeze a workflow, place a compliance hold, reject a
request, or terminate an account to protect users, comply with law, address risk,
investigate evidence, or maintain the service. Final language must distinguish
account access from conditional-award and completed-payout treatment and must state
any notice, review, appeal, or statutory rights counsel requires.

## 17. Intellectual property and feedback

The final Terms should grant a limited, revocable right to use FundLoop for its
intended purpose, preserve FundLoop and licensor rights, define project/user content
licenses narrowly, and address feedback. Counsel must review open-source, trademark,
user-content, and moral-rights terms.

## 18. Disclaimers and limitation questions

The service is intended to be offered `as is` and `as available` without any
guarantee of allocation, payout, value, continuity, availability, security, or
fitness for a particular purpose. Any warranty disclaimer, liability exclusion,
cap, indemnity, or consequential-damages clause must be drafted by counsel for the
actual customer classes and may not exclude liability or remedies that cannot
legally be excluded.

## 19. Governing law and disputes

The proposed governing law and exclusive venue are Ontario, Canada. The final
clause must preserve any mandatory consumer, privacy, employment, regulatory,
small-claims, class-proceeding, or other statutory forum and remedy. Counsel must
decide whether arbitration, waiver, notice, limitation, or informal-resolution
terms are appropriate and enforceable.

## 20. Versions, notices, and acceptance evidence

The proposed acceptance record would include actor, capacity, document identifier,
immutable content hash, locale, effective version, timestamp, source surface,
experimental-warning version, and relevant project/payout context. Material changes
would require affirmative reacceptance before the protected action. Access to an
old accepted version and a retainable copy would be preserved.

Operational email and legally required notices must be separated from commercial
electronic messages. Marketing messages require the consent, sender information,
and unsubscribe controls applicable under Canadian anti-spam law.

## 21. Contact information

Before approval, FundLoop must add a service address, legal-notice email, support
channel, privacy contact, and any regulator or complaint information counsel
requires. Placeholders must never reach an effective document.

## 22. Questions requiring counsel approval

1. Does the actual contribution, allocation, account, and payout design trigger
   Retail Payment Activities Act registration or end-user-fund safeguarding?
2. Does any fiat or crypto activity make FundLoop a FINTRAC money services business
   or create travel-rule, KYC, reporting, and recordkeeping duties?
3. Are project contributions legally unconditional FundLoop property, and what
   trust, insolvency, restitution, consumer, mistake, or refund rights remain?
4. When, if ever before final payout, does a user obtain a contractual claim?
5. Do any tokens, pooled expectations, or product representations create securities
   or derivatives issues?
6. Which project operators or users qualify as consumers, and which mandatory
   internet/future-performance agreement rules apply?
7. Are sanctions, tax, employment, charity, crowdfunding, unclaimed-property, or
   gaming/contest regimes implicated?
8. Which disclaimers, limits, venue, consent, and silence-as-approval provisions are
   enforceable for the intended Canadian population?

No answer is supplied by this draft.
