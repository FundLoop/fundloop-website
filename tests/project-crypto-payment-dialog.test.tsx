import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ProjectCryptoPaymentDialog } from "@/components/project-crypto-payment-dialog"

const openWalletModal = vi.fn()

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
  useAccount: () => ({ address: null, chainId: null, isConnected: false }),
  usePublicClient: () => null,
  useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }),
  useWaitForTransactionReceipt: () => ({ isSuccess: false, isLoading: false, data: null }),
  useWriteContract: () => ({
    data: null,
    error: null,
    isPending: false,
    writeContractAsync: vi.fn(),
    reset: vi.fn(),
  }),
}))

describe("ProjectCryptoPaymentDialog", () => {
  beforeEach(() => {
    openWalletModal.mockReset()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    )
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
