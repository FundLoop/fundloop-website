Source: https://hackmd.io/6t9bM2i5QBW83D0C6MZ6dw

Below is a **FundLoop** grant proposal in collaboration with **GreenPill Toronto** and **Cubid Protocol** for a new **ZK primitive required for FundLoop**. It reflects a funding ask of **$5,000**, with governance routed through a **FundLoop Garden** for key decisions.

---

# **Proposal: zkActivitySum — A Privacy-Preserving Activity Oracle for Collective Capital Allocation**

## **Submitted to:**  
**Allo Capital Builders Fund** (via Gitcoin Gardens)

## **Applicant:**  
**FundLoop** – A regenerative mutual-aid protocol built on **Allo Protocol** within the Procent Foundation's AutoPGF ecosystem

---

## **Overview**

This proposal seeks **$5,000** in funding to initiate the development of **zkActivitySum**, a privacy-preserving activity oracle designed to serve as **a foundational primitive for collective capital allocation mechanisms**. 

**zkActivitySum** will enable decentralized communities to **verify cross-ecosystem user engagement** without compromising privacy — a core requirement for fair and trustless UBI, retroactive funding, quadratic eligibility, or any usage-based reward mechanism.

This proposal aligns directly with the **Allo Capital Builders Fund’s mission** to fuel novel coordination tools and make them interoperable with **gardens.fund** and the wider Gitcoin ecosystem.

---

## **About FundLoop**

FundLoop is a new project that centers on an idea of a **mutual aid society** or a "**virtual network state**" where projects & apps collaborate to help each other get more users. Projects contribute minimal usage data and **1% of their revenue** (or more) to FundLoop, from where users get rewarded with a streamed & airdropped "**citizen salary**" for being truly **active and in good standing across several value-aligned and sybil-resistant apps**. 


![fundloop](https://hackmd.io/_uploads/rk279IT0ke.jpg)
blue arrows: information flow
black arrows: funds flow


See more at https://fundloop.org (PoC, dummy data, testnet)

---

## **The Problem**
#### How to truly minimize publication of sybil-resistant usage data?

In a multi-protocol world, how do we know if one person is *active* across multiple projects — without violating privacy or centralizing data?

Current solutions either:
- Centralize web2 activity data (e.g., via analytics platforms or credentialing hubs)
- Or require web3 users to use the same public key across multiple apps, creating surveillance risks.
- And often lack sufficient granularity to distinguish **meaningful engagement** from passive membership.

This creates a critical bottleneck for ecosystems like Gitcoin and other impact funding platforms, which depend on usage-based legitimacy for **UBI, retroPGF, QF rounds**, and more.

---

## **The Solution: zkActivitySum**

**zkActivitySum** is a proposed primitive that lets users **prove aggregate engagement** across multiple apps without revealing which apps they use — or sharing any personal data.

**Key properties:**
- Each app submits anonymized usage scores tied to **app-scoped Cubid identities**
- Users privately aggregate their scores and produce a **ZK or TEE-verified proof**: “I am active enough, across enough platforms, to qualify”
- No party — not even the aggregator — learns where or how a user was active
- Ideal for **capital allocators, identity scorers, and grant platforms**

---

## **Why This Is Relevant to Gitcoin & Gardens**

- **FundLoop** is developing a regenerative UBI / airdrop system where active users earn a **“citizen salary”** funded by project contributions. **zkActivitySum is essential infrastructure** to make that UBI eligibility **Sybil-resistant, fair, and private**.
- We intend to **launch a FundLoop Garden** to steward this tool, in full alignment with **Gitcoin’s interoperable capital coordination layer**.
- zkActivitySum will be **open-source and reusable**, and designed for **interoperability with Allo Protocol, Gitcoin Passport, and gardens.fund**.

---

## **Governance Commitment**

Major decisions — including:
- Selection of the final **TEE stack** (e.g., Integritee, Phala, Secret, or AWS Nitro)
- Formation of the **project steward team** and the **builder team**
- Distribution of any **follow-on funds** or bounties

...will be made transparently **within a FundLoop Garden**, governed by $GTC stakers and ecosystem-aligned contributors. This approach ensures that **community alignment and capital allocation** evolve in tandem with the technology itself.

---

## **Milestones & Timeline**

| Milestone | Description | Timeframe |
|----------|-------------|-----------|
| **M1: Research & Team Formation** | Evaluate TEE vs ZK architecture options, define minimum viable flow | 2–3 weeks |
| **M2: FundLoop Garden Setup** | Deploy and activate FundLoop Garden for community governance | 1 week |
| **M3: Architecture Spec & MVP Plan** | Finalize architecture, prepare roadmap for pilot build | 3-6 weeks |

---

## **Requested Funding**

**Total Ask:** $5,000 USD

**Use of Funds:**  
- Incentivize early research and architectural design
- Cover deployment and setup of the governance layer
- Seed coordination and scoping for MVP build, developing a proof-of-concept

Leftover funds, if any, will be used towards continuing development of an MVP and towards integrating the FundLoop web app with **Allo Protocol**.

---

## **Team**

**Kaz** – Ecosystem Architect at FundLoop. Deep background in regenerative economics, DAO coordination, and mutual-aid incentive systems. Previously consulted on public goods strategy and decentralized infrastructure across the Near ecosystem. Funder and builder of the Procent Foundation multichain ecosystem. Steward of the GreenPill Toronto chapter.

**Builder roles TBD** – To be appointed via open call through the FundLoop Garden after community input and milestone alignment.

**Project Steward roles TBD** – To be appointed via open call through the FundLoop Garden after community input and milestone alignment.

---

## **Technology Partners (Under Consideration)**

We are actively exploring four TEE compute environments to anchor the privacy guarantees of zkActivitySum:

- **Integritee** (decentralized SGX on Polkadot)
- **Phala Network** (off-chain confidential workers)
- **Secret Network** (Cosmos-based private contracts)
- **AWS Nitro Enclaves** (centralized, but fast to prototype)

Our goal is to launch with one and **abstract the interface for future ZK-native implementations**.

---

## **Outcome**

zkActivitySum will initially be prototyped within FundLoop, where it will be a core part of the capital allocation protocol. Once stable, it will then be made available for integration into any Garden, Allo Pool, or PGF-compatible funding round. 

We envision this tool powering:
- Threshold-based UBI eligibility
- Usage scoring for quadratic or MACI-based voting rounds
- Interoperable proofs of engagement across grant ecosystems

It will do so **without ever exposing individual user behavior or centralizing cross-app identity data** — preserving the Web3 ethos while increasing capital efficiency.

---

## **Get Involved**

We are joining the Gitcoin Grants Garden and will stake our $GTC.  
We welcome co-governance through the #allo-integrations channel.  
We invite Allo stewards to co-sign our multisig wallet for fund management.

---

*This project is small in ask but foundational in vision — seeding a new primitive in the capital allocation layer of Web3.*
