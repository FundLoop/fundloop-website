import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "../../edge-functions/result.ts"
import type { StripeAcssDebitCurrency } from "../../stripe/stripe-acss-debit-contract.ts"

export type StripeAcssDebitProvider = {
  discoverCapability(): Promise<{ accountId: string; livemode: boolean; acssDebitActive: boolean; configurationActive: boolean }>
  createCheckoutSession(input: {
    idempotencyKey: string
    amountMinor: number
    currency: "cad" | "usd"
    successUrl: string
    cancelUrl: string
    paymentMethodConfigurationId: string
    integrationIdentifier: string
    metadata: Record<string, string>
  }): Promise<{ id: string; url: string | null; livemode: boolean }>
}

export type StripeAcssDebitAdapterInput = {
  environment: string
  commandId: string
  projectId: number
  projectSlug: string
  paymentId: number
  amountMinor: string
  currencyCode: StripeAcssDebitCurrency
  actorUserId: string
  paymentMethodConfigurationId: string
  appOrigin: string
  usdAccountEvidenceVerified: boolean
}

export async function createStripeAcssDebitCheckout(provider: StripeAcssDebitProvider, input: StripeAcssDebitAdapterInput): Promise<EdgeCommandResult<{
  providerAccountId: string; checkoutSessionId: string; checkoutUrl: string; capabilityEvidenceHash: string
}>> {
  if (!["local", "development", "dev", "preview", "test"].includes(input.environment)) {
    return edgeCommandFailure("production_disabled", "Canadian PAD intake is unavailable in this environment.")
  }
  if (!/^[0-9a-f-]{36}$/.test(input.commandId) || !Number.isInteger(input.projectId) || input.projectId <= 0 ||
      !Number.isInteger(input.paymentId) || input.paymentId <= 0 || !/^[1-9]\d*$/.test(input.amountMinor) ||
      !["CAD", "USD"].includes(input.currencyCode) || !/^pmc_[A-Za-z0-9]+$/.test(input.paymentMethodConfigurationId) ||
      !input.appOrigin.startsWith("http")) return edgeCommandFailure("invalid_payload", "PAD adapter input is invalid.")
  if (input.currencyCode === "USD" && !input.usdAccountEvidenceVerified) {
    return edgeCommandFailure("usd_account_evidence_required", "USD PAD requires authoritative evidence for the exact payer account.")
  }
  const capability = await provider.discoverCapability()
  if (capability.livemode) return edgeCommandFailure("live_mode_denied", "Live-mode Stripe objects are forbidden.")
  if (!capability.acssDebitActive || !capability.configurationActive) {
    return edgeCommandFailure("stripe_acss_debit_not_enabled", "Canadian PAD is not enabled in the FundLoop Stripe sandbox configuration.")
  }
  const capabilityEvidenceHash = await sha256(JSON.stringify({ accountId: capability.accountId, acssDebitActive: true,
    configurationActive: true, configurationId: input.paymentMethodConfigurationId, currencyCode: input.currencyCode }))
  const metadata = { fundloop_pad_command_id: input.commandId, fundloop_project_id: String(input.projectId),
    fundloop_payment_id: String(input.paymentId), fundloop_environment: input.environment, fundloop_currency: input.currencyCode }
  const suffix = input.commandId.replaceAll("-", "").slice(-8)
  const session = await provider.createCheckoutSession({ idempotencyKey: `fundloop:pad:${input.commandId}`,
    amountMinor: Number(input.amountMinor), currency: input.currencyCode.toLowerCase() as "cad" | "usd",
    successUrl: `${input.appOrigin}/projects/${input.projectSlug}/payments?pad=return`,
    cancelUrl: `${input.appOrigin}/projects/${input.projectSlug}/payments?pad=cancel`,
    paymentMethodConfigurationId: input.paymentMethodConfigurationId,
    integrationIdentifier: `fundloop-pad-${suffix}`, metadata })
  if (session.livemode) return edgeCommandFailure("live_mode_denied", "Live-mode Stripe objects are forbidden.")
  if (!session.url || !session.id.startsWith("cs_test_")) return edgeCommandFailure("stripe_checkout_unavailable", "Stripe did not return a test Checkout URL.")
  return edgeCommandSuccess({ providerAccountId: capability.accountId, checkoutSessionId: session.id,
    checkoutUrl: session.url, capabilityEvidenceHash })
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
