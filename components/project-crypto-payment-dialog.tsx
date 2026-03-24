"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useAccount, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { formatUnits, parseUnits } from "viem"
import { Loader2, Wallet } from "lucide-react"
import { recordOnchainPaymentSubmission } from "@/app/actions/project-payment-actions"
import { openFundLoopWalletModal, hasReownProjectId } from "@/components/web3-provider"
import { erc20Abi, fundLoopIntakeAbi } from "@/lib/onchain/fundloop-intake-abi"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

type PaymentRecord = {
  id: number
  payment_amount: number
}

export type CryptoPaymentMethodOption = {
  id: number
  label: string | null
  is_default: boolean | null
  chain: {
    id: number
    display_name: string
    network_key: string
    evm_chain_id: number
    native_asset_symbol: string
  }
  asset: {
    id: number
    symbol: string
    name: string
    token_address: string | null
    decimals: number
    is_native: boolean
  }
  intakeContract: {
    id: number
    contract_address: string
    treasury_address: string
  }
}

type ProjectCryptoPaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: PaymentRecord | null
  paymentMethods: CryptoPaymentMethodOption[]
  projectId: number | null
  projectSlug: string
  onPaymentRecorded: (paymentId: number, txHash: string) => void
}

function serializeForJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map(serializeForJson)
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, serializeForJson(entry)]),
    )
  }

  return value
}

export function ProjectCryptoPaymentDialog({
  open,
  onOpenChange,
  payment,
  paymentMethods,
  projectId,
  projectSlug,
  onPaymentRecorded,
}: ProjectCryptoPaymentDialogProps) {
  const [selectedMethodId, setSelectedMethodId] = useState<string>("")
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [lastAction, setLastAction] = useState<"approve" | "deposit" | null>(null)
  const [recording, startRecording] = useTransition()
  const { address, chainId, isConnected } = useAccount()
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain()
  const { data: hash, error: writeError, isPending: writing, writeContractAsync, reset } = useWriteContract()
  const receiptQuery = useWaitForTransactionReceipt({ hash })

  const selectedMethod = useMemo(
    () =>
      paymentMethods.find((method) => method.id === Number.parseInt(selectedMethodId, 10)) ??
      paymentMethods.find((method) => method.is_default) ??
      paymentMethods[0] ??
      null,
    [paymentMethods, selectedMethodId],
  )

  const publicClient = usePublicClient({
    chainId: selectedMethod?.chain.evm_chain_id,
  })

  useEffect(() => {
    if (!open) {
      reset()
      setLastAction(null)
      setApprovalRequired(false)
      return
    }

    if (paymentMethods.length > 0) {
      const defaultMethod = paymentMethods.find((method) => method.is_default) ?? paymentMethods[0]
      setSelectedMethodId(String(defaultMethod.id))
    }
  }, [open, paymentMethods, reset])

  const amountRaw = useMemo(() => {
    if (!payment || !selectedMethod) {
      return BigInt(0)
    }

    return parseUnits(String(payment.payment_amount), selectedMethod.asset.decimals)
  }, [payment, selectedMethod])

  useEffect(() => {
    const loadAllowance = async () => {
      if (!open || !address || !selectedMethod || selectedMethod.asset.is_native || !publicClient) {
        setApprovalRequired(false)
        return
      }

      try {
        const allowance = await publicClient.readContract({
          address: selectedMethod.asset.token_address as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, selectedMethod.intakeContract.contract_address as `0x${string}`],
        })

        setApprovalRequired(allowance < amountRaw)
      } catch (error) {
        console.error("Failed to read token allowance", error)
        setApprovalRequired(true)
      }
    }

    void loadAllowance()
  }, [address, amountRaw, open, publicClient, selectedMethod, receiptQuery.isSuccess])

  useEffect(() => {
    if (!receiptQuery.isSuccess || !selectedMethod || !payment || !projectId || !hash) {
      return
    }

    if (lastAction === "approve") {
      toast({
        title: "Token approved",
        description: "Approval confirmed. You can submit the crypto payment now.",
      })
      setLastAction(null)
      return
    }

    if (lastAction !== "deposit" || !address) {
      return
    }

    startRecording(async () => {
      const result = await recordOnchainPaymentSubmission({
        projectSlug,
        paymentId: payment.id,
        paymentMethodId: selectedMethod.id,
        txHash: hash,
        walletAddress: address,
        amountRaw: amountRaw.toString(),
        amountDecimal: String(payment.payment_amount),
        chainId: selectedMethod.chain.id,
        chainAssetId: selectedMethod.asset.id,
        intakeContractId: selectedMethod.intakeContract.id,
        blockNumber: receiptQuery.data.blockNumber ? Number(receiptQuery.data.blockNumber) : null,
        receipt: serializeForJson(receiptQuery.data) as never,
      })

      if (!result.ok) {
        toast({
          title: "Payment receipt could not be stored",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Crypto payment submitted",
        description: "The onchain receipt is stored and the payment now awaits confirmation.",
      })

      onPaymentRecorded(payment.id, hash)
      setLastAction(null)
      onOpenChange(false)
    })
  }, [address, amountRaw, hash, lastAction, onOpenChange, onPaymentRecorded, payment, projectId, projectSlug, receiptQuery.data, receiptQuery.isSuccess, selectedMethod])

  useEffect(() => {
    if (!writeError) {
      return
    }

    toast({
      title: "Transaction failed",
      description: writeError.message,
      variant: "destructive",
    })
  }, [writeError])

  const handleApprove = async () => {
    if (!selectedMethod || !selectedMethod.asset.token_address) {
      return
    }

    setLastAction("approve")
    await writeContractAsync({
      address: selectedMethod.asset.token_address as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [selectedMethod.intakeContract.contract_address as `0x${string}`, amountRaw],
    })
  }

  const handleDeposit = async () => {
    if (!selectedMethod || !projectId) {
      return
    }

    setLastAction("deposit")

    if (selectedMethod.asset.is_native) {
      await writeContractAsync({
        address: selectedMethod.intakeContract.contract_address as `0x${string}`,
        abi: fundLoopIntakeAbi,
        functionName: "depositNative",
        args: [BigInt(projectId)],
        value: amountRaw,
      })
      return
    }

    await writeContractAsync({
      address: selectedMethod.intakeContract.contract_address as `0x${string}`,
      abi: fundLoopIntakeAbi,
      functionName: "depositToken",
      args: [BigInt(projectId), selectedMethod.asset.token_address as `0x${string}`, amountRaw],
    })
  }

  const wrongChain = selectedMethod ? chainId !== selectedMethod.chain.evm_chain_id : false
  const busy = writing || receiptQuery.isLoading || switchingChain || recording

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay with crypto</DialogTitle>
          <DialogDescription>
            Submit this payment through a FundLoop intake contract so the contribution is tagged to your project ID.
          </DialogDescription>
        </DialogHeader>

        {!payment || !selectedMethod ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
            Configure at least one crypto payment method for this project before submitting an onchain payment.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Payment route</Label>
              <Select value={String(selectedMethod.id)} onValueChange={setSelectedMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a crypto route" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={String(method.id)}>
                      {method.label || `${method.chain.display_name} ${method.asset.symbol}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border bg-slate-50/70 p-4 text-sm text-slate-700">
              <p>
                Amount: <span className="font-medium">{payment.payment_amount}</span> {selectedMethod.asset.symbol}
              </p>
              <p>Chain: {selectedMethod.chain.display_name}</p>
              <p>Project ID tag: {projectId}</p>
              <p className="break-all">Contract: {selectedMethod.intakeContract.contract_address}</p>
              <p className="break-all">Treasury: {selectedMethod.intakeContract.treasury_address}</p>
              {!selectedMethod.asset.is_native ? (
                <p className="break-all">Token: {selectedMethod.asset.token_address}</p>
              ) : null}
            </div>

            {hash ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950">
                <p className="font-medium">Latest transaction</p>
                <p className="break-all">{hash}</p>
                {receiptQuery.data ? (
                  <p>
                    Confirmations: block {receiptQuery.data.blockNumber ? receiptQuery.data.blockNumber.toString() : "pending"}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {!hasReownProjectId ? (
            <div className="w-full rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
              Wallet connection is not configured. Add `NEXT_PUBLIC_REOWN_PROJECT_ID` to enable crypto payments.
            </div>
          ) : null}

          {!isConnected ? (
            <Button className="w-full" onClick={() => void openFundLoopWalletModal()} disabled={!hasReownProjectId}>
              <Wallet className="mr-2 h-4 w-4" />
              Connect wallet
            </Button>
          ) : wrongChain && selectedMethod ? (
            <Button
              className="w-full"
              onClick={() => void switchChainAsync({ chainId: selectedMethod.chain.evm_chain_id })}
              disabled={busy}
            >
              Switch to {selectedMethod.chain.display_name}
            </Button>
          ) : approvalRequired && selectedMethod && !selectedMethod.asset.is_native ? (
            <Button className="w-full" onClick={() => void handleApprove()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve {selectedMethod.asset.symbol}
            </Button>
          ) : (
            <Button className="w-full" onClick={() => void handleDeposit()} disabled={busy || !selectedMethod || !payment}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit crypto payment
            </Button>
          )}

          {selectedMethod ? (
            <p className="w-full text-center text-xs text-slate-500">
              Onchain amount: {formatUnits(amountRaw, selectedMethod.asset.decimals)} {selectedMethod.asset.symbol}
            </p>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
