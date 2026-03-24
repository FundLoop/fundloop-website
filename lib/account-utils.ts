export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidWalletAddress(address: string, walletType = "ethereum") {
  if (walletType === "ethereum") {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  return address.trim().length > 0
}
