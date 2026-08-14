# DRAFT - NOT APPROVED - NOT EFFECTIVE

## Counsel redline register

This register makes the requested decisions reviewable without pretending to supply
legal conclusions. Counsel should redline the exact hashed Terms and Privacy drafts,
reference the decision identifier below, and return conditions that engineering can
test. Unchanged text is not deemed approved by silence.

| Decision identifier | Draft locations for redline | Required conclusion | Runtime consequence while pending |
| --- | --- | --- | --- |
| `ownership-refunds-escrow` | Terms §§5-6; Privacy §§3-5; data-flow receipt/custody rows | Classify title, refund rights, trust/escrow/custody, insolvency, consumer and payment-law effect | Live receipt, refund policy activation, and value flow remain disabled |
| `payout-ownership-and-finality` | Terms §§8-9; accounting memo §§3.3 and 5 | Define when legal ownership, debt, expense, asset derecognition, and final settlement occur | Payout execution and production posting remain disabled |
| `holds-expiry-and-carryover` | Terms §§9-10; accounting memo §§3.3, 5 and 10 | Approve hold/review rights, notice/appeal, expiry clock, reserved-claim treatment, abandoned-property and carryover consequences | Conditional records remain non-authoritative shadow state |
| `sanctions-and-payment-regulation` | Terms §§2, 6, 9 and 16; Privacy §§4, 6 and 9 | Determine RPAA/PSP, FINTRAC/MSB, sanctions, safeguarding, reporting, screening and incident obligations | Provider and payout production controls remain false |
| `privacy-consent-and-invitations` | Terms §13; Privacy §§3-12; data-flow identity/profile/invitation rows | Approve authority, minimization, project sharing, processor roles, transfers, retention, deletion and rights | Only review-status documents and affirmative invitation/profile controls may run locally/dev |
| `governing-law-and-disputes` | Terms §§18-19 | Draft enforceable governing-law, venue, mandatory-rights, limitation, dispute and remedy language for actual customer classes | No effective Terms version may be published |
| `prominent-disclosures-and-acceptance` | Terms §§1, 7-12 and 20; Privacy §§1, 8-10; public review pages | Approve decision-point experimental, no-guarantee, fee/FX, chain-publicity, no-refund and reacceptance disclosures | Review preview remains non-effective and cannot authorize value flow |

## Redline return requirements

For every row, the reviewer should return: the exact packet digest, proposed text,
accepted/rejected assumptions, reasons, legal sources relied upon, conditions,
expiry, re-review triggers, and whether the mapped runtime control is sufficient.
Engineering must record each condition as a testable disposition. Task #184, not
this draft register, owns accepting genuine professional conclusions.
