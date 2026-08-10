import Stripe from "stripe"
import { validateStripeConnectAccountInput } from "../../../lib/edge-functions/stripe-connect-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { buildStripeConnectAccountSnapshot } from "../../../lib/stripe/stripe-connect-snapshot.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const allowed = new Set(["local", "development", "dev", "preview", "test"])
function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase() }
function siteUrl() { return (getEnv("FUNDLOOP_SITE_URL") ?? "http://127.0.0.1:3000").replace(/\/$/, "") }
async function sha256(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("") }
function code(message: string) { return message.match(/stripe_connect_[a-z_]+/)?.[0] ?? "stripe_connect_account_failed" }

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type" } })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const parsed = await parseJsonBody(request); const validated = validateStripeConnectAccountInput(parsed.ok ? parsed.body : undefined)
  if (!validated.ok) return json(validated)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const deploymentEnvironment = environment()
  if (!allowed.has(deploymentEnvironment)) return json(edgeCommandFailure("stripe_connect_runtime_disabled", "Stripe Connect onboarding is unavailable in production."))
  const secretKey = getEnv("STRIPE_SECRET_KEY")?.trim(); const platformAccount = getEnv("STRIPE_ACCOUNT_ID")?.trim()
  if (!secretKey?.startsWith("sk_test_") || !platformAccount?.match(/^acct_[A-Za-z0-9]+$/)) return json(edgeCommandFailure("stripe_connect_sandbox_not_configured", "Stripe sandbox credentials are not configured."))
  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() })
  const existing = await auth.adminClient.from("stripe_connect_accounts").select("provider_account_id").eq("user_id", auth.user.id).maybeSingle()
  if (existing.error) return json(edgeCommandFailure("stripe_connect_account_read_failed", existing.error.message))
  try {
    const platform = await stripe.accounts.retrieve(null)
    if ("deleted" in platform || platform.id !== platformAccount) return json(edgeCommandFailure("stripe_connect_platform_mismatch", "Stripe sandbox account binding does not match."))
    let providerAccountId = existing.data?.provider_account_id as string | undefined
    if (!providerAccountId) {
      if (validated.data.action !== "onboard") return json(edgeCommandFailure("stripe_connect_account_missing", "Start Stripe onboarding first."))
      const created = await stripe.accounts.create({ type: "express", country: validated.data.countryCode, email: auth.user.email,
        default_currency: validated.data.defaultCurrency.toLowerCase(), capabilities: { transfers: { requested: true } },
        metadata: { fundloop_user_id: auth.user.id, fundloop_environment: deploymentEnvironment } })
      providerAccountId = created.id
    }
    const account = await stripe.accounts.retrieve(providerAccountId, { expand: ["external_accounts"] })
    if (account.deleted) return json(edgeCommandFailure("stripe_connect_account_deleted", "The Stripe connected account is unavailable."))
    const snapshot = buildStripeConnectAccountSnapshot(account)
    const evidenceHash = await sha256(JSON.stringify(snapshot))
    const synced = await auth.adminClient.rpc("sync_stripe_connect_account", { p_actor_user_id: auth.user.id,
      p_command: { contractVersion: "stripe_connect_account_sync.v1", deploymentEnvironment, ...snapshot, evidenceHash } })
    if (synced.error) return json(edgeCommandFailure(code(synced.error.message), synced.error.message))
    if (validated.data.action === "refresh") return json(edgeCommandSuccess({ ...synced.data, account: snapshot, sandbox: true }))
    if (validated.data.action === "manage") {
      const login = await stripe.accounts.createLoginLink(providerAccountId)
      return json(edgeCommandSuccess({ ...synced.data, account: snapshot, redirectUrl: login.url, redirectKind: "express_dashboard", sandbox: true }))
    }
    const link = await stripe.accountLinks.create({ account: providerAccountId, type: "account_onboarding",
      refresh_url: `${siteUrl()}/workspace/earnings?stripe=refresh`, return_url: `${siteUrl()}/workspace/earnings?stripe=returned`,
      collection_options: { fields: "eventually_due", future_requirements: "include" } })
    return json(edgeCommandSuccess({ ...synced.data, account: snapshot, redirectUrl: link.url, redirectKind: "hosted_onboarding", sandbox: true }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe Connect account operation failed."
    return json(edgeCommandFailure(code(message), message))
  }
}
serve(handleRequest); export { handleRequest }
