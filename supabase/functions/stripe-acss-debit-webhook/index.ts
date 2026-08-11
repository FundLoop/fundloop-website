import Stripe from "stripe"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import type { StripeAcssDebitObservation, StripeAcssDebitCurrency } from "../../../lib/stripe/stripe-acss-debit-contract.ts"
import { createFunctionClients, getEnv, json, serve } from "../_shared/command-runtime.ts"

const environment = () => (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase()
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("")
const stringId = (value: unknown, prefix: string) => typeof value === "string" && value.startsWith(prefix) ? value : null
const signatureTimestamp = (header: string) => { const value = header.split(",").find((part) => part.startsWith("t="))?.slice(2); return value && /^\d+$/.test(value) ? Number(value) : null }
const objectId = (value: string | Stripe.PaymentIntent | Stripe.Charge | null | undefined, prefix: string) => typeof value === "string" ? stringId(value, prefix) : stringId(value?.id, prefix)

function observePaymentIntent(pi: Stripe.PaymentIntent, sessionId: string | null, evidenceType?: StripeAcssDebitObservation["evidenceType"]): StripeAcssDebitObservation | null {
  const commandId = pi.metadata?.fundloop_pad_command_id
  const currency = pi.currency.toUpperCase()
  if (!commandId || !/^[0-9a-f-]{36}$/.test(commandId) || (currency !== "CAD" && currency !== "USD")) return null
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge as Stripe.Charge : null
  const balance = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction as Stripe.BalanceTransaction : null
  const paymentMethod = typeof pi.payment_method === "object" ? pi.payment_method as Stripe.PaymentMethod : null
  const mandateId = stringId(charge?.payment_method_details?.acss_debit?.mandate, "mandate_")
  const type = paymentMethod?.type ?? charge?.payment_method_details?.type ?? null
  let normalized = evidenceType
  if (!normalized) normalized = pi.status === "succeeded" && balance?.status === "available" ? "settled_available" :
    pi.status === "processing" || pi.status === "succeeded" ? "processing" : pi.status === "canceled" ? "canceled" : "failed"
  const gross = pi.amount_received || pi.amount
  const fee = balance && balance.currency === pi.currency ? balance.fee : null
  const net = balance && balance.currency === pi.currency ? balance.net : null
  return {evidenceType: normalized, commandId, providerObjectId: pi.id, providerCheckoutSessionId: sessionId,
    providerPaymentIntentId: pi.id, providerChargeId: charge?.id ?? null, providerMandateId: mandateId,
    providerBalanceTransactionId: balance?.id ?? null, currencyCode: currency as StripeAcssDebitCurrency,
    grossAmountMinor: String(gross), feeAmountMinor: fee === null ? null : String(fee), netAmountMinor: net === null ? null : String(net),
    balanceStatus: balance?.status === "available" ? "available" : balance?.status === "pending" ? "pending" : null, paymentMethodType: type}
}

async function checkoutSessionForPaymentIntent(stripe: Stripe, pi: Stripe.PaymentIntent) {
  const sessions = await stripe.checkout.sessions.list({payment_intent: pi.id, limit: 2})
  const commandId = pi.metadata?.fundloop_pad_command_id
  const matching = sessions.data.filter((session) => session.metadata?.fundloop_pad_command_id === commandId)
  return matching.length === 1 ? matching[0] : null
}

async function observeWithCheckout(stripe: Stripe, pi: Stripe.PaymentIntent, evidenceType?: StripeAcssDebitObservation["evidenceType"]) {
  const session = await checkoutSessionForPaymentIntent(stripe, pi)
  return session ? observePaymentIntent(pi, session.id, evidenceType) : null
}

async function authoritativeObservation(stripe: Stripe, event: Stripe.Event): Promise<StripeAcssDebitObservation | null> {
  const raw = event.data.object as {id?: string; payment_intent?: string | Stripe.PaymentIntent; metadata?: Record<string,string>; amount?: number; amount_refunded?: number; currency?: string; status?: string}
  if (event.type === "checkout.session.completed" && raw.id?.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(raw.id, {expand: ["payment_intent.latest_charge.balance_transaction", "payment_intent.payment_method"]})
    const pi = typeof session.payment_intent === "object" ? session.payment_intent : null
    return pi ? observePaymentIntent(pi, session.id, "checkout_completed") : null
  }
  if (event.type.startsWith("payment_intent.") && raw.id?.startsWith("pi_")) {
    const pi = await stripe.paymentIntents.retrieve(raw.id, {expand: ["latest_charge.balance_transaction", "payment_method"]})
    return observeWithCheckout(stripe, pi)
  }
  if (event.type === "charge.refunded" && raw.id?.startsWith("ch_")) {
    const charge = await stripe.charges.retrieve(raw.id, {expand: ["payment_intent.latest_charge.balance_transaction", "payment_intent.payment_method"]})
    const pi = typeof charge.payment_intent === "object" ? charge.payment_intent : null
    return pi ? observeWithCheckout(stripe, pi, "refunded") : null
  }
  if (event.type.startsWith("charge.dispute.") && raw.id?.startsWith("dp_")) {
    const dispute = await stripe.disputes.retrieve(raw.id, {expand: ["charge.payment_intent.latest_charge.balance_transaction", "charge.payment_intent.payment_method"]})
    const charge = typeof dispute.charge === "object" ? dispute.charge : null
    const pi = charge && typeof charge.payment_intent === "object" ? charge.payment_intent : null
    const kind = event.type === "charge.dispute.closed" ? dispute.status === "won" ? "dispute_won" : "dispute_lost" : "disputed"
    return pi ? observeWithCheckout(stripe, pi, kind) : null
  }
  return null
}

async function handleRequest(request: Request) {
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const runtimeEnvironment = environment()
  if (!["local", "development", "dev", "preview", "test"].includes(runtimeEnvironment)) return json(edgeCommandFailure("production_disabled", "PAD webhooks are unavailable in this environment."))
  const secretKey = getEnv("STRIPE_SECRET_KEY")?.trim(), webhookSecret = getEnv("STRIPE_ACSS_DEBIT_WEBHOOK_SECRET")?.trim(), providerAccountId = getEnv("STRIPE_ACCOUNT_ID")?.trim()
  if (!secretKey?.startsWith("sk_test_") || !webhookSecret?.startsWith("whsec_") || !providerAccountId?.match(/^acct_[A-Za-z0-9]+$/)) return json(edgeCommandFailure("stripe_acss_debit_not_configured", "PAD webhook credentials are not configured."))
  const signature = request.headers.get("stripe-signature") ?? "", timestamp = signatureTimestamp(signature)
  if (timestamp === null) return json(edgeCommandFailure("invalid_signature", "Stripe signature timestamp is missing."), {status: 400})
  const payload = await request.text(), stripe = new Stripe(secretKey, {httpClient: Stripe.createFetchHttpClient()})
  let event: Stripe.Event
  try { event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret, 300, Stripe.createSubtleCryptoProvider()) }
  catch { return json(edgeCommandFailure("invalid_signature", "Stripe webhook signature verification failed."), {status: 400}) }
  if (event.livemode) return json(edgeCommandFailure("live_mode_denied", "Live-mode Stripe events are forbidden."), {status: 403})
  const observation = await authoritativeObservation(stripe, event)
  if (!observation) return json(edgeCommandSuccess({ignored: true, eventId: event.id}))
  const terminalBeforeMandate = ["failed", "canceled"].includes(observation.evidenceType)
  if ((!terminalBeforeMandate && observation.paymentMethodType !== "acss_debit") || (!terminalBeforeMandate && !observation.providerMandateId) ||
      (terminalBeforeMandate && observation.paymentMethodType !== null && observation.paymentMethodType !== "acss_debit")) {
    return json(edgeCommandFailure("stripe_acss_authoritative_mismatch", "Authoritative Stripe state did not match the ACSS debit lifecycle."), {status: 409})
  }
  const clients = createFunctionClients(request)
  if (!clients.ok) return json(edgeCommandFailure("function_not_configured", clients.error))
  const payloadSha256 = await sha256(payload)
  const capabilityEvidenceHash = await sha256(JSON.stringify({providerAccountId, currencyCode: observation.currencyCode, source: "signed_webhook_refetch"}))
  const {data, error} = await clients.adminClient.rpc("ingest_stripe_acss_debit_webhook", {p_command: {
    contractVersion: "stripe_acss_debit_webhook.v1", deploymentEnvironment: runtimeEnvironment, providerEventId: event.id,
    providerAccountId, eventType: event.type, providerCreatedAt: new Date(event.created * 1000).toISOString(), apiVersion: event.api_version ?? "",
    signatureTimestamp: timestamp, payloadSha256, livemode: false, observationSource: "stripe_sdk_v1", capabilityEvidenceHash, ...observation,
  }})
  return json(error ? edgeCommandFailure("stripe_acss_webhook_ingest_failed", error.message) : edgeCommandSuccess({ignored: false, eventId: event.id, evidenceId: data}), error ? {status: 500} : {})
}
serve(handleRequest)
export {handleRequest, authoritativeObservation, checkoutSessionForPaymentIntent}
