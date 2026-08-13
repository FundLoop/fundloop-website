import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildDeploymentAuditRows } from "@/lib/onchain/deployment-audit"
import type { WalletRuntimeConfig } from "@/lib/onchain/runtime-config"

const runtimeConfig: WalletRuntimeConfig = {
  environment: "preview",
  manifestVersion: "fundloop-wallet-deployments.v1",
  reownProjectId: "reown-project-id",
  reownProjectIdConfigured: true,
  walletEnabled: false,
  activeChains: [],
  issues: [],
}

describe("deployment audit rows", () => {
  it("marks disabled manifest chains as mismatched when db rows stay active", () => {
    const rows = buildDeploymentAuditRows(
      runtimeConfig,
      [
        {
          id: 1,
          chain_id: 2,
          collection_mode: "contract",
          contract_address: "0x1111111111111111111111111111111111111111",
          treasury_address: "0x2222222222222222222222222222222222222222",
          abi_version: "fundloop-intake-v1",
          is_active: true,
          ref_chains: {
            id: 2,
            network_key: "base",
            display_name: "Base",
          },
        },
      ],
      "preview",
    )

    const baseRow = rows.find((row) => row.networkKey === "base")
    expect(baseRow?.status).toBe("mismatch")
    expect(baseRow?.statusReason).toMatch(/manifest disables this chain/i)
  })
})

describe("Supabase deployment replay contract", () => {
  const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8")
  const deployWorkflow = readFileSync(".github/workflows/supabase-deploy.yml", "utf8")
  const bootstrapRunner = readFileSync("scripts/run-supabase-pr-replay-ci.mjs", "utf8")
  const replayRunner = readFileSync("scripts/run-supabase-pr-replay.mjs", "utf8")
  const failureSmoke = readFileSync("scripts/smoke-supabase-pr-replay-failure.mjs", "utf8")

  it("pins the regression-tested CLI for both replay and deployment", () => {
    expect(ciWorkflow).toContain("version: 2.113.0")
    expect(deployWorkflow).toContain("version: 2.113.0")
    expect(deployWorkflow).not.toContain("version: 2.90.0")
  })

  it("executes full migration history locally before retaining remote dry-run planning", () => {
    expect(ciWorkflow).toContain("pnpm supabase:replay:ci")
    expect(ciWorkflow).not.toContain("supabase db start --yes")
    expect(bootstrapRunner).toContain('["db", "start", "--yes", "--workdir", bootstrapRoot]')
    expect(bootstrapRunner).toContain('["stop", "--no-backup", "--workdir", bootstrapRoot]')
    expect(bootstrapRunner).toContain('["scripts/run-supabase-pr-replay.mjs"]')
    expect(bootstrapRunner).toContain('["scripts/smoke-supabase-pr-replay-failure.mjs"]')
    expect(deployWorkflow).toContain('supabase db push --yes --include-all --db-url "$supabase_db_url" --dry-run')
    expect(replayRunner).toContain('run("supabase", ["db", "push", "--yes", "--include-all", "--db-url", dbUrl])')
    expect(replayRunner).toContain("supabase_migrations.schema_migrations order by version")
  })

  it("bootstraps a unique seed-disabled workdir and requires zero application history", () => {
    expect(bootstrapRunner).toContain("fundloop-pr-replay-${randomBytes(8)")
    expect(bootstrapRunner).toContain('[db.seed]\nenabled = false')
    expect(bootstrapRunner).toContain('mkdirSync(path.join(bootstrapSupabase, "migrations")')
    expect(bootstrapRunner).toContain("127.0.0.1:${dbPort}")
    expect(bootstrapRunner).toContain('delete isolatedEnv[key]')
    expect(replayRunner).toContain("Replay preflight passed: application migration history is empty.")
    expect(replayRunner).toContain("replay database already contains % application migrations")
  })

  it("seeds once after the exact history check", () => {
    expect(bootstrapRunner).not.toContain("supabase/seed.sql")
    expect(replayRunner.match(/supabase\/seed\.sql/g)).toHaveLength(1)
    expect(replayRunner.indexOf("supabase_migrations.schema_migrations order by version"))
      .toBeLessThan(replayRunner.indexOf("supabase/seed.sql"))
  })

  it("covers the prepared-statement regression, final migration, and representative SQL boundaries", () => {
    expect(replayRunner).toContain('"20260809020000"')
    expect(replayRunner).toContain('"20260811120000"')
    expect(replayRunner).toContain("review_policy_controls.sql")
    expect(replayRunner).toContain("epoch_funded_allocation.sql")
    expect(replayRunner).toContain("project_payment_rail_integrity.sql")
  })

  it("fails closed on a disposable invalid migration without accepting remote targets", () => {
    expect(replayRunner).toContain("Refusing non-loopback replay target")
    expect(failureSmoke).toContain("Refusing non-loopback replay target")
    expect(failureSmoke).toContain("deliberate_missing_ci_relation")
    expect(failureSmoke).toContain("Invalid migration was rejected")
    expect(failureSmoke).toContain("20260811120000")
  })

  it("always reports the required PR dry-run check and gates scoped execution", () => {
    expect(deployWorkflow).toContain("pull_request:\n    branches:\n      - dev\n      - main\n  push:")
    expect(deployWorkflow).toContain("name: Classify Supabase change")
    expect(deployWorkflow).toContain("git diff --no-renames --name-only")
    expect(deployWorkflow).toContain("node scripts/classify-supabase-drift-push.mjs deploy")
    expect(deployWorkflow).toContain("name: Supabase execution")
    expect(deployWorkflow).toContain("needs.scope.outputs.should_run == 'true'")
    expect(deployWorkflow).toContain("name: Supabase ${{ github.event_name == 'pull_request' && 'dry-run'")
    expect(deployWorkflow).toContain('if [[ "${SHOULD_RUN}" == "false" && "${SUPABASE_RESULT}" != "skipped" ]]')
  })
})
