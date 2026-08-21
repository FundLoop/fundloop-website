This is the upload flow, our **data gate**, and our **decision + execution layer**.

---

# 🧠 zkActivitySum v1 — Monthly Run Creation & Operator Flow PRD

## 1. What This Slice Does (Outcome)

This system allows FundLoop operators to:

* assemble a **monthly run** from approved datasets
* lock in a **specific computation version**
* execute the run (initially manually)
* receive a **TEE-attested allocation result**
* store and inspect outputs for audit and payout

👉 This is where “data becomes money.”

---

## 2. Core Concept: The “Run”

A **run** is a single, immutable computation event.

It represents:

* one month
* one set of datasets
* one computation version
* one output result

Think of it like:

> a block in a blockchain, but for economic allocation

---

## 3. Primary Operator Flow

## Step 1: Open Run Dashboard

Route:

* `/admin/zkas/runs`

Operator sees:

* list of past runs
* current month status
* datasets available for inclusion

---

## Step 2: Create New Run

Operator selects:

* Month (e.g. 2026-04)
* Datasets (from approved pool)
* Optional note

System enforces:

* only one dataset per project per month
* only approved datasets selectable
* no duplicate project inclusion

---

### UX requirement (important)

Show a clean summary:

* total projects included
* total users (approx, from datasets)
* which projects are missing
* dataset versions used

👉 This builds operator confidence before execution.

---

## Step 3: Lock the Run

Once created, the run enters:

* **Draft → Locked**

After locking:

* datasets cannot change
* config cannot change
* this becomes the canonical input set

👉 This is a critical integrity boundary.

---

## Step 4: Trigger Execution

Operator clicks:

* “Run zkActivitySum”

For v1:

* manual trigger only
* later → cron

System:

* assembles execution package
* calls execution service (local or TEE)

---

## Step 5: Execution Lifecycle

Run moves through states:

* Pending
* Running
* Completed
* Failed

During execution:

* show logs (basic)
* show progress indicator (even if coarse)

---

## Step 6: Result Handling

On success:

System stores:

* output dataset reference
* summary stats
* attestation artifact

Operator sees:

* total users allocated
* total USD distributed
* per-user results (admin view)
* link to raw output file

---

## Step 7: Mark as Final

Run becomes:

* **Completed (Final)**

After this:

* results are immutable
* used for payouts
* referenced in audit

---

# 4. Core Features to Build

## A. Run Creation Interface

* select month
* select datasets
* preview summary
* create run

---

## B. Run Locking Mechanism

* prevents mutation
* ensures reproducibility

---

## C. Execution Trigger

* manual button
* backend job call

---

## D. Execution Status Tracking

* run state machine
* logs (basic text is fine)

---

## E. Results Viewer

* summary panel
* downloadable output
* user-level table (admin only)

---

## F. Run History

* list of all runs
* filter by month/status
* view past outputs

---

# 5. How This Fits Into Your Repo

## `app/`

Add:

* `/admin/zkas/runs` (list)
* `/admin/zkas/runs/[id]` (detail)
* `/admin/zkas/runs/new`

---

## `components/`

Add:

* run summary panel
* dataset selector
* run status badge
* execution log viewer
* results table

---

## `lib/`

Core orchestration lives here:

* run creation logic
* dataset aggregation
* execution trigger wrapper
* result parsing helpers

---

## `types/`

Define:

* Run
* RunStatus
* RunInput
* RunOutput
* ExecutionResult

---

## `zkas/` (new domain)

This becomes critical now:

```id="n5oxzc"
zkas/
  engine/      # scoring logic
  runner/      # execution wrapper
  interface/   # input/output contracts
```

---

## `tests/`

Add:

* deterministic run tests
* input → output consistency tests
* edge case scoring tests

---

# 6. Existing Tables You Can Leverage

From your schema :

## Useful

### `projects`

* used to validate dataset inclusion

### `users`

* reference for Cubid IDs (indirectly)

### `audit_log`

* log:

  * run creation
  * run execution
  * run completion

### `cron_logs`

* may track execution attempts later

---

# 7. Missing Concepts (Critical)

You do NOT currently have structures for:

## 1. Run Registry

You need to represent:

* month
* status
* version
* execution metadata

---

## 2. Run ↔ Dataset Mapping

Which datasets were used in which run

---

## 3. Execution Metadata

* start time
* end time
* logs
* execution mode (TEE vs local)

---

## 4. Run Outputs

* output file reference
* summary stats
* attestation reference

---

👉 These are core to zkAS and must exist conceptually even if implemented simply first.

---

# 8. UX Requirements (Important)

## A. Confidence before execution

Operators must clearly see:

* what data is included
* what is missing
* what will happen

## B. Irreversibility clarity

Once a run is locked:

* UI must communicate:

  > “This cannot be changed”

## C. Clear failure handling

If a run fails:

* show reason
* allow retry (new run or rerun)

## D. Clean separation

Do NOT mix:

* dataset management
* run execution
* payout logic

---

# 9. Definition of Done (Run System)

This slice is complete when:

## 🟢 Functional

* operator can create a run from approved datasets
* system prevents invalid combinations
* operator can trigger execution
* system produces output and stores it

---

## 🟢 Integrity

* locked runs cannot be modified
* same inputs produce same outputs (locally)

---

## 🟢 Observability

* operator can see:

  * run status
  * logs
  * results

---

## 🟢 Auditability

* every run is:

  * identifiable
  * reproducible (at least locally)
  * tied to a specific dataset set

---

## 🟢 TEE Integration (baseline)

* at least one run executed via TEE
* attestation stored
* output linked to attestation

---

# 10. What Not To Build Yet

Avoid:

* automated scheduling UI
* governance voting on runs
* multi-run comparisons
* user-facing payout dashboards
* advanced analytics

Stay focused.

---

# 11. Recommended Build Order

1. Run creation UI (no execution yet)
2. Dataset selection + validation gating
3. Run locking logic
4. Local execution integration
5. Result storage + viewer
6. Execution status tracking
7. TEE execution integration

---

# 12. The Real Insight

If upload/validation is:

> “garbage filter”

Then run system is:

> **“economic commit layer”**

This is where trust is either built or lost.

---

EOD
