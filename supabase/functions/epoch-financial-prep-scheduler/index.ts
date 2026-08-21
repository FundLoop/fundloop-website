import { edgeCommandFailure,edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequestOrInternalSecret,getEnv,json,parseJsonBody,serve } from "../_shared/command-runtime.ts"

const cycle=/^\d{4}-(?:0[1-9]|1[0-2])$/
const allowed=new Set(["local","development","dev","preview","test"])

async function handleRequest(request:Request){
  if(request.method!=="POST")return json(edgeCommandFailure("method_not_allowed","POST required."))
  const environment=(getEnv("FUNDLOOP_DEPLOYMENT_ENV")??"production").trim().toLowerCase()
  if(!allowed.has(environment))return json(edgeCommandFailure("epoch_financial_prep_runtime_disabled","Scheduled harvest is unavailable in production."))
  const auth=await authenticateRequestOrInternalSecret(request,{secretEnvName:"FUNDLOOP_EPOCH_FINANCIAL_PREP_SECRET",secretHeaderName:"x-fundloop-cron-secret"})
  if(!auth.ok||auth.mode!=="internal_secret")return json(edgeCommandFailure(auth.code??"forbidden",auth.error??"Internal scheduler authorization required."))
  const parsed=await parseJsonBody(request)
  if(!parsed.ok||!parsed.body||typeof parsed.body!=="object"||Array.isArray(parsed.body))return json(edgeCommandFailure("invalid_payload","A target cycle is required."))
  const body=parsed.body as Record<string,unknown>
  if(Object.keys(body).some((key)=>!["targetCycleKey","limit"].includes(key))||typeof body.targetCycleKey!=="string"||!cycle.test(body.targetCycleKey)
    ||(body.limit!==undefined&&(!Number.isInteger(body.limit)||Number(body.limit)<1||Number(body.limit)>500)))return json(edgeCommandFailure("invalid_payload","Invalid harvest schedule command."))
  const {data,error}=await auth.adminClient.rpc("harvest_expired_epoch_source_lots",{p_environment:environment,p_target_cycle_key:body.targetCycleKey,p_limit:Number(body.limit??100)})
  if(error)return json(edgeCommandFailure(error.message.match(/epoch_[a-z_]+/)?.[0]??"epoch_source_harvest_failed",error.message))
  return json(edgeCommandSuccess({harvestedCount:Number(data),targetCycleKey:body.targetCycleKey}))
}
serve(handleRequest)
export {handleRequest}
