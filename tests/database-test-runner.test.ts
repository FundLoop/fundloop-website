import { describe, expect, it } from "vitest"
import { discoverDatabaseSuites, runDatabaseSuites, validateSuiteResult, validateTapOutput } from "@/scripts/run-database-test-suite.mjs"

describe("database TAP runner", () => {
  it("discovers every top-level SQL/shell suite with explicit ownership", () => {
    const suites = discoverDatabaseSuites()
    expect(suites.length).toBeGreaterThanOrEqual(20)
    expect(suites.some((suite) => suite.name === "epoch_allocation_v2_four_epoch_lifecycle.sh" && suite.isolated)).toBe(true)
    expect(suites.some((suite) => suite.name === "base_safe_payout_control_plane.sh" && suite.isolated)).toBe(true)
  })

  it("emits valid planned TAP and succeeds only when every suite and cleanup succeeds", () => {
    const suites = [{ name: "a.sql", path: "a.sql", isolated: false, contract: "psql-on-error-stop" },
      { name: "b.sh", path: "b.sh", isolated: true, contract: "wrapper-owned:test-fixture" }]
    const result = runDatabaseSuites({ suites, dbUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres", execute: () => ({ status: 0, stdout: "", stderr: "", signal: null }) })
    expect(result).toMatchObject({ exitCode: 0, suiteCount: 2 })
    expect(result.output).toBe("TAP version 13\n1..2\nok 1 - a.sql\nok 2 - b.sh\n")
  })

  it("accepts complete TAP and rejects missing, malformed, mismatched, duplicate, not-ok, bailout, and trailing output", () => {
    expect(validateTapOutput("TAP version 13\n1..2\nok 1 - first\nok 2 - second\n")).toEqual({ plan: 2, testCount: 2 })
    for (const [output, error] of [
      ["", "suite_tap_missing"],
      ["ok one", "suite_tap_unaccounted"],
      ["1..2\nok 1 - only", "suite_tap_plan_mismatch"],
      ["1..2\nok 1 - first\nok 1 - duplicate", "suite_tap_duplicate_number"],
      ["1..1\nnot ok 1 - hidden failure", "suite_tap_not_ok"],
      ["TAP version 13\nBail out! database disappeared\n1..0", "suite_tap_bailout"],
      ["1..1\nok 1 - pass\nunaccounted diagnostic", "suite_tap_unaccounted"],
    ] as const) expect(() => validateTapOutput(output)).toThrow(error)
  })

  it("requires TAP unless an accountable SQL or shell wrapper contract is explicit", () => {
    expect(validateSuiteResult({ name: "assert.sql", contract: "psql-on-error-stop" }, { status: 0, stdout: "DO\n" }))
      .toMatchObject({ mode: "accountable-non-tap" })
    expect(validateSuiteResult({ name: "assert.sh", contract: "wrapper-owned:fixture" }, { status: 0, stdout: "done\n" }))
      .toMatchObject({ mode: "accountable-non-tap" })
    expect(() => validateSuiteResult({ name: "unowned.sh", contract: null }, { status: 0, stdout: "" }))
      .toThrow("suite_tap_missing")
    expect(() => validateSuiteResult({ name: "lying.sh", contract: "wrapper-owned:fixture" }, { status: 0, stdout: "1..1\nnot ok 1 - failed" }))
      .toThrow("suite_tap_not_ok")
  })

  it.each([
    ["assertion", [0, 1, 0]],
    ["setup", [2]],
    ["cleanup", [0, 0, 3]],
  ])("returns non-zero TAP diagnostics for %s failure", (_label, statuses) => {
    let call = 0
    const suites = [{ name: "failure.sh", path: "failure.sh", isolated: true, contract: "wrapper-owned:test-fixture" }]
    const result = runDatabaseSuites({ suites, dbUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres", execute: () => ({
      status: statuses[Math.min(call++, statuses.length - 1)], stderr: "deliberate failure", stdout: "", signal: null,
    }) })
    expect(result.exitCode).toBe(1)
    expect(result.output).toMatch(/not ok/)
    expect(result.output.match(/^(?:not )?ok \d+/gm)).toHaveLength(1)
  })
})
