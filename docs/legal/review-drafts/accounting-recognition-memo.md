# DRAFT - NOT APPROVED - NOT EFFECTIVE

## Fundloop Canada Inc. accounting-recognition review memo

- Status: accountant and counsel review draft only
- Prepared: August 8, 2026
- Entity: Fundloop Canada Inc., Ontario, Canada
- Management accounting centre: USD-equivalent epoch and project reporting
- Statutory functional/presentation currency: **not determined**
- Applicable Canadian GAAP framework: **not determined**

> This memo presents facts, implementation boundaries, alternatives, and approval
> questions. It does not select accounting treatment, provide tax advice, authorize
> financial statements, or permit production value flow.

## 1. Purpose

FundLoop intends to receive settled project contributions in Stripe USD/CAD and
Base USDC/USDT/PYUSD, deduct three fee types, allocate reconciled value through
monthly epochs, maintain conditional user-award records, and execute best-effort
payouts. This memo identifies the decisions an accountant must make before the
neutral ledger schema can become FundLoop's production accounting policy.

The architecture can implement immutable assets, custody accounts, balanced
journals, periods, source events, memorandum awards, exact native quantities,
reversals, and reconciliation without deciding income-statement classification.
Production posting templates and financial-statement presentation remain gated.

## 2. Assumed product facts for review

These are intended product facts, not conclusions about legal or accounting effect:

1. A project package is eligible only when its versioned user list and accompanying
   funds are fully settled before Pacific month-end cutoff.
2. Late or past-attributed receipts enter the current open epoch; promises and
   pending transfers are never allocatable cash.
3. Product intent is that legal title to settled project contributions transfers to
   FundLoop, projects have no contractual refund right, and discretionary refunds
   are best effort only.
4. Platform and epoch treasury custody are physically and logically separated by
   rail and asset.
5. A project fee is assessed once on each `project x rail x epoch` aggregate, a
   2.5% base fee is assessed per rail before allocation, and a user-selected fee is
   deducted during payout.
6. Allocation creates a conditional memorandum award, not user ownership or a
   production general-ledger payable under the current product intent.
7. A payout request reserves/queues eligible inventory but is not payment.
8. The proposed recognition boundary for user ownership is reconciled external
   final settlement recorded as `payout_processed`; counsel and the accountant must
   approve or replace that boundary.
9. An epoch's unrequested awards expire after three full payout months and remaining
   value is carried into a later epoch. Timely reserved requests do not expire
   automatically.
10. Monthly product calculations use one approved fixed USD-equivalent rate per
    epoch. That management rate does not replace transaction-date or reporting-date
    rates required by the approved accounting framework.

## 3. Decisions that must precede production

### 3.1 Reporting framework and currencies

The accountant must determine:

- whether FundLoop reports under Canadian accounting standards for private
  enterprises, IFRS Accounting Standards, or another required/elected framework;
- FundLoop's functional currency based on its primary economic environment;
- financial-statement presentation currency;
- whether the USD-equivalent epoch ledger is a management subledger while the
  statutory general ledger is CAD, or whether another configuration is justified;
- transaction-date, month-end, reporting-date, and settlement FX sources and
  entries; and
- consolidation, related-party, and foreign-operation considerations if the
  organizational structure changes.

Ontario incorporation does not itself determine functional currency. The locked
monthly epoch FX rate is a product/allocation convention and cannot silently become
the statutory rate.

### 3.2 Project contribution recognition alternatives

The economic substance and enforceable obligations must determine treatment; the
Terms label is not enough.

| Alternative for review | Possible rationale | Key concern |
| --- | --- | --- |
| Revenue/income on settled receipt | FundLoop receives unconditional title and the project retains no refund or allocation control | FundLoop may still owe substantive allocation/payout or other performance; gross recognition could overstate revenue and conflict with user/project expectations. |
| Deferred revenue or contract liability | Receipt precedes FundLoop's promised monthly processing, allocation, reporting, or payout-related service | Identify customer, performance obligations, transaction price, satisfaction timing, refunds/variable consideration, and gross/net presentation. |
| Restricted or designated fund presentation | Funds are FundLoop-owned but internally restricted to an epoch/rail purpose | Internal designation may not create a liability; terminology must not imply trust/escrow without legal basis. |
| Agency/payable/custodial model | FundLoop economically holds or facilitates value for intended recipients | Conflicts with current ownership intent but may better reflect actual obligations or payment regulation; requires legal classification and different safeguarding/presentation. |
| Contribution/grant or other income | Project transfer may not be consideration for a service | Determine conditions, restrictions, repayment risk, and applicable framework guidance. |

The accountant must select the model, recognition event, measurement, account
classification, disclosure, and evidence. A model may vary by contract or rail only
if differences are real, documented, and consistently applied.

### 3.3 Conditional awards and payout recognition alternatives

| Event | Current neutral implementation | Approval question |
| --- | --- | --- |
| Allocation calculated/reviewed | Immutable calculation artifact only | Does this create any constructive, contractual, or accounting obligation? |
| Allocation approved | Conditional memorandum award and source/asset eligibility | Is an expense, provision, payable, or disclosure required despite no legal ownership? |
| Payout request | Reservation/queue memorandum; no external settlement | Does acceptance make an obligation unconditional or change measurement? |
| Payout initiated | Execution attempt and clearing evidence | When should cash/crypto be derecognized and a payable/clearing account recognized? |
| `payout_processed` | Matched, final external settlement and balanced journal | Is this the correct expense/liability/ownership event? What evidence is sufficient for Stripe and Base finality? |
| Failure/reversal/reorg | Reversal or exception; never deletion | How are liabilities, losses, receivables, and subsequent events presented? |
| Expiry/carryover | Remove unrequested memorandum award and transfer designated value to later epoch | Is there income/reversal, abandoned-property exposure, or no GL effect beyond internal designation? |

The approved policy must distinguish legal obligation timing, expense recognition,
payable recognition, asset derecognition, settlement finality, and user tax/reporting
events. They may not be the same timestamp.

## 4. Neutral ledger implementation allowed before approval

Local and `dev` implementation may create these classification-neutral contracts:

- immutable asset identity by fiat code or `chain_id x token_address` with decimals,
  issuer, peg, and metadata version;
- custody accounts mapped one-to-one to externally reconcilable Stripe/bank/Safe
  balances and separated platform/epoch purposes;
- exact native atomic quantities plus exact USD management amounts and rate evidence;
- immutable financial events, journal headers/lines, source references, periods,
  posting status, reversals, and retained foreign keys;
- balanced atomic posting functions, idempotency, closed-period guards, RLS, least
  privilege, audit events, and reconciliation exceptions;
- effective-dated machine account keys whose display code and financial-statement
  classification can be approved later without rewriting history;
- memorandum conditional awards, reservations, queues, holds, and expiry/carryover
  records explicitly excluded from the production GL until an approved template
  posts them; and
- shadow journals and reports that are labelled non-authoritative and execute no
  external transfer.

Neutral implementation must not hard-code `revenue`, `payable`, `expense`,
`escrow`, `trust`, `wages`, or `user-owned` as the economic meaning of a draft
event. Production posting templates remain disabled until approval.

## 5. Illustrative event map, not approved journal policy

| Product event | Evidence | Native asset movement | Candidate accounting questions |
| --- | --- | --- | --- |
| Settled project receipt | Stripe availability/bank statement or finalized Base receipt | External custody increases | Revenue, deferred revenue, contribution, restriction, liability, tax, project fee timing |
| Project fee sweep | Policy version, aggregate base, clamp calculation, custody transfer | Epoch/clearing custody decreases; platform custody increases | Earned on receipt or service? Gross/net, GST/HST, inter-account versus income event |
| First-of-month valuation | Approved source hierarchy and immutable rates | No native movement | Functional-currency remeasurement, stablecoin/token classification, unrealized gain/loss |
| Base fee sweep | 2.5% per-rail assessment and custody transfer | Epoch custody decreases; platform custody increases | Revenue timing, GST/HST, gross/net, project/customer identity |
| Allocation approval | Locked manifest and deterministic result | No native movement | Memorandum only versus expense/provision/payable; disclosure and measurement |
| User fee at payout | User fee version, chosen percentage, native split | Epoch custody pays platform and recipient | Fee revenue versus reduction of payout expense; GST/HST; gross/net presentation |
| Final payout | Provider/chain final settlement and reconciliation | Epoch custody decreases | Expense, payable settlement, direct distribution, tax/reporting, asset derecognition |
| Refund/dispute/reversal | Provider/legal evidence and original source | Platform/epoch custody or receivable changes | Contra revenue, expense, receivable, loss, reserve, tax adjustment |
| Expiry/carryover | Expiry clock and successful inventory transfer | Old/new epoch designation or custody changes | Memorandum reallocation, revenue release, abandoned property, no GL event |

## 6. Chart-of-accounts review

The architecture's hybrid chart groups fine-grained custody/clearing accounts and
stable control accounts while allowing summary reporting. The accountant must
approve final account classes, normal balances, display codes, and statements for:

- Stripe/bank and Safe assets per currency/token and platform/epoch purpose;
- provider clearing, in-transit, unidentified/disputed, chargeback, refund,
  receivable, reserve, and gas balances;
- project contribution or revenue/deferred/restricted/liability alternatives;
- conditional-award memorandum controls and any approved payable/provision;
- project, base, and user fee income or contra-expense presentation;
- payout/distribution expense or other approved classification;
- realized/unrealized FX and token gains/losses;
- Stripe/bank/network/gas/paymaster costs;
- GST/HST, withholding, tax, sanctions, and other statutory balances; and
- retained earnings/equity and period-close accounts.

Account machine keys must remain immutable even if a reviewer changes display
codes or financial-statement grouping.

## 7. Gross versus net and principal-agent questions

For contributions, fees, payouts, and provider costs, the accountant and counsel
must determine who controls the service/value before transfer, who is the customer,
who bears inventory/settlement/discretion risk, who sets price, and whether FundLoop
acts as principal or agent. Legal title is relevant but not determinative.

The approved memo must state whether reports show:

- gross settled project funds plus separate fees and distributions;
- net platform revenue only;
- contribution or other income with designated distributions;
- provider costs as FundLoop expenses or pass-through amounts; and
- user-selected fees as revenue, donation/contribution, reduction of distribution,
  or another class.

## 8. Fiat, stablecoin, and non-stable-token accounting

Each asset requires its own analysis. A token symbol is not an accounting identity.
The ledger records exact chain and contract address, native units, and evidence.

- Fiat balances require transaction and reporting-period foreign-currency treatment
  relative to the approved functional currency.
- Stablecoins require analysis of contractual redemption rights and substance; a
  peg label does not automatically make a token cash or foreign currency.
- Non-stable tokens such as ETH require an approved asset classification and
  consistent valuation, impairment/fair-value, disposition, and gain/loss method.
- Under the IFRS Interpretations Committee's cryptocurrency agenda decision,
  qualifying holdings may fall under IAS 2 when held for sale in the ordinary
  course or IAS 38 otherwise; FundLoop's actual framework and token rights must be
  reviewed rather than copied mechanically.
- A product depeg pause of plus/minus 0.3% is an operational control, not an
  accounting measurement policy.

## 9. Exchange-rate and valuation control

Product calculations use monthly locked USD-equivalent rates obtained through
primary, fallback, reasonability, preanalysis, review, approval, and posting steps,
with one-admin manual continuation only after source exhaustion.

The accountant must separately approve:

- statutory transaction-date rates and observable-market hierarchy;
- period-end remeasurement and presentation-currency translation;
- stablecoin and non-stable-token fair-value or other measurement sources;
- realized/unrealized gain/loss timing and location;
- bid/ask, fees, liquidity, depeg, unavailable markets, and manual overrides;
- treatment of the difference between product locked rates and accounting rates;
  and
- evidence, consistency, control ownership, and change policy.

Revaluation runs on the first of the month for product purposes, but statutory
reporting may require other dates and adjustments.

## 10. Refunds, disputes, chargebacks, and losses

The policy must never rewrite or delete a settled event. It should post explicit
reversals, receivables, reserves, losses, recoveries, and tax adjustments linked to
the original event.

Approval is required for:

- when a discretionary refund is recognized and from platform versus epoch funds;
- who bears provider reversals after allocation or payout;
- chargeback reserve targets and bad-debt timing;
- whether unrelated user awards may ever be reduced (the product decision says no
  silent reduction);
- insolvency and negative-custody presentation; and
- subsequent-event and disclosure treatment.

## 11. Tax and information-reporting review

No tax conclusion is supplied. A Canadian tax adviser/accountant must review:

- GST/HST registration, place of supply, taxable consideration, invoicing, and tax
  on project/base/user fees and any services embedded in contributions;
- income timing and characterization of contributions, fees, expired awards,
  refunds, distributions, and crypto gains/losses;
- recipient reporting, withholding, contractor/employment characterization, and
  information slips;
- crypto-asset receipt, disposition, transfer, and valuation records;
- project/user residency and tax-document collection;
- intercompany, permanent establishment, and cross-border implications if scope
  expands; and
- retention of books, records, wallet addresses, transaction IDs, native units,
  CAD values, counterparties, and methods for the required period.

CRA guidance says crypto activity can have income and GST/HST consequences and
expects detailed books and records. Exact obligations depend on the facts.

## 12. Reconciliation and close controls

Production close should require:

- provider/statement/onchain custody balances reconciled to each asset-specific
  ledger account;
- native-unit conservation by custody, epoch, project source, conditional award,
  reservation, transfer, fee, and remainder;
- USD management and approved statutory currency trial balances;
- unique retained source events and balanced journals;
- documented FX sources, manual overrides, depeg/market exceptions, disputes,
  holds, and stale items;
- review of all platform/epoch transfers and fee clamps;
- payout finality and replacement/reorg evidence;
- expiry/carryover completion and prior-epoch close evidence; and
- immutable close-package hash, approver, date, version, and exception list.

## 13. Accountant approval schedule

Before production, the final signed memo should answer and evidence:

1. applicable GAAP framework, functional currency, presentation currency, and
   management-subledger relationship;
2. project contribution recognition model and event;
3. conditional award, payout request, initiation, and final payout recognition;
4. user ownership/payable/expense timing consistent with counsel's contract view;
5. gross/net and principal/agent presentation;
6. all three fee classifications and GST/HST treatment;
7. fiat/stablecoin/token classification and measurement by asset;
8. product versus statutory FX, gain/loss, depeg, and manual-rate policy;
9. expiry/carryover, refunds, disputes, chargebacks, reserves, losses, and
   abandoned-property implications;
10. tax, withholding, information-reporting, and records obligations;
11. final chart of accounts, journal templates, reconciliations, close controls,
    materiality, and approval authority; and
12. transition/opening-balance treatment for every legacy financial row.

The approval record must identify the accountant, professional capacity, scope,
documents and code/version reviewed, assumptions, unresolved qualifications,
signature/equivalent evidence, and approval date.

## 14. Explicit non-conclusions

This memo does not conclude:

- that FundLoop's ownership wording determines economic substance;
- that project receipts are revenue, deferred revenue, restricted funds, or a
  liability;
- when a user obligation or distribution expense arises;
- whether FundLoop is principal, agent, custodian, trustee, employer, payer, money
  services business, or payment service provider;
- FundLoop's functional currency or applicable GAAP framework;
- the classification or measurement of any stablecoin or token;
- GST/HST, income-tax, withholding, recipient-reporting, or records treatment; or
- that the current chart or illustrative event map is approved for production.

## 15. Primary sources for review

Accessed August 8, 2026; reviewers must verify currency and applicability:

- [CRA crypto-asset tax obligations](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/cryptocurrency-guide/crypto-assets-tax-obligations.html)
- [CRA books and records for crypto assets](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/cryptocurrency-guide/books-records-crypto.html)
- [CRA valuing crypto assets](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/cryptocurrency-guide/value-crypto.html)
- [IAS 21, The Effects of Changes in Foreign Exchange Rates](https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/)
- [IFRS Interpretations Committee cryptocurrency agenda decision](https://www.ifrs.org/projects/completed-projects/2019/holdings-of-cryptocurrencies/tad-holdings-of-cryptocurrencies/)
- [Bank of Canada PSP registration criteria](https://www.bankofcanada.ca/2026/06/criteria-for-registering-payment-service-providers/)
- [FINTRAC money services businesses guidance](https://fintrac-canafe.canada.ca/msb-esm/msb-eng)

## 16. Production gate

Neutral schema and shadow testing may proceed locally and on `dev`. Production
posting templates, live fund receipt, allocation, definitive award/payable
presentation, and payout remain disabled until counsel and the accountant approve
the final contracts, classification, chart, journals, controls, tax treatment, and
provider topology through the launch record defined in [README.md](./README.md).
