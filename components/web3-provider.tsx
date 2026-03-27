"use client"

import { type ReactNode, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { WagmiProvider } from "wagmi"
import { SUPPORTED_WAGMI_CHAINS } from "@/lib/onchain/supported-chains"

const appMetadata = {
  name: "FundLoop",
  description: "FundLoop project contribution payments",
  url: "https://fundloop.org",
  icons: ["https://fundloop.org/favicon.ico"],
}

export const hasReownProjectId = Boolean(process.env.NEXT_PUBLIC_REOWN_PROJECT_ID)
const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "00000000000000000000000000000000"
const wagmiAdapter = new WagmiAdapter({
  projectId: reownProjectId,
  networks: [...SUPPORTED_WAGMI_CHAINS],
})

let appKitInitialized = false

function ensureAppKit() {
  if (appKitInitialized) {
    return
  }

  createAppKit({
    adapters: [wagmiAdapter],
    projectId: reownProjectId,
    networks: [...SUPPORTED_WAGMI_CHAINS],
    defaultNetwork: SUPPORTED_WAGMI_CHAINS[1],
    metadata: appMetadata,
    allowUnsupportedChain: false,
  })

  appKitInitialized = true
}

export function openFundLoopWalletModal() {
  if (!hasReownProjectId) {
    return Promise.resolve()
  }

  ensureAppKit()
  return import("@reown/appkit/react").then(({ modal }) => modal?.open())
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  useEffect(() => {
    if (!hasReownProjectId) {
      return
    }

    ensureAppKit()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  )
}
