import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

type Capability = {
  id: string
  state: "local-real" | "sandbox-real" | "stubbed" | "pending"
  personas: string[]
  evidence: string[]
  pendingReason?: string
  highRisk: string[]
}

const matrix = JSON.parse(readFileSync(path.resolve("tests/e2e/operational/feature-118-capability-matrix.json"), "utf8")) as {
  schemaVersion: number
  featureIssue: number
  taskIssue: number
  productionValueFlowEnabled: boolean
  capabilities: Capability[]
}

describe("Feature #118 operational capability matrix", () => {
  it("covers every required persona and operational boundary without duplicate claims", () => {
    expect(matrix).toMatchObject({ schemaVersion: 1, featureIssue: 118, taskIssue: 144, productionValueFlowEnabled: false })
    expect(new Set(matrix.capabilities.map((entry) => entry.id)).size).toBe(matrix.capabilities.length)
    expect(new Set(matrix.capabilities.flatMap((entry) => entry.personas))).toEqual(new Set([
      "new-member", "returning-member", "new-founder", "returning-founder", "returning-operator",
    ]))
    expect(matrix.capabilities.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "policy-user-review-acknowledgement",
      "profile-private-publication-consent",
      "project-invitation-consented-sharing",
      "founder-package-settlement-review",
      "withdrawal-partial-queue-fee-settlement",
      "operator-twelve-stage-shadow-run",
      "operator-fx-review-and-source-order",
      "operator-allocation-rerun-and-close",
      "base-usdc-intake-and-safe-payout",
      "stripe-connect-usd-cad-payout",
      "stripe-bank-transfer-usd-cad-intake",
      "stripe-canadian-pad-intake",
      "stripe-eur-gbp-pay-by-bank-intake",
    ]))
  })

  it("never represents a stubbed or unavailable provider path as real", () => {
    const stripeIntake = matrix.capabilities.find((entry) => entry.id === "stripe-bank-transfer-usd-cad-intake")
    expect(stripeIntake?.state).toBe("pending")
    expect(matrix.capabilities.find((entry) => entry.id === "stripe-canadian-pad-intake")?.state).toBe("local-real")
    expect(matrix.capabilities.find((entry) => entry.id === "stripe-eur-gbp-pay-by-bank-intake")?.state).toBe("local-real")
    expect(matrix.capabilities.find((entry) => entry.id === "base-usdt-review-route")?.state).toBe("stubbed")
    expect(matrix.capabilities.find((entry) => entry.id === "base-pyusd-review-route")?.state).toBe("stubbed")
    for (const entry of matrix.capabilities.filter((candidate) => ["pending", "stubbed"].includes(candidate.state))) {
      expect(entry.pendingReason?.length).toBeGreaterThan(20)
    }
  })

  it("binds each claim to existing evidence and an explicit high-risk matrix", () => {
    for (const entry of matrix.capabilities) {
      expect(entry.evidence.length).toBeGreaterThan(0)
      for (const evidencePath of entry.evidence) expect(() => readFileSync(path.resolve(evidencePath))).not.toThrow()
      expect(entry.highRisk.length).toBeGreaterThan(0)
    }
  })

  it("orchestrates only the loopback stack and resets owned local state on exit", () => {
    const script = readFileSync(path.resolve("scripts/run-feature-118-operational-matrix.mjs"), "utf8")
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as { scripts: Record<string, string> }
    expect(packageJson.scripts["test:e2e:feature-118"]).toBe("node scripts/run-feature-118-operational-matrix.mjs")
    expect(script).toContain('dbUrl.hostname !== "127.0.0.1"')
    expect(script).toContain('dbUrl.port !== "55322"')
    expect(script).toContain('apiUrl.port !== "55321"')
    expect(script).toContain('await execute("all-five-personas", "pnpm", ["test:e2e:personas"])')
    expect(script).toContain('await execute("base-local-wallet", "pnpm", ["test:e2e:local"])')
    expect(script).toContain('let cleanup = await run("supabase", ["db", "reset", "--local"]')
    expect(script).toContain('if (!cleanup.ok) cleanup = await run("supabase", ["db", "reset", "--local"]')
    expect(script).not.toMatch(/db push|supabase link|--linked|productionValueFlowEnabled: true/)
    const personaRunner = readFileSync(path.resolve("scripts/run-playwright-local-personas.mjs"), "utf8")
    expect(personaRunner).toContain("waitForReadinessProbe")
    expect(personaRunner).toContain('id: "supabase-foundation"')
    expect(personaRunner).toContain("let deletionOk = false")
    expect(personaRunner).toContain("!deletionOk && !deleteLocalOwnerRecord")
    const localWalletRunner = readFileSync(path.resolve("scripts/run-playwright-local-wallet.mjs"), "utf8")
    expect(localWalletRunner).toContain("applyCommittedSqlFixture")
    expect(localWalletRunner).toContain("supabase/tests/fixtures/epoch_funded_allocation_browser.sql")
    expect(localWalletRunner).toContain("supabase/tests/withdrawal_obligation_control_plane.sql")
    expect(localWalletRunner).toContain("supabase/tests/base_safe_payout_control_plane.sql")
    expect(localWalletRunner).toContain("supabase/tests/stripe_connect_payout_control_plane.sql")
    expect(localWalletRunner).toContain('"--project=operational-local"')
    expect(localWalletRunner).toContain("async function resetLocalDatabase")
    expect(localWalletRunner).toContain("await waitForLocalWalletSchema({ env })")
    expect(localWalletRunner).not.toContain('waitForHttp(`${sharedEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`)')
    expect(localWalletRunner).toContain("await resetLocalDatabase().catch(() => {})")
    expect(localWalletRunner).toContain("attempt < 120")
    expect(localWalletRunner).toContain("stopProcessGroup(child)")
    expect(localWalletRunner).toContain("stopActiveCommands()")
    expect(localWalletRunner).toContain("if (!interrupted) await resetLocalDatabase().catch(() => {})")
    const playwrightConfig = readFileSync(path.resolve("playwright.config.ts"), "utf8")
    expect(playwrightConfig).toContain('name: "local-wallet"')
    expect(playwrightConfig).toContain("/local\\/.*\\.spec\\.ts/")
    expect(playwrightConfig).toContain('name: "operational-local"')
    expect(playwrightConfig).toContain("/operational\\/.*\\.spec\\.ts/")
  })

  it("uses fresh local Edge isolates so readiness cannot consume persona command CPU budgets", () => {
    const config = readFileSync(path.resolve("supabase/config.toml"), "utf8")
    const edgeRuntime = config.slice(config.indexOf("[edge_runtime]"), config.indexOf("[edge_runtime.secrets]"))
    expect(edgeRuntime).toContain('policy = "oneshot"')
    expect(edgeRuntime).not.toContain('policy = "per_worker"')
  })
})
