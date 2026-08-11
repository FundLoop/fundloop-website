import Stripe from "stripe"
import { createStripeAcssDebitCheckout } from "../../../lib/execution/adapters/stripe-acss-debit.ts"
import { validateStripeAcssDebitCheckoutCreateInput } from "../../../lib/stripe/stripe-acss-debit-contract.ts"
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
  const input = validateStripeAcssDebitCheckoutCreateInput(body.body, runtimeEnvironment)
  if (!input.ok) return json(input)
  if (input.data.currencyCode === "USD") return json(edgeCommandFailure("usd_account_evidence_required", "USD PAD remains unavailable without authoritative exact-account denomination evidence."))
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const acknowledgement = await requireCurrentTermsAcknowledgement(auth.adminClient, {actorUserId: auth.user.id, actorCapacity: "project_actor", sourceSurface: "project_funding_preview"})
  if (!acknowledgement.ok) return json(edgeCommandFailure(acknowledgement.code, acknowledgement.message))
  const project = await projectAdminContext(auth.adminClient, auth.user.id, input.data.projectSlug)
  if (!project) return json(edgeCommandFailure("permission_denied", "You do not have permission to fund this project."))
  const {data: payment, error: paymentError} = await auth.adminClient.from("payments").select("id,project_id").eq("id", input.data.paymentId).eq("project_id", project.id).maybeSingle()
  if (paymentError || !payment) return json(edgeCommandFailure("payment_mismatch", "Payment changed; reload before opening PAD Checkout."))
  const secretKey = getEnv("STRIPE_SECRET_KEY")?.trim()
  const providerAccountId = getEnv("STRIPE_ACCOUNT_ID")?.trim()
  const configurationId = getEnv("STRIPE_ACSS_DEBIT_PAYMENT_METHOD_CONFIGURATION_ID")?.trim()
  if (!secretKey?.startsWith("sk_test_") || !providerAccountId?.match(/^acct_[A-Za-z0-9]+$/) || !configurationId?.match(/^pmc_[A-Za-z0-9]+$/)) {
    return json(edgeCommandFailure("stripe_acss_debit_not_configured", "Canadian PAD sandbox capability/configuration evidence is unavailable."))
  }
  const {data: commandId, error: prepareError} = await auth.adminClient.rpc("prepare_stripe_acss_debit_command", {p_command: {
    contractVersion: "stripe_acss_debit_prepare.v1", deploymentEnvironment: runtimeEnvironment, actorUserId: auth.user.id,
    projectSlug: input.data.projectSlug, paymentId: input.data.paymentId, currencyCode: input.data.currencyCode,
  }})
  if (prepareError || typeof commandId !== "string") return json(edgeCommandFailure("stripe_acss_prepare_failed", prepareError?.message ?? "PAD command could not be prepared."))
  const {data: preparedCommand, error: preparedCommandError} = await auth.adminClient.from("stripe_acss_debit_commands")
    .select("expected_amount_minor,funding_quote_id").eq("id", commandId).maybeSingle()
  const expectedAmountMinor = preparedCommand?.expected_amount_minor === null || preparedCommand?.expected_amount_minor === undefined
    ? null : String(preparedCommand.expected_amount_minor)
  if (preparedCommandError || !preparedCommand?.funding_quote_id || !expectedAmountMinor || !/^[1-9]\d*$/.test(expectedAmountMinor)) {
    return json(edgeCommandFailure("stripe_acss_funding_quote_unavailable", "A fresh reviewed CAD conversion quote is required before Checkout."))
  }
  const stripe = new Stripe(secretKey, {httpClient: Stripe.createFetchHttpClient()})
  let result
  try {
    result = await createStripeAcssDebitCheckout({
      async discoverCapability() {
        const [account, configuration] = await Promise.all([stripe.accounts.retrieve(providerAccountId), stripe.paymentMethodConfigurations.retrieve(configurationId)])
        const capabilities = (account as unknown as {capabilities?: Record<string, string>}).capabilities ?? {}
        const rawConfiguration = configuration as unknown as Record<string, unknown>
        const acss = rawConfiguration.acss_debit as {available?: boolean; display_preference?: {value?: string}} | undefined
        const enabledMethods = Object.entries(rawConfiguration).filter(([key, value]) => key !== "acss_debit" && value && typeof value === "object")
          .filter(([, value]) => { const method = value as {available?: boolean; display_preference?: {value?: string}}; return method.available === true && method.display_preference?.value !== "off" })
        return {accountId: account.id, livemode: false,
          acssDebitActive: capabilities.acss_debit_payments === "active",
          configurationActive: acss?.available === true && acss.display_preference?.value !== "off" && enabledMethods.length === 0}
      },
      async createCheckoutSession(providerInput) {
        const session = await stripe.checkout.sessions.create({mode: "payment", integration_identifier: providerInput.integrationIdentifier,
          payment_method_configuration: providerInput.paymentMethodConfigurationId,
          line_items: [{quantity: 1, price_data: {currency: providerInput.currency, unit_amount: providerInput.amountMinor,
            product_data: {name: `FundLoop project funding #${input.data.paymentId}`, description: "One-time Canadian pre-authorized debit"}}}],
          success_url: providerInput.successUrl, cancel_url: providerInput.cancelUrl, customer_creation: "always",
          payment_intent_data: {setup_future_usage: undefined, metadata: providerInput.metadata}, metadata: providerInput.metadata,
          custom_text: {submit: {message: "One-time project funding. FundLoop does not save or reuse your bank mandate."}},
        }, {idempotencyKey: providerInput.idempotencyKey})
        return {id: session.id, url: session.url, livemode: session.livemode}
      },
    }, {environment: runtimeEnvironment, commandId, projectId: project.id, projectSlug: input.data.projectSlug,
      paymentId: input.data.paymentId, amountMinor: expectedAmountMinor, currencyCode: input.data.currencyCode,
      actorUserId: auth.user.id, paymentMethodConfigurationId: configurationId, appOrigin: origin(), usdAccountEvidenceVerified: false})
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    return json(edgeCommandFailure(/acss|payment method|configuration|capabilit/i.test(message) ? "stripe_acss_debit_not_enabled" : "stripe_acss_provider_rejected",
      "Stripe could not open Canadian PAD Checkout. Confirm test-mode PAD capability and the dedicated payment-method configuration."))
  }
  if (!result.ok) return json(result)
  const {error: acknowledgeError} = await auth.adminClient.rpc("acknowledge_stripe_acss_debit_checkout", {p_command: {commandId,
    providerAccountId: result.data.providerAccountId, providerCheckoutSessionId: result.data.checkoutSessionId,
    capabilityEvidenceHash: result.data.capabilityEvidenceHash}})
  if (acknowledgeError) return json(edgeCommandFailure("stripe_acss_checkout_ack_failed", "Stripe Checkout was created; retry safely to recover the local acknowledgement."))
  return json(edgeCommandSuccess({commandId, checkoutSessionId: result.data.checkoutSessionId, checkoutUrl: result.data.checkoutUrl,
    currencyCode: input.data.currencyCode, expectedAmountMinor, status: "checkout_created", sandboxOnly: true}))
}
serve(handleRequest)
export {handleRequest}
