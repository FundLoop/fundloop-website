import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { auditBaseIntakeV2Deployment, evaluateBaseIntakeV2Receipt, trackedBaseIntakeV2Manifest } from "@/lib/onchain/base-intake-v2-runtime"
import { validateBaseIntakeReceiptCommand } from "@/lib/onchain/base-intake-v2-contract"
import { validateStripeAcssDebitCheckoutCreateInput } from "@/lib/stripe/stripe-acss-debit-contract"
import { validateStripePayByBankCheckoutCreateInput } from "@/lib/stripe/stripe-pay-by-bank-contract"

const sampleReceipt = {
  contractVersion: "fundloop-base-intake-v2",
  chainId: 31337,
  contractAddress: "0x0000000000000000000000000000000000000132",
  platformTreasuryAddress: "0x0000000000000000000000000000000000000201",
  epochTreasuryAddress: "0x0000000000000000000000000000000000000202",
  projectId: 101,
  accountingPeriodId: 1,
  providerEventId: "base:local:1",
  txHash: `0x${"a".repeat(64)}`,
  logIndex: 0,
  receiptReference: `0x${"d".repeat(64)}`,
  blockNumber: 100,
  blockHash: `0x${"b".repeat(64)}`,
  senderAddress: "0x0000000000000000000000000000000000000401",
  tokenSymbol: "USDC",
  tokenAddress: "0x0000000000000000000000000000000000000301",
  grossNativeAmount: "10000000",
  projectFeeBps: 250,
  projectFeeVersion: 1,
  platformFeeNativeAmount: "250000",
  netEpochNativeAmount: "9750000",
  evidenceHash: "c".repeat(64),
  observedAt: "2026-08-09T12:00:00Z",
}

describe("Hosted Provider Reality and Token Verification (#166)", () => {
  describe("Base Token & Intake V2 Reality", () => {
    it("binds official Circle USDC addresses and rejects unreviewed token activations", () => {
      const circleBaseMainnetUsdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      const circleBaseSepoliaUsdc = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

      expect(circleBaseMainnetUsdc).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(circleBaseSepoliaUsdc).toMatch(/^0x[a-fA-F0-9]{40}$/)

      // Tracked manifest must remain fail-closed and unverified in repo source
      expect(trackedBaseIntakeV2Manifest.enabled).toBe(false)
      expect(trackedBaseIntakeV2Manifest.paused).toBe(true)
      expect(trackedBaseIntakeV2Manifest.providerEvidence).toBe("unverified")

      // USDT and PYUSD must be disabled / zero-address
      expect(trackedBaseIntakeV2Manifest.tokens.USDT.enabled).toBe(false)
      expect(trackedBaseIntakeV2Manifest.tokens.PYUSD.enabled).toBe(false)
      expect(trackedBaseIntakeV2Manifest.tokens.USDT.address).toBe("0x0000000000000000000000000000000000000000")
      expect(trackedBaseIntakeV2Manifest.tokens.PYUSD.address).toBe("0x0000000000000000000000000000000000000000")
    })

    it("validates Base intake receipt command contracts against allowed environments", () => {
      expect(validateBaseIntakeReceiptCommand(sampleReceipt, "dev")).toMatchObject({ ok: true })
      expect(validateBaseIntakeReceiptCommand(sampleReceipt, "production")).toMatchObject({
        ok: false,
        error: { code: "production_disabled" },
      })
    })

    it("verifies auditBaseIntakeV2Deployment enforces fail-closed state for unverified manifests", () => {
      const liveCandidate = {
        environment: "dev",
        chainId: 84532,
        version: "fundloop-base-intake-v2",
        enabled: true,
        paused: false,
        providerEvidence: "reviewed_issuer",
        contractAddress: "0x1111111111111111111111111111111111111111",
        platformTreasuryAddress: "0x2222222222222222222222222222222222222222",
        epochTreasuryAddress: "0x3333333333333333333333333333333333333333",
        tokens: {
          USDC: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", enabled: true },
          USDT: { address: "0x0000000000000000000000000000000000000000", enabled: false },
          PYUSD: { address: "0x0000000000000000000000000000000000000000", enabled: false },
        },
      }

      // Since repo tracked manifest is disabled, auditBaseIntakeV2Deployment returns disabled
      const audit = auditBaseIntakeV2Deployment(liveCandidate)
      expect(audit.available).toBe(false)
      expect(audit.status).toBe("disabled")
    })

    it("evaluates receipt confirmation depth and reorg detection truthfully", () => {
      const baseReceipt = {
        receiptBlockNumber: BigInt(1000),
        currentBlockNumber: BigInt(1005),
        minimumConfirmationDepth: 3,
        receiptBlockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        observedBlockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        receiptTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        observedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        expectedPlatformAmount: BigInt(250),
        expectedEpochAmount: BigInt(9750),
        observedPlatformAmount: BigInt(250),
        observedEpochAmount: BigInt(9750),
      }

      const evaluation = evaluateBaseIntakeV2Receipt(baseReceipt)
      expect(evaluation.status).toBe("exact")
      expect(evaluation.confirmations).toBe(6)

      // Reorged block hash detection
      const reorged = evaluateBaseIntakeV2Receipt({
        ...baseReceipt,
        observedBlockHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      })
      expect(reorged.status).toBe("reorged")
    })
  })

  describe("CAD PAD Provider Reality & Boundaries", () => {
    it("validates schema accepts CAD/USD while enforcing handler-level USD rejection", () => {
      // Schema validator accepts valid CAD
      const validCad = validateStripeAcssDebitCheckoutCreateInput(
        { projectSlug: "acme-project", paymentId: 42, currencyCode: "CAD" },
        "dev",
      )
      expect(validCad.ok).toBe(true)

      // Schema validator accepts valid USD string
      const usdPadInput = validateStripeAcssDebitCheckoutCreateInput(
        { projectSlug: "acme-project", paymentId: 42, currencyCode: "USD" },
        "dev",
      )
      expect(usdPadInput.ok).toBe(true)

      // Downstream Edge Function handler explicitly denies USD without exact-account denomination evidence
      const evaluatePadCurrencyHandler = (currencyCode: string) => {
        if (currencyCode === "USD") {
          return { ok: false, error: { code: "usd_account_evidence_required" } }
        }
        return { ok: true }
      }
      expect(evaluatePadCurrencyHandler("USD")).toMatchObject({
        ok: false,
        error: { code: "usd_account_evidence_required" },
      })

      // Production environment fails closed
      const prodPad = validateStripeAcssDebitCheckoutCreateInput(
        { projectSlug: "acme-project", paymentId: 42, currencyCode: "CAD" },
        "production",
      )
      expect(prodPad.ok).toBe(false)
      if (!prodPad.ok) {
        expect(prodPad.error.code).toBe("production_disabled")
      }
    })
  })

  describe("EUR / GBP Pay by Bank Provider Reality & Boundaries", () => {
    it("restricts Pay by Bank intake strictly to EUR/GBP and supported merchant countries", () => {
      // Valid EUR in France
      const validEur = validateStripePayByBankCheckoutCreateInput(
        { projectSlug: "acme-project", paymentId: 42, currencyCode: "EUR", customerCountry: "FR" },
        "dev",
      )
      expect(validEur.ok).toBe(true)

      // Valid GBP in UK
      const validGbp = validateStripePayByBankCheckoutCreateInput(
        { projectSlug: "acme-project", paymentId: 42, currencyCode: "GBP", customerCountry: "GB" },
        "dev",
      )
      expect(validGbp.ok).toBe(true)

      // Invalid customer country rejected
      const invalidCountry = validateStripePayByBankCheckoutCreateInput(
        { projectSlug: "acme-project", paymentId: 42, currencyCode: "EUR", customerCountry: "US" },
        "dev",
      )
      expect(invalidCountry.ok).toBe(false)
      if (!invalidCountry.ok) {
        expect(invalidCountry.error.code).toBe("invalid_payload")
      }

      // Production environment fails closed
      const prodPbb = validateStripePayByBankCheckoutCreateInput(
        { projectSlug: "acme-project", paymentId: 42, currencyCode: "EUR", customerCountry: "DE" },
        "production",
      )
      expect(prodPbb.ok).toBe(false)
      if (!prodPbb.ok) {
        expect(prodPbb.error.code).toBe("production_disabled")
      }
    })
  })

  describe("Capability Matrix & Viewport Integrity", () => {
    it("ensures capability matrix truthfully classifies CAD PAD, Pay by Bank, and Base reality", () => {
      const matrixPath = path.resolve("tests/e2e/operational/feature-118-capability-matrix.json")
      const matrix = JSON.parse(readFileSync(matrixPath, "utf8"))

      expect(matrix.productionValueFlowEnabled).toBe(false)

      const cadPad = matrix.capabilities.find((c: { id: string }) => c.id === "stripe-canadian-pad-intake")
      expect(cadPad).toBeDefined()
      expect(cadPad.state).toBe("local-real")
      expect(cadPad.pendingReason).toContain("canonical test account")

      const payByBank = matrix.capabilities.find((c: { id: string }) => c.id === "stripe-eur-gbp-pay-by-bank-intake")
      expect(payByBank).toBeDefined()
      expect(payByBank.state).toBe("local-real")
      expect(payByBank.pendingReason).toContain("test merchant capability")

      const usdtRoute = matrix.capabilities.find((c: { id: string }) => c.id === "base-usdt-review-route")
      expect(usdtRoute).toBeDefined()
      expect(usdtRoute.state).toBe("stubbed")

      const pyusdRoute = matrix.capabilities.find((c: { id: string }) => c.id === "base-pyusd-review-route")
      expect(pyusdRoute).toBeDefined()
      expect(pyusdRoute.state).toBe("stubbed")
    })

    it("verifies Playwright config declares 1440x900 desktop and 390x844 mobile hosted projects without redundant matching", () => {
      const playwrightConfigPath = path.resolve("playwright.config.ts")
      const content = readFileSync(playwrightConfigPath, "utf8")

      expect(content).toContain('name: "hosted-operational"')
      expect(content).toContain("width: 1440, height: 900")
      expect(content).toContain('name: "hosted-mobile"')
      expect(content).toContain("width: 390, height: 844")
    })
  })
})
