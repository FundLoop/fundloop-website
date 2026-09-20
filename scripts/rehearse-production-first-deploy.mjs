// Rehearses FundLoop Prod's first pipeline database deploy against a local replica of its
// observed starting state (supabase/rehearsal/production-first-deploy/00_production_baseline.sql).
//
//   node scripts/rehearse-production-first-deploy.mjs
//
// Boots two isolated, task-owned Postgres 17 Supabase databases in the local Docker host:
//   rehearsal  - Prod baseline, then the exact deploy sequence (handover pre, db push, handover post)
//   reference  - a plain full-history replay, for comparison
// Then reports: the unpatched-push failure, applied history, data preservation, reference-data
// gaps, and every RLS/policy/client-privilege difference caused by Prod's starting state.
// Both databases are stopped and removed afterwards. Nothing touches hosted projects.

import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { randomBytes } from "node:crypto"

const rehearsalDir = "supabase/rehearsal/production-first-deploy"
const referenceTables = [
  "ref_categories", "ref_chain_assets", "ref_chains", "ref_genders", "ref_interests", "ref_invitation_statuses",
  "ref_locations", "ref_notification_types", "ref_occupations", "ref_payment_methods", "ref_payment_periodicities",
  "ref_payment_statuses", "ref_roles", "ref_skills", "ref_social_platforms", "blog_posts", "team_roles",
]

const baseEnv = { ...process.env, PGSSLMODE: "disable" }
for (const key of ["DEV_SUPABASE_SESSION_POOLER_URL", "MAIN_SUPABASE_SESSION_POOLER_URL", "SUPABASE_ACCESS_TOKEN"]) delete baseEnv[key]

function run(command, args) {
  execFileSync(command, args, { env: baseEnv, stdio: "inherit" })
}

function attempt(command, args) {
  const result = spawnSync(command, args, { env: baseEnv, encoding: "utf8" })
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` }
}

function query(dbUrl, sql) {
  return execFileSync("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], { env: baseEnv, encoding: "utf8" }).trim()
}

function psqlFile(dbUrl, file) {
  run("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-f", file])
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close((error) => (error ? reject(error) : resolve(typeof address === "object" && address ? address.port : null)))
    })
  })
}

async function startDatabase(label) {
  const projectId = `fundloop-rehearsal-${label}-${randomBytes(6).toString("hex")}`
  const root = mkdtempSync(path.join(os.tmpdir(), `${projectId}-`))
  const port = await availablePort()
  mkdirSync(path.join(root, "supabase", "migrations"), { recursive: true })
  writeFileSync(path.join(root, "supabase", "config.toml"), `project_id = "${projectId}"

[db]
port = ${port}
major_version = 17
health_timeout = "3m"

[db.migrations]
enabled = true
schema_paths = []

[db.seed]
enabled = false
sql_paths = []
`)
  const database = { label, root, url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`, started: true }
  run("supabase", ["db", "start", "--yes", "--workdir", root])
  return database
}

function stopDatabase(database) {
  if (!database) return
  try {
    run("supabase", ["stop", "--no-backup", "--workdir", database.root])
  } catch (error) {
    console.error(`Could not fully stop ${database.label}:`, error)
  }
  rmSync(database.root, { recursive: true, force: true })
}

const push = (database) => attempt("supabase", ["db", "push", "--yes", "--include-all", "--db-url", database.url])

const securitySnapshotSql = `
  select c.relname || '|rls=' || c.relrowsecurity
    || '|anon=' || concat_ws(',', nullif(has_table_privilege('anon', c.oid, 'SELECT')::text, 'false') , case when has_table_privilege('anon', c.oid, 'INSERT') then 'ins' end, case when has_table_privilege('anon', c.oid, 'UPDATE') then 'upd' end, case when has_table_privilege('anon', c.oid, 'DELETE') then 'del' end)
    || '|auth=' || concat_ws(',', nullif(has_table_privilege('authenticated', c.oid, 'SELECT')::text, 'false'), case when has_table_privilege('authenticated', c.oid, 'INSERT') then 'ins' end, case when has_table_privilege('authenticated', c.oid, 'UPDATE') then 'upd' end, case when has_table_privilege('authenticated', c.oid, 'DELETE') then 'del' end)
    || '|policies=' || coalesce((select string_agg(p.policyname || ':' || p.cmd, ',' order by p.policyname) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname), '')
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  order by c.relname`

function snapshot(dbUrl) {
  return new Map(query(dbUrl, securitySnapshotSql).split("\n").filter(Boolean).map((line) => [line.split("|")[0], line]))
}

const report = { findings: [], ok: true }
const fail = (message) => { report.ok = false; report.findings.push(`FAIL ${message}`) }
const note = (message) => report.findings.push(`NOTE ${message}`)
const pass = (message) => report.findings.push(`OK   ${message}`)

let rehearsal
let reference
try {
  const migrationVersions = readdirSync("supabase/migrations").filter((name) => /^\d+_.+\.sql$/.test(name)).map((name) => name.split("_")[0]).sort()

  rehearsal = await startDatabase("prod")
  reference = await startDatabase("reference")

  // Event triggers need superuser; on Prod ensure_rls belongs to supabase_admin as well.
  psqlFile(rehearsal.url.replace("postgres:postgres@", "supabase_admin:postgres@"), `${rehearsalDir}/00_production_baseline.sql`)
  const baselineCronRows = Number(query(rehearsal.url, "select count(*) from public.cron_logs"))
  const baselineAuthUsers = Number(query(rehearsal.url, "select count(*) from auth.users"))

  // 1. What happens if the pipeline deploy runs unmodified.
  const unpatched = push(rehearsal)
  if (unpatched.status !== 0 && /cron_logs/.test(unpatched.output) && /already exists/.test(unpatched.output)) {
    pass("unmodified deploy fails at initial_remote.sql because public.cron_logs already exists (expected)")
  } else if (unpatched.status === 0) {
    fail("unmodified deploy unexpectedly succeeded; re-check the Prod baseline")
  } else {
    fail(`unmodified deploy failed for an unexpected reason:\n${unpatched.output.slice(-1500)}`)
  }
  const partialHistory = query(
    rehearsal.url,
    "select case when to_regclass('supabase_migrations.schema_migrations') is null then 0 else (select count(*) from supabase_migrations.schema_migrations) end",
  )
  if (partialHistory === "0") pass("failed deploy left no partial migration history")
  else fail(`failed deploy recorded ${partialHistory} migrations`)

  // 2. The planned sequence.
  psqlFile(rehearsal.url, `${rehearsalDir}/10_cron_logs_handover_pre.sql`)
  const patched = push(rehearsal)
  if (patched.status !== 0) {
    fail(`deploy after handover-pre failed:\n${patched.output.slice(-3000)}`)
    throw new Error("rehearsal deploy failed")
  }
  const applied = query(rehearsal.url, "select version from supabase_migrations.schema_migrations order by version").split("\n")
  if (JSON.stringify(applied) === JSON.stringify(migrationVersions)) pass(`all ${applied.length} migrations applied in order`)
  else fail(`applied history differs from repository (${applied.length} vs ${migrationVersions.length})`)

  psqlFile(rehearsal.url, `${rehearsalDir}/20_cron_logs_handover_post.sql`)
  psqlFile(rehearsal.url, `${rehearsalDir}/30_cron_logs_handover_cleanup.sql`)
  const cronRows = Number(query(rehearsal.url, "select count(*) from public.cron_logs"))
  const authUsers = Number(query(rehearsal.url, "select count(*) from auth.users"))
  if (cronRows === baselineCronRows) pass(`cron_logs preserved (${cronRows} rows)`)
  else fail(`cron_logs rows ${baselineCronRows} -> ${cronRows}`)
  if (authUsers === baselineAuthUsers) pass(`auth.users preserved (${authUsers})`)
  else fail(`auth.users ${baselineAuthUsers} -> ${authUsers}`)
  const profilesForPrelaunchUsers = Number(query(rehearsal.url, "select count(*) from public.users where user_id in (select id from auth.users)"))
  note(`public.users rows for pre-existing auth users after deploy: ${profilesForPrelaunchUsers}/${authUsers}`)

  // 3. Reference data on a database that never runs seed.sql.
  const empty = referenceTables.filter((table) => query(rehearsal.url, `select count(*) from public.${table}`) === "0")
  if (empty.length === 0) pass("all reference/content tables have rows")
  else fail(`empty reference/content tables after deploy (seed.sql does not run in Production): ${empty.join(", ")}`)

  // 4. Security posture versus a plain replay.
  const referencePush = push(reference)
  if (referencePush.status !== 0) throw new Error(`reference replay failed:\n${referencePush.output.slice(-1500)}`)
  const prodSecurity = snapshot(rehearsal.url)
  const referenceSecurity = snapshot(reference.url)
  const differences = []
  for (const [table, line] of prodSecurity) {
    const other = referenceSecurity.get(table)
    if (other !== line) differences.push(`  prod: ${line}\n  repl: ${other ?? "(missing)"}`)
  }
  for (const table of referenceSecurity.keys()) if (!prodSecurity.has(table)) differences.push(`  missing in prod: ${table}`)
  if (differences.length === 0) pass("RLS flags, policies and client privileges match a plain replay")
  else note(`${differences.length} security differences between Prod rehearsal and plain replay:\n${differences.join("\n")}`)

  const exposed = query(rehearsal.url, `
    select string_agg(c.relname, ', ' order by c.relname) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
      and (has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE') or has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE'))`)
  if (!exposed) pass("no client-writable public table without RLS")
  else fail(`client-writable public tables without RLS: ${exposed}`)

  // 5. Behavioural suites that do not depend on seed.sql data.
  for (const suite of ["legacy_public_rls_policies.sql", "public_client_write_grants.sql", "audit_trigger_definer.sql"]) {
    const file = `supabase/tests/${suite}`
    const result = attempt("psql", [rehearsal.url, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-f", file])
    if (result.status === 0) pass(`suite ${suite}`)
    else if (/No such file/.test(result.output)) note(`suite ${suite} not present on this branch`)
    else fail(`suite ${suite}:\n${result.output.slice(-800)}`)
  }
} catch (error) {
  report.ok = false
  report.findings.push(`ERROR ${error instanceof Error ? error.message : String(error)}`)
} finally {
  stopDatabase(rehearsal)
  stopDatabase(reference)
}

console.log(`\n==== Production first-deploy rehearsal: ${report.ok ? "PASS" : "ATTENTION NEEDED"} ====`)
for (const line of report.findings) console.log(line)
process.exitCode = report.ok ? 0 : 1
