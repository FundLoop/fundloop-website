# backgrounder-for-agents.md

Related planning docs:
- [Agent Context Index](/Users/botmaster/src/fundloop/agent-context/README.md)
- [Current-State Architecture](/Users/botmaster/src/fundloop/agent-context/current-state-architecture.md)
- [Target-State Architecture](/Users/botmaster/src/fundloop/agent-context/target-state-architecture.md)
- [TODO Roadmap](/Users/botmaster/src/fundloop/agent-context/todo.md)

## Purpose of this Document

This document is required reading for any coding agent working on FundLoop. It provides context about *why* FundLoop exists, *who it serves*, and *what matters most* when making implementation decisions.

This is **not** a README. It is a grounding layer to ensure all agents build with aligned intent.

---

## Primary User: Who is this for?

FundLoop serves **two first-class user types**:

### 1. Humans

* Builders, contributors, and participants in value-aligned projects
* Project operators committing a % of revenue
* Individuals seeking a **citizen salary / UBI-like income** tied to participation

### 2. Agents (Critical)

* Autonomous or semi-autonomous software agents acting on behalf of users or organizations
* Agents interacting with FundLoop via **MCP-compatible interfaces**
* Agents performing:

  * Data submission (activity, contributions)
  * Fund routing
  * Governance participation
  * Identity / proof interactions

**Important:** Agents are not secondary. The system must be designed so that:

* Everything a human can do → an agent can also do programmatically
* Interfaces are deterministic, structured, and automatable

---

## Primary Goal: What must the user do?

### For Projects:

* Commit a **% of revenue (e.g. 1%)** into FundLoop
* Submit funds regularly (monthly cadence)
* Provide attribution data (who contributed, how much)

### For Individuals:

* Prove they are a **unique human (proof-of-personhood)**
* Participate in projects
* Receive allocations based on:

  * Participation breadth
  * Attribution from projects
  * System-wide distribution rules

### For Agents:

* Submit and retrieve structured data reliably
* Execute workflows without ambiguity
* Interact via MCP endpoints without requiring UI

---

## Business Goal: What does success look like?

Success is **not traffic or signups**.

Success = a functioning economic loop:

1. **Projects contribute funds regularly**
2. **Data about contributions is submitted consistently**
3. **Proof-of-personhood is enforced**
4. **Funds are distributed transparently and credibly**
5. **Participants receive meaningful payouts**
6. **More projects join because the system works**

### Key Signals of Success:

* Monthly funding cycles executed without manual intervention
* Increasing number of contributing projects
* Increasing number of verified humans
* High trust in payout fairness
* Minimal fraud / sybil leakage

---

## Content: What is real copy/data?

Agents must distinguish between:

### Real Data (Authoritative)

* Project submissions (fund amounts, timestamps)
* User participation data
* Attribution weights (who contributed what)
* Proof-of-personhood scores
* Distribution results
* On-chain transactions

### Semi-Real (Mutable / Experimental)

* Allocation formulas
* Weighting systems
* Governance parameters

### Placeholder / Non-Canonical

* Current website content (FundLoop.org is a draft)
* UI labels and explanatory copy
* Early mock flows

**Rule:**
If something affects money, identity, or allocation → treat it as critical data.
Everything else is secondary.

---

## Brand Signals: Colours, Logo, Type, Voice

### Tone / Voice

* Clear, direct, non-hype
* Optimistic but grounded
* “Regens in a degen world”
* Focus on **systems that work**, not ideals alone

### Design Principles

* Minimal, functional UI
* Data-first presentation (tables > marketing fluff)
* Transparency over aesthetics

### Visual Direction (current, not final)

* Neutral / dark-friendly palette
* Clean sans-serif typography
* Emphasis on clarity over brand flair

**Important for agents:**
Do not over-design. Prioritize usability, clarity, and system integrity.

---

## Constraints

### Tech Stack

* **Frontend:** Next.js (app router)
* **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
* **Data Model:** Relational, strongly structured, audit-friendly
* **Integrations:**

  * Proof-of-personhood (external systems)
  * On-chain transactions
  * MCP interface for agents

---

### Architecture Constraints

* Must support **monthly computation cycles**
* Must support **replayability** (re-run past months)
* Must support **auditability** (trace every payout)
* Must support **multi-project aggregation**
* Must support **agent-first interaction (MCP)**

---

### Operational Constraints

* Early versions are **partially manual**
* Excel parity may be required initially for validation
* System will evolve month-to-month

---

### Accessibility Level

* Functional accessibility required (basic compliance)
* Not a pixel-perfect or WCAG-AAA product (yet)
* Prioritize:

  * Clear flows
  * Legible data
  * Simple interactions

---

### Timeline Reality

* This is an **iterative build**
* Early versions will be incomplete
* The priority is:

  1. Working system
  2. Reliable data
  3. Correct payouts

Polish comes later.

---

## Key Design Principles (Non-Negotiable)

### 1. Determinism over Magic

* Same inputs → same outputs
* No hidden logic

### 2. Auditability

* Every number must be explainable
* Every payout traceable

### 3. Agent Compatibility

* No UI-only flows
* Everything must be callable via structured interfaces

### 4. Minimize Trust Assumptions

* Assume adversarial conditions
* Design against sybil attacks and manipulation

### 5. Start Simple, Expand Carefully

* Avoid premature complexity
* Ship the smallest working economic loop first

---

## Final Mental Model

FundLoop is:

* Not a website
* Not a dashboard
* Not a social platform

It is:

> A **monthly economic coordination engine**
> that routes capital from projects → to humans
> based on participation, attribution, and verified identity
> and cretes a co-marketing engine for a living, thriving ecosystem

Everything you build should serve that loop.

If it doesn’t → it’s likely unnecessary.

---

EOF
