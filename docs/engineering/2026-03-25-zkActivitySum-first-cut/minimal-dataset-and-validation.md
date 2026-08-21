Below is the minimal (not canonical) **dataset upload + validation UX and flow** for zkActivitySum v1, scoped to get us operational fast without painting us into a corner.

# zkActivitySum v1 — Minimal Dataset Upload + Validation UX

## Goal

Enable a project operator or FundLoop admin to upload one monthly dataset per project, validate it strictly, and make it eligible for inclusion in a monthly zkAS run.

This flow should be built to support:

* manual early-month operations
* clear operator confidence
* strict data hygiene
* future automation later

It should fit naturally into the existing Next app and Supabase-backed admin experience, while sitting alongside your existing `projects`, `payments`, `project_stats_monthly`, and `users` ecosystem. 

---

# 1. Primary user roles

## Project uploader

A project admin or designated operator who submits the monthly file.

## FundLoop operator

A network-level admin who:

* reviews uploads
* sees validation results
* approves datasets for run inclusion
* creates the monthly run

For v1, it is fine if FundLoop operators do most of this manually.

---

# 2. Core user journey

## Step 1: Enter the zkAS admin area

Add a small admin section in the app, something like:

* `/admin/zkas`
* `/admin/zkas/uploads`
* `/admin/zkas/runs`

This does not need to be public-facing.

---

## Step 2: Start a new dataset upload

Uploader chooses:

* month
* project
* file type: CSV or JSON

The system should strongly guide toward CSV first unless JSON is already truly needed.

### Minimal form fields

* Project
* Month
* File upload
* Optional note

### Nice but still simple

Also show:

* expected schema
* downloadable template
* short rules summary

---

## Step 3: Pre-upload guidance

Before upload, the screen should make these rules painfully clear:

* one row per user per month per app
* required columns must be present
* optional scoring columns must be either fully used or fully omitted
* all used numeric columns must contain numeric values in every row
* no flags in v1
* no event logs in v1
* clean data only

Do not hide this in docs. Put it directly on the upload screen.

---

## Step 4: Upload and initial parsing

Once the file is uploaded, the app performs a first validation pass.

This is not yet “approved.” It is just parsed and checked.

The app should immediately show:

* file name
* upload time
* row count
* detected columns
* project
* month
* parsing status

If parsing fails, the user gets a hard stop.

---

# 3. Validation stages

Treat validation as a staged pipeline, even if v1 implements it simply.

## Stage A: File-level validation

Checks:

* file can be opened
* format is allowed
* file is not empty
* file is not absurdly large
* headers/keys are readable

## Stage B: Schema validation

Checks:

* required columns present
* no fatal unknown structure
* column names match expected format
* month value is present and coherent
* project selection is coherent with upload context

## Stage C: Column consistency validation

Checks:

* if `activity_score` is populated anywhere, it must be populated everywhere
* same for `activity_count`
* same for `confidence_weight`
* used optional columns must be numeric in every row

## Stage D: Row-level validation

Checks:

* no blank `app_user_id`
* no duplicate user rows within the file unless duplicates are explicitly forbidden and surfaced
* numeric columns are valid numerics
* no impossible values if you choose to enforce baseline sanity checks

## Stage E: Dataset integrity validation

Checks:

* file month matches selected month
* selected project matches upload context
* there is not already another approved dataset for the same project/month unless replacing is explicitly allowed
* row count and score distribution are not obviously broken

For v1, “obviously broken” can just mean a few simple warnings, not advanced anomaly detection.

---

# 4. Validation result UX

After upload, show a **validation report page**.

## If passed

Show:

* status: Passed
* row count
* required columns found
* optional columns used or omitted
* hash generated
* ready for approval / inclusion

## If failed

Show:

* status: Failed
* exact error list
* row numbers where possible
* which rule failed
* option to upload corrected file

## If passed with warnings

Show:

* status: Passed with warnings
* warnings clearly separated from errors
* operator can still proceed

Example warnings:

* unusually low row count vs prior month
* unusually high average score
* missing optional columns entirely

Warnings should not block v1 unless you want them to.

---

# 5. Approval model

Do not make upload automatically equal “run-ready.”

Use a simple state progression:

* Draft / Uploaded
* Validated
* Approved for run use
* Included in run
* Archived / Replaced

For v1, approval can be done by a FundLoop operator only.

That gives you a control checkpoint before anything enters the monthly allocation.

---

# 6. Minimal screens to build

## A. Upload list page

Shows all uploaded datasets with:

* month
* project
* uploader
* status
* row count
* uploaded at
* validation result

## B. Upload page

Simple form for dataset submission.

## C. Validation result page

Detailed report for one dataset.

## D. Dataset detail page

Shows:

* metadata
* validation summary
* approval state
* whether included in a run
* link to replacement history if any

That is enough for v1.

---

# 7. Minimal operator flow

## Project-side or admin-side upload

1. Choose project and month
2. Upload CSV
3. Review validation report
4. Fix and re-upload if needed

## FundLoop operator

1. Open pending validated datasets
2. Review summary
3. Approve acceptable datasets
4. Use approved datasets when creating the monthly run

This is manual, but clean.

---

# 8. Recommended repo fit

## `app/`

Add admin routes for:

* upload list
* upload form
* validation detail
* dataset detail

## `components/`

Add:

* upload form
* validation summary card
* validation error table
* dataset status badge
* dataset detail panel

## `lib/`

Put the actual reusable logic here:

* CSV/JSON parsing helpers
* validation rules
* upload orchestration
* storage helpers
* dataset status helpers

## `types/`

Define shared types for:

* upload payload
* parsed dataset shape
* validation report
* validation error
* dataset status

## `tests/`

This is where you need discipline.
Add tests for:

* valid file
* missing required columns
* partial optional column usage
* non-numeric values
* duplicate rows
* bad month/project mismatches

## `supabase/`

Later this will hold the supporting migrations, but for now the PRD level point is simply:

* dataset metadata and validation state belong in the database
* raw files belong in object storage

---

# 9. Tables likely reusable vs missing

From your current structure, the main reusable anchors are:

* `projects`
* `users`
* `payments`
* `project_stats_monthly`
* `audit_log`
* `cron_logs` 

## Likely reusable

### `projects`

Use this to associate each dataset with a specific project.

### `audit_log`

Useful for tracking approvals, replacements, and operator actions.

### `cron_logs`

May later be reused or echoed for run-trigger events, though probably too generic by itself.

### `project_stats_monthly`

Potentially useful as a comparison source for sanity-check warnings.

## Clearly missing

You almost certainly need new concepts for:

* dataset upload registry
* validation results
* dataset approval state
* dataset-to-run inclusion mapping

Those concepts do not appear to exist yet in the current schema summary. 

---

# 10. UX principles for v1

## Be strict, not clever

Do not auto-correct silently.
Do not infer too much.
Reject bad data plainly.

## Show operators exactly what happened

Every failure should say:

* what failed
* where it failed
* how to fix it

## Optimize for repeat monthly use

The same people will do this again next month.
Make it boring and reliable.

## Prefer explicit templates

Give uploaders a template file.
That will save you a lot of grief.

---

# 11. Definition of done for the upload + validation slice

This slice is done when:

A project operator or FundLoop admin can:

* upload a monthly dataset for a project
* receive a deterministic validation result
* see exact errors if invalid
* re-upload a corrected file
* get an approved dataset into a “ready for run” state

And a FundLoop operator can:

* view all submitted datasets for a month
* distinguish valid from invalid
* approve a valid dataset
* later include that dataset in a monthly run

And engineering can:

* run automated tests covering the validation rules
* trust that the same file always yields the same validation outcome

---

# 12. What not to build yet

Do not build these in this slice:

* user-facing explanation pages
* token payout routing
* automatic project-to-project anomaly detection
* advanced fraud heuristics
* full TEE execution UI
* automated cron execution
* rich analytics dashboards

Those can come later. First get a hard, reliable intake gate.

---

# 13. Recommended build order for this slice

1. Shared dataset types and validation rules in `types/` and `lib/`
2. Parser + validator tests in `tests/`
3. Upload form and validation result UI in `app/` + `components/`
4. Dataset list/detail pages
5. Approval action for operators
6. Hook it into later run creation flow

That is the cleanest order.

---

EOD
