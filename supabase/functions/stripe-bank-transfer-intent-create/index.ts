import Stripe from "stripe"
import { createStripeBankTransferIntent } from "../../../lib/execution/adapters/stripe-bank-transfer.ts"
import { validateStripeBankTransferIntentCreateInput } from "../../../lib/stripe/stripe-bank-transfer-contract.ts"
import { requireCurrentTermsAcknowledgement } from "../../../lib/policies/terms-acknowledgement-guard.ts"
import { edgeCommandFailure,edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequest,getEnv,json,parseJsonBody,serve } from "../_shared/command-runtime.ts"

function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV")??"production").trim().toLowerCase() }

async function projectAdminContext(client,actorUserId,slug) {
  const {data:project,error}=await client.from("projects").select("id,slug,organization_id").eq("slug",slug).maybeSingle()
  if(error||!project)return {ok:false,error:"Project not found."}
  const {data:participant}=await client.from("participants").select("id").eq("project_id",project.id).eq("user_id",actorUserId).eq("is_admin",true).maybeSingle()
  if(participant?.id)return {ok:true,project}
  const {data:roles}=await client.from("ref_roles").select("id").in("name",["Founder","Admin"])
  const roleIds=(roles??[]).map((role)=>role.id)
  if(project.organization_id&&roleIds.length) {
    const {data:member}=await client.from("organization_members").select("id").eq("organization_id",project.organization_id)
      .eq("user_id",actorUserId).eq("status","active").is("deleted_at",null).in("role_id",roleIds).maybeSingle()
    if(member?.id)return {ok:true,project}
  }
  return {ok:false,error:"You do not have permission to fund this project."}
}

async function handleRequest(request:Request) {
  if(request.method==="OPTIONS")return new Response("ok",{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type"}})
  if(request.method!=="POST")return json(edgeCommandFailure("method_not_allowed","POST required."))
  const runtimeEnvironment=environment()
  const body=await parseJsonBody(request);if(!body.ok)return json(edgeCommandFailure("invalid_payload",body.error))
  const input=validateStripeBankTransferIntentCreateInput(body.body,runtimeEnvironment);if(!input.ok)return json(input)
  const auth=await authenticateRequest(request);if(!auth.ok||!auth.user)return json(edgeCommandFailure(auth.code??"not_authenticated",auth.error))
  const acknowledgement=await requireCurrentTermsAcknowledgement(auth.adminClient,{actorUserId:auth.user.id,actorCapacity:"project_actor",sourceSurface:"project_funding_preview"})
  if(!acknowledgement.ok)return json(edgeCommandFailure(acknowledgement.code,acknowledgement.message))
  const context=await projectAdminContext(auth.adminClient,auth.user.id,input.data.projectSlug)
  if(!context.ok)return json(edgeCommandFailure("permission_denied",context.error))
  const {data:payment,error:paymentError}=await auth.adminClient.from("payments").select("id,project_id,payment_amount").eq("id",input.data.paymentId).eq("project_id",context.project.id).maybeSingle()
  if(paymentError||!payment)return json(edgeCommandFailure("payment_not_found","Payment not found."))
  if(String(Math.round(Number(payment.payment_amount)*100))!==input.data.expectedAmountMinor)return json(edgeCommandFailure("amount_mismatch","Payment amount changed; reload before requesting instructions."))
  const secretKey=getEnv("STRIPE_SECRET_KEY")?.trim();const providerAccountId=getEnv("STRIPE_ACCOUNT_ID")?.trim()
  if(!secretKey?.startsWith("sk_test_")||!providerAccountId?.match(/^acct_[A-Za-z0-9]+$/))return json(edgeCommandFailure("stripe_sandbox_not_configured","Stripe sandbox credentials are not configured."))
  const stripe=new Stripe(secretKey,{httpClient:Stripe.createFetchHttpClient()})
  let result
  try { result=await createStripeBankTransferIntent({
    async createCustomer(providerInput) {
      const customer=await stripe.customers.create({metadata:providerInput.metadata},{idempotencyKey:providerInput.idempotencyKey})
      return {id:customer.id,livemode:customer.livemode}
    },
    async createPaymentIntent(providerInput) {
      const intent=await stripe.paymentIntents.create({amount:providerInput.amountMinor,currency:providerInput.currency,customer:providerInput.customerId,
        payment_method_types:["customer_balance"],payment_method_data:{type:"customer_balance"},
        payment_method_options:{customer_balance:{funding_type:"bank_transfer",bank_transfer:{type:"us_bank_transfer"}}},confirm:true,metadata:providerInput.metadata},
        {idempotencyKey:providerInput.idempotencyKey})
      const instructions=(intent.next_action as {display_bank_transfer_instructions?:{hosted_instructions_url?:string|null}}|null)?.display_bank_transfer_instructions
      return {id:intent.id,livemode:intent.livemode,status:intent.status,hostedInstructionsUrl:instructions?.hosted_instructions_url??null}
    },
  },{environment:runtimeEnvironment,projectId:context.project.id,projectSlug:input.data.projectSlug,paymentId:input.data.paymentId,
    amountMinor:input.data.expectedAmountMinor,currencyCode:"USD",actorUserId:auth.user.id}) }
  catch(error) {
    const message=error instanceof Error?error.message:""
    const bankTransfersUnavailable=/bank transfer|bank_transfer/i.test(message)
    return json(edgeCommandFailure(bankTransfersUnavailable?"stripe_bank_transfers_not_enabled":"stripe_bank_transfer_provider_rejected",
      bankTransfersUnavailable
        ?"Stripe Bank Transfers are not enabled for the Fundloop sandbox. Enable the payment method in Stripe before retrying."
        :"Stripe rejected the sandbox bank-transfer request. Confirm Bank Transfers are enabled for the Fundloop sandbox before retrying."))
  }
  if(!result.ok)return json(result)
  const {data:intentId,error}=await auth.adminClient.rpc("record_stripe_bank_transfer_intent",{p_command:{contractVersion:"stripe_bank_transfer_intent.v1",
    deploymentEnvironment:runtimeEnvironment,actorUserId:auth.user.id,projectSlug:input.data.projectSlug,paymentId:input.data.paymentId,
    currencyCode:"USD",expectedAmountMinor:input.data.expectedAmountMinor,providerAccountId,providerCustomerId:result.data.providerCustomerId,
    providerPaymentIntentId:result.data.providerPaymentIntentId,evidenceHash:result.data.evidenceHash}})
  if(error)return json(edgeCommandFailure("stripe_intent_record_failed",error.message))
  return json(edgeCommandSuccess({intentId:Number(intentId),paymentId:input.data.paymentId,currencyCode:"USD",expectedAmountMinor:input.data.expectedAmountMinor,
    providerPaymentIntentId:result.data.providerPaymentIntentId,status:result.data.status,hostedInstructionsUrl:result.data.hostedInstructionsUrl,sandboxOnly:true}))
}
serve(handleRequest);export{handleRequest}
