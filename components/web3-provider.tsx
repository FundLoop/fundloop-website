"use client"

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { WagmiProvider } from "wagmi"
import { createConfiguredChain, SUPPORTED_CHAIN_CONFIGS, type SupportedChainKey } from "@/lib/onchain/supported-chains"
import { ZERO_REOWN_PROJECT_ID, type WalletRuntimeConfig } from "@/lib/onchain/runtime-config"

const appMetadata = {
  name: "FundLoop",
  description: "FundLoop project contribution payments",
  url: "https://fundloop.org",
  icons: ["https://fundloop.org/favicon.ico"],
}

type WalletRuntimeContextValue = {
  runtimeConfig: WalletRuntimeConfig
  walletEnabled: boolean
  openWalletModal: () => Promise<void>
}

const fallbackChain = SUPPORTED_CHAIN_CONFIGS.ethereum.chain
const WalletRuntimeContext = createContext<WalletRuntimeContextValue | null>(null)

let appKitInitialized = false

function ensureAppKit(input: {
  wagmiAdapter: WagmiAdapter
  projectId: string
  networks: [ReturnType<typeof createConfiguredChain>, ...ReturnType<typeof createConfiguredChain>[]]
}) {
  if (appKitInitialized) {
    return
  }

  createAppKit({
    adapters: [input.wagmiAdapter],
    projectId: input.projectId,
    networks: input.networks,
    defaultNetwork: input.networks[0] ?? fallbackChain,
    metadata: appMetadata,
    allowUnsupportedChain: false,
  })

  appKitInitialized = true
}

export function useWalletRuntime() {
  const context = useContext(WalletRuntimeContext)
  if (!context) {
    throw new Error("useWalletRuntime must be used within Web3Provider")
  }

  return context
}

export function Web3Provider({
  children,
  runtimeConfig,
}: {
  children: ReactNode
  runtimeConfig: WalletRuntimeConfig
}) {
  const [queryClient] = useState(() => new QueryClient())
  const networks = useMemo(
    () =>
      runtimeConfig.activeChains.map((chain) =>
        createConfiguredChain(chain.networkKey as SupportedChainKey, chain.rpcUrl),
      ),
    [runtimeConfig.activeChains],
  )
  const reownProjectId = runtimeConfig.reownProjectIdConfigured
    ? runtimeConfig.reownProjectId ?? ZERO_REOWN_PROJECT_ID
    : ZERO_REOWN_PROJECT_ID
  const hasConfiguredNetworks = networks.length > 0
  const adapterNetworks = useMemo(() => (networks.length > 0 ? networks : [fallbackChain]), [networks])
  const appKitNetworks = adapterNetworks as [typeof adapterNetworks[number], ...typeof adapterNetworks[number][]]
  const wagmiAdapter = useMemo(
    () =>
      new WagmiAdapter({
        projectId: reownProjectId,
        networks: appKitNetworks,
      }),
    [appKitNetworks, reownProjectId],
  )

  useEffect(() => {
    if (!runtimeConfig.walletEnabled || !hasConfiguredNetworks) {
      return
    }

    ensureAppKit({
      wagmiAdapter,
      projectId: reownProjectId,
      networks: appKitNetworks,
    })
  }, [appKitNetworks, hasConfiguredNetworks, reownProjectId, runtimeConfig.walletEnabled, wagmiAdapter])

  const contextValue = useMemo<WalletRuntimeContextValue>(
    () => ({
      runtimeConfig,
      walletEnabled: runtimeConfig.walletEnabled,
      openWalletModal: async () => {
        if (!runtimeConfig.walletEnabled || !hasConfiguredNetworks) {
          return
        }

        ensureAppKit({
          wagmiAdapter,
          projectId: reownProjectId,
          networks: appKitNetworks,
        })

        const { modal } = await import("@reown/appkit/react")
        await modal?.open()
      },
    }),
    [appKitNetworks, hasConfiguredNetworks, reownProjectId, runtimeConfig, wagmiAdapter],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        <WalletRuntimeContext.Provider value={contextValue}>{children}</WalletRuntimeContext.Provider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
