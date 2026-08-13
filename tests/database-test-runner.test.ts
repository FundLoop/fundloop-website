import { describe, expect, it } from "vitest"
import { discoverDatabaseSuites, runDatabaseSuites } from "@/scripts/run-database-test-suite.mjs"

describe("database TAP runner", () => {
  it("discovers every top-level SQL/shell suite with explicit ownership", () => {
    const suites = discoverDatabaseSuites()
    expect(suites.length).toBeGreaterThanOrEqual(20)
    expect(suites.some((suite) => suite.name === "epoch_allocation_v2_four_epoch_lifecycle.sh" && suite.isolated)).toBe(true)
    expect(suites.some((suite) => suite.name === "base_safe_payout_control_plane.sh" && suite.isolated)).toBe(true)
  })

  it("emits valid planned TAP and succeeds only when every suite and cleanup succeeds", () => {
    const suites = [{ name: "a.sql", path: "a.sql", isolated: false }, { name: "b.sh", path: "b.sh", isolated: true }]
    const result = runDatabaseSuites({ suites, dbUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres", execute: () => ({ status: 0, stdout: "", stderr: "", signal: null }) })
    expect(result).toMatchObject({ exitCode: 0, suiteCount: 2 })
    expect(result.output).toBe("TAP version 13\n1..2\nok 1 - a.sql\nok 2 - b.sh\n")
  })

  it.each([
    ["assertion", [0, 1, 0]],
    ["setup", [2]],
    ["cleanup", [0, 0, 3]],
  ])("returns non-zero TAP diagnostics for %s failure", (_label, statuses) => {
    let call = 0
    const suites = [{ name: "failure.sh", path: "failure.sh", isolated: true }]
    const result = runDatabaseSuites({ suites, dbUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres", execute: () => ({
      status: statuses[Math.min(call++, statuses.length - 1)], stderr: "deliberate failure", stdout: "", signal: null,
    }) })
    expect(result.exitCode).toBe(1)
    expect(result.output).toMatch(/not ok|cleanup failure/)
  })
})
