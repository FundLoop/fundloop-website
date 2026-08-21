import Stripe from "stripe"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { buildStripeConnectAccountSnapshot } from "../../../lib/stripe/stripe-connect-snapshot.ts"
import { createFunctionClients, getEnv, json, serve } from "../_shared/command-runtime.ts"

const accepted = new Set(["account.updated", "payout.created", "payout.updated", "payout.paid", "payout.failed", "payout.canceled"])
function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }
async function sha256(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("") }
function signatureTimestamp(header: string) { const value = header.split(",").find((part) => part.startsWith("t="))?.slice(2); return value && /^\d+$/.test(value) ? Number(value) : null }
function payoutStatus(value: string) { return ["pending", "in_transit", "paid", "failed", "canceled"].includes(value) ? value : "pending" }

async function handleRequest(request: Request) {
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const deploymentEnvironment = environment()
  if (!["local", "development", "dev", "preview", "test"].includes(deploymentEnvironment)) return json(edgeCommandFailure("stripe_connect_runtime_disabled", "Stripe Connect webhooks are unavailable in production."))
  const secretKey = getEnv("STRIPE_SECRET_KEY")?.trim(); const webhookSecret = getEnv("STRIPE_CONNECT_WEBHOOK_SECRET")?.trim(); const platformAccount = getEnv("STRIPE_ACCOUNT_ID")?.trim()
  if (!secretKey?.startsWith("sk_test_") || !webhookSecret?.startsWith("whsec_") || !platformAccount?.match(/^acct_[A-Za-z0-9]+$/)) return json(edgeCommandFailure("stripe_connect_sandbox_not_configured", "Stripe Connect sandbox webhook credentials are not configured."))
  const signature = request.headers.get("stripe-signature") ?? ""; const timestamp = signatureTimestamp(signature); const payload = await request.text()
  if (timestamp === null) return json(edgeCommandFailure("invalid_signature", "Stripe signature timestamp is missing."), { status: 400 })
  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() })
  const platform = await stripe.accounts.retrieveCurrent()
  if ("deleted" in platform || platform.id !== platformAccount) return json(edgeCommandFailure("stripe_connect_platform_mismatch", "Stripe sandbox account binding does not match."))
  let event: Stripe.Event
  try { event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret, 300, Stripe.createSubtleCryptoProvider()) }
  catch { return json(edgeCommandFailure("invalid_signature", "Stripe webhook signature verification failed."), { status: 400 }) }
  if (event.livemode) return json(edgeCommandFailure("live_mode_denied", "Live-mode Stripe events are forbidden."), { status: 403 })
  if (!accepted.has(event.type)) return json(edgeCommandSuccess({ ignored: true, eventId: event.id }))
  const providerAccountId = typeof event.account === "string" ? event.account : ""
  if (!/^acct_[A-Za-z0-9]+$/.test(providerAccountId)) return json(edgeCommandFailure("stripe_connect_account_missing", "Connected-account event context is required."), { status: 400 })
  const clients = createFunctionClients(request); if (!clients.ok) return json(edgeCommandFailure("function_not_configured", clients.error))
  const payloadSha256 = await sha256(payload)
  let command: Record<string, unknown>
  if (event.type === "account.updated") {
    const retrieved = await stripe.accounts.retrieve(providerAccountId, { expand: ["external_accounts"] })
    if ("deleted" in retrieved && retrieved.deleted) return json(edgeCommandFailure("stripe_connect_account_deleted", "The connected account was deleted."))
    const snapshot = buildStripeConnectAccountSnapshot(retrieved, new Date(event.created * 1000))
    command = { ...snapshot, contractVersion: "stripe_connect_webhook.v1", deploymentEnvironment, providerEventId: event.id,
      eventType: event.type, providerObjectId: providerAccountId, providerCreatedAt: new Date(event.created * 1000).toISOString(),
      signatureTimestamp: timestamp, payloadSha256, livemode: false, observationSource: "stripe_sdk_v1" }
  } else {
    const raw = event.data.object as Stripe.Payout
    const payout = await stripe.payouts.retrieve(raw.id, { expand: ["destination"] }, { stripeAccount: providerAccountId })
    const destination = payout.destination && typeof payout.destination === "object" ? payout.destination as Stripe.BankAccount | Stripe.Card : null
    command = { contractVersion: "stripe_connect_webhook.v1", deploymentEnvironment, providerEventId: event.id, providerAccountId,
      eventType: event.type, providerObjectId: payout.id, providerCreatedAt: new Date(event.created * 1000).toISOString(),
      signatureTimestamp: timestamp, payloadSha256, livemode: false, observationSource: "stripe_sdk_v1", providerStatus: payoutStatus(payout.status),
      amountMinor: String(payout.amount), currencyCode: payout.currency.toUpperCase(), destinationLast4: destination?.last4 ?? "",
      failureCode: payout.failure_code ?? "", arrivalAt: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : "",
      providerCommandId: payout.metadata?.fundloop_payout_command_id ?? "", providerTransferId: payout.metadata?.fundloop_transfer_id ?? "" }
  }
  const result = await clients.adminClient.rpc("ingest_stripe_connect_webhook", { p_command: command })
  return json(result.error ? edgeCommandFailure("stripe_connect_webhook_ingest_failed", result.error.message) : edgeCommandSuccess({ eventId: event.id, result: result.data }), result.error ? { status: 500 } : {})
}
serve(handleRequest); export { handleRequest }
