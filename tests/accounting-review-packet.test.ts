import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { accountingPacketDigest, verifyAccountingReviewExample, verifyAccountingReviewPacket } from "../scripts/verify-accounting-review-packet.mjs"

const repoRoot = process.cwd()
const load = (name: string) => JSON.parse(readFileSync(resolve(repoRoot, "docs/accounting/review-drafts", name), "utf8"))

describe("accountant/bookkeeping review packet", () => {
  it("recalculates every native and USD-functional journal and trial balance", () => {
    expect(verifyAccountingReviewExample(load("accounting-review-example.json"))).toEqual({ ok: true })
  })

  it("requires the walkthrough to expose every accounting decision", () => {
    const example = load("accounting-review-example.json")
    example.allocationMemorandum.decisionRefs = ["awards-liabilities-and-payout-timing"]
    expect(() => verifyAccountingReviewExample(example)).toThrow("does not expose every required decision")
  })

  it("binds the packet without selecting treatment or granting authority", () => {
    const packet = load("accounting-review-packet.json")
    expect(verifyAccountingReviewPacket({ packet, repoRoot })).toEqual({ ok: true, packetId: packet.packetId, packetSha256: packet.packetSha256 })
    expect(packet.reviewer).toEqual({ name: null, designation: null, engagementReference: null })
    expect(packet.decisions).toBeNull()
  })

  it("rejects unbalanced native or functional journals", () => {
    for (const field of ["nativeMinor", "functionalUsdTenThousandth"] as const) {
      const example = load("accounting-review-example.json")
      example.events[0].postings[0][field] = "9999"
      expect(() => verifyAccountingReviewExample(example)).toThrow("not balanced in native and functional values")
    }
  })

  it("rejects broken E-3, target-funding, and top-up conservation", () => {
    for (const field of ["e3HarvestedUsdTenThousandth", "independentCurrentFundingUsdTenThousandth", "capLimitedTopUpUsdTenThousandth"] as const) {
      const example = load("accounting-review-example.json")
      example.allocationMemorandum[field] = "1"
      expect(() => verifyAccountingReviewExample(example)).toThrow("conservation failed")
    }
  })

  it("rejects missing trial balances, placeholder events, and wrong FX", () => {
    const noTrial = load("accounting-review-example.json")
    noTrial.trialBalanceCheckpoints = []
    expect(() => verifyAccountingReviewExample(noTrial)).toThrow("trial-balance checkpoints are incomplete")
    const renamed = load("accounting-review-example.json")
    renamed.events[0].id = "placeholder"
    expect(() => verifyAccountingReviewExample(renamed)).toThrow("event set is incomplete or reordered")
    const fx = load("accounting-review-example.json")
    fx.events[0].postings[0].functionalUsdTenThousandth = "10000"
    fx.events[0].postings[1].functionalUsdTenThousandth = "10000"
    fx.events[3].postings[0].functionalUsdTenThousandth = "10000"
    fx.events[3].postings[1].functionalUsdTenThousandth = "10000"
    fx.trialBalanceCheckpoints[0].balances.find((row: { account: string }) => row.account === "custody-control").functionalUsdTenThousandth = "10000"
    fx.trialBalanceCheckpoints[0].balances.find((row: { account: string }) => row.account === "unclassified-source-control").functionalUsdTenThousandth = "-10000"
    expect(() => verifyAccountingReviewExample(fx)).toThrow("FX conversion")
  })

  it("rejects fabricated approvals and recomputed unknown authority fields", () => {
    const approved = load("accounting-review-packet.json")
    approved.reviewer.name = "Invented Accountant"
    expect(() => verifyAccountingReviewPacket({ packet: approved, repoRoot })).toThrow("cannot fabricate")

    const unknown = load("accounting-review-packet.json")
    unknown.accountantApproval = { approved: true }
    unknown.packetSha256 = accountingPacketDigest(unknown)
    expect(() => verifyAccountingReviewPacket({ packet: unknown, repoRoot })).toThrow("unknown or missing fields")
  })

  it("rejects opening-balance, cutover, and value-flow authority", () => {
    for (const field of ["openingBalanceAuthority", "productionCutoverAuthority", "valueFlowAuthority"] as const) {
      const packet = load("accounting-review-packet.json")
      packet[field] = true
      expect(() => verifyAccountingReviewPacket({ packet, repoRoot })).toThrow("cannot authorize")
    }
  })

  it("rejects changed evidence bytes and stale packet digests", () => {
    const evidence = load("accounting-review-packet.json")
    evidence.runtimeEvidence[0].sha256 = "0".repeat(64)
    expect(() => verifyAccountingReviewPacket({ packet: evidence, repoRoot })).toThrow("evidence digest mismatch")

    const digest = load("accounting-review-packet.json")
    digest.packetSha256 = "f".repeat(64)
    expect(() => verifyAccountingReviewPacket({ packet: digest, repoRoot })).toThrow("self digest mismatch")
  })
})
