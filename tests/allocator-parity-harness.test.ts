import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { calculateFundedRedistributionV2 } from "@/lib/monthly-cycles/funded-redistribution-v2-calculator"
import {
  ALLOCATOR_PARITY_FIXTURES,
  ALLOCATOR_PARITY_FIXTURE_VERSION,
  computeParityOutcome,
  paritySha256,
  type ParityOutcome,
} from "./support/allocator-parity-fixtures"

// Golden vectors shared with FundLoop/fundloop-allocator (#216). Regenerate only for an intentional
// calculator change: ALLOCATOR_PARITY_WRITE=1 pnpm vitest run tests/allocator-parity-harness.test.ts
const goldenPath = resolve(process.cwd(), "tests/fixtures/allocator-parity/golden-v1.json")

type Golden = { version: string; fixturesSha256: string; outcomes: ParityOutcome[] }

describe("allocator parity harness", () => {
  it("defines 50 distinct fixtures spanning 1 to 10,000 users", () => {
    const ids = new Set(ALLOCATOR_PARITY_FIXTURES.map((spec) => spec.id))
    const seeds = new Set(ALLOCATOR_PARITY_FIXTURES.map((spec) => spec.seed))
    expect(ALLOCATOR_PARITY_FIXTURES).toHaveLength(50)
    expect(ids.size).toBe(50)
    expect(seeds.size).toBe(50)
    const sizes = ALLOCATOR_PARITY_FIXTURES.map((spec) => spec.users)
    expect(Math.min(...sizes)).toBe(1)
    expect(Math.max(...sizes)).toBe(10_000)
  })

  it("reproduces every golden outcome bit-for-bit", async () => {
    const outcomes: ParityOutcome[] = []
    for (const spec of ALLOCATOR_PARITY_FIXTURES) outcomes.push(await computeParityOutcome(spec, calculateFundedRedistributionV2))
    const current: Golden = { version: ALLOCATOR_PARITY_FIXTURE_VERSION, fixturesSha256: paritySha256(ALLOCATOR_PARITY_FIXTURES), outcomes }

    if (process.env.ALLOCATOR_PARITY_WRITE === "1") writeFileSync(goldenPath, `${JSON.stringify(current, null, 2)}\n`)
    expect(existsSync(goldenPath), "golden vectors missing; see header comment").toBe(true)
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as Golden

    expect(current.version).toBe(golden.version)
    expect(current.fixturesSha256).toBe(golden.fixturesSha256)
    for (const [index, outcome] of outcomes.entries()) expect(outcome, outcome.id).toEqual(golden.outcomes[index])
    expect(outcomes).toHaveLength(golden.outcomes.length)
  }, 600_000)

  it("keeps every successful fixture internally conserved", () => {
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as Golden
    for (const outcome of golden.outcomes) {
      if (!outcome.ok) continue
      expect(outcome.invariantsOk, outcome.id).toBe(true)
      expect(BigInt(outcome.totals.finalAllocationMinor) + BigInt(outcome.totals.carryOutResidueMinor), outcome.id)
        .toBe(BigInt(outcome.totals.totalInputMinor))
    }
  })
})
