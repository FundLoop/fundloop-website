import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem"

const baseSepoliaRequested = process.argv.includes("baseSepolia")
const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim()
const baseSepoliaPrivateKey = process.env.BASE_SEPOLIA_PRIVATE_KEY?.trim()
if (baseSepoliaRequested && (!baseSepoliaRpcUrl || !baseSepoliaPrivateKey)) {
  throw new Error("BASE_SEPOLIA_RPC_URL and BASE_SEPOLIA_PRIVATE_KEY are required for --network baseSepolia")
}

const config = {
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    baseSepolia: {
      type: "http",
      url: baseSepoliaRpcUrl || "http://127.0.0.1:1",
      chainId: 84532,
      accounts: baseSepoliaPrivateKey ? [baseSepoliaPrivateKey] : [],
    },
  },
}

export default config
