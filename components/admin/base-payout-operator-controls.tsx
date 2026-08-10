"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { invokeBaseSafePayoutOperator } from "@/lib/edge-functions/base-safe-payout-operator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card"

type Deployment={id:number;chain_id:number;safe_role:string;safe_address:string;module_address:string;is_paused:boolean;is_active:boolean;
  max_per_transaction_native:number|string;max_rolling_24h_native:number|string;max_per_epoch_native:number|string;
  base_paymaster_budgets:{remaining_native:number|string;max_per_request_native:number|string;is_paused:boolean}|Array<{remaining_native:number|string;max_per_request_native:number|string;is_paused:boolean}>|null}
type Command={id:number;payout_intent_id:number;status:string;request_hash:string;native_atomic_amount:number|string;user_fee_native_amount:number|string;
  token_address:string;recipient_address:string;fee_recipient_address:string;authorized_at:string}
type Intent={id:number;rail:string|null;status:string;amount_usd:number;payout_route_id:number|null}

export function BasePayoutOperatorControls({enabled,deployments,commands,intents}:{enabled:boolean;deployments:Deployment[];commands:Command[];intents:Intent[]}){
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState<string|null>(null);const [txHashes,setTxHashes]=useState<Record<number,string>>({})
  const deployment=deployments.find((item)=>item.safe_role==="epoch")
  const platformDeployment=deployments.find((item)=>item.safe_role==="platform")
  async function run(input:Parameters<typeof invokeBaseSafePayoutOperator>[0]){setBusy(true);setMessage(null);const result=await invokeBaseSafePayoutOperator(input);setBusy(false)
    setMessage(result.ok?`Checkpoint accepted: ${String((result.data as Record<string,unknown>).status??input.action)}`:result.error.message);if(result.ok)location.reload()}
  if(!enabled)return <Card><CardHeader><CardTitle>Base payout review unavailable</CardTitle><CardDescription>This control plane is disabled in production and when the explicit review flag is absent.</CardDescription></CardHeader></Card>
  return <Card data-testid="base-payout-operator-controls"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Base Safe payout checkpoints</CardTitle>
    <CardDescription>Review-only Safe/module controls. Authorization, execution, finality observation, and balanced journals remain separate. Production is disabled.</CardDescription></CardHeader>
    <CardContent className="space-y-5">{deployment?<div className="grid gap-3 md:grid-cols-4"><div><p className="text-xs text-[var(--text-muted)]">Epoch Safe</p><p className="break-all font-mono text-xs">{deployment.safe_address}</p></div>
      <div><p className="text-xs text-[var(--text-muted)]">Platform Safe</p><p className="break-all font-mono text-xs">{platformDeployment?.safe_address??"not configured"}</p></div>
      <div><p className="text-xs text-[var(--text-muted)]">Independent limits</p><p className="text-sm">$20 transaction · $500 rolling · $5,000 epoch</p></div>
      <div><p className="text-xs text-[var(--text-muted)]">State</p><Badge variant={deployment.is_active&&!deployment.is_paused?"default":"secondary"}>{deployment.is_paused?"paused":"review active"}</Badge></div></div>:<p className="text-sm text-[var(--text-muted)]">No active non-production epoch Safe deployment.</p>}
      {intents.filter((intent)=>intent.rail==="evm"&&["draft","ready"].includes(intent.status)).map((intent)=><div key={intent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><span>Intent #{intent.id} · ${Number(intent.amount_usd).toFixed(2)}</span>
        <Button size="sm" disabled={busy||!deployment} onClick={()=>deployment&&run({action:"authorize",payoutIntentId:intent.id,deploymentId:deployment.id,gasBudgetNative:"1000"})}>Authorize exact request</Button></div>)}
      {commands.map((command)=><div key={command.id} className="space-y-3 rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span>Command #{command.id} · intent #{command.payout_intent_id}</span><Badge variant="outline">{command.status}</Badge></div>
        <p className="text-xs text-[var(--text-muted)]">Recipient {command.native_atomic_amount} atomic · platform fee {command.user_fee_native_amount} atomic</p>
        <p className="break-all font-mono text-xs text-[var(--text-muted)]">{command.request_hash}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy||command.status!=="authorized"} onClick={()=>run({action:"execute",commandId:command.id})}>Execute limited signer</Button>
          <input aria-label={`Transaction hash for command ${command.id}`} placeholder="0x transaction hash" value={txHashes[command.id]??""} onChange={(event)=>setTxHashes((current)=>({...current,[command.id]:event.target.value}))} className="h-9 min-w-64 flex-1 rounded-md border px-2 font-mono text-xs"/>
          <Button size="sm" disabled={busy||!/^0x[0-9a-f]{64}$/i.test(txHashes[command.id]??"")} onClick={()=>run({action:"observe",commandId:command.id,txHash:txHashes[command.id] as `0x${string}`})}>Observe finality</Button></div></div>)}
      {message?<p role="status" className="text-sm">{message}</p>:null}</CardContent></Card>
}
