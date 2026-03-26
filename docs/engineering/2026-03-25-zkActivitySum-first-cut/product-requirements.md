# 🧠 zkActivitySum v1 — High-Level PRD

## 1. What We’re Building (Outcome)

zkActivitySum v1 is a **monthly computation system** that:

* collects standardized activity data from participating projects
* privately links user identities across apps (inside a TEE)
* computes a **fair, aggregate USD allocation per user**
* produces an **attestable, replayable result**
* returns outputs to FundLoop for payout execution
* is zero-knowledge for involved parties through means of TEE (not ZK tech)

It is **not**:

* a real-time system
* a generic analytics engine
* a ZK system (yet)
* a user-facing product

👉 It is a **batch computation + trust system** that underpins FundLoop payouts.

---

## 2. Core Product Capabilities

### A. Dataset Intake & Validation

* Projects upload monthly user activity datasets
* System validates:

  * schema correctness
  * numeric consistency
  * completeness rules (column-level strictness)
* Only valid datasets can be used

👉 This is your first major product surface.

---

### B. Run Creation & Management

* Operators define a “monthly run”
* A run consists of:

  * selected validated datasets
  * a pinned computation version
* Runs are immutable once executed

👉 Think: “Git commit for economic distribution”

---

### C. Execution Engine (TEE-backed)

* Runs execute inside a TEE
* Engine performs:

  * identity linkage
  * score computation
  * aggregation
  * allocation

👉 This is the trust core of the system

---

### D. Output & Distribution Interface

* TEE produces:

  * per-user USD allocation
  * attested result artifact
* Results are stored and exposed to:

  * FundLoop payout logic
  * admin UI
  * (eventually) user UI

---

### E. Audit & Replay Layer

* Every run is:

  * reproducible
  * versioned
  * auditable
* System can:

  * list past runs
  * inspect inputs/outputs (metadata-level)
  * verify integrity

---

## 3. What Needs to Be Built (High Level)

### 1. Dataset Upload + Validation System

* Upload UI in app
* Backend validation pipeline
* Dataset approval state

### 2. Run Orchestration System

* Create run
* Select datasets
* Trigger execution (manual first)
* Track run lifecycle

### 3. Execution Service (Containerized Python Engine)

* Accepts run inputs
* Executes scoring logic
* Produces outputs
* Works in:

  * local mode (dev)
  * TEE mode (prod)

### 4. TEE Integration Layer

* Packaging + execution adapter
* Attestation capture
* Output sealing

### 5. Results Storage + Retrieval

* Store outputs
* Link to runs
* Expose via app

### 6. Admin UI (minimal but critical)

* Upload datasets
* Validate datasets
* Create runs
* Trigger runs
* View results

---

## 4. How This Fits Into Your Monorepo

You don’t need a new repo. You need one new **domain module**.

### 🔹 New Top-Level Folder (recommended)

```
zkas/
```

Inside:

```
zkas/
  engine/        # Python computation engine
  runner/        # execution wrapper (local vs TEE)
  schemas/       # dataset schema definitions
  versioning/    # config + run versioning logic
```

---

### 🔹 Existing Folders (how they are used)

#### `app/`

* Dataset upload UI
* Run management UI
* Admin dashboards

#### `lib/`

* Upload helpers
* Validation logic
* Supabase + storage clients
* zkAS orchestration helpers

#### `supabase/`

* Stores:

  * dataset metadata
  * run metadata
  * validation results
  * output references

#### `types/`

* Shared types:

  * dataset schema
  * run status
  * result format

#### `tests/`

* Validation tests
* scoring logic tests (non-TEE)

---

## 5. What You Can Reuse vs What’s Missing

### ✅ Already Useful Tables

From your schema :

#### Projects & participation

* `projects`
* `participants`
* `project_users`

👉 These give you:

* project registry
* user-project relationships

---

#### Users

* `users` (with `cubid_id`, `cubid_score`)

👉 Important:

* This is your bridge to Cubid
* BUT **not used directly in zkAS identity output**

---

#### Payments

* `payments`

👉 Can later connect:

* zkAS output → payment generation

---

#### Stats tables

* `project_stats_monthly`

👉 Possibly useful for:

* sanity checks
* comparisons vs submitted data

---

### ❌ Missing (You Will Need These Concepts)

Not exact schemas, but conceptually:

#### 1. Dataset Registry

You need something like:

* uploaded datasets
* per project
* per month
* validation status
* storage reference

---

#### 2. Dataset Validation Results

* pass/fail
* error logs
* schema checks

---

#### 3. Run Registry

* each monthly run
* version reference
* selected datasets
* status

---

#### 4. Run Outputs

* result reference (object storage)
* summary stats
* attestation reference

---

#### 5. Run ↔ Dataset Mapping

* which datasets were used in which run

---

👉 These are completely missing today and are **core to zkAS**

---

## 6. Product Boundaries (Important)

### zkActivitySum is responsible for:

* data ingestion (validated)
* identity linkage (TEE)
* scoring
* allocation (USD)
* auditability

### FundLoop app is responsible for:

* token routing
* swaps/bridging
* payout execution
* user experience

👉 Keep this separation clean or things get messy fast

---

## 7. Success Criteria / Definition of Done (v1)

### 🟢 Functional

* At least 1 full monthly run completed end-to-end
* ≥ 2 projects submit valid datasets
* System computes allocations successfully
* Outputs consumed by payout logic

---

### 🟢 Data Integrity

* 100% of datasets pass strict validation before inclusion
* No partial/invalid columns allowed
* Deterministic scoring (same inputs → same outputs)

---

### 🟢 Replayability

* A past run can be:

  * identified
  * re-executed (locally at minimum)
  * verified against original outputs

---

### 🟢 TEE Execution

* At least 1 successful run executed in a TEE
* Attestation artifact captured
* Output tied to that attestation

---

### 🟢 UX (Admin)

* Admin can:

  * upload dataset
  * see validation result
  * create run
  * trigger run
  * view results

Without engineering intervention.

---

### 🟢 Separation of Concerns

* zkAS produces USD allocations only
* No token logic inside zkAS

---

### 🟢 Performance (reasonable baseline)

* Can process:

  * 10k–100k users
  * across multiple projects
* Within acceptable batch time (minutes, not hours)

---

## 8. What Will Kill This If You Get It Wrong

Straight talk:

* ❌ Loose validation rules → garbage in → loss of trust
* ❌ Mixing payout logic into zkAS → architectural mess
* ❌ No strict run versioning → impossible audits
* ❌ No clear admin UX → you become the operator forever
* ❌ Skipping local execution → development becomes painfully slow

---

## 9. The Real Product Insight

You are not building a feature.

You are building:

> **A trusted economic computation layer for multi-project ecosystems**

If this works:

* FundLoop works
* zkActivitySum becomes reusable beyond FundLoop

If this is sloppy:

* everything downstream loses credibility

---

EOD
