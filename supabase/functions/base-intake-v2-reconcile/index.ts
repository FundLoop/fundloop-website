import { validateBaseIntakeReconciliationCommand } from "../../../lib/onchain/base-intake-v2-contract.ts"
import { observeBaseIntakeV2Receipt } from "../../../lib/onchain/base-intake-v2-observer.js"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequestOrInternalSecret, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"
import { createPublicClient, http } from "npm:viem"

async function resolveTrustedReplacement(txHash: string) {
  const url = getEnv("BASE_INTAKE_REPLACEMENT_RESOLVER_URL")
  const secret = getEnv("BASE_INTAKE_REPLACEMENT_RESOLVER_SECRET")
  if (!url || !secret) return undefined
  const response = await fetch(`${url.replace(/\/$/, "")}/${txHash}`, { headers: { authorization: `Bearer ${secret}` } })
  if (!response.ok) return undefined
  const value = (await response.json())?.replacementTxHash
  return typeof value === "string" && /^0x[0-9a-f]{64}$/.test(value) ? value : undefined
}

async function handleRequest(request: Request) {
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  const environment = (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "").toLowerCase()
  const body = await parseJsonBody(request)
  if (!body.ok) return json(edgeCommandFailure("invalid_payload", body.error))
  const auth = await authenticateRequestOrInternalSecret(request, {
    secretEnvName: "FUNDLOOP_BASE_INTAKE_SECRET",
    secretHeaderName: "x-fundloop-base-intake-secret",
  })
  if (!auth.ok || auth.mode !== "internal_secret") return json(edgeCommandFailure("forbidden", "Internal Base reconciliation authorization required."))
  const input = validateBaseIntakeReconciliationCommand(body.body, environment)
  if (!input.ok) return json(input)
  const rpcUrl = getEnv("BASE_INTAKE_RPC_URL")
  if (!rpcUrl) return json(edgeCommandFailure("reconciliation_unavailable", "Trusted Base RPC is not configured."))
  const { data: receipt, error: receiptError } = await auth.adminClient.from("base_intake_v2_receipts").select("*, base_intake_v2_deployments(*)").eq("id", input.data.receiptId).single()
  if (receiptError || !receipt) return json(edgeCommandFailure("receipt_not_found", "Base intake receipt was not found."))
  const deployment = receipt.base_intake_v2_deployments
  const observation = await observeBaseIntakeV2Receipt({
    snapshot: {
      id: receipt.id, txHash: receipt.tx_hash, blockHash: receipt.block_hash, blockNumber: BigInt(receipt.block_number),
      contractAddress: deployment.contract_address, tokenAddress: receipt.token_address, projectId: BigInt(receipt.project_id),
      accountingPeriodId: BigInt(receipt.accounting_period_id), senderAddress: receipt.sender_address,
      platformTreasuryAddress: receipt.platform_treasury_address, epochTreasuryAddress: receipt.epoch_treasury_address,
      grossAmount: BigInt(receipt.gross_native_amount), feeBps: receipt.project_fee_bps,
      platformFeeAmount: BigInt(receipt.platform_fee_native_amount), netEpochAmount: BigInt(receipt.net_epoch_native_amount),
    },
    client: createPublicClient({ transport: http(rpcUrl) }),
    resolveReplacement: resolveTrustedReplacement,
  })
  const { data, error } = await auth.adminClient.rpc("reconcile_base_intake_v2_receipt", {
    p_command: { ...observation, deploymentEnvironment: environment },
  })
  return json(error ? edgeCommandFailure("reconciliation_failed", error.message) : edgeCommandSuccess({ reconciliationId: data }))
}

serve(handleRequest)
export { handleRequest }
