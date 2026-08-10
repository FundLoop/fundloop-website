import { validateBaseSafePayoutOperatorInput } from "../../../lib/edge-functions/base-safe-payout-contract.ts"
import { edgeCommandFailure,edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import { executeBaseSafePayoutOperator } from "../../../lib/base-payout/base-safe-payout-command.ts"
import { authenticateRequest,getEnv,json,parseJsonBody,serve } from "../_shared/command-runtime.ts"

const allowed=new Set(["local","development","dev","preview","test"])
async function handleRequest(request:Request){
  if(request.method==="OPTIONS")return new Response("ok",{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type"}})
  if(request.method!=="POST")return json(edgeCommandFailure("method_not_allowed","POST required."))
  const parsed=await parseJsonBody(request);const validated=validateBaseSafePayoutOperatorInput(parsed.ok?parsed.body:undefined)
  if(!validated.ok)return json(validated)
  const auth=await authenticateRequest(request)
  if(!auth.ok||!auth.user)return json(edgeCommandFailure(auth.code??"not_authenticated",auth.error))
  if(!isInternalAdminEmail(auth.user.email??null,getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS")))return json(edgeCommandFailure("forbidden","Internal operator access is required."))
  const deploymentEnvironment=(getEnv("FUNDLOOP_DEPLOYMENT_ENV")??"production").trim().toLowerCase()
  if(!allowed.has(deploymentEnvironment))return json(edgeCommandFailure("base_payout_runtime_disabled","Base payouts are unavailable in production."))
  const rpcUrl=getEnv("BASE_PAYOUT_RPC_URL")?.trim()
  if(!rpcUrl)return json(edgeCommandFailure("base_payout_rpc_unavailable","Base payout RPC is not configured."))
  const privateKey=getEnv("BASE_PAYOUT_LIMITED_SIGNER_PRIVATE_KEY")?.trim() as `0x${string}`|undefined
  const result=await executeBaseSafePayoutOperator(auth.adminClient,auth.user.id,validated.data,{deploymentEnvironment,rpcUrl,privateKey})
  return json(result.ok?edgeCommandSuccess(result.data):edgeCommandFailure(result.error.code,result.error.message))
}
serve(handleRequest)
export{handleRequest}
