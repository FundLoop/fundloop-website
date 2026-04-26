# Supabase Remote Deployments

Last reviewed: 2026-04-21

FundLoop deploys Supabase schema migrations and Edge Functions through the `Supabase Deploy` GitHub Actions workflow.

## Targets

- Pull requests into `dev` run a database migration dry-run against the dev Supabase project.
- Pull requests into `main` run a database migration dry-run against the main Supabase project.
- Pushes to `dev` deploy migrations and all tracked Edge Functions to the dev Supabase project.
- Pushes to `main` deploy migrations and all tracked Edge Functions to the main Supabase project through the GitHub `Production` environment gate.
- Manual `workflow_dispatch` can run a `dry-run` or `deploy` against either target. Manual `main` deploys also use the `Production` environment gate.
- All other runs use the GitHub `Preview` environment.

PR runs intentionally do not mutate shared databases or deploy functions.

## Required GitHub Secrets

- `DEV_SUPABASE_SESSION_POOLER_URL`
- `MAIN_SUPABASE_SESSION_POOLER_URL`
- `SUPABASE_ACCESS_TOKEN`

The pooler URLs must be session-pooler Postgres connection strings with the standard Supabase username format:

```text
postgres.<project-ref>
```

The workflow parses `<project-ref>` from that username and fails before deployment if the format does not match. The parsed project ref is used for `supabase functions deploy --project-ref`.

## Deployment Behavior

Database migrations are deployed with:

```bash
supabase db push --yes --db-url "$SUPABASE_DB_URL"
```

Pull requests use the same target resolution but run:

```bash
supabase db push --yes --db-url "$SUPABASE_DB_URL" --dry-run
```

Edge Functions are deployed by enumerating each local function directory under `supabase/functions/` except `_shared` and deploying them one by one:

```bash
supabase functions deploy "<function-name>" --project-ref "$SUPABASE_PROJECT_REF"
```

The workflow pins the Supabase CLI version instead of using `latest`; update it deliberately during normal dependency/tooling triage.

The workflow never runs remote seeds, never resets a remote database, and never writes Supabase function secrets.

## Function Runtime Secrets

Each Supabase project must already have the runtime secrets needed by the functions, including Supabase URL/key values, CUBID credentials, wallet/runtime configuration, and any future integration keys.

Use Supabase project settings or the Supabase CLI secrets workflow to manage those values deliberately per environment.
