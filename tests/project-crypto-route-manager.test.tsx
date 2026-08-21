import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { ProjectCryptoRouteManager } from "@/components/project-crypto-route-manager"

const mocks = vi.hoisted(() => ({
  createRoute: vi.fn(),
  updateRoute: vi.fn(),
  moveRoute: vi.fn(),
  setRouteEnabled: vi.fn(),
  onRoutesChange: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/lib/edge-functions/project-payment-operations", () => ({
  invokeProjectCryptoRouteCreateBrowser: mocks.createRoute,
  invokeProjectCryptoRouteUpdateBrowser: mocks.updateRoute,
  invokeProjectCryptoRouteMoveBrowser: mocks.moveRoute,
  invokeProjectCryptoRouteEnabledSetBrowser: mocks.setRouteEnabled,
}))

vi.mock("@/components/web3-provider", () => ({
  useWalletRuntime: () => ({ runtimeConfig: { environment: "preview" } }),
}))

vi.mock("@/lib/onchain/runtime-config", () => ({
  getDeploymentAvailabilityForRoute: () => ({ available: true, reason: null }),
}))

vi.mock("@/components/ui/use-toast", () => ({ toast: mocks.toast }))

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({
    from: (table: string) => {
      const rows = table === "ref_chains"
        ? [{ id: 2, display_name: "Base", network_key: "base" }]
        : table === "ref_chain_assets"
          ? [{ id: 21, chain_id: 2, symbol: "USDC", name: "USD Coin" }]
          : [{
              id: 31,
              chain_id: 2,
              contract_address: "0x1111111111111111111111111111111111111111",
              treasury_address: "0x2222222222222222222222222222222222222222",
              abi_version: "v1",
            }]
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => Promise.resolve({ data: rows }),
      }
      return builder
    },
  }),
}))

vi.mock("@/components/ui/select", async () => {
  const React = await import("react")
  const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
    disabled?: boolean
  }>({})

  return {
    Select: ({ value, onValueChange, disabled, children }: {
      value?: string
      onValueChange?: (value: string) => void
      disabled?: boolean
      children: ReactNode
    }) => (
      <SelectContext.Provider value={{ value, onValueChange, disabled }}>
        {children}
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => {
      const context = React.useContext(SelectContext)
      return <button type="button" disabled={context.disabled} {...props}>{context.value || children}</button>
    },
    SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => {
      const context = React.useContext(SelectContext)
      return (
        <button type="button" role="option" aria-selected={context.value === value} onClick={() => context.onValueChange?.(value)}>
          {children}
        </button>
      )
    },
  }
})

const persistedRoute = {
  id: 71,
  label: "Saved primary draft",
  is_default: true,
  is_enabled: true,
  sort_order: 1,
  is_runtime_available: true,
  runtime_availability_issue: null,
  chain: {
    id: 2,
    display_name: "Base",
    network_key: "base",
    evm_chain_id: 8453,
    native_asset_symbol: "ETH",
    is_active: true,
  },
  asset: {
    id: 21,
    symbol: "USDC",
    name: "USD Coin",
    token_address: "0x3333333333333333333333333333333333333333",
    decimals: 6,
    is_native: false,
    is_stablecoin: true,
    is_active: true,
  },
  intakeContract: {
    id: 31,
    contract_address: "0x1111111111111111111111111111111111111111",
    treasury_address: "0x2222222222222222222222222222222222222222",
    is_active: true,
  },
}

async function chooseRouteReferences(route: HTMLElement) {
  fireEvent.click(within(route).getByRole("option", { name: "Base" }))
  await waitFor(() => expect(within(route).getByRole("option", { name: "USDC · USD Coin" })).toBeTruthy())
  fireEvent.click(within(route).getByRole("option", { name: "USDC · USD Coin" }))
}

describe("ProjectCryptoRouteManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createRoute.mockResolvedValue({ ok: true, data: [persistedRoute] })
  })

  it("preserves an unrelated unsaved draft after another draft is persisted", async () => {
    render(
      <ProjectCryptoRouteManager
        projectSlug="fixture-project"
        routes={[]}
        onRoutesChange={mocks.onRoutesChange}
      />,
    )

    const addRoute = await screen.findByTestId("add-crypto-route")
    await waitFor(() => expect(addRoute.getAttribute("disabled")).toBeNull())
    fireEvent.click(addRoute)
    fireEvent.click(addRoute)

    const drafts = screen.getAllByTestId(/^enabled-route-draft-/)
    expect(drafts).toHaveLength(2)

    fireEvent.change(within(drafts[0]).getByPlaceholderText("Base USDC default route"), {
      target: { value: "Saved primary draft" },
    })
    fireEvent.change(within(drafts[1]).getByPlaceholderText("Base USDC default route"), {
      target: { value: "Keep this local draft" },
    })
    await chooseRouteReferences(drafts[0])
    await chooseRouteReferences(drafts[1])

    fireEvent.click(within(drafts[0]).getByRole("button", { name: "Create route" }))

    await screen.findByTestId("enabled-route-71")
    await waitFor(() => expect(screen.getAllByTestId(/^enabled-route-draft-/)).toHaveLength(1))

    const remainingDraft = screen.getAllByTestId(/^enabled-route-draft-/)[0]
    expect(within(remainingDraft).getByPlaceholderText("Base USDC default route").getAttribute("value"))
      .toBe("Keep this local draft")
    expect(within(remainingDraft).getByTestId(/^route-chain-trigger-/).textContent).toContain("2")
    expect(within(remainingDraft).getByTestId(/^route-token-trigger-/).textContent).toContain("21")
    expect(within(remainingDraft).getByText("0x1111111111111111111111111111111111111111")).toBeTruthy()
    expect(within(remainingDraft).getByText("New")).toBeTruthy()

    expect(mocks.createRoute).toHaveBeenCalledWith({
      projectSlug: "fixture-project",
      chainId: 2,
      chainAssetId: 21,
      intakeContractId: 31,
      label: "Saved primary draft",
      isDefault: true,
    })
    expect(mocks.onRoutesChange).toHaveBeenCalledWith([persistedRoute])
  })
})
