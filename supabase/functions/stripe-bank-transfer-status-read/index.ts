import { edgeCommandFailure,edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequest,json,parseJsonBody,serve } from "../_shared/command-runtime.ts"
async function handleRequest(request:Request) {
  if(request.method==="OPTIONS")return new Response("ok",{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type"}})
  if(request.method!=="POST")return json(edgeCommandFailure("method_not_allowed","POST required."))
  const body=await parseJsonBody(request);if(!body.ok)return json(edgeCommandFailure("invalid_payload",body.error))
  const slug=typeof body.body?.projectSlug==="string"?body.body.projectSlug.trim():""
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||Object.keys(body.body??{}).some(key=>key!=="projectSlug"))return json(edgeCommandFailure("invalid_payload","Project slug is invalid."))
  const auth=await authenticateRequest(request);if(!auth.ok||!auth.user)return json(edgeCommandFailure(auth.code??"not_authenticated",auth.error))
  const {data,error}=await auth.adminClient.rpc("list_project_stripe_bank_transfer_status",{p_actor_user_id:auth.user.id,p_project_slug:slug})
  if(error)return json(edgeCommandFailure("status_read_failed",error.message))
  return json(edgeCommandSuccess((data??[]).map(row=>({intentId:Number(row.intent_id),paymentId:Number(row.payment_id),currencyCode:row.currency_code,
    expectedAmountMinor:String(row.expected_amount_minor),status:row.status,statusAt:row.status_at,orderingStatus:row.ordering_status,
    availableForShadowClose:Boolean(row.available_for_shadow_close),topologyStatus:row.topology_status,sweepEvidencePending:Boolean(row.sweep_evidence_pending)}))))
}
serve(handleRequest);export{handleRequest}
