# Monthly Reporting Publication

Session 36 introduced the first durable reporting publication model.

## Storage And Tables

- `monthly_cycle_reports` stores published report metadata for a monthly cycle.
- `monthly_cycle_report_audience` scopes each report to `public`, `user`, `founder`, or `operator`.
- `monthly-cycle-reports` is the Supabase Storage bucket reserved for generated report artifacts.
- Report rows may point at stored JSON, Markdown, or PDF artifacts through `artifact_bucket`, `artifact_path`, `artifact_mime_type`, and `artifact_hash`.

The table is intentionally metadata-first. Later generation commands can write artifacts to Supabase Storage and upsert matching report rows without changing the page contracts.

## Role Surfaces

- Public readers use `/[locale]/reports`.
- Users use `/[locale]/workspace/reporting`.
- Founders use `/[locale]/founder/projects/[slug]/reporting`.
- Operators use `/[locale]/admin/cycles/[cycleKey]/reporting`.

These pages are read-only in Session 36. Report generation, publication commands, artifact signing, and retention automation remain future sessions.

## Operating Rule

Monthly reports should attach to `monthly_cycles`. Pages should use reporting read models from `lib/reporting/monthly-cycle-reports.ts` instead of separately reconstructing cycle status, user results, project summaries, and artifact metadata.
