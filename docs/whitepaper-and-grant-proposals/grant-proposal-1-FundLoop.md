Source: https://hackmd.io/phawC4SHTsafdkN6aTt5vQ

Below is a grant proposal made in collaboration with **GreenPill Toronto** and **Sacred Protocol** to pilot a new candidate primitive for **allo.capital** called **FundLoop**. It reflects a funding ask of **$3,000** to execute an **inaugural pilot epoch** of the new protocol, with governance routed through a new **FundLoop Garden** for governance of key parameters and decisions.

---

# FundLoop Inaugural Pilot Proposal  
**For Gitcoin Gardens:** Allo Capital Builders Fund

**Website:** [fundloop.org](https://fundloop.org)  

**Team:**  
- **Kaz:** Ideation, system architecture and strategy @ GreenPill Toronto  
- **Harry:** Full-stack development @ CUBID Protocol  
- **Paul:** CTO @ Sacred Protocol  
- **Lisan:** Funds distribution mechanism and operations @ Sacred Protocol  

---

## Overview

FundLoop is a new economic network that enables projects to pledge 1% of their revenue to support a citizen salary for verified active users.  

FundLoop solves three fundamental problems:
1. **People need cash**. FundLoop pays people for simply being an active user in more than one participating protocol.
2. **Projects need users.** FundLoop incentivizes users to explore and join other participating projects.
3. **The world needs more capital allocation mechanisms**. FundLoop proposes to become the next Allo.Capital primitive.

We have successfully launched and bootstrapped the [**fundloop website**](https://fundloop.org) where projects and users can already sign up for early access.

However, while the signup flow is operational, the actual processes for submitting revenue and active user data are still in early draft form and have not yet been tested.

This proposal seeks support to **operationalize the full cycle: submission, validation, and distribution,** albeit manual without trusted execution environments nor any zk-proofs.

---

## Process flow

![fundloop_final_flow](https://hackmd.io/_uploads/By79Hg5kxx.png)


FundLoop is a new project that centers on an idea of a **mutual aid society** or a "**virtual network state**" where projects & apps collaborate to help each other get more users. Projects contribute minimal usage data and **1% of their revenue** (or more) to FundLoop, from where users get rewarded with a streamed & airdropped "**citizen salary**" for being truly **active and in good standing across several value-aligned and sybil-resistant apps**

---

## Scope of Work

We will focus on five concrete areas:

1. **Fine-tuning the Submission Process**  
   - Enable project admins to easily submit revenue contributions and lists of active users via the fundloop.org interface.  
   - Create dashboards for tracking submissions.

2. **Operationalizing Data Collection**  
   - Set up backend processes for validating submissions, including timestamped entries, audit trails, and basic anomaly checks.

3. **Piloting the First Round**  
   - Open invitation the first cohort of projects to submit revenues and user activity. (Note: We are open to all interested projects, applications are permissionless.)
   - Process real submissions through the improved flow.  
   - Identify bottlenecks and prepare for scaling.

4. **Verifying Proof of Personhood & Proof of Participation**  
   - Integrate a lightweight PoP verification method (e.g., Cubid, Gitcoin Passport, or social graph-based proof) to ensure that users are real and unique. 
   - Design & pilot quadratic formulas to convert binary information on user participation into funds allocation
   - Prioritize minimal friction for users, overall allocation fairness, and future engagement potential with new protocols

5. **Paying Users via Social Tipping**  
   - We will pilot our first citizen salary payments using a social tipping protocol requiring nothing more than a Twitter handle. 
   - This approach will allow users to receive micro-payments easily without setup overhead, allowing us to push complex implementations to the future, such as bank transfers or requesting normie users to create external wallets.

In parallel, we will establish a **governance process** using [**Gardens.Fund**](https://gardens.fund) to let participants vote continuously on key decisions, weights and thresholds as the pilot progresses.

*(FYI: Whats **not** included in the scope of work: scaleability, zero-knowledge, trusted execution environments, etc.)*

---

## Budget Request

**Total Request:** $3,000

Broken into individual, non-sequential milestones:

| Milestone | Description | Budget |
|:---|:---|---:|
| 1 | Submission Flow Upgrade (frontend + backend) | $500 |
| 2 | Data Collection System (backend processes) | $500 |
| 3 | Proof of Personhood integration (simple MVP) | $500 |
| 4 | Quadratic Proof of Activity formulas (simple MVP) | $500 |
| 5 | Gardens.Fund Governance Setup | $500 |
| 6 | First Pilot Execution (processing, payments) | $500 |
|   | **Total request** | **$3,000** |

Beneficiary Address: GreenPill Toronto

We are aiming for lean, fast iteration with a focus on testing real-world workflows quickly. Any unused funds will be added as a boost to the inaugural Citizen Salary distribution.

---

## Why It Matters to Gitcoin Gardens


**Gitcoin Gardens** is pioneering **regenerative ecosystems for public goods funding** with the Allo Capital Builders Fund. FundLoop fits seamlessly into this mission by creating a **scalable, permissionless method for rewarding meaningful participation and redistributing value back to individuals**.  

Our approach combines **grassroots verification, decentralized funding submissions,** and **pilotable governance flows,** all aligned with Gitcoin’s goals of building resilient coordination infrastructure.  

[Supporting FundLoop now will help expand the toolset available for building more transparent, participatory ecosystems — starting with a simple but powerful pilot.
](https://fundloop.org)
---
