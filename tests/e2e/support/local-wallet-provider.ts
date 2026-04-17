// @ts-nocheck

import type { BrowserContext, Page } from "@playwright/test"

type LocalWalletProviderInput = {
  rpcUrl: string
  chainId: number
  account: string
}

export async function installInjectedLocalWallet(context: BrowserContext, input: LocalWalletProviderInput) {
  await context.addInitScript(
    ({ rpcUrl, chainId, account }) => {
      class FundLoopLocalWalletProvider {
        account
        rpcUrl
        chainId
        chainIdHex
        isMetaMask
        providers
        selectedAddress
        listeners
        requestId

        constructor() {
          this.account = account
          this.rpcUrl = rpcUrl
          this.chainId = chainId
          this.chainIdHex = `0x${chainId.toString(16)}`
          this.isMetaMask = false
          this.providers = [this]
          this.selectedAddress = account
          this.listeners = new Map()
          this.requestId = 0
        }

        on(event, listener) {
          const current = this.listeners.get(event) ?? []
          current.push(listener)
          this.listeners.set(event, current)
          return this
        }

        removeListener(event, listener) {
          const current = this.listeners.get(event) ?? []
          this.listeners.set(
            event,
            current.filter((entry) => entry !== listener),
          )
          return this
        }

        emit(event, payload) {
          const current = this.listeners.get(event) ?? []
          current.forEach((listener) => listener(payload))
        }

        async rpc(method, params = []) {
          const response = await fetch(this.rpcUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: ++this.requestId,
              method,
              params,
            }),
          })

          const body = await response.json()

          if (body.error) {
            const error = new Error(body.error.message ?? `RPC request failed for ${method}`)
            Object.assign(error, body.error)
            throw error
          }

          return body.result
        }

        async request({ method, params = [] }) {
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [this.account]
            case "eth_chainId":
              return this.chainIdHex
            case "net_version":
              return String(this.chainId)
            case "wallet_switchEthereumChain": {
              const nextChainId = params?.[0]?.chainId?.toLowerCase?.()
              if (nextChainId !== this.chainIdHex.toLowerCase()) {
                const error = new Error(`Unsupported local chain ${nextChainId}`)
                Object.assign(error, { code: 4902 })
                throw error
              }

              this.emit("chainChanged", this.chainIdHex)
              return null
            }
            case "wallet_addEthereumChain": {
              const nextChainId = params?.[0]?.chainId?.toLowerCase?.()
              if (nextChainId !== this.chainIdHex.toLowerCase()) {
                const error = new Error(`Unsupported local chain ${nextChainId}`)
                Object.assign(error, { code: 4902 })
                throw error
              }

              this.emit("chainChanged", this.chainIdHex)
              return null
            }
            case "eth_sendTransaction": {
              const [transaction] = params ?? []
              return this.rpc(method, [
                {
                  ...transaction,
                  from: transaction?.from ?? this.account,
                },
              ])
            }
            default:
              return this.rpc(method, params)
          }
        }

        send(methodOrPayload, paramsOrCallback) {
          if (typeof methodOrPayload === "string") {
            return this.request({ method: methodOrPayload, params: paramsOrCallback })
          }

          return this.request(methodOrPayload)
        }

        enable() {
          return Promise.resolve([this.account])
        }
      }

      const provider = new FundLoopLocalWalletProvider()
      window.ethereum = provider
      window.dispatchEvent(new Event("ethereum#initialized"))
    },
    {
      rpcUrl: input.rpcUrl,
      chainId: input.chainId,
      account: input.account,
    },
  )
}

export async function connectInjectedLocalWallet(page: Page) {
  const connection = page.evaluate(
    () =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const handleResult = (event: Event) => {
          const customEvent = event as CustomEvent<{ ok: boolean; error?: string }>
          window.removeEventListener("fundloop:e2e-connect-wallet-result", handleResult)
          resolve(customEvent.detail)
        }

        window.addEventListener("fundloop:e2e-connect-wallet-result", handleResult)
        window.dispatchEvent(new Event("fundloop:e2e-connect-wallet"))
      }),
  )

  const result = await connection
  if (!result.ok) {
    throw new Error(result.error ?? "Could not connect the injected local wallet.")
  }
}
