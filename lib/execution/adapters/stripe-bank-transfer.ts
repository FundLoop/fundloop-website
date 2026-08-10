import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "../../edge-functions/result.ts"

export type StripeBankTransferProvider = {
  createCustomer(input: { idempotencyKey: string; metadata: Record<string,string> }): Promise<{ id: string; livemode: boolean }>
  createPaymentIntent(input: {
    idempotencyKey: string; customerId: string; amountMinor: number; currency: "usd"; metadata: Record<string,string>
  }): Promise<{ id: string; livemode: boolean; status: string; hostedInstructionsUrl: string | null }>
}

export type StripeBankTransferAdapterInput = {
  environment: string
  projectId: number
  projectSlug: string
  paymentId: number
  amountMinor: string
  currencyCode: "USD"
  actorUserId: string
}

export type StripeBankTransferAdapterOutput = {
  providerCustomerId: string
  providerPaymentIntentId: string
  status: string
  hostedInstructionsUrl: string | null
  evidenceHash: string
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2,"0")).join("")
}

export async function createStripeBankTransferIntent(
  provider: StripeBankTransferProvider,
  input: StripeBankTransferAdapterInput,
): Promise<EdgeCommandResult<StripeBankTransferAdapterOutput>> {
  if (!["local","development","dev","preview","test"].includes(input.environment)) {
    return edgeCommandFailure("production_disabled", "Stripe bank-transfer intake is unavailable in this environment.")
  }
  if (!Number.isInteger(input.projectId) || input.projectId <= 0 || !Number.isInteger(input.paymentId) || input.paymentId <= 0 ||
    !/^[1-9]\d*$/.test(input.amountMinor) || input.currencyCode !== "USD") {
    return edgeCommandFailure("invalid_payload", "Stripe bank-transfer adapter input is invalid.")
  }
  const prefix = `fundloop:stripe-intake:${input.projectId}:${input.paymentId}`
  const metadata = { fundloop_project_id: String(input.projectId), fundloop_project_slug: input.projectSlug,
    fundloop_payment_id: String(input.paymentId), fundloop_environment: input.environment }
  const customer = await provider.createCustomer({ idempotencyKey: `${prefix}:customer`, metadata })
  if (customer.livemode) return edgeCommandFailure("live_mode_denied", "Live-mode Stripe objects are forbidden.")
  const intent = await provider.createPaymentIntent({ idempotencyKey: `${prefix}:intent`, customerId: customer.id,
    amountMinor: Number(input.amountMinor), currency: "usd", metadata })
  if (intent.livemode) return edgeCommandFailure("live_mode_denied", "Live-mode Stripe objects are forbidden.")
  const evidenceHash = await sha256(JSON.stringify({ customerId: customer.id, paymentIntentId: intent.id,
    projectId: input.projectId, paymentId: input.paymentId, amountMinor: input.amountMinor, currencyCode: input.currencyCode,
    environment: input.environment, status: intent.status }))
  return edgeCommandSuccess({ providerCustomerId: customer.id, providerPaymentIntentId: intent.id,
    status: intent.status, hostedInstructionsUrl: intent.hostedInstructionsUrl, evidenceHash })
}
