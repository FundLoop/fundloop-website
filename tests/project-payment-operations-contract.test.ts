import { describe, expect, it } from "vitest"
import {
  normalizeProjectCryptoRoutesResult,
  normalizeProjectOnchainPaymentSubmissionRecordResult,
  PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION,
  validateProjectCryptoRouteCreateInput,
  validateProjectCryptoRouteEnabledSetInput,
  validateProjectCryptoRouteMoveInput,
  validateProjectCryptoRouteUpdateInput,
  validateProjectOnchainPaymentSubmissionRecordInput,
} from "@/lib/edge-functions/project-payment-operations-contract"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"

describe("project payment operation contracts", () => {
  it("validates project crypto route creation input", () => {
    const result = validateProjectCryptoRouteCreateInput({
      projectSlug: "civic-mesh",
      chainId: 1,
      chainAssetId: 2,
      intakeContractId: 3,
      label: "Base USDC",
      isDefault: true,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        projectSlug: "civic-mesh",
        chainId: 1,
        chainAssetId: 2,
        intakeContractId: 3,
        label: "Base USDC",
        isDefault: true,
      },
    })
  })

  it("rejects invalid project crypto route update identifiers", () => {
    const result = validateProjectCryptoRouteUpdateInput({
      projectSlug: "civic-mesh",
      paymentMethodId: 0,
      chainId: 1,
      chainAssetId: 2,
      intakeContractId: 3,
      label: "Base USDC",
      isDefault: false,
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_payload")
  })

  it("rejects invalid route move directions", () => {
    const result = validateProjectCryptoRouteMoveInput({
      projectSlug: "civic-mesh",
      paymentMethodId: 10,
      direction: "sideways",
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.message).toContain("direction")
  })

  it("validates route enabled-state commands", () => {
    const result = validateProjectCryptoRouteEnabledSetInput({
      projectSlug: "civic-mesh",
      paymentMethodId: 10,
      enabled: false,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        projectSlug: "civic-mesh",
        paymentMethodId: 10,
        enabled: false,
      },
    })
  })

  it("validates receipt recording and rejects invalid period tags", () => {
    const result = validateProjectOnchainPaymentSubmissionRecordInput({
      projectSlug: "civic-mesh",
      paymentId: 11,
      paymentMethodId: 12,
      txHash: "0xabc",
      walletAddress: "0xdef",
      amountRaw: "1000000",
      amountDecimal: "1",
      periodId: 13,
      chainId: 1,
      chainAssetId: 2,
      intakeContractId: 3,
      receipt: {},
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.message).toContain("periodId")
  })

  it("normalizes invalid Edge Function route responses", () => {
    const result = normalizeProjectCryptoRoutesResult(PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION, edgeCommandSuccess([{ id: 1 }]))

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })

  it("normalizes invalid Edge Function receipt responses", () => {
    const result = normalizeProjectOnchainPaymentSubmissionRecordResult(edgeCommandSuccess({ id: 1 }))

    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })
})
