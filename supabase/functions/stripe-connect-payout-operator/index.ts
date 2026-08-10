import Stripe from "stripe"
import { validateStripeConnectPayoutInput } from "../../../lib/edge-functions/stripe-connect-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { submitStripeConnectPayout } from "../../../lib/stripe/stripe-connect-command.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }
async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type" } })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const parsed = await parseJsonBody(request); const validated = validateStripeConnectPayoutInput(parsed.ok ? parsed.body : undefined)
  if (!validated.ok) return json(validated)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  if (!isInternalAdminEmail(auth.user.email ?? null, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))) return json(edgeCommandFailure("forbidden", "Internal operator access is required."))
  const secretKey = getEnv("STRIPE_SECRET_KEY")?.trim(); const platformAccount = getEnv("STRIPE_ACCOUNT_ID")?.trim()
  if (!secretKey?.startsWith("sk_test_") || !platformAccount?.match(/^acct_[A-Za-z0-9]+$/)) return json(edgeCommandFailure("stripe_connect_sandbox_not_configured", "Stripe sandbox credentials are not configured."))
  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() })
  const platform = await stripe.accounts.retrieve(null)
  if ("deleted" in platform || platform.id !== platformAccount) return json(edgeCommandFailure("stripe_connect_platform_mismatch", "Stripe sandbox account binding does not match."))
  const provider = {
    createTransfer: (input: { amount: number; currency: string; destination: string; transferGroup: string; commandId: string }, idempotencyKey: string) => stripe.transfers.create({
      amount: input.amount, currency: input.currency, destination: input.destination, transfer_group: input.transferGroup,
      metadata: { fundloop_payout_command_id: input.commandId },
    }, { idempotencyKey }),
    createPayout: (input: { amount: number; currency: string; providerAccountId: string; commandId: string; transferId: string }, idempotencyKey: string) => stripe.payouts.create({
      amount: input.amount, currency: input.currency, method: "standard",
      metadata: { fundloop_payout_command_id: input.commandId, fundloop_transfer_id: input.transferId },
    }, { stripeAccount: input.providerAccountId, idempotencyKey }),
  }
  const result = await submitStripeConnectPayout(auth.adminClient, provider, auth.user.id, validated.data.payoutIntentId, environment())
  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message), result.ok ? {} : { status: 400 })
}
serve(handleRequest); export { handleRequest }
