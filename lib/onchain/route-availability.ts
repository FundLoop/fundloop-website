export type DepositAddressRouteShape = {
  networkKey: string
  treasuryAddress: string
  abiVersion: string
}

export function isSolanaDepositAddressRoute(input: DepositAddressRouteShape) {
  return input.networkKey.startsWith("solana") && input.abiVersion.startsWith("solana-") && input.treasuryAddress.trim().length > 0
}
