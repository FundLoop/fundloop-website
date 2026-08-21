# DRAFT - NOT APPROVED - NOT EFFECTIVE

## Fundloop Canada Inc. Privacy Notice review draft

- Document status: privacy/counsel-review draft only
- Document identifier: `fundloop-privacy-ca-review-draft-2026-08-08`
- Effective date: none
- Intended initial territory: Canada
- Accountable organization: Fundloop Canada Inc.
- Privacy officer/contact: **required before approval**

> Reviewer instruction: This draft is mapped to the accompanying
> [data-flow inventory](./data-flow-inventory.md). It must not replace the live
> Privacy page until counsel approves the final text, the inventory and retention
> schedule are verified, provider terms are confirmed, and the production gate in
> [README.md](./README.md) is complete.

## 1. Our privacy commitment

FundLoop's product intent is not to sell or rent personal information or disclose
it voluntarily for unrelated third-party marketing. FundLoop must nevertheless
collect, use, transfer, and disclose information to operate the service, work with
processors and independent providers, complete identity and payment workflows,
share approved profile information, use public blockchains, protect the service,
and comply with law.

This is not a promise that information is never shared. The final Notice must name
the categories of recipients, explain cross-border processing and public-chain
exposure, and distinguish required processing from optional choices.

## 2. Scope and accountability

The proposed Notice would apply to FundLoop's websites, applications, accounts,
project workflows, support, monthly allocation, conditional-award, and payout
services for Canadian users and project representatives.

Fundloop Canada Inc. would remain accountable for personal information under its
control, including information transferred to processors. Before approval it must
designate a privacy officer and publish usable contact, access/correction,
complaint, and breach-reporting channels.

## 3. Information we collect

### 3.1 Account and profile information

- email address, authentication identifiers, login/session and security evidence;
- name, avatar, headline, biography, gender, occupation, location, interests, and
  field-level visibility choices;
- invitation code or project invitation state, role, membership, and organization;
- support messages, contact information, browser/device context, and the IP address
  currently fetched from `api.ipify.org` by the support form;
- language, locale, notification, document acceptance, consent, and withdrawal
  evidence.

Profile fields are private by default under the target design. Public publication
and project-member sharing are separate choices; neither is bundled into general
Terms acceptance.

### 3.2 Identity, eligibility, and compliance information

- Cubid identifier and app-scoped identity references;
- whitelist/validation status, uniqueness score or band, timestamps, source, and
  remediation/hold state;
- identity, business, authority, sanctions, fraud, source-of-funds, tax, and
  provider onboarding states required for a workflow;
- project-scoped pseudonyms and eligibility decisions.

Derived scores, wallet addresses, pseudonyms, and compliance decisions may still
be personal information. FundLoop should avoid collecting underlying identity
evidence when a verified status or minimal result is sufficient.

### 3.3 Project and participation information

- project/organization identity, website, description, logo, categories, team and
  role information;
- active-user lists, project-specific user references, contribution/attribution
  rows, review decisions, validation failures, and project communications;
- monthly-cycle inputs, approvals, opt-outs, calculation evidence, allocation
  provenance, reports, and audit artifacts.

Public reports are intended to contain project totals and trends without user
identifiers. Small cells and combinations can still permit inference and require
privacy thresholds and review.

### 3.4 Financial, payout, and blockchain information

- payment rail, fiat/token identity, amount, currency, fees, dates, provider status,
  settlement/finality evidence, disputes, refunds, and reconciliation references;
- conditional awards, source projects, inventory eligibility, requests,
  reservations, queues, holds, payout status, and user-selected fee;
- redacted bank/Stripe route state and connected-account capability requirements;
- wallet address, chain, token contract, native amount, transaction hash, block,
  finality, Safe/paymaster events, and public-chain history;
- accounting, foreign-exchange, tax, sanctions, and audit evidence.

FundLoop should not store raw bank credentials. Public blockchain information
cannot be made private or deleted after confirmation.

### 3.5 Usage, device, and technical information

- IP address, request/session metadata, browser, device, operating system, locale,
  pages/actions, timestamps, errors, security events, and deployment diagnostics;
- cookies, local/session storage, authentication cookies, and any approved analytics
  or observability events;
- RPC/provider request metadata and public contract interactions.

The final Notice and Cookie Policy must reflect the analytics and observability
tools actually enabled in each environment, not merely tools that might be used.

## 4. How we collect information

Information may come directly from a user or project; from another authorized
project member; from Supabase authentication and application activity; from Cubid,
Stripe, financial institutions, Base/Ethereum, Safe, RPC/paymaster services, email
providers, or other selected processors; from public sources and sanctions lists;
or from FundLoop's own calculations, reviews, and security systems.

A project uploading another person's information must have authority and provide
any required notice. FundLoop must minimize project lists and prevent cross-project
identity correlation.

## 5. Purposes and required versus optional processing

FundLoop proposes to process information to:

- create, secure, authenticate, support, and administer accounts;
- create projects, verify authority, invite members, and manage project-scoped
  access;
- validate project packages, identity/uniqueness, sanctions, fraud, and eligibility;
- observe settlement, reconcile custody, calculate fees and allocations, maintain
  conditional awards, reserve inventory, execute/reconcile payouts, and audit the
  monthly epoch;
- provide reports and notifications, investigate problems, prevent abuse, and
  enforce policies;
- maintain financial, tax, security, legal, consent, and incident records; and
- comply with valid legal and regulatory requirements.

Optional processing must be separated and explained at the choice point:

- public profile publication;
- the specific personal-profile fields shared with accepted project members;
- non-essential analytics or measurement; and
- commercial electronic messages.

Withdrawing an optional choice applies prospectively. It does not require deletion
of public-chain data or records FundLoop must retain for legal, financial, security,
fraud, or audit purposes.

## 6. Recipients and disclosures

Subject to final contracts and configuration, information may be transferred or
disclosed to:

| Recipient category | Proposed purpose and boundary |
| --- | --- |
| Supabase | Authentication, Postgres, storage, Edge Functions, logs, backups, and security. Region, subprocessors, plan, DPA, and deletion behavior must be confirmed. |
| Vercel | Web hosting, request processing, deployment/runtime logs, security, and any separately enabled observability. Plan/DPA and processing locations must be confirmed. |
| Cubid | Identity resolution, app-scoped identifier, whitelist/validation, uniqueness, and remediation. Exchange only the minimum required fields. |
| Stripe and financial institutions | Bank-transfer instructions, connected-account onboarding, identity/compliance, payment/payout, fraud, dispute, refund, and reconciliation. Stripe may act as processor and/or independent controller. |
| Base/Ethereum, Safe, RPC/paymaster providers | Public and provider processing of wallet addresses, tokens, amounts, destinations, transaction data, gas sponsorship, and finality. Confirm exact providers and logs. |
| Email and support providers | Authentication, transactional, security, project/cycle, remediation, support, and separately consented marketing communications. Provider is not yet selected in this draft. |
| Project members | Only after affirmative invitation acceptance, and only the disclosed project-scoped fields needed for the authorized role. No pre-acceptance or unrelated-project access. |
| Public audiences | Only information affirmatively published by the user, approved project information, privacy-reviewed reports, and unavoidable public-chain data. |
| Professional advisers, auditors, insurers, transaction counterparties | Confidential advice, assurance, risk, financing, corporate transaction, or claim handling subject to appropriate controls. |
| Authorities and other parties required by law | Valid legal process, sanctions/AML/payment/tax reporting, emergencies, protection of rights, and investigation of fraud or security incidents. Scope and notice are subject to law. |

FundLoop would not permit a processor to use information for unrelated purposes
merely because it receives data to provide its service. Provider terms and actual
roles must be reviewed before approval.

## 7. Cross-border processing

Suppliers may process information outside Canada, including in the United States
and other countries where they or their subprocessors operate. Information may be
subject to the laws and lawful access regimes of those places. FundLoop remains
accountable for processor transfers under its control and must use contractual and
organizational measures appropriate to the risk.

Before approval, the final inventory must state selected regions, relevant
subprocessors, transfer terms, backup/log locations, and any material provider role
as an independent controller.

## 8. Public blockchain information

Base is an Ethereum layer-two network whose transaction data is submitted to
Ethereum. Confirmed transaction information can be globally visible, persistent,
copied, indexed, and correlated. FundLoop and its processors cannot delete or
control third-party copies.

Before a user supplies an onchain destination, the product should prominently
explain that wallet address, asset, amount, destination, timestamp, transaction
hash, and related activity may become public. FundLoop must not publish additional
offchain identity mappings.

## 9. Consent, contract, and other authority

The final Notice and user interfaces must explain what information is required for
the requested service and what choices are optional. Consent requests should be
understandable, specific, unbundled, and proportionate to sensitivity and
reasonable expectations.

Counsel must identify the appropriate authority for each processing purpose,
including service performance, legal duties, fraud/security, public profiles,
project-member sharing, analytics, commercial email, identity/compliance, and
public blockchain processing. This draft does not decide that analysis.

## 10. Retention and deletion

FundLoop proposes event-based retention rather than one blanket period. The final
schedule requires counsel/accountant approval and provider verification.

| Record class | Proposed trigger | Review question |
| --- | --- | --- |
| Account/profile | Account closure plus support/security window | What period supports disputes, fraud, tax, and access rights? |
| Optional public profile | Consent withdrawal | Remove promptly from FundLoop public discovery; retain only separately justified records. |
| Pending invitation | Acceptance, decline, revocation, or expiry | How long are safe invitation metadata and audit evidence required? Raw tokens must not persist. |
| Identity/compliance | Last relevant workflow or hold closure | Minimize raw evidence; determine statutory KYC/AML/sanctions periods if applicable. |
| Project packages and allocations | Epoch close/expiry | Coordinate contract, audit, tax, regulatory, and limitation periods. |
| Financial/payout/accounting | Final reconciliation or reversal | CRA guidance commonly requires long-lived books and records; accountant must set the exact policy. |
| Public blockchain | Confirmation | FundLoop cannot delete the chain; minimize retained offchain mappings. |
| Security/audit/consent | Event or superseding version | Retain sufficient immutable evidence without retaining unrelated content. |
| Support and communications | Request closure or consent withdrawal | Separate operational, legal, and marketing evidence. |
| Provider logs/backups | Provider-created event | Verify actual rotation, backup expiry, deletion lag, and legal holds. |

Deletion must propagate to active systems and processors where required and
possible. Backups may age out on a documented schedule. Deletion does not apply to
immutable public-chain data or records subject to a lawful retention obligation.

## 11. Safeguards and incidents

FundLoop proposes role-scoped access, row-level security, least privilege, strong
authentication, secret isolation, encryption in transit and at rest where
applicable, append-only financial evidence, environment separation, audit logs,
provider reconciliation, monitoring, tested backups, secure deletion, and incident
response.

Sensitive identity and financial information requires heightened safeguards. Before
production, FundLoop must appoint incident owners, maintain breach records, and
implement assessment, containment, notification, and regulator-reporting procedures
required by applicable law. No system can guarantee absolute security.

## 12. Individual rights and choices

Subject to applicable exceptions, the final service should provide a practical way
to:

- request access to personal information and an account of its use/disclosure;
- correct inaccurate information;
- withdraw optional consent prospectively;
- make a privacy complaint or challenge compliance;
- obtain information about policies, recipients, safeguards, and cross-border
  processing; and
- request deletion where FundLoop has no lawful need or obligation to retain it.

FundLoop must verify identity before responding and explain any refusal and review
route. A privacy contact and service standard are required before approval.

## 13. Children

The intended service is for adults 18 and older. FundLoop does not intend to collect
children's information. The final policy and controls must state how suspected
underage accounts are handled.

## 14. Changes and version evidence

The final Notice would have an immutable identifier, hash, locale, effective date,
summary of material changes, and archived prior versions. Material new purposes or
choices would receive appropriate notice and consent before the affected action.
Draft edits are not effective changes.

## 15. Contact and complaints

Before approval, insert Fundloop Canada Inc.'s service address, privacy officer,
privacy email, support contact, and any required regulator/complaint information.
No placeholder may be published as effective.

## 16. Questions requiring privacy/counsel approval

1. Which processing falls under PIPEDA or other federal/provincial privacy rules for
   the initial and future business model?
2. Which purposes rely on meaningful consent, contract necessity, legal duty, or
   another authority, and which choices must be express?
3. What exact fields do Cubid, Stripe, Supabase, Vercel, email, RPC/paymaster, Safe,
   and future analytics providers receive, retain, derive, or control?
4. Which providers are processors versus independent controllers, where is data
   processed, and which DPA/subprocessor/transfer terms apply to the selected plan?
5. What retention period and deletion workflow applies to each inventory class?
6. Which identity, compliance, financial, tax, sanctions, consent, and incident
   records must be immutable or retained despite withdrawal/deletion requests?
7. What public-report thresholds prevent re-identification from exact small cells?
8. What privacy officer, complaint, access/correction, and breach processes must be
   operational before launch?

No answer is supplied by this draft.

## 17. Primary sources for review

Accessed August 8, 2026; reviewers must verify currency:

- [PIPEDA](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/)
- [Office of the Privacy Commissioner: PIPEDA principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/)
- [Office of the Privacy Commissioner: meaningful consent](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/)
- [Office of the Privacy Commissioner: cross-border processing guidance](https://www.priv.gc.ca/en/privacy-topics/airports-and-borders/gl_dab_090127/)
- [Stripe Canada Privacy Policy](https://stripe.com/en-ca/privacy)
- [Stripe Data Processing Agreement](https://stripe.com/legal/dpa)
- [Supabase Data Processing Addendum](https://supabase.com/legal/customer-resources/data-processing-addendum)
- [Vercel Data Processing Addendum](https://vercel.com/legal/dpa)
- [Base protocol overview](https://docs.base.org/base-chain/specs/protocol/overview)
