# DRAFT - NOT APPROVED - NOT EFFECTIVE

## Fundloop Canada review packet

- Status: review material only
- Entity: Fundloop Canada Inc.
- Formation jurisdiction: Ontario, Canada
- Initial project and user jurisdiction: Canada
- Proposed governing law and dispute venue: Ontario, Canada, subject to counsel
- Prepared: August 8, 2026
- Effective date: none
- Production use: prohibited until every approval gate below is complete

These documents translate approved product intent into questions and draft language
for qualified Canadian counsel and an accountant. They are not legal advice,
accounting advice, effective terms, a published privacy notice, or authority to
receive, allocate, or pay live funds.

## Packet contents

1. [Terms review draft](./terms-canada.md)
2. [Privacy Notice review draft](./privacy-notice-canada.md)
3. [Repository-grounded data-flow inventory](./data-flow-inventory.md)
4. [Accounting-recognition review memo](./accounting-recognition-memo.md)
5. [Versioned counsel review packet manifest](./counsel-review-packet.json)
6. [Counsel redline register](./counsel-redline-register.md)
7. [Qualified counsel decision record template](./counsel-decision-template.md)

The manifest binds these drafts and the mapped runtime controls to exact SHA-256
digests. Run `node scripts/verify-counsel-review-packet.mjs` before supplying the
packet for review. A digest match proves only which bytes were reviewed; it is not
an approval. The blank decision template must be completed by genuinely engaged,
qualified Canadian counsel and independently incorporated under Task #184.

The drafts intentionally use `proposed`, `intended`, and `subject to review` where
FundLoop has made a product decision but a professional must determine the legal,
regulatory, accounting, or tax consequence.

## Production approval gate

Production receipt, allocation, definitive policy activation, and payout remain
disabled until one immutable launch record links all of the following:

- [ ] qualified Canadian counsel identity, engagement scope, date, and written
      approval of the final Terms and Privacy Notice;
- [ ] counsel's written classification or required implementation plan for the
      Retail Payment Activities Act, FINTRAC/MSB obligations, sanctions, consumer
      protection, securities/derivatives, custody/insolvency, and enforceability;
- [ ] qualified accountant identity, applicable Canadian GAAP framework, date, and
      written approval of recognition, presentation, functional currency, token,
      FX, fee, tax, and control treatment;
- [ ] final provider topology and agreements for Stripe, Supabase, Vercel, Cubid,
      email, Base RPC/paymaster/Safe, including data-processing and cross-border
      terms that apply to the selected plans;
- [ ] final data inventory, retention schedule, privacy officer/contact, incident
      process, subprocessors, and user-rights workflow;
- [ ] final document identifiers, immutable hashes, locales, effective dates,
      acceptance surfaces, material-change/reacceptance rules, and rollback plan;
- [ ] evidence that production UI copy matches the approved source documents and
      that experimental/no-guarantee/no-escrow/no-refund language is prominent at
      the relevant decision point rather than hidden in fine print;
- [ ] production readiness review confirming that no code path can bypass legal,
      accounting, identity, sanctions, settlement, treasury, or payout controls.

An experimental warning is a disclosure, not an exemption or control bypass.
Contract language saying Fundloop owns contributed funds or is not an escrow
provider does not by itself determine Fundloop's regulatory, insolvency, tax, or
accounting classification.

## Primary review sources

All links were accessed August 8, 2026. A reviewer must recheck currency before
approval.

- [PIPEDA, Justice Laws Website](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/)
- [PIPEDA fair information principles, Office of the Privacy Commissioner](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/)
- [Meaningful consent guidance, Office of the Privacy Commissioner](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/)
- [Ontario Electronic Commerce Act, 2000](https://www.ontario.ca/laws/statute/00e17)
- [Ontario Consumer Protection Act, 2002](https://www.ontario.ca/laws/statute/02c30)
- [Bank of Canada PSP registration criteria](https://www.bankofcanada.ca/2026/06/criteria-for-registering-payment-service-providers/)
- [FINTRAC money services businesses guidance](https://fintrac-canafe.canada.ca/msb-esm/msb-eng)
- [Canadian sanctions consolidated list](https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/consolidated-consolide.aspx)
- [CRA crypto-asset tax obligations](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/cryptocurrency-guide/crypto-assets-tax-obligations.html)
- [IFRS Interpretations Committee cryptocurrency agenda decision](https://www.ifrs.org/projects/completed-projects/2019/holdings-of-cryptocurrencies/tad-holdings-of-cryptocurrencies/)

## Change control

Edits to these files do not change an effective policy. A future approved source
must receive a new immutable document identifier and content hash. Draft history is
retained for review provenance and must never be relabelled as approved merely by
changing a status field.
