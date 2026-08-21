# FundLoop improvement suggestions

Review date: 2026-08-13
Status: product-direction proposal for discussion
Companion document: [FundLoop business red-team critique](./README.md)

## Scope and non-goal

This document responds to the weaknesses identified in the business red-team
critique. It proposes ways to make FundLoop easier to understand, safer to operate,
more honest about its MVP, and simpler for projects and participants to adopt.

It does **not** propose replacing FundLoop's product thesis. FundLoop remains an
opt-in economic network in which projects voluntarily fund rewards for verified
participants, the network coordinates a monthly allocation, and people can receive
value for participating in projects that choose to reward them.

The objective is to preserve that thesis while sharply improving:

- truthfulness about the MVP and the intended privacy transition;
- simplicity at the project and participant boundaries;
- isolation of the sensitive allocation process;
- clarity and predictability of fees and allocation policy;
- reporting as the primary evidence of value;
- integration ergonomics for developers and agents;
- proof through real concierge pilots; and
- discipline about what FundLoop will stop building.

## Sprint #155 disposition tags

The annotations below map these recommendations to
[Sprint #155](https://github.com/FundLoop/fundloop-website/issues/155) as scoped on
2026-08-13. They describe **coverage in the Sprint's accepted Task scope**, not a
claim that every linked Task is complete or deployed. The live Task lifecycle remains
the source of truth for implementation status.

- **Addressed in Sprint scope** means a Task's objective or acceptance criteria
  directly require the recommendation's outcome.
- **Partially addressed in Sprint scope** means the Sprint supplies an important
  control, proof, or prerequisite, but leaves material product work for later.
- **Deliberate Sprint variance** means Sprint #155 intentionally does something
  broader or differently sequenced than this proposal. The variance is recorded so
  it can be evaluated rather than mistaken for silent roadmap drift.
- **Accepted MVP bypass** means the recommendation remains desirable, but the MVP
  is explicitly allowed to ship with a narrower or less private implementation.
  These items must stay visible on the roadmap, but are not Sprint #155 release
  blockers unless a linked Task says otherwise.

### 2026-08-13 implementation and deferral map

This table is the authoritative cross-reference for how the recommendations below
relate to the approved MVP. A linked Task owns only the outcome stated in its issue;
the link does not imply that the entire recommendation is implemented.

| Sections | MVP disposition | Current implementation owner | Deferred owner or decision |
| --- | --- | --- | --- |
| 1 and 3 | Partial | FundLoop [#168](https://github.com/FundLoop/fundloop-website/issues/168), [#172](https://github.com/FundLoop/fundloop-website/issues/172), and [#183](https://github.com/FundLoop/fundloop-website/issues/183) cover truthful capability, governance, and hosted-language evidence. | Product-wide terminology and experimental-policy copy remain post-Sprint work. |
| 2 | Accepted MVP bypass | Existing Goal 2 funding-source and accounting evidence supports the current approved funding paths. | Voluntary funding-choice product design belongs in post-Sprint Feature 2 or 3 below. |
| 4, 5, and 8 | Accepted MVP bypass | FundLoop #183 verifies the hosted current story and role journeys. | The belief-led landing page, audience split, and multi-answer accordion belong in post-Sprint Feature 1. |
| 6 and 7 | Partial | FundLoop [#181](https://github.com/FundLoop/fundloop-website/issues/181), [#182](https://github.com/FundLoop/fundloop-website/issues/182), and #183 cover reports, claims, and hosted founder/participant evidence. | Few-minute integration and broader UX simplification belong in post-Sprint Features 1 and 2. |
| 9 and 9.1 | Deliberate MVP variance | FundLoop [#204](https://github.com/FundLoop/fundloop-website/issues/204) owns the allocator field/access boundary, allocator-only logical tables, currency propagation, and FundLoop integration. Cubid [Feature #77](https://github.com/Cubid-Me/cubid-monorepo/issues/77), [Goal #78](https://github.com/Cubid-Me/cubid-monorepo/issues/78), and Tasks [#79](https://github.com/Cubid-Me/cubid-monorepo/issues/79), [#80](https://github.com/Cubid-Me/cubid-monorepo/issues/80), and [#81](https://github.com/Cubid-Me/cubid-monorepo/issues/81) own the private scoped-ID/score API, resolution, and handoff. FundLoop #188 publishes the combined Goal 2 evidence. | FundLoop may retain identity joins before/after allocation and return per-project claims during MVP. Project claims become currency claims, unnecessary retained project correlation is removed, and a physically separate allocator datastore is evaluated in privacy v2. |
| 9.2 | Accepted MVP bypass | #204 keeps ZK claims explicitly unavailable. | Alias separation, proofs, circuits, and administrator-collusion resistance belong in post-Sprint Feature 5. |
| 9.3 | Accepted MVP bypass | FundLoop #168 and [#184](https://github.com/FundLoop/fundloop-website/issues/184) cover governance prerequisites only. | The secondary-account and consented email-list product belongs in post-Sprint Feature 2 and is not part of the allocator MVP. |
| 10 | Partial | FundLoop #183, #184, and #204 bind current privacy claims and negatives. | The prominent public privacy narrative belongs in post-Sprint Feature 1. |
| 11 and 12 | Partial | FundLoop [#165](https://github.com/FundLoop/fundloop-website/issues/165), [#169](https://github.com/FundLoop/fundloop-website/issues/169), #181, and [#186](https://github.com/FundLoop/fundloop-website/issues/186) cover fee/FX/cap evidence and explanation. | Final fee payer/model and stable cap policy belong in post-Sprint Feature 3. |
| 13 and 14 | Partial | FundLoop #169, [#170](https://github.com/FundLoop/fundloop-website/issues/170), #172, [#173](https://github.com/FundLoop/fundloop-website/issues/173), #184, and #204 cover release, custody, governance, and phase boundaries. | Public sub-one-year commitment and final custody model require later product and professional decisions. |
| 15 | Addressed in Sprint scope | FundLoop #181 and #183 implement and verify audience-scoped reporting; #204 constrains allocator-originated fields. | Pilot comprehension and correlation research remain part of post-Sprint Feature 4. |
| 16 | Partial | Cubid #79-#81 provide the private allocator integration contract; FundLoop #204 consumes it. | The public ten-minute quickstart, external SDK/API, and webhook product belong in post-Sprint Feature 2. |
| 17 and 18 | Accepted MVP bypass | Sprint #155 supplies no-value acceptance and evidence prerequisites. | Real concierge pilots and pre-committed kill criteria belong in post-Sprint Feature 4. |
| 19 | Deliberate Sprint variance | FundLoop #165, [#166](https://github.com/FundLoop/fundloop-website/issues/166), and #186 finish bounded safety and production-readiness evidence. | After Sprint #155, further rail, asset, formula, or platform breadth requires a written exception tied to a pilot or safety need. |
| 20 | Partial | FundLoop #169, #172, and #184 create scoped accounting, release, and governance evidence. | A unified product-level decision register belongs in post-Sprint Feature 3 or 4. |

Two allocator-specific clarifications apply throughout this document:

1. FundLoop's own project membership and user self-identification data has no role
   in allocator input selection. The allocator receives project-scoped UUIDs, not
   FundLoop membership rows or raw participant identity.
2. The MVP may bind FundLoop users to per-project claims before and after
   calculation so the logic can be validated. The privacy boundary limits what the
   allocator can read and emit; it does not require FundLoop to erase those joins in
   v1.

## 1. Product principles

The improvements should be governed by six principles.

### 1.1 Preserve the ambition, narrow the near-term proof

FundLoop may retain its long-term identity as a shared rewards platform, a
privacy-preserving coordination system, a public-goods mechanism, and an
alternative approach to broad economic distribution. The MVP does not have to
prove every part of that future simultaneously.

The near-term proof is narrower:

> Can projects fund a monthly program, submit privacy-minimized participant
> references, let FundLoop calculate a defensible result, and receive trustworthy
> reports while participants successfully collect rewards?

### 1.2 Absorb complexity inside FundLoop

FundLoop's internal architecture may be complex because money, identity, privacy,
reconciliation, and reporting are complex. That complexity should not be exported
to projects or participants.

The external experience should be simple enough to describe in one short paragraph
for each audience. If a founder, developer, or participant must understand the
ledger, allocator, custody topology, or reconciliation state machine to join, the
product boundary has failed.

### 1.3 State the current phase before describing the future

> **Partially addressed in Sprint #155:**
> [Task #172](https://github.com/FundLoop/fundloop-website/issues/172) requires
> truthful capability labels and a refreshed release capability review;
> [Task #183](https://github.com/FundLoop/fundloop-website/issues/183) tests the
> public story across three languages; and
> [Task #204](https://github.com/FundLoop/fundloop-website/issues/204) requires the
> MVP, future ZK flow, and consented-PII flow to remain distinct. The broader public
> roadmap and landing-page rewrite remain post-Sprint work.

Every public claim should clearly distinguish:

- what is true in the non-zero-knowledge MVP;
- what conventional privacy controls protect today;
- what FundLoop administrators can still see;
- what is experimental or operator-selected;
- what is planned for the full launch; and
- what has been proven in production rather than merely implemented.

### 1.4 Treat experiments as experiments

The current fee positions and dynamic cap multiplier are learning mechanisms. They
should be presented as bounded prototype controls with published decision dates,
not as permanent economic doctrine.

### 1.5 Make reporting the proof layer

> **Addressed in Sprint #155 scope:**
> [Task #181](https://github.com/FundLoop/fundloop-website/issues/181) makes
> deterministic audience-specific report generation, publication, explanation,
> retention, privacy enforcement, and hosted verification a release requirement.

FundLoop should not ask projects or participants to trust a complicated mechanism
without intelligible evidence. Reporting should explain the monthly outcome without
exposing the cross-project identity graph.

### 1.6 Stop treating breadth as progress

> **Deliberate Sprint variance:** Sprint #155 finishes and validates already-selected
> production-readiness surfaces before imposing the narrower post-Sprint product
> boundary. [Task #165](https://github.com/FundLoop/fundloop-website/issues/165),
> [Task #166](https://github.com/FundLoop/fundloop-website/issues/166), and
> [Task #186](https://github.com/FundLoop/fundloop-website/issues/186) are the main
> exceptions. They are bounded evidence and safety work, not evidence that continued
> rail, asset, or formula expansion should count as product progress.

Additional chains, assets, formulas, governance systems, and agent operations do
not establish product-market fit. Near-term progress means fewer steps for projects,
fewer steps for users, clearer reports, successful real payouts, renewal, and
privacy-preserving evidence.

## 2. Replace the mandatory revenue pledge with voluntary funding choices

The one-percent pledge can remain an important cultural signal and an available
commitment model, but it should not be the mandatory entrance condition for every
project or use case.

Projects should be able to choose a recurring funding policy that fits their
purpose, for example:

- a percentage of revenue;
- a fixed monthly amount;
- a time-limited pilot budget;
- a grant-funded distribution budget;
- a recurring community or contributor reward pool; or
- a one-time funded epoch.

The project profile and reports should identify the selected commitment truthfully.
FundLoop can still recognize projects that voluntarily pledge one percent or more,
but it should not imply that a revenue share is the only legitimate form of
participation.

This broadens the set of credible early adopters without abandoning the voluntary
give-back thesis. It also accommodates organizations that do not have conventional
revenue, including humanitarian programs, foundations, cooperatives, grant-funded
projects, municipalities, and experimental UBI pilots.

The following questions must be explicit during setup:

- What is the funding rule?
- What period does it cover?
- Is the amount fixed, formula-based, or discretionary?
- When does it become final for the epoch?
- What fees apply?
- What happens if funds arrive late or the project opts out?
- What happens to value that cannot be paid?

## 3. Use reward language without promising income

> **Partially addressed in Sprint #155 scope:**
> [Task #183](https://github.com/FundLoop/fundloop-website/issues/183) requires the
> hosted public story to distinguish current, hosted, and pending capabilities, while
> [Task #168](https://github.com/FundLoop/fundloop-website/issues/168) packages the
> relevant policy, payment, reporting, consent, and disclosure claims for legal
> review. Neither Task, by itself, completes the product-wide terminology migration.

FundLoop should remove words such as **income**, **salary**, and **entitlement** from
its direct product promise unless a specific, legally reviewed context supports
them. These words imply regularity, ownership, enforceability, or employment-like
rights that the MVP does not provide.

Preferred public terms include:

- monthly reward;
- participant reward;
- project-funded reward;
- estimated reward;
- approved reward;
- available reward balance;
- payout request;
- payout sent; and
- payout settled.

The lifecycle should remain explicit:

| Stage | Meaning |
| --- | --- |
| Estimated | A non-final preview based on current inputs. |
| Calculated | The allocator produced a result, but review is incomplete. |
| Approved | The monthly result passed the required review. This label alone must not imply payment. |
| Available | The approved amount is backed and open for a payout request under the applicable rules. |
| Requested | The participant selected an eligible route and requested payment. |
| Sent | A provider or network accepted the payout instruction. |
| Settled | External evidence confirms the final movement of value. |
| Held, failed, returned, or expired | The amount did not settle; the exact reason and next action must be visible. |

Terms such as **salary**, **citizen salary**, **UBI**, and **income** can still appear
in compare-and-contrast material. The distinction should be prominent:

> While nation states are contemplating UBI and citizen salary, FundLoop is
> building an alternative based on opt-in, voluntary, project-funded reward
> mechanisms. FundLoop rewards are not wages, guaranteed income, or a government
> benefit.

Likewise, **entitled** should not be used as shorthand for a calculated or approved
amount. Project reports can instead say which users were **eligible**, which
rewards were **approved**, which became **available**, and which were **settled**.

## 4. Make the landing page belief-based

The home page should explain FundLoop's counter-narrative before listing product
features.

### 4.1 The unspoken compromise in the reward category

Most user-reward systems make at least one of these compromises:

- projects observe and retain detailed user behaviour to prove activity;
- users surrender privacy in exchange for rewards;
- rewards are trapped inside one platform or loyalty silo;
- weak identity controls make programs vulnerable to duplicate accounts and bots;
- strong identity controls expose too much identity to each project;
- projects must build their own allocation and payout machinery;
- a centralized operator makes an opaque decision about who deserves value; or
- reward marketing promises more certainty than the payment system can deliver.

The underlying category belief is often: **useful rewards require surveillance,
closed platforms, or fraud-prone pseudonymity**.

### 4.2 FundLoop's counter-narrative

FundLoop should state a clear alternative:

> Projects should be able to voluntarily share value with real participants
> without building a financial operating system, and people should be able to
> participate across projects without giving every project a complete view of who
> they are or where else they participate.

Supporting beliefs can include:

1. Projects should choose whether and how much value to contribute.
2. People should be rewarded for genuine participation without being required to
   become a public profile or an advertising identity.
3. Proof of humanity should reduce duplication without making identity universally
   visible.
4. Allocation should be reproducible and challengeable, not mystical.
5. A calculated amount is not a payment; the product should say exactly where value
   is in its lifecycle.
6. Projects should receive evidence of the program's operation without receiving a
   cross-project map of participants.
7. Technical complexity should make participation simpler, not more complicated.

### 4.3 Avoid a feature pitch disguised as philosophy

Belief-based positioning becomes hollow if every belief immediately resolves into
a feature list. The landing page should first define the category problem and the
alternative standard. Product mechanics should appear later as evidence that
FundLoop is attempting to satisfy that standard.

The page should not claim that the standard has already been achieved where the MVP
still relies on conventional privacy controls or manual operator decisions.

## 5. Split the public experience into project-facing and participant-facing sites

After the belief-led home page, detailed material should separate into two coherent
audience journeys.

### 5.1 Persistent audience selector

The primary navigation should include a visible selector such as:

```text
[ For people ]  ◉────────○  [ For projects ]
```

The selected side should be unmistakable through:

- a sliding indicator in the navigation;
- a restrained transition when the audience changes;
- distinct audience labels and calls to action;
- an optional subtle colour or illustration shift;
- preserved selection while navigating relevant pages; and
- an accessible, reduced-motion alternative.

This is not two separate brands. It is two views of the same loop. The transition
should visually communicate that people and projects occupy opposite sides of one
shared monthly system.

### 5.2 Home-page role

The shared landing page should contain only:

- the belief and counter-narrative;
- a concise statement of the voluntary monthly loop;
- the honest MVP privacy disclosure;
- the audience selector;
- a short explanation of what FundLoop is; and
- links into the two detailed journeys.

Allocation mechanics, payment setup, integration steps, participant instructions,
reports, and use cases should move into the relevant audience experience.

## 6. Make project participation obviously simple

> **Partially addressed in Sprint #155 scope:**
> [Task #183](https://github.com/FundLoop/fundloop-website/issues/183) exercises a
> hosted founder journey and [Task #181](https://github.com/FundLoop/fundloop-website/issues/181)
> completes founder-facing reporting. Sprint #155 does not yet prove the promised
> few-minute SDK onboarding or build the tech-agnostic project path.

The project-facing site should lead with the operational simplicity FundLoop is
trying to create:

> Set up your organization profile in a few minutes. Install the CUBID SDK, add one
> project-scoped identifier column to your user model, fund a monthly or recurring
> reward, and send the project-scoped CUBID identifiers for eligible participants.
> FundLoop handles allocation, payout preparation, and privacy-preserving reports
> showing how many participants were scored, approved, made available for payout,
> and ultimately paid.

This copy must be validated against the actual integration. If additional steps are
required for authorization, consent, webhooks, reconciliation, or provider setup,
they should be disclosed rather than hidden. The product goal remains to make the
happy path genuinely match the short explanation.

### 6.1 Project onboarding sequence

The visible setup should be organized into five tasks:

1. **Create the project profile.** Identify the organization, accountable operator,
   public description, and program purpose.
2. **Connect CUBID.** Install the SDK or use an approved integration so the project
   stores project-scoped identifiers rather than global FundLoop identities.
3. **Choose the reward commitment.** Select a fixed amount, percentage, grant
   budget, or pilot budget and a recurrence policy.
4. **Send the monthly cohort.** Submit the project ID and the project-scoped CUBID
   identifiers that qualify under the project's disclosed participation rule.
5. **Review the report.** See validation counts, exclusions, aggregate scores,
   approved rewards, payout availability, settlement totals, and exceptions without
   receiving the cross-project identity graph.

### 6.2 Project-facing use cases

The site should demonstrate the breadth of the thesis through concrete programs,
not abstract platform labels:

- **Local UBI experiment:** an organization creates an opt-in UBI pilot for
  privacy-protected participants in a town or another geo-fenced area.
- **Humanitarian relief:** a relief fund establishes recurring support for verified
  humans in a disaster area while minimizing public identity exposure.
- **Game-player rewards:** a game developer rewards active players while reducing
  duplicate-account farming.
- **Web3 ecosystem rewards:** a foundation rewards active users through a
  Sybil-resistant protocol rather than a wallet-counting airdrop.
- **Recurring startup airdrops:** a startup funds a recurring reward to encourage
  new-user activation and continued participation.
- **Collective distributions:** a cooperative, collective, or membership
  organization distributes earnings or surplus to members pseudonymously.
- **Open-source contributor rewards:** an open-source program operates a recurring
  contributor program without building its own allocation and payout system.
- **Grant-funded public goods:** a public-goods project distributes grant funding
  while protecting participant privacy and preserving auditable aggregate reports.

Each use-case page should state the applicable assumptions. Terms such as UBI,
earnings, relief, and airdrop describe the project program; they must not imply that
FundLoop guarantees income or that every program has the same legal classification.

## 7. Make participant use obviously simple

> **Partially addressed in Sprint #155 scope:**
> [Task #182](https://github.com/FundLoop/fundloop-website/issues/182) proves the
> current-and-prior-two-month claim window, payout-state handling, and rollover
> lifecycle, and [Task #183](https://github.com/FundLoop/fundloop-website/issues/183)
> exercises the hosted verified-participant journey. Simplifying the surrounding
> public explanation and interaction design remains follow-up work.

The participant-facing site should be explainable in one sentence:

> Participate in projects that voluntarily reward people, then come to FundLoop to
> review and collect your monthly reward, including still-available rewards from up
> to the previous three payout months.

The phrase “up to three months later” is ambiguous because it can mean either a
delay or a claim window. Public copy should explain the exact timing with a concrete
example. It should never imply that FundLoop intentionally waits three months to
pay a ready reward if the actual policy is that a reward remains requestable for
three complete payout months.

### 7.1 Participant journey

1. **Use participating projects.** The project explains what activity or membership
   can qualify for its program.
2. **Prove uniqueness through CUBID.** CUBID provides the project with a scoped
   identifier and later gives the isolated allocator the scoped mapping and score.
3. **Open FundLoop.** The participant signs in to see monthly reward state without
   being required to publish a public profile.
4. **Review the explanation.** The participant sees the applicable month, status,
   amount, timing, and any reason a reward is unavailable or held.
5. **Choose an available payout route.** The participant completes only the
   identity and destination steps required for that route and risk level.
6. **Track settlement.** FundLoop distinguishes request, provider acceptance, and
   final settlement.

No user-facing flow should require participants to understand source lots,
water-filling, custody accounts, locked manifests, or cross-project pseudonym
resolution.

## 8. Add “What is FundLoop?” as a multi-answer accordion

The home page should acknowledge that FundLoop can be understood from several
angles. An accordion can give each label a precise meaning and an honest boundary.

| Answer | Explanation and boundary |
| --- | --- |
| Citizen salary | An inspiration and comparison: recurring project-funded rewards can resemble a small citizen dividend, but FundLoop does not promise wages, salary, or guaranteed income. |
| Post-capitalist network state | A long-term social and economic ambition, not a claim that the MVP is a government, jurisdiction, or complete alternative economy. |
| Founder growth engine | A hypothesis that voluntary rewards can improve acquisition, participation, and retention; it must be demonstrated through pilots rather than asserted as proven performance. |
| Shared rewards platform | The clearest current product description: projects fund recurring rewards and FundLoop coordinates private eligibility, allocation, reporting, and payout state. |
| Proof-of-humanity network | A use of CUBID's scoped identity and score signals to reduce duplicate participation; FundLoop should not claim perfect bot prevention or universal personhood proof. |
| Financial operating system | The internal control plane for monthly funding, calculation, review, reconciliation, and reporting—not a bank account or a promise that FundLoop is outside financial regulation. |
| Multi-rail treasury | A description of technical support for more than one value rail; near-term product scope remains one Stripe-backed fiat route and one Safe-backed stablecoin route. |
| Project directory | A discovery surface for projects that participate in the loop, not the primary product or a claim of project endorsement. |
| Agent/MCP platform | A bounded interface through which authorized agents can assist with supported workflows; full agent parity is not a near-term objective. |
| ZK attribution system | The intended privacy destination. The MVP isolates identity amalgamation but is not yet zero knowledge. |
| Public-goods ecosystem | A set of possible programs and participants organized around voluntary circulation of value, not a claim that all listed projects are public goods. |
| UBI distribution engine | Infrastructure that a project or community could use for an opt-in UBI experiment; FundLoop itself does not guarantee or universally provide UBI. |

The accordion should reduce confusion, not celebrate ambiguity. The first expanded
answer should be **shared rewards platform**, followed by the strongest current
plain-language description. Aspirational answers should be labelled as such.

## 9. Isolate the allocation engine as a privacy boundary

> **Deliberate MVP variance with scoped implementation:**
> [FundLoop #204](https://github.com/FundLoop/fundloop-website/issues/204) now tests
> the allocator's field and authority boundary rather than requiring the allocator
> to be FundLoop's only identity join. [Cubid #79](https://github.com/Cubid-Me/cubid-monorepo/issues/79)
> owns the private contract/authentication, [Cubid #80](https://github.com/Cubid-Me/cubid-monorepo/issues/80)
> owns project-scoped-to-FundLoop-scoped resolution and score evidence, and
> [Cubid #81](https://github.com/Cubid-Me/cubid-monorepo/issues/81) owns privacy
> negatives, hosted smoke, and the FundLoop handoff. FundLoop #204 owns the API
> client, logical allocator-only tables/roles, forbidden-field contracts, and
> mandatory currency. [FundLoop #188](https://github.com/FundLoop/fundloop-website/issues/188)
> remains the Goal 2 publication gate.
>
> **Accepted MVP bypass:** FundLoop may retain the identity join before and after
> allocation and may persist per-project claims linked to FundLoop users. The
> allocator itself must receive only project-scoped UUIDs and required financial
> facts, and may return only FundLoop-scoped UUIDs, scores, award/source facts,
> project claims, and currency. Project membership/self-identification is not an
> allocator input. Project claims become currency claims in privacy v2.

The long-term allocator should become a separately bounded module and the only
calculation component allowed to amalgamate project-scoped CUBID identifiers into
whole-user, FundLoop-scoped identifiers. For the MVP, FundLoop may perform and
retain the surrounding identity joins for validation and downstream processing.

The boundary should have these properties:

- a separate package or service with a narrowly versioned input/output contract;
- no general application-table access;
- no project-facing access to FundLoop-scoped identifiers;
- no FundLoop application access to project-scoped membership mappings;
- short-lived processing inputs wherever feasible;
- encrypted transport and storage for any retained mapping evidence;
- purpose-specific operator access with immutable audit events;
- explicit retention and deletion rules;
- deterministic calculation artifacts separated from identity mapping artifacts;
- aggregate project reports and private participant reports derived through scoped
  transformations; and
- tests proving that forbidden identifiers cannot cross each interface.

This is not zero knowledge. For the MVP, it is a conventional privacy architecture
that minimizes what reaches the allocator and stabilizes the interfaces a future ZK
implementation would replace. It does not claim that the main FundLoop application
cannot retain or reconstruct the mapping.

The near-term claim should therefore be:

> The MVP uses scoped identifiers, strict service boundaries, encryption, access
> controls, and audited processing to reduce unnecessary cross-project visibility.
> Authorized FundLoop administrators can still access usage and allocation data
> when operating or investigating the MVP. The system is designed so the isolated
> identity join can transition toward zero-knowledge proofs in the full launch.

FundLoop should not claim that this architecture already proves administrators
cannot correlate users. It proves an intentional minimization boundary only after
the deployed data flows, logs, reports, backups, and administrator tools have been
verified against the contract.

### 9.1 High-level information flow

The participant, project, and CUBID exchanges shown for context are descriptive
assumptions, not FundLoop remediation scope. Only interfaces whose sender or receiver
is FundLoop or the allocator are assigned to FundLoop/Cubid Tasks in this document.

```mermaid
sequenceDiagram
    participant user as Participant
    participant project as Project
    participant cubid as CUBID
    participant fundloop as FundLoop app
    box rgb(255, 250, 220) Isolated allocator privacy boundary
        participant allocator as Allocator
    end

    user->>project: participant identifier
    user->>fundloop: participant identifiers
    user->>cubid: identity proofs
    project->>cubid: user identifier
    cubid-->>project: project-scoped UUID

    fundloop->>cubid: user identifiers
    cubid-->>fundloop: user identifiers + FundLoop-scoped UUIDs

    project->>allocator: project ID + project-scoped UUIDs
    project->>fundloop: project name + funds
    fundloop->>allocator: project + verified funds + cap multiple

    allocator->>cubid: project-scoped UUIDs
    cubid-->>allocator: scoped UUID + FundLoop UUID + score
    allocator-->>fundloop: FundLoop UUID + allocated reward
    fundloop-->>user: funds (simplified payout)
```

The diagram records the long-term minimization target. The approved MVP differs in
these explicit ways:

- the participant supplies the identifier each project already uses and separately
  supplies the identifiers FundLoop needs for its own account-resolution flow;
- the project knows its own users and its project-scoped CUBID identifiers;
- FundLoop may exchange and retain the identifiers required to validate the current
  mapping before and after allocation;
- CUBID performs identity proofing and scoped identifier resolution;
- the allocator receives project-scoped UUIDs and requests FundLoop-scoped UUIDs
  plus scores through the private Cubid API owned by Cubid #79-#81;
- the allocator returns FundLoop-scoped UUIDs, award amounts, currency, source
  evidence, and per-project claims to FundLoop during MVP;
- FundLoop may retain the mapping and claims, while the allocator is forbidden from
  reading raw user identity, project-membership/self-identification, auth, reporting,
  support, or payout tables; and
- reports reveal only the minimum appropriate to the participant, project,
  operator, or public audience.

The schematic is not an exact MVP storage diagram. FundLoop #204 is the operative
MVP contract. A separate allocator database and replacement of project claims with
currency claims remain privacy-v2 roadmap items.

### 9.2 Fully private alias-separation flow for the ZK phase

> **Partially addressed in Sprint #155 scope:**
> [Task #204](https://github.com/FundLoop/fundloop-website/issues/204) requires this
> flow to be modelled separately and labelled unavailable unless implemented. It
> explicitly does not implement ZK proofs, circuits, or proving infrastructure.

A participant who wants stronger unlinkability should be able to use two unrelated
identifiers:

- **Identifier X**, known to the project—for example, a dedicated EVM wallet; and
- **Identifier Y**, known to FundLoop—for example, a one-time email address used
  only for the FundLoop account.

The participant gives both identifiers, together with the required identity proofs,
to CUBID. CUBID resolves X only into a project-scoped UUID and Y only into a
FundLoop-scoped UUID. The project never receives Y or the FundLoop-scoped UUID.
FundLoop never receives X or the project-scoped UUID. Neither side receives a
shared CUBID UUID.

```mermaid
sequenceDiagram
    participant user as Participant
    participant project as Project
    participant cubid as CUBID
    participant fundloop as FundLoop app
    box rgb(238, 252, 245) Zero-knowledge allocation boundary
        participant allocator as ZK allocator
    end

    user->>project: identifier X (for example, dedicated EVM wallet)
    user->>fundloop: identifier Y (for example, one-time email)
    user->>cubid: identifier X + identifier Y + identity proofs

    project->>cubid: identifier X
    cubid-->>project: project-scoped UUID only
    fundloop->>cubid: identifier Y
    cubid-->>fundloop: FundLoop-scoped UUID only

    project->>allocator: project ID + project-scoped UUIDs
    project->>fundloop: project name + funds
    fundloop->>allocator: verified funds + cap policy

    allocator->>cubid: request ZK linkage and score proof
    cubid-->>allocator: proof of unique eligible user + committed score
    allocator-->>fundloop: FundLoop-scoped UUID + allocated reward
    fundloop-->>user: funds (simplified payout)
```

Under this design:

- the project can associate participation only with identifier X and its own
  project-scoped UUID;
- FundLoop can associate the account and reward only with identifier Y and the
  FundLoop-scoped UUID;
- CUBID knows that X and Y resolve to the same verified person, but does not return
  that mapping to either administrator group;
- the ZK allocator proves the hidden project-to-FundLoop relationship and score
  conditions without disclosing the project-scoped UUID, identifier X, identifier
  Y, or the cross-scope mapping to FundLoop; and
- reports remain scoped so neither project-facing nor FundLoop-facing output
  introduces a reusable join key.

This removes the direct shared-identifier path that project and FundLoop
administrators could otherwise use to correlate a participant by colluding. It is
reasonable to describe that specific path as having **no available identifier
join** once the ZK design is correctly implemented and verified.

It should not be marketed as literally “zero privacy risk” without stating the
threat model. The guarantee depends on CUBID not disclosing or misusing the X-to-Y
mapping, sound ZK circuits and keys, correct clients, non-identifying reports, and
controls against timing, amount, cohort-size, IP, browser, wallet, support, and
other metadata side channels. Independent review must verify those assumptions
before FundLoop claims administrator-collusion resistance.

### 9.3 Tech-agnostic project flow with consented identifier sharing

> **Partially addressed in Sprint #155 scope:**
> [Task #204](https://github.com/FundLoop/fundloop-website/issues/204) audits this as
> a distinct future data contract, while
> [Task #168](https://github.com/FundLoop/fundloop-website/issues/168) and
> [Task #184](https://github.com/FundLoop/fundloop-website/issues/184) cover the
> required consent, privacy, retention, and qualified governance conclusions. The
> secondary CUBID project account and no-developer upload workflow are not delivered
> by Sprint #155.

Projects without a developer team should have a deliberately simple participation
path. The project sends FundLoop a list of participant email addresses and the total
funds for the reward period. It does not integrate the CUBID SDK, resolve scoped
identifiers, or communicate with CUBID directly.

```mermaid
sequenceDiagram
    participant user as Participant
    participant project as Project
    participant fundloop as FundLoop app
    participant cubid as CUBID
    box rgb(255, 250, 220) Allocation boundary
        participant allocator as Allocator
    end

    user->>project: email under disclosed T&C consent
    project->>fundloop: participant email list + total funds

    fundloop->>cubid: create or use secondary project account
    fundloop->>cubid: emails as project identifiers
    cubid-->>fundloop: project-scoped UUIDs

    fundloop->>allocator: project ID + project-scoped UUIDs
    fundloop->>allocator: verified funds + cap policy
    allocator->>cubid: project-scoped UUIDs
    cubid-->>allocator: scoped UUID + FundLoop UUID + score
    allocator-->>fundloop: FundLoop UUID + allocated reward

    user->>fundloop: email to identify FundLoop account
    fundloop-->>user: funds (simplified payout)
```

In the background, FundLoop creates or manages a secondary CUBID account on the
project's behalf and submits the supplied emails as that project's identifiers.
CUBID returns project-scoped identifiers, which FundLoop passes through the same
allocator contract used for integrated projects. This extra translation may appear
superfluous, but it keeps allocator inputs and allocation rules uniform. The
allocator should not need a separate formula or identity model for low-tech
projects.

This path has an explicit privacy tradeoff: FundLoop receives both the participant
email and its association with the project. It is therefore an accessibility path,
not a privacy-preserving substitute for the scoped or ZK flows. It should be
available only when all of the following are true:

- the project's terms and privacy notice clearly say that participant PII will be
  shared with FundLoop for identity resolution, allocation, reporting, and payout;
- each participant must acknowledge that FundLoop will send their email address to
  CUBID for identity resolution and creation of the project's scoped identifier;
- the project has a valid legal basis for the transfer and records the applicable
  participant notice or consent;
- FundLoop and the project have the required data-processing and controller terms;
- the upload uses a secure, access-controlled channel rather than ordinary email or
  an ad hoc spreadsheet link;
- retention, correction, deletion, breach-response, and data-subject-request
  responsibilities are defined; and
- FundLoop makes the lower-privacy character of this route visible in project
  onboarding and participant-facing explanations.

The product benefit is reach: a community organization, cooperative, relief
program, or conventional business can participate without a developer team or any
knowledge of CUBID. Its operational journey becomes: agree to the data-sharing
terms, create a project profile, upload the eligible emails, transfer the period's
funds, and receive the standard FundLoop reports.

The final payout arrows in all three schematics intentionally omit the participant's
reward-request step and any payment-provider processing. They close the conceptual
loop without presenting the diagrams as complete settlement specifications.

## 10. Be bold and specific about the privacy future

> **Partially addressed in Sprint #155 scope:**
> [Task #183](https://github.com/FundLoop/fundloop-website/issues/183) proves hosted
> privacy negatives and public-copy accuracy,
> [Task #204](https://github.com/FundLoop/fundloop-website/issues/204) establishes the
> actual identifier-visibility contract, and
> [Task #184](https://github.com/FundLoop/fundloop-website/issues/184) requires
> qualified privacy and retention conclusions. The bold landing-page statement and
> repeated in-product MVP disclosure remain a separate product change.

The landing page should prominently state the privacy belief:

> Rewards should not require every project to know your complete identity or where
> else you participate. FundLoop is building toward a system in which projects can
> reward verified people using scoped proofs instead of shared identity dossiers.

Immediately nearby, smaller but readable phase disclosure should say:

> MVP privacy notice: the first release is not zero knowledge. It protects users
> with conventional controls including scoped identifiers, access restrictions,
> encryption, private-by-default profiles, limited reports, and audited operations.
> Authorized FundLoop administrators can see usage and allocation data when needed
> to operate, support, investigate, and audit the MVP. The roadmap moves the
> sensitive identity join into zero-knowledge proofs for the full launch.

The disclosure should be repeated at meaningful decision points rather than hidden
only in a privacy policy:

- participant onboarding;
- CUBID connection;
- project integration setup;
- public-profile publication;
- monthly cohort submission;
- reward calculation and reporting; and
- payout setup.

## 11. Treat fee placement as a time-bounded prototype

> **Partially addressed in Sprint #155 scope:**
> [Task #165](https://github.com/FundLoop/fundloop-website/issues/165) proves fee and
> FX conservation for the EUR source,
> [Task #169](https://github.com/FundLoop/fundloop-website/issues/169) exposes fee
> recognition and gross/net decisions for accounting review, and
> [Task #181](https://github.com/FundLoop/fundloop-website/issues/181) makes fees
> explainable in reports. Sprint #155 does not select the final fee payer, model, or
> lock date.

FundLoop is currently building fee capabilities at the front, middle, and back of
the flow. These controls should be documented as an experimental fee-placement
framework:

- **Front:** a project fee associated with receiving or processing the funded
  project package.
- **Middle:** a base platform fee before allocation.
- **Back:** a participant-selected or payout-stage fee associated with a reward
  request.

The purpose is to learn:

- which party perceives and receives the value;
- where a fee is easiest to explain;
- which fee interferes least with project participation;
- which model can finance compliance and operations;
- how fee placement affects reward size and payout completion;
- whether optional fees are actually chosen; and
- whether projects prefer predictable invoices or value-based charges.

The website and product should not imply that all three positions are intended to
remain. They are prototype capabilities used to compare models.

Within one year, FundLoop should choose and lock a simple fee policy. A plausible
outcome is a predictable project-side fee with payment-provider costs separately
disclosed, but the experiment should determine the answer. The final decision must
include:

- one primary fee payer;
- one readily understood calculation basis;
- documented treatment of provider and network costs;
- no hidden reduction between an approved reward and payout;
- versioned transition rules for existing programs; and
- a public effective date after which the fee model is no longer dynamically
  experimented with in ordinary production programs.

## 12. Treat the admin-controlled cap as a time-bounded policy playground

> **Partially addressed in Sprint #155 scope:**
> [Task #186](https://github.com/FundLoop/fundloop-website/issues/186) proves that the
> selected cap applies only to redistribution top-ups with deterministic
> conservation, while [Task #181](https://github.com/FundLoop/fundloop-website/issues/181)
> requires audience-appropriate cap explanations. The Sprint does not choose the
> post-MVP multiplier or publish a cap-stabilization date.

The dynamic cap multiplier lets an administrator preview and select redistribution
behaviour. During the MVP, this can be useful for learning how different caps affect
concentration, low-reward participants, carryover, and comprehensibility.

It should be described as an interim playground measure, not a permanent source of
monthly discretion.

MVP controls should require:

- a bounded allowed range;
- scenario comparison before selection;
- an immutable record of the selected multiplier and resulting distribution;
- a written rationale;
- disclosure in operator, project, participant, and public reports at the
  appropriate level;
- no change after the epoch locks;
- monitoring for disparate or surprising outcomes; and
- a published date for replacing dynamic selection with a stable policy.

The full launch should use a fine-tuned, predictable multiplier or a narrow
pre-announced rule for changing it. The eventual policy should be set before the
affected participation period wherever possible, so participants do not experience
the reward rule as retrospective discretion.

## 13. Publish a two-phase roadmap

> **Partially addressed in Sprint #155 scope:**
> [Task #172](https://github.com/FundLoop/fundloop-website/issues/172) creates an
> evidence-bound Dev release decision,
> [Task #173](https://github.com/FundLoop/fundloop-website/issues/173) owns controlled
> promotion and Production parity, and
> [Task #204](https://github.com/FundLoop/fundloop-website/issues/204) prevents the
> non-ZK MVP from being described as the future ZK design. Sprint #155 does not
> publish or commit the sub-one-year Phase 2 roadmap.

The public roadmap should distinguish the non-ZK experimental MVP from the full
launch and commit to completing the transition in less than one year.

### Phase 1: non-ZK MVP and learning system

Target window: now through 2026 Q4, with real pilot evidence extending into early
2027 if required.

Characteristics:

- conventional privacy controls rather than zero-knowledge proofs;
- an isolated allocator as the only identity-amalgamation boundary;
- authorized FundLoop administrators can access usage and allocation evidence;
- private-by-default participant profiles and audience-scoped reports;
- dynamic, operator-selected cap multiplier with immutable disclosure;
- front-, middle-, and back-fee capabilities available for experiments;
- one Stripe-backed fiat route;
- one Safe-backed stablecoin route;
- concierge operation and support;
- real monthly pilots with complete settlement and reporting evidence;
- no guarantee of income, salary, or universal availability; and
- explicit labels separating estimated, approved, available, sent, and settled
  rewards.

Required learning outputs:

- project willingness to fund and renew;
- participant completion and payout rates;
- comprehensibility of reward explanations;
- privacy concerns and support cases;
- operating cost per project and participant;
- fee-model response;
- cap sensitivity and fairness response;
- provider and settlement reliability; and
- the smallest data contract needed for ZK transition.

### Phase 2: privacy-preserving full launch

Target: complete before 2027-08-13, with an internal target no later than
2027-06-30 to leave contingency inside the one-year commitment.

Characteristics:

- a reviewed zero-knowledge or equivalently privacy-preserving identity and
  eligibility proof replacing the MVP's administrator-visible amalgamation path;
- independently verified guarantees about what projects, FundLoop, CUBID, the
  allocator, and report consumers can learn;
- a fine-tuned and predictable cap policy;
- a simple, locked fee model;
- the same narrow supported fiat and stablecoin routes unless real demand justifies
  expansion after launch;
- production-approved legal, accounting, privacy, custody, tax, sanctions, and
  payment classifications;
- complete participant-, project-, operator-, and public-report contracts;
- published reliability and payout-state definitions; and
- real pilot evidence showing the product is valuable enough to operate.

### Roadmap honesty rule

“Full launch” must not mean that code has merged or a ZK proof runs in a test. It
requires the complete hosted user journey, production data boundaries, professional
approval, external settlement, privacy verification, and public reporting to match
the stated product.

If the ZK transition, fee simplification, or cap stabilization cannot be completed
inside one year, FundLoop should publish the missed gate and resulting product
boundary rather than silently extending the MVP's experimental controls.

## 14. Avoid custody wherever possible

> **Partially addressed in Sprint #155 scope:**
> [Task #169](https://github.com/FundLoop/fundloop-website/issues/169) requires an
> accounting decision on custody,
> [Task #170](https://github.com/FundLoop/fundloop-website/issues/170) proves ledger,
> opening-balance, and cutover gates, and
> [Task #184](https://github.com/FundLoop/fundloop-website/issues/184) requires
> qualified legal, accounting, unclaimed-property, and custody conclusions before
> value activation. These controls do not yet select and implement the final
> non-custodial operating structure.

FundLoop should prefer structures in which regulated providers or project-controlled
accounts hold and move value, while FundLoop calculates instructions, records
approvals, and reconciles evidence.

The preferred high-level pattern is:

```text
Project funds a program through an approved provider or project-controlled Safe
    → FundLoop verifies available program funding
    → the isolated allocator calculates approved rewards
    → an authorized instruction is sent to the provider or Safe
    → the provider or network moves value
    → FundLoop records independent settlement evidence
```

FundLoop should avoid representing an internal ledger or omnibus wallet as proof
that user money is safeguarded, owned, or paid. It should not pool assets merely
because the architecture can support pooling.

For the first supported routes:

- fiat should use one Stripe-backed structure selected after legal and provider
  review; and
- stablecoin should use one Safe-backed, allowlisted route with narrow permissions,
  transparent assets, and externally inspectable settlement.

Provider involvement does not automatically remove FundLoop from regulatory scope.
The final contracts, control of instructions, handling of balances, insolvency
treatment, and user relationship must still be reviewed on their facts.

## 15. Make reporting the primary product proof while preserving privacy

> **Addressed in Sprint #155 scope:**
> [Task #181](https://github.com/FundLoop/fundloop-website/issues/181) owns
> deterministic public, participant, founder, operator, and MCP reports with privacy
> and authorization checks; [Task #183](https://github.com/FundLoop/fundloop-website/issues/183)
> exercises those reports across hosted roles; and
> [Task #204](https://github.com/FundLoop/fundloop-website/issues/204) tests that
> reporting does not escape the intended identity boundary.

Reporting should be the place where FundLoop earns trust and demonstrates value.
The objective is not to publish the complete audit graph. It is to give each
audience enough evidence to understand and challenge the outcome without learning
facts it should not know.

### 15.1 Participant report

Show:

- reward month and project-appropriate source explanation;
- calculation policy version;
- estimated, approved, available, requested, sent, and settled amounts;
- whether an identity or score factor affected eligibility;
- payout route and fee summary without exposing secrets;
- expiry or claim-window dates;
- hold, exclusion, or failure reasons; and
- a correction or support path.

Do not show another participant, cross-project membership, raw CUBID evidence, or
operator-only fraud signals.

### 15.2 Project report

Show:

- funds submitted, verified, fee-processed, allocated, paid, returned, or carried;
- submitted cohort count;
- accepted, unresolved, excluded, and paid participant counts;
- aggregate score or eligibility bands where privacy thresholds permit;
- fee calculation and provider costs;
- cap multiplier and aggregate effect;
- payout completion and exception rates;
- comparison with prior epochs; and
- enough evidence to reconcile the project's program.

Do not return FundLoop-scoped UUIDs, identities from another project, another
project's membership, or a join key that enables correlation.

### 15.3 Operator report

Show the complete operational evidence required to reconcile funds, investigate
exceptions, review identity failures, verify calculations, and close the epoch.
Access should be purpose-limited, logged, and time-bounded where possible.

### 15.4 Public report

Show aggregate funding, eligible-participant bands, settled-reward totals, payout
completion, fees, policy version, cap multiplier, privacy method, and unresolved
exceptions only when disclosure thresholds prevent re-identification.

Public reports should state whether the epoch used the conventional MVP privacy
model or the later ZK model.

### 15.5 Reporting success criterion

A founder and a participant should each be able to explain the result after reading
their report without assistance. That comprehension should be tested during the
concierge pilots rather than assumed.

## 16. Reposition the developer product around a small integration contract

> **Partially addressed in Sprint #155 scope:**
> [Task #181](https://github.com/FundLoop/fundloop-website/issues/181) aligns MCP
> reporting with the same typed report contracts used by human audiences, and
> [Task #204](https://github.com/FundLoop/fundloop-website/issues/204) narrows and
> versions the allocator input/output contract. Sprint #155 does not deliver the
> ten-minute project quickstart, small external SDK/API contract, or webhook product.

The developer proposition should lead with the shortest path to a working program,
not MCP, architecture, or the internal control plane.

The primary integration contract should expose a small set of stable operations:

1. create or configure a project reward program;
2. obtain or store project-scoped CUBID identifiers;
3. validate and submit a monthly eligible cohort;
4. fund or confirm funding for the epoch;
5. retrieve validation, calculation, and payout-status reports; and
6. receive webhooks for exceptions and settlement.

Developer materials should include:

- one ten-minute quickstart;
- framework-neutral REST contracts or a small SDK;
- exact database-field guidance for the project-scoped identifier;
- test and sandbox identities;
- idempotency and retry rules;
- webhook signatures and replay guidance;
- privacy diagrams and forbidden-data examples;
- copy-pasteable cohort-validation examples;
- a complete sample monthly close; and
- migration guidance for the later ZK contract.

MCP should be an adapter over these stable product APIs. It can help an authorized
agent prepare a project status update, validate a cohort, summarize exceptions, or
assemble a monthly report. FundLoop should not pursue agent parity for every
operation before the core human and API workflows are proven.

## 17. Run a concierge pilot before more platform expansion

> **Deliberate Sprint sequencing variance:** Sprint #155 completes production
> readiness, governance gates, and hosted no-value acceptance before the proposed
> real design-partner pilot. [Task #183](https://github.com/FundLoop/fundloop-website/issues/183)
> is a controlled founder/user/operator acceptance run, not a funded concierge pilot,
> and must not be counted as market validation.

FundLoop should recruit a small number of real design partners whose use cases
exercise different parts of the thesis. A useful initial cohort could include:

- one open-source or public-goods contributor program;
- one Web3 or game community concerned about duplicate accounts; and
- one cooperative, relief, local-UBI, or membership distribution program.

Each pilot should run for at least three consecutive monthly epochs. FundLoop staff
may perform manual or semi-manual work, provided the report identifies which steps
were manual and no manual action is presented as automation.

### 17.1 Minimum pilot evidence

Each project must produce:

- a real accountable project operator;
- a disclosed participation and eligibility rule;
- a real funded amount;
- project-scoped CUBID identifiers;
- a validated cohort;
- an immutable cap and fee selection;
- a completed calculation and review;
- available rewards for real participants;
- at least one successful provider- or network-settled payout;
- participant and project reports;
- a reconciliation package;
- support and dispute records; and
- an explicit renewal or non-renewal decision.

### 17.2 Pilot metrics

Measure:

- setup time for the project and developer;
- staff-hours required per monthly close;
- percentage of submitted identities successfully resolved;
- percentage of approved participants who open FundLoop;
- percentage who complete payout setup;
- percentage and value successfully settled;
- median and distribution of reward amounts;
- time from cutoff to available reward and final settlement;
- support cases and disputes per 100 participants;
- participant comprehension of amount, status, and privacy boundary;
- project comprehension of fees, allocation, and reports;
- perceived fairness under different cap scenarios;
- privacy objections or withdrawal requests;
- project-reported changes in participation, retention, or acquisition;
- total operating cost and gross fee revenue per epoch; and
- willingness to renew and pay under the proposed simplified fee model.

## 18. Introduce explicit kill and pivot criteria

> **Not addressed by Sprint #155:** the Sprint supplies evidence that future kill
> criteria can consume, especially through
> [Task #181](https://github.com/FundLoop/fundloop-website/issues/181) and
> [Task #183](https://github.com/FundLoop/fundloop-website/issues/183), but it does
> not pre-commit FundLoop to adoption, economics, comprehension, or renewal gates.

Before the first pilot, FundLoop should publish internal continuation criteria so
the team cannot redefine success after observing the outcome.

The program should stop, narrow, or materially redesign if, after three completed
pilot epochs, one or more of these conditions persists without a credible measured
remedy:

- no participating project agrees to renew under a fee that can support the
  service;
- the median available reward is below the relevant payout minimum or is too small
  to motivate completion;
- fewer than 70 percent of approved participants complete payout setup;
- fewer than 90 percent of properly requested rewards settle successfully;
- more than 10 percent of participants dispute eligibility, calculation, or status;
- a typical project requires more than four staff-hours to operate one monthly
  close after initial setup;
- FundLoop requires recurring manual intervention that cannot be financed by the
  expected fee model;
- projects cannot identify measurable value beyond general goodwill;
- the project integration cannot truthfully be completed in the promised simple
  workflow;
- participants cannot correctly distinguish approved, available, sent, and settled
  value after reading their report;
- the conventional MVP privacy model produces unacceptable participant or project
  resistance;
- legal or regulatory requirements make the expected revenue model uneconomic;
- the fee experiments do not identify one understandable, sustainable model;
- cap selection remains too discretionary or produces outcomes users cannot regard
  as legitimate; or
- the proposed ZK transition cannot preserve the required allocation and reporting
  functionality inside the one-year roadmap.

These are not automatic declarations that the entire FundLoop thesis is false. They
are stop conditions for the current product, operating model, or target market.
Crossing one should trigger an explicit decision record rather than another layer
of features.

## 19. Stop-work boundary

> **Deliberate Sprint variance:**
> [Task #165](https://github.com/FundLoop/fundloop-website/issues/165) adds durable EUR
> Pay by Bank allocation coverage and
> [Task #166](https://github.com/FundLoop/fundloop-website/issues/166) validates CAD
> PAD, EUR/GBP Pay by Bank, and reviewed Base token reality. That is broader than the
> proposed one-fiat/one-stablecoin operating boundary. The variance is acceptable as
> finite production-readiness and capability-classification work: #166 requires one
> supported hosted test rail, one unsupported no-mutation path, truthful labels, and
> no provider/token activation or real value flow. It must not become precedent for
> continued rail or asset expansion after Sprint #155.
>
> [Task #186](https://github.com/FundLoop/fundloop-website/issues/186) also spends
> capacity on allocation complexity, but explicitly preserves the already-approved
> v2 formula rather than adding another formula. This fits the section's allowance
> for safety, reproducibility, migration, and test maintenance.

Until the concierge pilots establish adoption, meaningful rewards, privacy
acceptance, operational viability, and renewal, FundLoop should stop building:

- additional chains and tokens;
- flatcoins;
- yield-bearing treasury concepts;
- public network-state ambitions;
- generalized governance;
- agent parity for every operation;
- more allocation formulas;
- new payment rails beyond one Stripe-backed fiat route and one Safe-backed
  stablecoin route;
- public participant rankings or cross-project reputation; and
- anything suggesting FundLoop itself guarantees income.

Existing code may be maintained where necessary for safety, reproducibility,
migrations, and current tests. Paused capabilities should be clearly labelled and
kept disabled where appropriate. They should not continue to consume product and
delivery capacity merely because earlier architecture anticipated them.

Exceptions should require a written reason tied to one of the following:

- a security or data-protection requirement;
- a legal or regulatory obligation;
- a blocker for the two supported payment routes;
- a blocker for the isolated allocator or ZK transition;
- a blocker for pilot reporting, settlement, or reconciliation; or
- direct, evidenced demand from a funded pilot partner.

## 20. Decision and evidence register

> **Partially addressed in Sprint #155 scope:**
> [Task #169](https://github.com/FundLoop/fundloop-website/issues/169),
> [Task #172](https://github.com/FundLoop/fundloop-website/issues/172), and
> [Task #184](https://github.com/FundLoop/fundloop-website/issues/184) create
> versioned accounting, release, and qualified-governance evidence. Sprint #155 does
> not yet establish one durable product-level register covering every experimental
> decision and its final decision date.

The roadmap should maintain a public or appropriately scoped register of the
remaining experimental decisions.

| Decision | MVP state | Full-launch commitment | Evidence required |
| --- | --- | --- | --- |
| Funding commitment | Revenue percentage and other voluntary commitments supported | Clear supported commitment types | Pilot adoption and reconciliation evidence |
| Fee placement | Front, middle, and back capabilities available for experiments | One simple predictable model | Willingness to pay, operating cost, completion impact |
| Cap multiplier | Operator-selected within a bounded range | Fine-tuned fixed or narrowly governed policy | Scenario outcomes, fairness and comprehension research |
| Privacy | Conventional scoped controls with authorized-admin visibility | ZK or equivalently verified privacy-preserving join | Threat model, proof design, hosted verification, independent review |
| Custody | Minimized; provider/project-controlled structures preferred | Professionally approved narrow model | Provider contracts, legal classification, insolvency and safeguarding analysis |
| Fiat route | One Stripe-backed route | Same route unless demand justifies change | Hosted settlement and reconciliation evidence |
| Stablecoin route | One Safe-backed allowlisted route | Same route unless demand justifies change | Hosted finality, control, and reconciliation evidence |
| Reporting | Audience-scoped reports with conventional privacy controls | Privacy-preserving reports backed by final proof model | Comprehension, correlation testing, publication evidence |
| Developer interface | Small API/SDK contract; MCP as adapter | Stable ZK-aware integration contract | External integration time and pilot reliability |
| Product viability | Concierge pilots | Repeatable self-serve or supportable operation | Renewal, meaningful reward, completion, cost and margin evidence |

## 21. Post-Sprint #155 Feature-slicing proposals

These proposals assume Sprint #155 is implemented and validated first, including
the approved MVP allocator boundary under #204 and the private Cubid Feature #77.
The Cubid tree is now approved/scoped; the remaining rows are candidate **Feature**
boundaries, not approved Feature or Task issues. Detailed scope, dependencies, and
acceptance criteria should be established through the normal Feature-planning
workflow.

### Option A: three broad Features

| Feature | Primary outcome | Recommendations grouped |
| --- | --- | --- |
| Product contract and adoption experience | Replace the current public and integration story with one honest, two-sided path for projects and participants. | Sections 2–8, 10, and 16 |
| Privacy, economics, and operating model | Complete the ZK transition plan, simplify fees and cap policy, minimize custody, narrow supported value routes, and publish the decision register. | Sections 9–14, 19, and 20 |
| Concierge pilots and viability decision | Run real monthly pilots using private reporting, then apply the pre-committed continuation criteria. | Sections 15, 17, and 18 |

This is the lowest-governance-overhead option. It is also the riskiest: each Feature
contains several different user outcomes and specialist domains, making it easy for
privacy, economics, or pilot learning to disappear inside a long implementation
tree.

### Option B: five outcome-aligned Features — recommended

| Feature | Primary outcome | Recommendations grouped | Key completion boundary |
| --- | --- | --- | --- |
| **1. Public product contract and two-sided journeys** | Make the belief, reward language, current privacy phase, two audiences, and participant path immediately understandable. | Sections 3–5, 7, 8, 10, and the public part of 13 | Tested people/project journeys consistently distinguish estimated, approved, available, sent, and settled rewards and disclose the non-ZK MVP. |
| **2. Simple project participation and developer integration** | Support one small integrated-project contract plus the consented, tech-agnostic path without exporting FundLoop's internal complexity. | Sections 2, 6, 9.3, and 16 | A new integrated project completes the quickstart, a no-developer project completes the consented upload path, and both receive the same scoped reports. |
| **3. Predictable economics and narrow value movement** | Turn fee and cap controls into bounded experiments, decide the supported fiat/stablecoin routes, minimize custody, and publish decisions. | Sections 11–14, 19, and 20 | One dated experiment plan exists; legal/accounting conclusions bind it; one predictable fee policy, one cap policy, and one fiat plus one stablecoin operating route are selected or explicitly gated. |
| **4. Concierge pilots and viability gates** | Test the thesis with real design partners and use reporting as the proof and learning layer. | Sections 15, 17, 18, and 20 | Three representative pilots complete the agreed monthly period with real funding and settlement evidence, measured comprehension and operating cost, renewal decisions, and an explicit continue/narrow/stop decision. |
| **5. Privacy-preserving allocator Phase 2** | Replace MVP project claims with currency claims, remove unnecessary retained project correlation, decide physical datastore separation, and then introduce the reviewed ZK or equivalently privacy-preserving contract without weakening allocation or reports. | Sections 9, 9.2, 10, 13, and 15 | Currency-claim output and datastore boundaries are proven first; the alias-separated flow is then independently reviewed across the allocator, application, reports, logs, support tools, and retention surfaces. No MVP privacy claim is silently upgraded before this gate passes. |

This is the recommended slice because each Feature has one externally meaningful
outcome, while the dependency chain remains visible:

1. Plan Features 1–3 immediately after Sprint #155 so the public promise, project
   contract, and pilot economics agree before recruiting design partners.
2. Implement the minimum useful scope of Features 1–3, then start Feature 4 before
   resuming broad platform expansion.
3. Plan Feature 5 early from #204's audited contract because privacy architecture has
   a long lead time, but gate material build-out by the pilot continuation decision
   unless a pilot's privacy requirement makes it an entry condition.
4. Treat Feature 4's kill criteria as a release gate for further breadth, not merely
   a retrospective report.

The five-Feature option intentionally separates **economic-policy simplification**
from **pilot execution**. This prevents the team from changing fees, cap policy, or
route scope after seeing pilot results without recording that the experiment changed.
It also separates the full ZK transition from the MVP-facing website work, so honest
privacy disclosure can ship before the future proof system is ready.

### Option C: seven narrow Features

| Feature | Primary outcome | Recommendations grouped |
| --- | --- | --- |
| Belief, language, and roadmap | Rewrite the public promise and publish the phase boundary. | Sections 3, 4, 8, 10, and 13 |
| Two-sided participant/project experience | Create the audience selector and simple participant journey. | Sections 5 and 7 |
| Integrated project quickstart | Deliver voluntary funding choices and the small SDK/API contract. | Sections 2, 6, and 16 |
| Tech-agnostic consented participation | Deliver the secondary CUBID project-account and secure PII-sharing flow. | Section 9.3 |
| Predictable economics and value routes | Decide fees, cap policy, custody structure, and the one-fiat/one-stablecoin boundary. | Sections 11, 12, 14, 19, and 20 |
| Privacy-preserving allocator Phase 2 | Deliver and independently verify the alias-separated ZK contract. | Sections 9, 9.2, 10, 13, and 15 |
| Concierge pilots and kill decision | Run real pilots, measure reporting comprehension and economics, and make the continuation decision. | Sections 15, 17, 18, and 20 |

This option provides the cleanest ownership and the smallest review units. Its cost is
coordination: public copy, onboarding, consent, reporting, economics, and privacy
would have more cross-Feature dependencies, and seven parallel roadmap promises may
recreate the breadth problem this document is trying to correct.

### Recommendation

Start planning **five new Features using Option B**. It is granular enough to expose
the distinct product, integration, economics, pilot, and privacy decisions, but small
enough to manage as one post-Sprint program. Do not start all five implementation
streams at once. The first implementation wave should make the promise and project
boundary pilot-ready; the second should run the pilots; the ZK Feature should retain
its own explicit architecture, independent-review, and continuation gates.

## Closing statement

FundLoop does not need to abandon its thesis to respond to the red-team critique.
It needs to make the thesis easier to enter, more honest about its current phase,
more disciplined about privacy, and demonstrably useful in real monthly programs.

The internal system can remain sophisticated. The promise at its boundaries should
be simple:

- projects voluntarily fund rewards and submit scoped participant references;
- participants prove uniqueness without making a public identity dossier;
- one field-limited allocator performs the calculation through a private Cubid
  scoped-ID/score API, while FundLoop temporarily retains the surrounding MVP joins;
- FundLoop explains exactly what was approved, made available, and settled;
- regulated providers or narrowly controlled accounts move the value wherever
  possible; and
- the MVP's fees, cap policy, and conventional privacy model graduate into a
  predictable, privacy-preserving full launch within one year—or FundLoop reports
  clearly why they did not.
