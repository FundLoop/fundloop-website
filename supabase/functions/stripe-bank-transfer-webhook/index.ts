import Stripe from "stripe"
import { normalizeStripeBankTransferWebhook } from "../../../lib/stripe/stripe-bank-transfer-contract.ts"
import { edgeCommandFailure,edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { createFunctionClients,getEnv,json,serve } from "../_shared/command-runtime.ts"

async function sha256(value:string) { const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("") }
function signatureTimestamp(header:string) { const value=header.split(",").find(part=>part.startsWith("t="))?.slice(2);return value&&/^\d+$/.test(value)?Number(value):null }
function environment() { return (getEnv("FUNDLOOP_DEPLOYMENT_ENV")??"production").trim().toLowerCase() }
function balanceSnapshots(balance:Stripe.Balance) {
  const currencies=new Set([...(balance.available??[]).map(x=>x.currency),...(balance.pending??[]).map(x=>x.currency)])
  return [...currencies].filter(currency=>currency==="usd"||currency==="cad").map(currency=>({currencyCode:currency.toUpperCase(),
    availableAmountMinor:String((balance.available??[]).filter(x=>x.currency===currency).reduce((sum,x)=>sum+x.amount,0)),
    pendingAmountMinor:String((balance.pending??[]).filter(x=>x.currency===currency).reduce((sum,x)=>sum+x.amount,0))}))
}

async function handleRequest(request:Request) {
  if(request.method!=="POST")return json(edgeCommandFailure("method_not_allowed","POST required."))
  const runtimeEnvironment=environment()
  if(!["local","dev","test"].includes(runtimeEnvironment))return json(edgeCommandFailure("production_disabled","Stripe webhooks are unavailable in this environment."))
  const secretKey=getEnv("STRIPE_SECRET_KEY")?.trim(),webhookSecret=getEnv("STRIPE_WEBHOOK_SECRET")?.trim(),providerAccountId=getEnv("STRIPE_ACCOUNT_ID")?.trim()
  if(!secretKey?.startsWith("sk_test_")||!webhookSecret?.startsWith("whsec_")||!providerAccountId?.match(/^acct_[A-Za-z0-9]+$/))
    return json(edgeCommandFailure("stripe_sandbox_not_configured","Stripe sandbox webhook credentials are not configured."))
  const signature=request.headers.get("stripe-signature")??"",timestamp=signatureTimestamp(signature)
  if(timestamp===null)return json(edgeCommandFailure("invalid_signature","Stripe signature timestamp is missing."),{status:400})
  const payload=await request.text();const stripe=new Stripe(secretKey,{httpClient:Stripe.createFetchHttpClient()})
  let event:Stripe.Event
  try { event=await stripe.webhooks.constructEventAsync(payload,signature,webhookSecret,300,Stripe.createSubtleCryptoProvider()) }
  catch { return json(edgeCommandFailure("invalid_signature","Stripe webhook signature verification failed."),{status:400}) }
  if(event.livemode)return json(edgeCommandFailure("live_mode_denied","Live-mode Stripe events are forbidden."),{status:403})
  const payloadSha256=await sha256(payload)
  const clients=createFunctionClients(request);if(!clients.ok)return json(edgeCommandFailure("function_not_configured",clients.error))
  const {data:existing,error:existingError}=await clients.adminClient.from("stripe_webhook_events")
    .select("id,provider_account_id,event_type,provider_created_at,payload_sha256").eq("provider_event_id",event.id).maybeSingle()
  if(existingError)return json(edgeCommandFailure("stripe_webhook_replay_check_failed",existingError.message),{status:500})
  if(existing){
    const stableReplay=existing.provider_account_id===providerAccountId&&existing.event_type===event.type&&
      Date.parse(existing.provider_created_at)===event.created*1000&&existing.payload_sha256===payloadSha256
    if(!stableReplay)return json(edgeCommandFailure("stripe_webhook_dedupe_conflict","Stripe event replay evidence changed."),{status:409})
    return json(edgeCommandSuccess({ignored:false,replayed:true,eventId:event.id}))
  }
  let observedObject:unknown=event.data.object
  const rawObject=event.data.object as {id?:string,payment_intent?:string}
  if(event.type.startsWith("payment_intent.")&&rawObject.id?.startsWith("pi_")) observedObject=await stripe.paymentIntents.retrieve(rawObject.id,{expand:["latest_charge.balance_transaction"]})
  else if(event.type==="charge.refunded"&&rawObject.id?.startsWith("ch_")) observedObject=await stripe.charges.retrieve(rawObject.id,{expand:["balance_transaction"]})
  else if(event.type.startsWith("charge.dispute.")&&rawObject.id?.startsWith("dp_")) observedObject=await stripe.disputes.retrieve(rawObject.id,{expand:["charge"]})
  const evidence=normalizeStripeBankTransferWebhook(event.type,observedObject)
  if(!evidence)return json(edgeCommandSuccess({ignored:true,eventId:event.id}))
  const balance=await stripe.balance.retrieve();const snapshots=balanceSnapshots(balance)
  const command={contractVersion:"stripe_bank_transfer_webhook.v1",deploymentEnvironment:runtimeEnvironment,providerEventId:event.id,
    providerAccountId,eventType:event.type,providerObjectId:evidence.providerObjectId,providerPaymentIntentId:evidence.providerPaymentIntentId,
    providerCustomerId:evidence.providerCustomerId,providerCreatedAt:new Date(event.created*1000).toISOString(),apiVersion:event.api_version??"",
    signatureTimestamp:timestamp,payloadSha256,livemode:false,observationSource:"stripe_sdk_v1",...evidence,balanceSnapshots:snapshots,
    balanceEvidenceHash:await sha256(JSON.stringify(snapshots))}
  const {data,error}=await clients.adminClient.rpc("ingest_stripe_bank_transfer_webhook",{p_command:command})
  return json(error?edgeCommandFailure("stripe_webhook_ingest_failed",error.message):edgeCommandSuccess({ignored:false,eventId:event.id,result:data}),error?{status:500}:{})
}
serve(handleRequest);export{handleRequest}
