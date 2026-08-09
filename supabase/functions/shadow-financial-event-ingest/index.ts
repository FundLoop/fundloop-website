import {validateShadowFinancialEvent} from "../../../lib/edge-functions/shadow-financial-event-contract.ts"
import {edgeCommandFailure,edgeCommandSuccess} from "../../../lib/edge-functions/result.ts"
import {authenticateRequestOrInternalSecret,getEnv,json,parseJsonBody,serve} from "../_shared/command-runtime.ts"
async function handleRequest(request){
 if(request.method!=="POST") return json(edgeCommandFailure("method_not_allowed","POST required."))
 const environment=(getEnv("FUNDLOOP_DEPLOYMENT_ENV")??"production").toLowerCase()
 const body=await parseJsonBody(request); if(!body.ok)return json(edgeCommandFailure("invalid_payload",body.error))
 const auth=await authenticateRequestOrInternalSecret(request,{secretEnvName:"FUNDLOOP_FINANCIAL_EVENT_SECRET",secretHeaderName:"x-fundloop-cron-secret"})
 if(!auth.ok||auth.mode!=="internal_secret")return json(edgeCommandFailure("forbidden","Internal ingestion authorization required."))
 const input=validateShadowFinancialEvent(body.body,environment); if(!input.ok)return json(input)
 const v=input.data
 const {data,error}=await auth.adminClient.rpc("ingest_external_financial_event",{p_provider_key:v.providerKey,p_provider_event_id:v.providerEventId,p_custody_account_id:v.custodyAccountId,p_asset_id:v.assetId,p_event_type:v.eventType,p_provider_sequence:v.providerSequence??null,p_settled_native_amount:v.settledNativeAmount,p_occurred_at:v.occurredAt,p_evidence_hash:v.evidenceHash,p_legacy_timestamp_evidence:v.legacyTimestampEvidence??{},p_deployment_environment:environment})
 return json(error?edgeCommandFailure("ingest_failed",error.message):edgeCommandSuccess({eventId:data}))
}
serve(handleRequest);export{handleRequest}
