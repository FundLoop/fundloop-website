import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "../../edge-functions/result.ts"
import type { StripePayByBankCurrency, StripePayByBankCustomerCountry } from "../../stripe/stripe-pay-by-bank-contract.ts"

export type StripePayByBankProvider = {
  discoverCapability(): Promise<{ accountId: string; livemode: boolean; merchantCountry: string; payByBankActive: boolean;
    configurationActive: boolean; chargeTopology: "platform" | "direct";
    privatePreviewCountries: StripePayByBankCustomerCountry[] }>
  createCheckoutSession(input: {
    idempotencyKey: string
    amountMinor: number
    currency: "eur" | "gbp"
    successUrl: string
    cancelUrl: string
    paymentMethodConfigurationId: string
    integrationIdentifier: string
    metadata: Record<string, string>
  }): Promise<{ id: string; url: string | null; livemode: boolean }>
}

export type StripePayByBankAdapterInput = {
  environment: string
  commandId: string
  projectId: number
  projectSlug: string
  paymentId: number
  amountMinor: string
  currencyCode: StripePayByBankCurrency
  customerCountry: StripePayByBankCustomerCountry
  actorUserId: string
  paymentMethodConfigurationId: string
  appOrigin: string
}

export async function createStripePayByBankCheckout(provider: StripePayByBankProvider, input: StripePayByBankAdapterInput): Promise<EdgeCommandResult<{
  providerAccountId: string; checkoutSessionId: string; checkoutUrl: string; capabilityEvidenceHash: string
}>> {
  if (!["local", "development", "dev", "preview", "test"].includes(input.environment)) {
    return edgeCommandFailure("production_disabled", "Pay by Bank intake is unavailable in this environment.")
  }
  if (!/^[0-9a-f-]{36}$/.test(input.commandId) || !Number.isInteger(input.projectId) || input.projectId <= 0 ||
      !Number.isInteger(input.paymentId) || input.paymentId <= 0 || !/^[1-9]\d*$/.test(input.amountMinor) ||
      !["EUR", "GBP"].includes(input.currencyCode) || !["FI", "FR", "DE", "IE", "GB"].includes(input.customerCountry) ||
      !/^pmc_[A-Za-z0-9]+$/.test(input.paymentMethodConfigurationId) ||
      !input.appOrigin.startsWith("http")) return edgeCommandFailure("invalid_payload", "Pay by Bank adapter input is invalid.")
  const capability = await provider.discoverCapability()
  if (capability.livemode) return edgeCommandFailure("live_mode_denied", "Live-mode Stripe objects are forbidden.")
  const supportedMerchantCountries = new Set(["AT","AU","BE","BG","CA","CH","CY","CZ","DE","DK","EE","ES","FI","FR","GB","GR","HR","HU","IE","IT","LI","LT","LU","LV","MT","NL","NO","PL","PT","RO","SE","SG","SI","SK","US"])
  if (!supportedMerchantCountries.has(capability.merchantCountry) || !capability.payByBankActive || !capability.configurationActive ||
      !["platform","direct"].includes(capability.chargeTopology)) {
    return edgeCommandFailure("stripe_pay_by_bank_not_enabled", "Pay by Bank is not enabled in the FundLoop Stripe sandbox configuration.")
  }
  if (["FR","DE","IE"].includes(input.customerCountry) && !capability.privatePreviewCountries.includes(input.customerCountry)) {
    return edgeCommandFailure("private_preview_unavailable", "This Pay by Bank customer country requires exact private-preview enablement.")
  }
  const capabilityEvidenceHash = await sha256(JSON.stringify({ accountId: capability.accountId, merchantCountry: capability.merchantCountry,
    payByBankActive: true, configurationActive: true, configurationId: input.paymentMethodConfigurationId,
    chargeTopology: capability.chargeTopology, customerCountry: input.customerCountry, currencyCode: input.currencyCode }))
  const metadata = { fundloop_pay_by_bank_command_id: input.commandId, fundloop_project_id: String(input.projectId),
    fundloop_payment_id: String(input.paymentId), fundloop_environment: input.environment, fundloop_currency: input.currencyCode,
    fundloop_customer_country: input.customerCountry, fundloop_charge_topology: capability.chargeTopology }
  const suffix = input.commandId.replaceAll("-", "").slice(-8)
  const session = await provider.createCheckoutSession({ idempotencyKey: `fundloop:pay-by-bank:${input.commandId}`,
    amountMinor: Number(input.amountMinor), currency: input.currencyCode.toLowerCase() as "eur" | "gbp",
    successUrl: `${input.appOrigin}/projects/${input.projectSlug}/payments?pay_by_bank=return`,
    cancelUrl: `${input.appOrigin}/projects/${input.projectSlug}/payments?pay_by_bank=cancel`,
    paymentMethodConfigurationId: input.paymentMethodConfigurationId,
    integrationIdentifier: `fundloop-pay-by-bank-${suffix}`, metadata })
  if (session.livemode) return edgeCommandFailure("live_mode_denied", "Live-mode Stripe objects are forbidden.")
  if (!session.url || !session.id.startsWith("cs_test_")) return edgeCommandFailure("stripe_checkout_unavailable", "Stripe did not return a test Checkout URL.")
  return edgeCommandSuccess({ providerAccountId: capability.accountId, checkoutSessionId: session.id,
    checkoutUrl: session.url, capabilityEvidenceHash })
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
