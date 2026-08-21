Here is the consolidated v1 design input set, written as the current working assumptions for zkActivitySum.

## zkActivitySum v1 — Design Inputs and Assumptions

### 1. Output of month 1

zkActivitySum v1 will output all three of the following for each qualifying user:

* a binary eligibility result
* a continuous aggregate activity score
* a final normalized dollar allocation

The dollar allocation is the canonical result. The eligibility result and aggregate score exist for auditability, internal review, and limited user-facing explanation.

### 2. Privacy boundary

The computation will run inside a TEE. The TEE will see pseudonymous per-app user inputs and perform the cross-app identity linkage internally. Public and application-facing outputs will not expose app-scoped IDs or global Cubid IDs. Instead, outputs will use zkActivitySum-scoped Cubid IDs, which are anonymous but consistent within zkActivitySum’s identity namespace.

### 3. App data submission format

Participating apps will submit pre-aggregated monthly user data, not event-level logs. The expected shape is one row per user per month per app. Initial supported submission formats will be signed CSV and/or signed JSON uploads.

### 4. Canonical identity join

Identity joining across apps will use Cubid app-scoped IDs, with re-linking performed inside the TEE. Participating apps only know their own Cubid-scoped identifiers. The TEE is the place where shared identity resolution occurs.

### 5. Activity and proof-of-personhood weighting

zkActivitySum v1 will combine activity and proof-of-personhood-related weighting in a single computation. Activity contributes to how much value a user should receive, and Cubid-derived confidence weighting can influence the final score.

### 6. Replayability scope

Every run must preserve enough information to support replayability and auditability. This includes:

* code version or git commit
* container image digest
* run configuration
* environment/config manifest
* schema version
* input dataset hash
* TEE attestation artifact
* exact output artifact

This is a core requirement, not an optional enhancement.

### 7. Retention policy

Run hashes and metadata will be retained indefinitely. Encrypted raw inputs and enough supporting artifacts to enable meaningful replay should be preserved for at least 12 months. Full reproducibility is expected for at least that window.

### 8. Supabase, object storage, and app responsibilities

Supabase will act as the control plane, while object storage will act as the data plane.

* Supabase stores run metadata, manifests, validation results, references, and operational records.
* Object storage stores uploaded input files, generated outputs, and related artifacts.
* The Next.js web app will facilitate upload into object storage and retrieval from object storage, using Supabase as the orchestration and metadata layer.

### 9. Upgrade strategy between months

Each monthly run is pinned to an immutable execution bundle. At minimum this means:

* a git tag or commit
* a container image digest
* a configuration manifest

Each month should be treated as a versioned release of zkActivitySum logic, so that later logic changes do not destroy the ability to understand or replay earlier runs.

### 10. Audit model

External or authorized auditors should be able to verify that a specific output came from a specific attested computation environment using a specific image and input hash set. If separately authorized, they may also be able to re-run the computation against decrypted inputs. The default model is strong verifiability without routine disclosure of sensitive input data.

### 11. First TEE target

The initial implementation will optimize for AWS Nitro Enclaves as the first practical TEE target. Other TEE environments remain possible future targets, but Nitro is the initial deployment assumption.

### 12. TEE operating system choice

zkActivitySum v1 will not be designed around OP-TEE, Trusty, or similar embedded/mobile-style TEE operating systems. Instead, it will rely on the TEE and confidential compute environment provided by the chosen cloud or enclave platform. For v1, the design target is enclave/confidential workload packaging, not low-level TEE OS development.

### 13. Runtime stack and execution modes

The core computation engine will be written in Python. This is preferred for data handling, validation logic, scoring iteration, and monthly evolution of the algorithm. The engine will run in a containerized form.

The system will support two execution modes:

* non-TEE container runs for development and rapid testing
* TEE runs for canonical, auditable, production results

Non-TEE runs are useful for iteration, but only TEE runs count as official.

### 14. Run triggering model

The system should be designed for cron-based recurring execution in the long term. However, the first few months of production and all test runs will be manually triggered. Manual triggers must still go through the same run framework and produce the same class of artifacts as scheduled runs.

### 15. TEE scope and output semantics

The TEE will handle the sensitive portions of the pipeline:

* internal identity linking
* score calculation
* weighting
* final user-level allocation calculation
* signed or attestable output production

The TEE output is a final recommended allocation in USD per zkActivitySum-scoped user. The downstream FundLoop application then determines the best token split and payout routing needed to deliver that recommended USD value across supported tokens and rails.

### 16. Canonical input schema and scoring defaults

The v1 canonical per-row schema is:

* `month`
* `project_id`
* `app_user_id`
* `activity_score` optional
* `activity_count` optional
* `confidence_weight` optional

The total row-level score is:

`total_score = (activity_score if present else 1) × (activity_count if present else 1) × (confidence_weight if present else 1)`

Further validation assumptions:

* if a given optional column is used at all in a file, then every row in that column must be populated
* values in used optional columns must be numeric
* nulls are only acceptable when the entire optional column is omitted or intentionally unused
* flags are not part of v1

### 17. Upload checker and dataset validation

The app will include an upload checker or dataset validator before a dataset becomes eligible for inclusion in a run. This validator will check:

* schema conformity
* required columns
* optional-column consistency
* numeric validation
* duplicate detection as appropriate
* month consistency
* project integrity and other basic invariants

Only validated datasets should be admitted into a run manifest.

### 18. Negative signals and exclusions

v1 will not incorporate negative signals, penalties, or complex fraud-weighting rules. Projects are expected to submit clean input data. Objects and records are effectively pass or not-pass for inclusion. If exclusions exist, they are handled outside of v1 scoring complexity rather than through penalty logic.

### 19. User-facing explainability

User-facing explanation in v1 will be intentionally limited. A user may be shown:

* the number of apps contributing to their result
* their final aggregate dollar allocation

They will not be shown per-app detail, raw internal weights, or the full internal scoring breakdown.

### 20. Execution model scope for v1

v1 is TEE-only in production. Traditional zk proving is not part of v1. The design may still be structured cleanly enough that a future computation backend could be swapped or extended, but v1 itself is not a dual TEE-and-ZK system.

### 21. Additional identity assumption

Identity resolution is explicitly assumed to occur inside the TEE. That means Cubid-related mapping material must be made available to the enclave in a way that allows the enclave to reconstruct the cross-app identity graph internally, rather than delivering pre-resolved user identities outside the trusted boundary.

---

EOD