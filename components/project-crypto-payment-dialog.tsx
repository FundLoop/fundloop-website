"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useAccount, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { formatUnits, parseUnits } from "viem"
import { Loader2, Wallet } from "lucide-react"
import { recordOnchainPaymentSubmission } from "@/app/actions/project-payment-actions"
import { useWalletRuntime } from "@/components/web3-provider"
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

const periodOptions = [
  { value: "0", label: "Current / unspecified" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const

type PaymentRecord = {
  id: number
  payment_amount: number
  period_end: string
}

export type CryptoPaymentMethodOption = {
  id: number
  label: string | null
  is_default: boolean | null
  is_runtime_available: boolean
  runtime_availability_issue: string | null
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
    is_stablecoin: boolean
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
  onPaymentRecorded: (paymentId: number, txHash: string, periodId: number) => void
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
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("0")
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [lastAction, setLastAction] = useState<"approve" | "deposit" | null>(null)
  const [recording, startRecording] = useTransition()
  const { openWalletModal, runtimeConfig, walletEnabled } = useWalletRuntime()
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
      setSelectedPeriodId("0")
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

  const periodId = useMemo(() => {
    const explicitValue = Number.parseInt(selectedPeriodId, 10)
    if (Number.isInteger(explicitValue) && explicitValue >= 0 && explicitValue <= 12) {
      return explicitValue
    }

    if (!payment?.period_end) {
      return 0
    }

    const monthText = payment.period_end.slice(5, 7)
    const month = Number.parseInt(monthText, 10)
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : 0
  }, [payment, selectedPeriodId])

  useEffect(() => {
    if (!open) {
      return
    }

    if (!payment?.period_end) {
      setSelectedPeriodId("0")
      return
    }

    const monthText = payment.period_end.slice(5, 7)
    const month = Number.parseInt(monthText, 10)
    setSelectedPeriodId(Number.isInteger(month) && month >= 1 && month <= 12 ? String(month) : "0")
  }, [open, payment?.id, payment?.period_end])

  const supportsDirectUsdSettlement = Boolean(selectedMethod?.asset.is_stablecoin)
  const selectedRouteAvailable = Boolean(selectedMethod?.is_runtime_available)
  const selectedRouteIssue =
    selectedMethod?.runtime_availability_issue ??
    `This crypto route is not available in the active ${runtimeConfig.environment} wallet deployment.`
  const walletConfigIssue =
    runtimeConfig.issues.find((issue) => issue.severity === "error")?.message ??
    "Wallet connection is not configured for this environment."

  useEffect(() => {
    const loadAllowance = async () => {
      if (!open || !address || !selectedMethod || !selectedRouteAvailable || selectedMethod.asset.is_native || !publicClient) {
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
  }, [address, amountRaw, open, publicClient, receiptQuery.isSuccess, selectedMethod, selectedRouteAvailable])

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
        periodId,
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

      onPaymentRecorded(payment.id, hash, periodId)
      setLastAction(null)
      onOpenChange(false)
    })
  }, [address, amountRaw, hash, lastAction, onOpenChange, onPaymentRecorded, payment, periodId, projectId, projectSlug, receiptQuery.data, receiptQuery.isSuccess, selectedMethod])

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
    if (!selectedMethod || !selectedRouteAvailable || !selectedMethod.asset.token_address || !supportsDirectUsdSettlement) {
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
    if (!selectedMethod || !selectedRouteAvailable || !projectId || !supportsDirectUsdSettlement) {
      return
    }

    setLastAction("deposit")

    if (selectedMethod.asset.is_native) {
      await writeContractAsync({
        address: selectedMethod.intakeContract.contract_address as `0x${string}`,
        abi: fundLoopIntakeAbi,
        functionName: "depositNative",
        args: [BigInt(projectId), periodId],
        value: amountRaw,
      })
      return
    }

    await writeContractAsync({
      address: selectedMethod.intakeContract.contract_address as `0x${string}`,
      abi: fundLoopIntakeAbi,
      functionName: "depositToken",
      args: [BigInt(projectId), periodId, selectedMethod.asset.token_address as `0x${string}`, amountRaw],
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
                      {!method.is_runtime_available ? " (Unavailable)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Onchain period tag</Label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a period tag" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Use a month tag when you want to pre-pay a specific month. Use current / unspecified for the current
                contribution cycle.
              </p>
            </div>

            <div className="rounded-2xl border bg-slate-50/70 p-4 text-sm text-slate-700">
              <p>
                Amount: <span className="font-medium">{payment.payment_amount}</span> {selectedMethod.asset.symbol}
              </p>
              <p>Chain: {selectedMethod.chain.display_name}</p>
              <p>Project ID tag: {projectId}</p>
              <p>Period ID tag: {periodOptions.find((option) => option.value === String(periodId))?.label ?? periodId}</p>
              <p className="break-all">Contract: {selectedMethod.intakeContract.contract_address}</p>
              <p className="break-all">Treasury: {selectedMethod.intakeContract.treasury_address}</p>
              {!selectedMethod.asset.is_native ? (
                <p className="break-all">Token: {selectedMethod.asset.token_address}</p>
              ) : null}
            </div>

            {!supportsDirectUsdSettlement ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                This payment is denominated in dollars, but this crypto route is not a stablecoin with known 1:1
                dollar semantics. Direct submission is disabled until FundLoop adds asset pricing and quote-based
                conversion.
              </div>
            ) : null}

            {!selectedRouteAvailable ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                {selectedRouteIssue}
              </div>
            ) : null}

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
          {!walletEnabled ? (
            <div className="w-full rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
              {walletConfigIssue}
            </div>
          ) : null}

          {!selectedRouteAvailable ? (
            <Button className="w-full" disabled>
              Route unavailable in {runtimeConfig.environment}
            </Button>
          ) : !isConnected ? (
            <Button className="w-full" onClick={() => void openWalletModal()} disabled={!walletEnabled}>
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
          ) : !supportsDirectUsdSettlement ? (
            <Button className="w-full" disabled>
              Quote required before paying
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

          {selectedMethod && supportsDirectUsdSettlement ? (
            <p className="w-full text-center text-xs text-slate-500">
              Onchain amount: {formatUnits(amountRaw, selectedMethod.asset.decimals)} {selectedMethod.asset.symbol}
            </p>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
