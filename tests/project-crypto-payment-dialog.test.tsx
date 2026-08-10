import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { cloneElement } from "react"
import { ProjectCryptoPaymentDialog } from "@/components/project-crypto-payment-dialog"
import { invokeProjectOnchainPaymentSubmissionRecordBrowser } from "@/lib/edge-functions/project-payment-operations"

const openWalletModal = vi.fn()
const wagmiState = vi.hoisted(() => ({
  account: { address: null as `0x${string}` | null, chainId: null as number | null, isConnected: false },
  publicClient: null as null | {
    readContract: ReturnType<typeof vi.fn>
    waitForTransactionReceipt: ReturnType<typeof vi.fn>
  },
  writeContractAsync: vi.fn(),
  reset: vi.fn(),
  writeHash: null as `0x${string}` | null,
  receipt: { isSuccess: false, isLoading: false, data: null as null | { blockNumber: bigint } },
}))

vi.mock("@/components/web3-provider", () => ({
  useWalletRuntime: () => ({
    walletEnabled: true,
    openWalletModal,
    runtimeConfig: {
      environment: "preview",
      manifestVersion: "fundloop-wallet-deployments.v1",
      reownProjectId: "reown-project-id",
      reownProjectIdConfigured: true,
      walletEnabled: true,
      activeChains: [],
      issues: [],
    },
  }),
}))

vi.mock("@/lib/edge-functions/project-payment-operations", () => ({
  invokeProjectOnchainPaymentSubmissionRecordBrowser: vi.fn(),
}))

vi.mock("wagmi", () => ({
  useAccount: () => wagmiState.account,
  usePublicClient: () => wagmiState.publicClient,
  useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }),
  useWaitForTransactionReceipt: () => wagmiState.receipt,
  useWriteContract: () => ({
    data: wagmiState.writeHash,
    error: null,
    isPending: false,
    writeContractAsync: wagmiState.writeContractAsync,
    reset: wagmiState.reset,
  }),
}))

describe("ProjectCryptoPaymentDialog", () => {
  beforeEach(() => {
    openWalletModal.mockReset()
    wagmiState.account = { address: null, chainId: null, isConnected: false }
    wagmiState.publicClient = null
    wagmiState.writeContractAsync.mockReset()
    wagmiState.reset.mockReset()
    wagmiState.writeHash = null
    wagmiState.receipt = { isSuccess: false, isLoading: false, data: null }
    vi.mocked(invokeProjectOnchainPaymentSubmissionRecordBrowser).mockReset()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    )
  })

  it("waits for token approval finality and refreshes allowance before enabling submission", async () => {
    const readContract = vi.fn().mockResolvedValueOnce(BigInt(0)).mockResolvedValueOnce(BigInt(100_000_000))
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: "success" })
    wagmiState.account = {
      address: "0x3333333333333333333333333333333333333333",
      chainId: 8453,
      isConnected: true,
    }
    wagmiState.publicClient = { readContract, waitForTransactionReceipt }
    wagmiState.writeContractAsync.mockResolvedValue("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

    render(
      <ProjectCryptoPaymentDialog
        open
        onOpenChange={vi.fn()}
        payment={{ id: 1, payment_amount: 100, period_end: "2026-04-30" }}
        paymentMethods={[
          {
            id: 10,
            label: "Base USDC",
            is_default: true,
            is_runtime_available: true,
            runtime_availability_issue: null,
            chain: {
              id: 2,
              display_name: "Base",
              network_key: "base",
              evm_chain_id: 8453,
              native_asset_symbol: "ETH",
            },
            asset: {
              id: 3,
              symbol: "USDC",
              name: "USD Coin",
              token_address: "0x4444444444444444444444444444444444444444",
              decimals: 6,
              is_native: false,
              is_stablecoin: true,
            },
            intakeContract: {
              id: 4,
              contract_address: "0x1111111111111111111111111111111111111111",
              treasury_address: "0x2222222222222222222222222222222222222222",
            },
          },
        ]}
        projectId={7}
        projectSlug="fundloop-studio"
        onPaymentRecorded={vi.fn()}
      />,
    )

    const approve = await screen.findByTestId("approve-token-button")
    fireEvent.click(approve)

    await waitFor(() => expect(waitForTransactionReceipt).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId("submit-crypto-payment-button")).toBeTruthy())
  })

  it("records a successful deposit receipt once while the attempt state rerenders", async () => {
    const transactionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const
    wagmiState.account = {
      address: "0x3333333333333333333333333333333333333333",
      chainId: 8453,
      isConnected: true,
    }
    wagmiState.publicClient = {
      readContract: vi.fn().mockResolvedValue(BigInt(100_000_000)),
      waitForTransactionReceipt: vi.fn(),
    }
    wagmiState.receipt = { isSuccess: true, isLoading: false, data: { blockNumber: BigInt(6) } }
    wagmiState.writeContractAsync.mockImplementation(async () => {
      wagmiState.writeHash = transactionHash
      return transactionHash
    })
    vi.mocked(invokeProjectOnchainPaymentSubmissionRecordBrowser).mockResolvedValue({
      ok: true,
      data: { submissionId: 42 },
    })
    const onOpenChange = vi.fn()
    const onPaymentRecorded = vi.fn()

    const dialog = (
      <ProjectCryptoPaymentDialog
        open
        onOpenChange={onOpenChange}
        payment={{ id: 1, payment_amount: 100, period_end: "2026-04-30" }}
        paymentMethods={[
          {
            id: 10,
            label: "Base USDC",
            is_default: true,
            is_runtime_available: true,
            runtime_availability_issue: null,
            chain: {
              id: 2,
              display_name: "Base",
              network_key: "base",
              evm_chain_id: 8453,
              native_asset_symbol: "ETH",
            },
            asset: {
              id: 3,
              symbol: "USDC",
              name: "USD Coin",
              token_address: "0x4444444444444444444444444444444444444444",
              decimals: 6,
              is_native: false,
              is_stablecoin: true,
            },
            intakeContract: {
              id: 4,
              contract_address: "0x1111111111111111111111111111111111111111",
              treasury_address: "0x2222222222222222222222222222222222222222",
            },
          },
        ]}
        projectId={7}
        projectSlug="fundloop-studio"
        onPaymentRecorded={onPaymentRecorded}
      />
    )
    const { rerender } = render(dialog)

    const submit = await screen.findByTestId("submit-crypto-payment-button")
    fireEvent.click(submit)
    await waitFor(() => expect(wagmiState.writeContractAsync).toHaveBeenCalledTimes(1))
    rerender(cloneElement(dialog))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(invokeProjectOnchainPaymentSubmissionRecordBrowser).toHaveBeenCalledTimes(1)
    expect(onPaymentRecorded).toHaveBeenCalledTimes(1)
  })

  it("shows a route unavailable state when the selected route is out of sync", () => {
    render(
      <ProjectCryptoPaymentDialog
        open
        onOpenChange={vi.fn()}
        payment={{ id: 1, payment_amount: 100, period_end: "2026-04-30" }}
        paymentMethods={[
          {
            id: 10,
            label: "Base USDC",
            is_default: true,
            is_runtime_available: false,
            runtime_availability_issue: "Base intake contract does not match the active preview deployment manifest.",
            chain: {
              id: 2,
              display_name: "Base",
              network_key: "base",
              evm_chain_id: 8453,
              native_asset_symbol: "ETH",
            },
            asset: {
              id: 3,
              symbol: "USDC",
              name: "USD Coin",
              token_address: "0x3333333333333333333333333333333333333333",
              decimals: 6,
              is_native: false,
              is_stablecoin: true,
            },
            intakeContract: {
              id: 4,
              contract_address: "0x1111111111111111111111111111111111111111",
              treasury_address: "0x2222222222222222222222222222222222222222",
            },
          },
        ]}
        projectId={7}
        projectSlug="fundloop-studio"
        onPaymentRecorded={vi.fn()}
      />,
    )

    expect(screen.getByText("Base intake contract does not match the active preview deployment manifest.")).toBeTruthy()
    expect(screen.getByRole("button", { name: /route unavailable in preview/i }).getAttribute("disabled")).not.toBeNull()
  })

  it("records a wallet-connect attempt when the connect button is pressed", async () => {
    render(
      <ProjectCryptoPaymentDialog
        open
        onOpenChange={vi.fn()}
        payment={{ id: 1, payment_amount: 100, period_end: "2026-04-30" }}
        paymentMethods={[
          {
            id: 10,
            label: "Base USDC",
            is_default: true,
            is_runtime_available: true,
            runtime_availability_issue: null,
            chain: {
              id: 2,
              display_name: "Base",
              network_key: "base",
              evm_chain_id: 8453,
              native_asset_symbol: "ETH",
            },
            asset: {
              id: 3,
              symbol: "USDC",
              name: "USD Coin",
              token_address: "0x3333333333333333333333333333333333333333",
              decimals: 6,
              is_native: false,
              is_stablecoin: true,
            },
            intakeContract: {
              id: 4,
              contract_address: "0x1111111111111111111111111111111111111111",
              treasury_address: "0x2222222222222222222222222222222222222222",
            },
          },
        ]}
        projectId={7}
        projectSlug="fundloop-studio"
        onPaymentRecorded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId("connect-wallet-button"))

    await waitFor(() => {
      expect(openWalletModal).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })
  })
})
