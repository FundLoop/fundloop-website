"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useAccount, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { formatUnits, parseUnits } from "viem"
import { Loader2, Wallet } from "lucide-react"
import { invokeProjectOnchainPaymentSubmissionRecordBrowser } from "@/lib/edge-functions/project-payment-operations"
import { useWalletRuntime } from "@/components/web3-provider"
import { erc20Abi, fundLoopIntakeAbi } from "@/lib/onchain/fundloop-intake-abi"
import { getRequiredConfirmationDepth } from "@/lib/onchain/runtime-config"
import type { OnchainSubmissionSummary } from "@/lib/onchain/payment-submissions"
import { capturePaymentFlowEvent } from "@/lib/observability/payment-flow-client"
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
  onPaymentRecorded: (paymentId: number, submission: OnchainSubmissionSummary) => void
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
  const [walletAttemptId, setWalletAttemptId] = useState<string | null>(null)
  const [receiptAttemptId, setReceiptAttemptId] = useState<string | null>(null)
  const expectedDepositHashRef = useRef<`0x${string}` | null>(null)
  const recordingReceiptHashRef = useRef<`0x${string}` | null>(null)
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
      expectedDepositHashRef.current = null
      recordingReceiptHashRef.current = null
      reset()
      setLastAction(null)
      setApprovalRequired(false)
      setSelectedPeriodId("0")
      setWalletAttemptId(null)
      setReceiptAttemptId(null)
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

  const emitReceiptEvent = useCallback(async (
    event: Omit<Parameters<typeof capturePaymentFlowEvent>[0], "flow" | "attemptId" | "environment">,
  ) => {
    const attemptId = receiptAttemptId ?? crypto.randomUUID()
    if (!receiptAttemptId) {
      setReceiptAttemptId(attemptId)
    }

    await capturePaymentFlowEvent({
      flow: "receipt_recording",
      attemptId,
      environment: runtimeConfig.environment,
      projectId,
      paymentId: payment?.id ?? null,
      paymentMethodId: selectedMethod?.id ?? null,
      chainId: selectedMethod?.chain.id ?? null,
      chainAssetId: selectedMethod?.asset.id ?? null,
      intakeContractId: selectedMethod?.intakeContract.id ?? null,
      txHash: hash ?? null,
      walletAddress: address ?? null,
      ...event,
    })
  }, [
    address,
    hash,
    payment?.id,
    projectId,
    receiptAttemptId,
    runtimeConfig.environment,
    selectedMethod?.asset.id,
    selectedMethod?.chain.id,
    selectedMethod?.id,
    selectedMethod?.intakeContract.id,
  ])

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
    if (!walletAttemptId || !isConnected) {
      return
    }

    void capturePaymentFlowEvent({
      flow: "wallet_connect",
      stage: "connected",
      outcome: "success",
      attemptId: walletAttemptId,
      environment: runtimeConfig.environment,
      projectId,
      paymentId: payment?.id ?? null,
      walletAddress: address ?? null,
      metadata: {
        chainId,
      },
    })
    setWalletAttemptId(null)
  }, [address, chainId, isConnected, payment?.id, projectId, runtimeConfig.environment, walletAttemptId])

  useEffect(() => {
    if (!walletAttemptId || isConnected) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void capturePaymentFlowEvent({
        flow: "wallet_connect",
        stage: "timeout",
        outcome: "failure",
        severity: "warning",
        attemptId: walletAttemptId,
        environment: runtimeConfig.environment,
        projectId,
        paymentId: payment?.id ?? null,
        errorCode: "wallet_connect_timeout",
        errorMessage: "Wallet connection did not complete before the timeout.",
      })
      setWalletAttemptId((current) => (current === walletAttemptId ? null : current))
    }, 15000)

    return () => window.clearTimeout(timeoutId)
  }, [isConnected, payment?.id, projectId, runtimeConfig.environment, walletAttemptId])

  useEffect(() => {
    if (!receiptQuery.isSuccess || !selectedMethod || !payment || !projectId || !hash) {
      return
    }

    if (lastAction === "approve") {
      void emitReceiptEvent({
        stage: "approval",
        outcome: "success",
        metadata: {
          chainId: selectedMethod.chain.evm_chain_id,
        },
      })
      toast({
        title: "Token approved",
        description: "Approval confirmed. You can submit the crypto payment now.",
      })
      setLastAction(null)
      return
    }

    if (lastAction !== "deposit" || !address || expectedDepositHashRef.current !== hash) {
      return
    }

    if (recordingReceiptHashRef.current === hash) {
      return
    }
    recordingReceiptHashRef.current = hash

    const activeAttemptId = receiptAttemptId ?? crypto.randomUUID()
    if (!receiptAttemptId) {
      setReceiptAttemptId(activeAttemptId)
    }

    startRecording(async () => {
      await capturePaymentFlowEvent({
        flow: "receipt_recording",
        stage: "deposit",
        outcome: "success",
        attemptId: activeAttemptId,
        environment: runtimeConfig.environment,
        projectId,
        paymentId: payment.id,
        paymentMethodId: selectedMethod.id,
        chainId: selectedMethod.chain.id,
        chainAssetId: selectedMethod.asset.id,
        intakeContractId: selectedMethod.intakeContract.id,
        txHash: hash,
        walletAddress: address,
        metadata: {
          blockNumber: receiptQuery.data.blockNumber ? Number(receiptQuery.data.blockNumber) : null,
        },
      })

      const result = await invokeProjectOnchainPaymentSubmissionRecordBrowser({
        projectSlug,
        attemptId: activeAttemptId,
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
        expectedDepositHashRef.current = null
        recordingReceiptHashRef.current = null
        await emitReceiptEvent({
          stage: "submission_record",
          outcome: "failure",
          errorCode: "submission_record_failed",
          errorMessage: result.error.message,
        })
        toast({
          title: "Payment receipt could not be stored",
          description: result.error.message,
          variant: "destructive",
        })
        return
      }

      await emitReceiptEvent({
        stage: "submission_record",
        outcome: "success",
        submissionId: result.data.submissionId,
      })
      toast({
        title: "Crypto payment submitted",
        description: "The onchain receipt is stored and the payment now awaits confirmation.",
      })

      onPaymentRecorded(payment.id, {
        id: result.data.submissionId,
        payment_id: payment.id,
        project_id: projectId,
        payment_method_id: selectedMethod.id,
        period_id: periodId,
        tx_hash: hash,
        wallet_address: address,
        status: "submitted",
        confirmation_count: 0,
        confirmation_depth: getRequiredConfirmationDepth(runtimeConfig, selectedMethod.chain.network_key),
        failure_code: null,
        failure_reason: null,
        submitted_at: new Date().toISOString(),
        last_checked_at: null,
        reconciled_at: null,
        matched_log_index: null,
        chain: {
          id: selectedMethod.chain.id,
          display_name: selectedMethod.chain.display_name,
          network_key: selectedMethod.chain.network_key,
        },
        asset: {
          id: selectedMethod.asset.id,
          symbol: selectedMethod.asset.symbol,
          is_native: selectedMethod.asset.is_native,
        },
      })
      setReceiptAttemptId(null)
      setLastAction(null)
      onOpenChange(false)
    })
  }, [
    address,
    amountRaw,
    emitReceiptEvent,
    hash,
    lastAction,
    onOpenChange,
    onPaymentRecorded,
    payment,
    periodId,
    projectId,
    projectSlug,
    receiptAttemptId,
    receiptQuery.data,
    receiptQuery.isSuccess,
    runtimeConfig,
    selectedMethod,
  ])

  useEffect(() => {
    if (!writeError) {
      return
    }

    void emitReceiptEvent({
      stage: lastAction === "approve" ? "approval" : "deposit",
      outcome: "failure",
      errorCode: "transaction_failed",
      errorMessage: writeError.message,
    })
    toast({
      title: "Transaction failed",
      description: writeError.message,
      variant: "destructive",
    })
  }, [emitReceiptEvent, lastAction, writeError])

  const handleConnectWallet = async () => {
    const attemptId = crypto.randomUUID()
    setWalletAttemptId(attemptId)

    await capturePaymentFlowEvent({
      flow: "wallet_connect",
      stage: "cta_click",
      outcome: "attempt",
      attemptId,
      environment: runtimeConfig.environment,
      projectId,
      paymentId: payment?.id ?? null,
    })

    if (!walletEnabled) {
      await capturePaymentFlowEvent({
        flow: "wallet_connect",
        stage: "runtime_blocked",
        outcome: "failure",
        severity: "warning",
        attemptId,
        environment: runtimeConfig.environment,
        projectId,
        paymentId: payment?.id ?? null,
        errorCode: "wallet_runtime_blocked",
        errorMessage: walletConfigIssue,
      })
      setWalletAttemptId(null)
      return
    }

    try {
      await capturePaymentFlowEvent({
        flow: "wallet_connect",
        stage: "modal_open",
        outcome: "attempt",
        attemptId,
        environment: runtimeConfig.environment,
        projectId,
        paymentId: payment?.id ?? null,
      })
      await openWalletModal()
    } catch (error) {
      await capturePaymentFlowEvent({
        flow: "wallet_connect",
        stage: "modal_open",
        outcome: "failure",
        severity: "error",
        attemptId,
        environment: runtimeConfig.environment,
        projectId,
        paymentId: payment?.id ?? null,
        errorCode: "wallet_modal_open_failed",
        errorMessage: error instanceof Error ? error.message : "Could not open the wallet modal.",
      })
      setWalletAttemptId(null)
    }
  }

  const handleSwitchChain = async () => {
    if (!selectedMethod) {
      return
    }

    await emitReceiptEvent({
      stage: "chain_switch",
      outcome: "attempt",
      metadata: {
        targetChainId: selectedMethod.chain.evm_chain_id,
      },
    })

    try {
      await switchChainAsync({ chainId: selectedMethod.chain.evm_chain_id })
      await emitReceiptEvent({
        stage: "chain_switch",
        outcome: "success",
        metadata: {
          targetChainId: selectedMethod.chain.evm_chain_id,
        },
      })
    } catch (error) {
      await emitReceiptEvent({
        stage: "chain_switch",
        outcome: "failure",
        errorCode: "chain_switch_failed",
        errorMessage: error instanceof Error ? error.message : "Could not switch the connected wallet chain.",
        metadata: {
          targetChainId: selectedMethod.chain.evm_chain_id,
        },
      })
    }
  }

  const handleApprove = async () => {
    if (!selectedMethod || !selectedRouteAvailable || !selectedMethod.asset.token_address || !supportsDirectUsdSettlement || !address || !publicClient) {
      await emitReceiptEvent({
        stage: "runtime_blocked",
        outcome: "failure",
        severity: "warning",
        errorCode: "approval_unavailable",
        errorMessage: selectedRouteAvailable
          ? "Approval is not available for the selected route."
          : selectedRouteIssue,
      })
      return
    }

    setLastAction("approve")
    await emitReceiptEvent({
      stage: "approval",
      outcome: "attempt",
      metadata: {
        contractAddress: selectedMethod.intakeContract.contract_address,
      },
    })

    try {
      const approvalHash = await writeContractAsync({
        address: selectedMethod.asset.token_address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [selectedMethod.intakeContract.contract_address as `0x${string}`, amountRaw],
      })

      await publicClient.waitForTransactionReceipt({ hash: approvalHash })
      const allowance = await publicClient.readContract({
        address: selectedMethod.asset.token_address as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, selectedMethod.intakeContract.contract_address as `0x${string}`],
      })
      setApprovalRequired(allowance < amountRaw)
    } catch {
      // The wagmi hook reports write failures; receipt or allowance-read failures keep approval required for retry.
    }
  }

  const handleDeposit = async () => {
    if (!selectedMethod || !selectedRouteAvailable || !projectId || !supportsDirectUsdSettlement) {
      await emitReceiptEvent({
        stage: "runtime_blocked",
        outcome: "failure",
        severity: "warning",
        errorCode: "deposit_unavailable",
        errorMessage: !selectedRouteAvailable
          ? selectedRouteIssue
          : "This crypto payment route is not currently executable.",
      })
      return
    }

    await emitReceiptEvent({
      stage: "deposit",
      outcome: "attempt",
      metadata: {
        projectId,
        periodId,
      },
    })

    try {
      if (selectedMethod.asset.is_native) {
        const depositHash = await writeContractAsync({
          address: selectedMethod.intakeContract.contract_address as `0x${string}`,
          abi: fundLoopIntakeAbi,
          functionName: "depositNative",
          args: [BigInt(projectId), periodId],
          value: amountRaw,
        })
        expectedDepositHashRef.current = depositHash
        setLastAction("deposit")
        return
      }

      const depositHash = await writeContractAsync({
        address: selectedMethod.intakeContract.contract_address as `0x${string}`,
        abi: fundLoopIntakeAbi,
        functionName: "depositToken",
        args: [BigInt(projectId), periodId, selectedMethod.asset.token_address as `0x${string}`, amountRaw],
      })
      expectedDepositHashRef.current = depositHash
      setLastAction("deposit")
    } catch {
      // The wagmi hook will surface the failure via writeError; keep the UX consistent and avoid double toasts.
    }
  }

  const wrongChain = selectedMethod ? chainId !== selectedMethod.chain.evm_chain_id : false
  const busy = writing || receiptQuery.isLoading || switchingChain || recording

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="project-crypto-payment-dialog">
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
                <SelectTrigger data-testid="crypto-payment-route-trigger">
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
                <SelectTrigger data-testid="crypto-payment-period-trigger">
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
            <Button className="w-full" onClick={() => void handleConnectWallet()} disabled={!walletEnabled} data-testid="connect-wallet-button">
              <Wallet className="mr-2 h-4 w-4" />
              Connect wallet
            </Button>
          ) : wrongChain && selectedMethod ? (
            <Button
              className="w-full"
              onClick={() => void handleSwitchChain()}
              disabled={busy}
              data-testid="switch-wallet-chain-button"
            >
              Switch to {selectedMethod.chain.display_name}
            </Button>
          ) : !supportsDirectUsdSettlement ? (
            <Button className="w-full" disabled>
              Quote required before paying
            </Button>
          ) : approvalRequired && selectedMethod && !selectedMethod.asset.is_native ? (
            <Button className="w-full" onClick={() => void handleApprove()} disabled={busy} data-testid="approve-token-button">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve {selectedMethod.asset.symbol}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => void handleDeposit()}
              disabled={busy || !selectedMethod || !payment}
              data-testid="submit-crypto-payment-button"
            >
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
