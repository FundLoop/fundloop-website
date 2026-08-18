import { describe, expect, test } from "vitest"
import {
  validateCubidAllocatorRequestBody,
  validateCubidAllocatorResponseBody,
} from "../lib/cubid/private-allocator-client"
import {
  calculateFundedRedistributionV2,
  type FundedAllocationCohortV2Input,
  type FundedProjectSourceInput,
  type FundedRedistributionPoolSourceInput,
  type FundedRedistributionV2Input,
} from "../lib/monthly-cycles/funded-redistribution-v2-calculator"

const FORBIDDEN_KEY_PATTERNS = [
  /email/i,
  /phone/i,
  /legal_name/i,
  /full_name/i,
  /display_name/i,
  /global_cubid/i,
  /raw_stamp/i,
  /proof_payload/i,
  /zk_proof/i,
  /wallet_address/i,
  /payout_destination/i,
  /project_membership/i,
  /self_identification/i,
]

const FORBIDDEN_VALUE_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email regex
  /0x[0-9a-fA-F]{40}/, // Ethereum/Base address regex
]

export function scanObjectForForbiddenFields(obj: unknown, path = "$"): string[] {
  const violations: string[] = []

  function walk(current: unknown, currentPath: string) {
    if (current === null || current === undefined) return
    if (typeof current === "string") {
      for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
        if (pattern.test(current)) {
          violations.push(`Forbidden value pattern matching ${pattern} at path: ${currentPath} (value: ${current})`)
        }
      }
      return
    }
    if (Array.isArray(current)) {
      current.forEach((item, idx) => walk(item, `${currentPath}[${idx}]`))
      return
    }
    if (typeof current === "object") {
      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        for (const pattern of FORBIDDEN_KEY_PATTERNS) {
          if (pattern.test(key)) {
            violations.push(`Forbidden key matching ${pattern} at path: ${currentPath}.${key}`)
          }
        }
        walk(value, `${currentPath}.${key}`)
      }
    }
  }

  walk(obj, path)
  return violations
}

describe("allocator forbidden field scanner", () => {
  test("clean allocator calculation artifact contains zero forbidden fields or PII", async () => {
    const projectSources: FundedProjectSourceInput[] = [
      {
        sourceLotId: "lot-1",
        sourceLotKey: "lot:2026-08:1",
        projectId: 10,
        projectKey: "project-alpha",
        exactUsd: "500.00",
        canonicalMinorCapacity: "50000",
        minorUnitScale: 2,
        sourceOrder: "1",
        railKey: "stripe_pay_by_bank",
        assetKey: "usd_fiat",
        custodyKey: "stripe_main",
        nativeAtomicAmount: "50000",
        fxSnapshotId: "fx-1",
        evidenceHash: "0000000000000000000000000000000000000000000000000000000000000001",
        currency: "USD",
      },
    ]

    const redistributionSources: FundedRedistributionPoolSourceInput[] = []

    const cohort: FundedAllocationCohortV2Input[] = [
      {
        projectId: 10,
        projectKey: "project-alpha",
        userId: "user-1",
        projectPseudonym: "11111111-1111-4111-8111-111111111111",
        lockedScore: "75",
        lockedMaximumScore: "100",
        cubidEvidenceHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    ]

    const input: FundedRedistributionV2Input = {
      cycleKey: "2026-08",
      manifestHash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      selectedPreviewHash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      minorUnitScale: 2,
      capMultiple: "3.00",
      currency: "USD",
      projectSources,
      redistributionSources,
      cohort,
    }

    const artifact = await calculateFundedRedistributionV2(input)
    const violations = scanObjectForForbiddenFields(artifact)

    expect(violations).toEqual([])
  })

  test("forbidden field scanner catches injected email, address, or forbidden keys", () => {
    const dirtyObject = {
      manifestId: 1,
      user_email: "alice@example.com",
      payout_destination: "0x1234567890123456789012345678901234567890",
      nested: {
        raw_stamps: ["stamp1"],
      },
    }

    const violations = scanObjectForForbiddenFields(dirtyObject)
    expect(violations.length).toBeGreaterThanOrEqual(3)
    expect(violations.some((v) => v.includes("email"))).toBe(true)
    expect(violations.some((v) => v.includes("raw_stamps"))).toBe(true)
    expect(violations.some((v) => v.includes("payout_destination"))).toBe(true)
  })

  test("Cubid request and response validators strictly reject forbidden fields", () => {
    const dirtyRequest = {
      contract_version: "2026-08-14",
      project_id: 10,
      email: "victim@example.com",
      items: [{ project_scoped_uuid: "11111111-1111-4111-8111-111111111111" }],
    }
    expect(validateCubidAllocatorRequestBody(dirtyRequest).ok).toBe(false)

    const dirtyResponse = {
      contract_version: "2026-08-14",
      request_id: "req-1",
      wallet_address: "0x1234567890123456789012345678901234567890",
      items: [],
    }
    expect(validateCubidAllocatorResponseBody(dirtyResponse).ok).toBe(false)
  })
})
