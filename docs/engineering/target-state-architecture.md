# FundLoop Target-State Architecture

Last drafted: 2026-04-14

Related planning docs:
- [Engineering Docs Index](./README.md)
- [Agent Context Index](../../agent-context/README.md)
- [Backgrounder for Agents](./backgrounder-for-agents.md)
- [Current-State Architecture](./current-state-architecture.md)
- [TODO Roadmap](../../agent-context/todo.md)

## 1. North Star

FundLoop should become a production-grade monthly economic coordination engine that serves two first-class audiences:

- humans
  - regular users discovering projects, proving personhood, participating, and managing earnings
  - founders and project members onboarding, funding the loop, managing contribution operations, and growing their project presence
- agents
  - MCP-compatible software agents acting on behalf of users, founders, or project teams through deterministic protocol-facing interfaces

The target system is not just a website and not just an internal dashboard. It is:

- a polished multilingual consumer and founder product
- a reliable money and identity workflow engine
- an audit-friendly monthly bookkeeping and distribution system
- an agent-operable protocol interface

## 2. Product Outcomes the Architecture Must Satisfy

The target architecture is successful only if it supports all of the following simultaneously:

- visually stunning presentation with a simple, calm, data-clear UX
- full light mode and dark mode support
- all current stubbed or placeholder pages completed, retired, or refactored into real flows
- multilingual capability across the public site and app
- Supabase storage as the primary artifact and document store
- most reads and all writes routed through Supabase Edge Functions
- an MCP server for agent interaction with FundLoop protocols and workflows
- mandatory KYC / proof-of-personhood through CUBID.me as the canonical identity provider
- support for both regular users and founders as primary product personas
- support for EVM and Solana rails through chain-abstracted execution services
- stubbed but intentional multi-currency fiat rails for inbound project funding and outbound user payouts
- a first-class monthly economic cadence:
  - end-of-month lock
  - prep
  - zk-calculation / distribution
  - cleanup / verification
  - distribution / payout
  - reporting

## 3. Target System Shape

The target system should still feel like one product, but internally it should separate into five clear layers.

### 3.1 Experience layer

This is the user-facing web app built in Next.js App Router.

Responsibilities:

- public site, marketing, project discovery, and educational content
- authenticated user and founder workspaces
- multilingual presentation
- theme system with strong light/dark parity
- fast, clean, low-friction interaction design
- data visualization and reporting UI

Rules:

- prefer server-rendered reads via Next server components calling backend interfaces
- keep client components focused on interaction, wallet adapters, forms, and optimistic UI
- no direct write logic from the browser to tables
- no business-critical browser reads directly from Supabase tables except where explicitly carved out as safe/cacheable

### 3.2 Application API layer

This becomes the primary backend contract for the app and agents.

Target implementation:

- Supabase Edge Functions become the standard write path
- most authenticated reads also move behind Edge Functions
- route handlers in the Next app become thin orchestration or session-bootstrap adapters, not the core domain layer

Responsibilities:

- authenticated request validation
- authorization and policy enforcement
- workflow orchestration
- identity lookups against CUBID.me
- payment and payout orchestration
- monthly-cycle state transitions
- protocol-safe read models for the app and MCP server

Practical target rule:

- all writes through Edge Functions
- most reads through Edge Functions
- direct table reads only for carefully selected internal admin or cache-friendly scenarios, and preferably phased out over time

### 3.3 Data and storage layer

Supabase remains the primary data platform.

Responsibilities:

- Postgres as the system of record
- Storage buckets for uploaded artifacts, generated reports, payout exports, proofs, and project assets
- auth/session foundation for the web app
- durable audit and observability storage

Target data design principles:

- strongly relational, explicit lifecycle states
- immutable snapshots for anything that affects money, identity, or monthly results
- replayable monthly state and reproducible distributions
- append-friendly event records for auditability
- clean separation between:
  - operational source data
  - monthly locked snapshots
  - derived reporting views

### 3.4 Protocol and execution layer

This is the chain-facing and payout-facing execution tier.

Responsibilities:

- chain-abstracted deposit and payout orchestration
- EVM support
- Solana support
- fiat rail stubs with a clear future adapter boundary
- receipt verification and reconciliation
- deterministic execution adapters used by Edge Functions

Important target principle:

the product should not hardcode chain-specific business logic into UI components or page-level handlers. Chain specifics belong behind execution adapters with a stable FundLoop-facing interface.

### 3.5 Agent interface layer

FundLoop should expose the same real workflows to agents through an MCP server.

Responsibilities:

- expose founder and project-member workflows programmatically
- support structured reads and writes for:
  - project onboarding status
  - funding obligations
  - route management
  - monthly cycle status
  - reporting and audit retrieval
  - user/project operational tasks
- provide deterministic schemas and error semantics

Design rule:

the MCP server should call the same Edge Function and protocol interfaces as the web app. It should not become a second backend with different rules.

## 4. Primary Product Surfaces

### 4.1 Public and discovery surfaces

These become complete, polished, multilingual experiences.

Target capabilities:

- public explanation of FundLoop as a working economic engine
- project discovery and browsing for regular users
- founder acquisition and onboarding funnels
- transparent explanation of identity, cadence, payouts, and verification
- data-forward reporting pages that build trust instead of hype

All current placeholder, half-marketing, or stubbed public pages should resolve into one of three states:

- a finished production page
- merged into a clearer flow
- removed entirely

### 4.2 Regular user workspace

This becomes the home for people receiving or tracking value from the system.

Target capabilities:

- sign in through Supabase auth
- link or create a CUBID.me account
- sync canonical identity traits from CUBID.me
- complete proof-of-personhood / KYC requirements through CUBID.me only
- discover projects to participate in
- view participation status and attribution
- view earnings, pending distributions, payout history, and payout preferences
- access reporting and explanations for how distributions were calculated

### 4.3 Founder and project workspace

This becomes the home for project operators and members.

Target capabilities:

- founder onboarding and project creation
- organization and team member management
- contribution route management
- inbound funding management for crypto and future fiat rails
- monthly obligation review, lock, and submission
- growth and participation reporting
- project attribution and data submission tools
- access for project members and agents, not just one founder account

### 4.4 Internal operations workspace

Internal operators need a real control plane, not scattered admin pages.

Target capabilities:

- monthly cadence management
- payment and payout operations
- reconciliation and exception handling
- observability and audit drill-down
- zk-calculation review and publication
- reporting export workflows
- manual interventions with strong audit trails

## 5. Identity and KYC Model

### Canonical identity provider

CUBID.me should be the source of truth for:

- proof-of-personhood
- KYC status
- socials
- phone
- email
- identity-linked metadata exposed by its API

Target rule:

FundLoop does not own primary KYC collection UX. FundLoop consumes identity state from CUBID.me through API integration and stores only the minimum synchronized snapshot needed for operations, permissions, and audit.

### Internal identity model

FundLoop should maintain:

- auth identity
- linked CUBID identity reference
- current synced identity snapshot
- verification status snapshot per monthly cycle where needed

This allows:

- deterministic month-end locking
- replay of historical calculations with identity state as of that cycle
- avoidance of mutable real-time identity drift corrupting prior results

## 6. Payments, Payouts, and Multi-Rail Execution

### 6.1 Inbound funding from projects

Target support:

- EVM contract-based deposits
- Solana program-based deposits
- fiat inbound stubbed behind the same abstract interface

The UI should present a single funding model:

- choose route
- review obligation
- submit / settle
- reconcile

The backend should handle:

- chain-specific execution
- route validation
- receipt verification
- normalized ledger updates

### 6.2 Outbound payouts to users

Target support:

- EVM payouts
- Solana payouts
- fiat payout stub

Important target principle:

outbound payouts should be modeled as a distinct subsystem from inbound project contributions, even if they share chain adapters and reconciliation primitives.

### 6.3 Chain abstraction boundary

Define a stable execution interface such as:

- create deposit intent
- submit deposit
- verify receipt
- create payout batch
- execute payout batch
- reconcile payout status

Each rail adapter implements that interface:

- EVM adapter
- Solana adapter
- fiat stub adapter

This keeps monthly-cycle logic and product flows chain-agnostic.

## 7. Monthly Economic Cadence

This is the true heart of the target architecture.

The system should model each month as an explicit operational cycle with stateful phases.

### Cycle phases

1. `lock`
   - end-of-month project contribution and attribution inputs are frozen
   - identity and eligibility snapshots are locked
   - reconciliation cutoff rules are applied

2. `prep`
   - validate completeness
   - fill missing operational data
   - flag exceptions
   - generate deterministic computation inputs

3. `calculate`
   - run zk-calculation or equivalent distribution computation
   - produce reproducible result artifacts
   - stage outputs for review

4. `cleanup_and_verify`
   - reconcile mismatches
   - confirm totals
   - verify audit trails
   - approve distribution package

5. `distribution`
   - create payout intents / batches
   - execute payouts by supported rails
   - reconcile final payout outcomes

6. `reporting`
   - publish project-facing and user-facing results
   - persist reporting artifacts
   - expose auditable explanations and exports

### Architecture implications

The target schema should treat a monthly cycle as a first-class entity with:

- status
- cutoff times
- locked snapshots
- input manifests
- computation artifacts
- verification records
- payout batches
- published reports

This should replace ad hoc month-based operational logic with a proper cycle engine.

## 8. Read / Write Architecture

### Writes

All writes should go through Supabase Edge Functions.

Examples:

- onboarding publish
- project updates
- contribution route changes
- deposit intent creation
- receipt recording
- monthly lock operations
- payout batch execution
- report publication
- agent-driven mutations via MCP

### Reads

Most reads should also move through Edge Functions.

Examples:

- project workspace dashboards
- user earnings and payout views
- cycle status
- audit and observability views
- reporting aggregates

Direct table reads should be minimized because the target product needs:

- stable contracts for human UI and MCP clients
- consistent authorization logic
- ability to evolve storage without rewriting every screen

## 9. MCP Server Target Role

The MCP server should be a first-class protocol interface, not a debugging extra.

Primary target personas:

- founders
- project members
- operator agents acting on behalf of organizations

Capabilities should include:

- read project obligations, route state, and cycle status
- create and update funding routes
- submit attribution and supporting data
- retrieve observability and reconciliation status
- inspect published monthly reports
- access protocol-safe commands for project operations

The MCP server should not bypass business rules. It should sit above the same Edge Function and execution interfaces used by the web app.

## 10. Frontend Experience Direction

The target frontend should be:

- visually stunning
- simple
- clean
- multilingual
- dark/light complete
- operationally legible

This does not mean a louder or more decorative UI. It means:

- fewer dead-end pages
- stronger hierarchy
- better discovery and onboarding funnels
- cleaner dashboards
- more transparent data presentation
- excellent typography, spacing, and motion discipline

The target interaction model should be:

- low-friction for users
- confidence-building for founders
- deterministic and data-clear for operators

## 11. Target Technical Boundaries

### 11.1 Next.js app

Owns:

- presentation
- routing
- authenticated session bootstrap
- server-rendered composition
- localized content rendering
- thin adapters to Edge Functions and MCP-compatible surfaces where needed

Does not own:

- direct domain writes
- core monthly-cycle logic
- chain-specific execution logic

### 11.2 Edge Functions

Own:

- application domain commands
- most read models
- authorization
- orchestration
- third-party API integrations
- monthly-cycle commands
- payout and reconciliation workflows

### 11.3 Postgres

Owns:

- canonical records
- snapshots
- ledger-like event data
- reporting materializations
- audit and observability data

### 11.4 Storage

Supabase Storage owns:

- uploaded project artifacts
- generated cycle exports
- zk inputs and outputs
- reporting files
- proof / audit attachments
- project media and user-uploaded assets where appropriate

### 11.5 Execution adapters

Own:

- EVM rail logic
- Solana rail logic
- fiat stub integrations
- reconciliation primitives

### 11.6 MCP server

Owns:

- agent-facing protocol interface
- structured tool contracts
- deterministic programmatic access

It should remain a thin capability layer over the same backend contracts used by the app.

## 12. Migration Direction from Current State

From the current architecture, the most important transition steps are:

1. move payment and onboarding writes out of Next server actions into Edge Functions
2. move most high-value reads behind stable backend contracts
3. split `project-payment-actions` responsibilities into smaller backend modules
4. introduce a first-class monthly cycle domain model
5. add a dedicated payout subsystem parallel to inbound payment flows
6. add Solana and fiat-stub rail adapters behind a common execution interface
7. integrate CUBID.me as the canonical KYC / identity source
8. expose founder and project-member operations through an MCP server
9. finish or remove all placeholder surfaces and unify the UX into production-grade user and founder journeys

## 13. Non-Negotiable Design Principles

- determinism over hidden logic
- auditability for all money and distribution paths
- agent compatibility for all meaningful workflows
- minimal trust assumptions
- explicit monthly-cycle state transitions
- chain abstraction at the backend boundary, not the UI layer
- CUBID.me as the identity and KYC source of truth
- one real backend contract shared by web users, operators, and agents

## 14. Practical Target-State Mental Model

When FundLoop reaches the intended architecture, the right mental model should be:

> A multilingual, beautiful, founder-and-user-facing web product
> backed by Supabase and Edge Functions
> with chain-abstracted funding and payout execution
> a first-class monthly economic cycle engine
> and an MCP server that lets agents participate in the same real workflows as humans.
