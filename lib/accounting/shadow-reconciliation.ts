import "server-only"
import {getAdminSupabaseClient} from "@/lib/supabase-admin"
export async function loadShadowFinancialReconciliation(){
 if((process.env.FUNDLOOP_DEPLOYMENT_ENV??"production").toLowerCase()==="production")return []
 const {data,error}=await getAdminSupabaseClient().from("shadow_financial_reconciliation_observability").select("*").order("observed_at",{ascending:false})
 if(error)throw new Error(`Unable to load shadow reconciliation: ${error.message}`)
 return data??[]
}
