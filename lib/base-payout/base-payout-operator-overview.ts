import "server-only"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"

const allowed=new Set(["local","development","dev","preview","test"])
export function isBasePayoutReviewEnabled(env:NodeJS.ProcessEnv=process.env){
  const deployment=(env.FUNDLOOP_DEPLOYMENT_ENV??"production").trim().toLowerCase()
  return allowed.has(deployment)&&env.NEXT_PUBLIC_BASE_PAYOUT_REVIEW_ENABLED==="true"
}

export async function loadBasePayoutOperatorOverview(monthlyCycleId:number){
  if(!isBasePayoutReviewEnabled())return {enabled:false,deployments:[],commands:[]}
  const supabase=getAdminSupabaseClient()
  const [deployments,commands]=await Promise.all([
    supabase.from("base_safe_payout_deployments").select("id,chain_id,safe_role,safe_address,module_address,is_paused,is_active,max_per_transaction_native,max_rolling_24h_native,max_per_epoch_native,base_paymaster_budgets(remaining_native,max_per_request_native,is_paused)")
      .eq("is_active",true).order("id"),
    supabase.from("base_payout_execution_commands").select("id,payout_intent_id,status,request_hash,native_atomic_amount,user_fee_native_amount,token_address,recipient_address,fee_recipient_address,authorized_at,chain_authorized_at")
      .eq("monthly_cycle_id",monthlyCycleId).order("id",{ascending:false}),
  ])
  return {enabled:true,deployments:deployments.data??[],commands:commands.data??[],warnings:[deployments.error?.message,commands.error?.message].filter(Boolean)}
}
