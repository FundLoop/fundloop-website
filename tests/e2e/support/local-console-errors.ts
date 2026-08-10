import type { ConsoleMessage, Page } from "@playwright/test"

const expectedLocalWalletHosts = new Set([
  "api.web3modal.org",
  "rpc.walletconnect.org",
  "pulse.walletconnect.org",
])

function isExpectedLocalWalletError(message: ConsoleMessage) {
  const url = message.location().url
  if (!url) return false
  try {
    return expectedLocalWalletHosts.has(new URL(url).hostname)
  } catch {
    return false
  }
}

export function collectUnexpectedLocalConsoleErrors(page: Page, errors: string[]) {
  page.on("console", (message) => {
    if (message.type() === "error" && !isExpectedLocalWalletError(message)) {
      errors.push(message.text())
    }
  })
}
