import Stripe from "stripe"
import { createStripePayByBankCheckout } from "../../../lib/execution/adapters/stripe-pay-by-bank.ts"
import { validateStripePayByBankCheckoutCreateInput } from "../../../lib/stripe/stripe-pay-by-bank-contract.ts"
import { requireCurrentTermsAcknowledgement } from "../../../lib/policies/terms-acknowledgement-guard.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

const environment = () => (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase()
const origin = () => (getEnv("FUNDLOOP_APP_ORIGIN") ?? "http://127.0.0.1:3000").replace(/\/$/, "")

async function projectAdminContext(client: any, actorUserId: string, slug: string) {
  const {data: project, error} = await client.from("projects").select("id,slug,organization_id").eq("slug", slug).maybeSingle()
  if (error || !project) return null
  const {data: participant} = await client.from("participants").select("id").eq("project_id", project.id).eq("user_id", actorUserId).eq("is_admin", true).maybeSingle()
  if (participant?.id) return project
  const {data: roles} = await client.from("ref_roles").select("id").in("name", ["Founder", "Admin"])
  const roleIds = (roles ?? []).map((role: {id: number}) => role.id)
  if (project.organization_id && roleIds.length) {
    const {data: member} = await client.from("organization_members").select("id").eq("organization_id", project.organization_id)
      .eq("user_id", actorUserId).eq("status", "active").is("deleted_at", null).in("role_id", roleIds).maybeSingle()
    if (member?.id) return project
  }
  return null
}

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", {headers: {"access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type"}})
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const runtimeEnvironment = environment()
  const body = await parseJsonBody(request)
  if (!body.ok) return json(edgeCommandFailure("invalid_payload", body.error ?? "Request body must be valid JSON."))
  const input = validateStripePayByBankCheckoutCreateInput(body.body, runtimeEnvironment)
  if (!input.ok) return json(input)
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const acknowledgement = await requireCurrentTermsAcknowledgement(auth.adminClient, {actorUserId: auth.user.id, actorCapacity: "project_actor", sourceSurface: "project_funding_preview"})
  if (!acknowledgement.ok) return json(edgeCommandFailure(acknowledgement.code, acknowledgement.message))
  const project = await projectAdminContext(auth.adminClient, auth.user.id, input.data.projectSlug)
  if (!project) return json(edgeCommandFailure("permission_denied", "You do not have permission to fund this project."))
  const {data: payment, error: paymentError} = await auth.adminClient.from("payments").select("id,project_id,payment_amount").eq("id", input.data.paymentId).eq("project_id", project.id).maybeSingle()
  if (paymentError || !payment || String(Math.round(Number(payment.payment_amount) * 100)) !== input.data.expectedAmountMinor) {
    return json(edgeCommandFailure("payment_mismatch", "Payment amount changed; reload before opening Pay by Bank Checkout."))
  }
  const secretKey = getEnv("STRIPE_SECRET_KEY")?.trim()
  const platformAccountId = getEnv("STRIPE_ACCOUNT_ID")?.trim()
  const providerAccountId = getEnv("STRIPE_PAY_BY_BANK_MERCHANT_ACCOUNT_ID")?.trim() || platformAccountId
  const configurationId = getEnv("STRIPE_PAY_BY_BANK_PAYMENT_METHOD_CONFIGURATION_ID")?.trim()
  const chargeTopology = (getEnv("STRIPE_PAY_BY_BANK_CHARGE_TOPOLOGY")?.trim() || "platform") as "platform" | "direct"
  if (!secretKey?.startsWith("sk_test_") || !platformAccountId?.match(/^acct_[A-Za-z0-9]+$/) || !providerAccountId?.match(/^acct_[A-Za-z0-9]+$/) ||
      !configurationId?.match(/^pmc_[A-Za-z0-9]+$/) || !["platform","direct"].includes(chargeTopology) ||
      (chargeTopology === "platform") !== (providerAccountId === platformAccountId)) {
    return json(edgeCommandFailure("stripe_pay_by_bank_not_configured", "Pay by Bank sandbox capability/configuration evidence is unavailable."))
  }
  const stripe = new Stripe(secretKey, {httpClient: Stripe.createFetchHttpClient()})
  const connected = providerAccountId !== platformAccountId
  const requestOptions = connected ? {stripeAccount: providerAccountId} : undefined
  let capabilitySnapshot: {accountId: string; livemode: boolean; merchantCountry: string; payByBankActive: boolean;
    configurationActive: boolean; chargeTopology: typeof chargeTopology; privatePreviewCountries: Array<"FI"|"FR"|"DE"|"IE"|"GB">}
  try {
    const [account, configuration] = await Promise.all([
      connected ? stripe.accounts.retrieve(providerAccountId) : stripe.accounts.retrieve(null),
      stripe.paymentMethodConfigurations.retrieve(configurationId, {}, requestOptions),
    ])
    const capabilities = (account as unknown as {capabilities?: Record<string, string>}).capabilities ?? {}
    const configurationRecord = configuration as unknown as Record<string, unknown>
    const method = configurationRecord.pay_by_bank as {available?: boolean; display_preference?: {value?: string}} | undefined
    const activeMethods = Object.entries(configurationRecord).filter(([, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false
      const candidate = value as {available?: unknown; display_preference?: {value?: unknown}}
      return candidate.available === true && candidate.display_preference?.value !== "off"
    }).map(([key]) => key)
    capabilitySnapshot = {accountId: account.id, livemode: false, merchantCountry: account.country ?? "",
      payByBankActive: capabilities.pay_by_bank_payments === "active", chargeTopology,
      configurationActive: method?.available === true && method.display_preference?.value !== "off" && activeMethods.length === 1 && activeMethods[0] === "pay_by_bank",
      privatePreviewCountries: []}
  } catch {
    return json(edgeCommandFailure("stripe_pay_by_bank_not_enabled", "Authoritative Pay by Bank capability/configuration evidence is unavailable."))
  }
  const previewEnabled = false
  if (capabilitySnapshot.livemode || !capabilitySnapshot.payByBankActive || !capabilitySnapshot.configurationActive ||
      (["FR","DE","IE"].includes(input.data.customerCountry) && !previewEnabled)) {
    return json(edgeCommandFailure("stripe_pay_by_bank_not_enabled", "Pay by Bank is unavailable for this exact merchant and customer country."))
  }
  const {data: commandId, error: prepareError} = await auth.adminClient.rpc("prepare_stripe_pay_by_bank_command", {p_command: {
    contractVersion: "stripe_pay_by_bank_prepare.v1", deploymentEnvironment: runtimeEnvironment, actorUserId: auth.user.id,
    projectSlug: input.data.projectSlug, paymentId: input.data.paymentId, currencyCode: input.data.currencyCode,
    expectedAmountMinor: input.data.expectedAmountMinor, customerCountry: input.data.customerCountry,
    providerAccountId, platformAccountId, chargeTopology, merchantCountry: capabilitySnapshot.merchantCountry, privatePreviewEnabled: previewEnabled,
  }})
  if (prepareError || typeof commandId !== "string") return json(edgeCommandFailure("stripe_pay_by_bank_prepare_failed", prepareError?.message ?? "Pay by Bank command could not be prepared."))
  let result
  try {
    result = await createStripePayByBankCheckout({
      async discoverCapability() {
        return capabilitySnapshot
      },
      async createCheckoutSession(providerInput) {
        const session = await stripe.checkout.sessions.create({mode: "payment", integration_identifier: providerInput.integrationIdentifier,
          payment_method_configuration: providerInput.paymentMethodConfigurationId,
          line_items: [{quantity: 1, price_data: {currency: providerInput.currency, unit_amount: providerInput.amountMinor,
            product_data: {name: `FundLoop project funding #${input.data.paymentId}`, description: "One-time Pay by Bank"}}}],
          success_url: providerInput.successUrl, cancel_url: providerInput.cancelUrl, customer_creation: "always",
          payment_intent_data: {setup_future_usage: undefined, metadata: providerInput.metadata}, metadata: providerInput.metadata,
          billing_address_collection: "required",
          custom_text: {submit: {message: "One-time project funding. FundLoop never receives your bank credentials."}},
        }, {idempotencyKey: providerInput.idempotencyKey, ...(providerAccountId !== platformAccountId ? {stripeAccount: providerAccountId} : {})})
        return {id: session.id, url: session.url, livemode: session.livemode}
      },
    }, {environment: runtimeEnvironment, commandId, projectId: project.id, projectSlug: input.data.projectSlug,
      paymentId: input.data.paymentId, amountMinor: input.data.expectedAmountMinor, currencyCode: input.data.currencyCode,
      actorUserId: auth.user.id, paymentMethodConfigurationId: configurationId, appOrigin: origin(), customerCountry: input.data.customerCountry})
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    return json(edgeCommandFailure(/pay.by.bank|payment method|configuration|capabilit/i.test(message) ? "stripe_pay_by_bank_not_enabled" : "stripe_pay_by_bank_provider_rejected",
      "Stripe could not open Pay by Bank Checkout. Confirm test-mode Pay by Bank capability and the dedicated payment-method configuration."))
  }
  if (!result.ok) return json(result)
  const {error: acknowledgeError} = await auth.adminClient.rpc("acknowledge_stripe_pay_by_bank_checkout", {p_command: {commandId,
    providerAccountId: result.data.providerAccountId, providerCheckoutSessionId: result.data.checkoutSessionId,
    capabilityEvidenceHash: result.data.capabilityEvidenceHash}})
  if (acknowledgeError) return json(edgeCommandFailure("stripe_pay_by_bank_checkout_ack_failed", "Stripe Checkout was created; retry safely to recover the local acknowledgement."))
  return json(edgeCommandSuccess({commandId, checkoutSessionId: result.data.checkoutSessionId, checkoutUrl: result.data.checkoutUrl,
    currencyCode: input.data.currencyCode, expectedAmountMinor: input.data.expectedAmountMinor, status: "checkout_created", sandboxOnly: true}))
}
serve(handleRequest)
export {handleRequest}
