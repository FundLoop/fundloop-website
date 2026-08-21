import Stripe from "stripe"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import type { StripePayByBankObservation, StripePayByBankCurrency } from "../../../lib/stripe/stripe-pay-by-bank-contract.ts"
import { createFunctionClients, getEnv, json, serve } from "../_shared/command-runtime.ts"

const environment = () => (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase()
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("")
const stringId = (value: unknown, prefix: string) => typeof value === "string" && value.startsWith(prefix) ? value : null
const signatureTimestamp = (header: string) => { const value = header.split(",").find((part) => part.startsWith("t="))?.slice(2); return value && /^\d+$/.test(value) ? Number(value) : null }
function observePaymentIntent(pi: Stripe.PaymentIntent, session: Stripe.Checkout.Session,
  evidenceType?: StripePayByBankObservation["evidenceType"], refund?: Stripe.Refund): StripePayByBankObservation | null {
  const commandId = pi.metadata?.fundloop_pay_by_bank_command_id
  const currency = pi.currency.toUpperCase()
  if (!commandId || session.metadata?.fundloop_pay_by_bank_command_id !== commandId || !/^[0-9a-f-]{36}$/.test(commandId) || !["EUR", "GBP"].includes(currency)) return null
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge as Stripe.Charge : null
  const balance = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction as Stripe.BalanceTransaction : null
  const paymentMethod = typeof pi.payment_method === "object" ? pi.payment_method as Stripe.PaymentMethod : null
  const type = paymentMethod?.type ?? charge?.payment_method_details?.type ?? null
  const country = paymentMethod?.billing_details.address?.country?.toUpperCase() ?? session.customer_details?.address?.country?.toUpperCase() ?? null
  let normalized = evidenceType
  if (!normalized) normalized = pi.status === "succeeded" && balance?.status === "available" ? "settled_available" :
    pi.status === "processing" || pi.status === "succeeded" ? "processing" : pi.status === "canceled" ? "canceled" : "failed"
  const gross = pi.amount_received || pi.amount
  const fee = balance && balance.currency === pi.currency ? balance.fee : null
  const net = balance && balance.currency === pi.currency ? balance.net : null
  return {evidenceType: normalized, commandId, providerObjectId: refund?.id ?? pi.id, providerCheckoutSessionId: session.id,
    providerPaymentIntentId: pi.id, providerChargeId: charge?.id ?? null, providerRefundId: refund?.id ?? null,
    providerBalanceTransactionId: balance?.id ?? null, currencyCode: currency as StripePayByBankCurrency,
    grossAmountMinor: String(gross), refundAmountMinor: refund ? String(refund.amount) : null,
    cumulativeRefundedAmountMinor: refund ? String(charge?.amount_refunded ?? 0) : null,
    feeAmountMinor: fee === null ? null : String(fee), netAmountMinor: net === null ? null : String(net),
    balanceStatus: balance?.status === "available" ? "available" : balance?.status === "pending" ? "pending" : null,
    paymentMethodType: type, customerCountry: country as StripePayByBankObservation["customerCountry"]}
}

async function checkoutSessionForPaymentIntent(stripe: Stripe, pi: Stripe.PaymentIntent) {
  const sessions = await stripe.checkout.sessions.list({payment_intent: pi.id, limit: 2})
  const commandId = pi.metadata?.fundloop_pay_by_bank_command_id
  const matching = sessions.data.filter((session) => session.metadata?.fundloop_pay_by_bank_command_id === commandId)
  return matching.length === 1 ? matching[0] : null
}

async function observeWithCheckout(stripe: Stripe, pi: Stripe.PaymentIntent, evidenceType?: StripePayByBankObservation["evidenceType"]) {
  const session = await checkoutSessionForPaymentIntent(stripe, pi)
  return session ? observePaymentIntent(pi, session, evidenceType) : null
}

async function authoritativeObservation(stripe: Stripe, event: Stripe.Event): Promise<StripePayByBankObservation | null> {
  const raw = event.data.object as {id?: string; payment_intent?: string | Stripe.PaymentIntent; metadata?: Record<string,string>; amount?: number; amount_refunded?: number; currency?: string; status?: string}
  if (event.type === "checkout.session.completed" && raw.id?.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(raw.id, {expand: ["payment_intent.latest_charge.balance_transaction", "payment_intent.payment_method"]})
    const pi = typeof session.payment_intent === "object" ? session.payment_intent : null
    return pi ? observePaymentIntent(pi, session, "checkout_completed") : null
  }
  if (event.type === "checkout.session.expired" && raw.id?.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(raw.id)
    const commandId = session.metadata?.fundloop_pay_by_bank_command_id
    const currency = session.currency?.toUpperCase()
    const country = session.customer_details?.address?.country?.toUpperCase() ?? session.metadata?.fundloop_customer_country?.toUpperCase()
    if (!commandId || !/^[0-9a-f-]{36}$/.test(commandId) || !currency || !["EUR", "GBP"].includes(currency)) return null
    return {evidenceType: "expired", commandId, providerObjectId: session.id, providerCheckoutSessionId: session.id,
      providerPaymentIntentId: null, providerChargeId: null, providerRefundId: null, providerBalanceTransactionId: null,
      currencyCode: currency as StripePayByBankCurrency, grossAmountMinor: String(session.amount_total ?? 0), refundAmountMinor: null,
      cumulativeRefundedAmountMinor: null,
      feeAmountMinor: null, netAmountMinor: null, balanceStatus: null, paymentMethodType: null,
      customerCountry: country as StripePayByBankObservation["customerCountry"]}
  }
  if (event.type.startsWith("payment_intent.") && raw.id?.startsWith("pi_")) {
    const pi = await stripe.paymentIntents.retrieve(raw.id, {expand: ["latest_charge.balance_transaction", "payment_method"]})
    return observeWithCheckout(stripe, pi)
  }
  if ((event.type === "refund.updated" || event.type === "refund.failed") && raw.id?.startsWith("re_")) {
    const refund = await stripe.refunds.retrieve(raw.id, {expand: ["payment_intent.latest_charge.balance_transaction", "payment_intent.payment_method"]})
    const pi = typeof refund.payment_intent === "object" ? refund.payment_intent as Stripe.PaymentIntent : null
    if (!pi) return null
    const session = await checkoutSessionForPaymentIntent(stripe, pi)
    if (!session) return null
    const kind: StripePayByBankObservation["evidenceType"] = refund.status === "succeeded" ? "refunded" : refund.status === "failed" ? "refund_failed" : "refund_pending"
    return observePaymentIntent(pi, session, kind, refund)
  }
  return null
}

async function handleRequest(request: Request) {
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const runtimeEnvironment = environment()
  if (!["local", "development", "dev", "preview", "test"].includes(runtimeEnvironment)) return json(edgeCommandFailure("production_disabled", "Pay by Bank webhooks are unavailable in this environment."))
  const secretKey = getEnv("STRIPE_SECRET_KEY")?.trim(), webhookSecret = getEnv("STRIPE_PAY_BY_BANK_WEBHOOK_SECRET")?.trim()
  const platformAccountId = getEnv("STRIPE_ACCOUNT_ID")?.trim(), providerAccountId = getEnv("STRIPE_PAY_BY_BANK_MERCHANT_ACCOUNT_ID")?.trim() || platformAccountId
  if (!secretKey?.startsWith("sk_test_") || !webhookSecret?.startsWith("whsec_") || !providerAccountId?.match(/^acct_[A-Za-z0-9]+$/)) return json(edgeCommandFailure("stripe_pay_by_bank_not_configured", "Pay by Bank webhook credentials are not configured."))
  const signature = request.headers.get("stripe-signature") ?? "", timestamp = signatureTimestamp(signature)
  if (timestamp === null) return json(edgeCommandFailure("invalid_signature", "Stripe signature timestamp is missing."), {status: 400})
  const payload = await request.text(), stripe = new Stripe(secretKey, {httpClient: Stripe.createFetchHttpClient()})
  let event: Stripe.Event
  try { event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret, 300, Stripe.createSubtleCryptoProvider()) }
  catch { return json(edgeCommandFailure("invalid_signature", "Stripe webhook signature verification failed."), {status: 400}) }
  if (event.livemode) return json(edgeCommandFailure("live_mode_denied", "Live-mode Stripe events are forbidden."), {status: 403})
  if (providerAccountId !== platformAccountId && event.account !== providerAccountId) return json(edgeCommandFailure("stripe_pay_by_bank_account_mismatch", "Stripe event account did not match the configured merchant."), {status: 409})
  const providerStripe = providerAccountId === platformAccountId ? stripe : new Stripe(secretKey, {httpClient: Stripe.createFetchHttpClient(), stripeAccount: providerAccountId})
  const observation = await authoritativeObservation(providerStripe, event)
  if (!observation) return json(edgeCommandSuccess({ignored: true, eventId: event.id}))
  if (observation.evidenceType !== "expired" && observation.paymentMethodType !== "pay_by_bank") return json(edgeCommandFailure("stripe_pay_by_bank_authoritative_mismatch", "Authoritative Stripe state did not prove Pay by Bank."), {status: 409})
  const clients = createFunctionClients(request)
  if (!clients.ok) return json(edgeCommandFailure("function_not_configured", clients.error))
  const payloadSha256 = await sha256(payload)
  const capabilityEvidenceHash = await sha256(JSON.stringify({providerAccountId, currencyCode: observation.currencyCode, source: "signed_webhook_refetch"}))
  const {data, error} = await clients.adminClient.rpc("ingest_stripe_pay_by_bank_webhook", {p_command: {
    contractVersion: "stripe_pay_by_bank_webhook.v1", deploymentEnvironment: runtimeEnvironment, providerEventId: event.id,
    providerAccountId, eventType: event.type, providerCreatedAt: new Date(event.created * 1000).toISOString(), apiVersion: event.api_version ?? "",
    signatureTimestamp: timestamp, payloadSha256, livemode: false, observationSource: "stripe_sdk_v1", capabilityEvidenceHash, ...observation,
  }})
  return json(error ? edgeCommandFailure("stripe_pay_by_bank_webhook_ingest_failed", error.message) : edgeCommandSuccess({ignored: false, eventId: event.id, evidenceId: data}), error ? {status: 500} : {})
}
serve(handleRequest)
export {handleRequest, authoritativeObservation, checkoutSessionForPaymentIntent}
