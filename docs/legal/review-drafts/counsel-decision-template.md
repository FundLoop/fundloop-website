# DRAFT - NOT APPROVED - NOT EFFECTIVE

## Qualified Canadian counsel decision record template

- Packet identifier: `fundloop-ca-counsel-review-2026-08-14-v1`
- Packet SHA-256: copy from `counsel-review-packet.json` after independently verifying it
- Decision identifier: **required**
- Reviewer name: **blank until completed by the engaged reviewer**
- Professional status and jurisdiction: **blank until completed by the engaged reviewer**
- Engagement reference and scope: **blank until completed by the engaged reviewer**
- Decision date: **blank**
- Decision: **approve / approve with conditions / reject / further facts required**
- Conditions and expiry: **blank**
- Re-review triggers accepted or amended: **blank**
- Engineering disposition: **blocked until the signed record is independently validated**

This template is not a signature, approval, legal opinion, or production authority.
Repository contributors must not complete professional qualifications or conclusions
on a reviewer's behalf. A completed record must identify the exact packet digest,
the reviewed assumptions, exceptions, conditions, expiry, and required engineering
changes. Task #184 owns validation and incorporation of genuine professional
conclusions; this Task only prepares the review materials.

## Reviewer checklist

1. Verify every source and runtime SHA-256 in the packet against the supplied
   repository checkout.
2. Record whether each product description matches the actual data flow and runtime
   control. List every mismatch rather than approving by implication.
3. Redline the Terms and Privacy drafts using the decision identifiers in the
   redline register.
4. State the legal classification, required controls, user-facing disclosure, and
   non-waivable rights for the decision.
5. State implementation conditions and the evidence needed to close them.
6. Identify facts or provider agreements that were unavailable and prevent a
   conclusion.
7. Sign and date the final record outside this draft template using the engaged
   professional's normal authenticated process.

## Engineering intake fields

| Field | Required value |
| --- | --- |
| Decision identifier | Exact identifier from the packet manifest |
| Outcome | Qualified reviewer's explicit outcome |
| Approved artifact hashes | Exact hashes reviewed by counsel |
| Conditions | Discrete, testable requirements |
| Re-review triggers | Provider, jurisdiction, product, policy, or runtime changes |
| Implementation owner | Named FundLoop owner after review |
| Verification evidence | PR, test, deployment, and hosted evidence identifiers |
| Production disposition | Remains blocked until Task #184 validates the genuine record |
