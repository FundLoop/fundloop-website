export const fundLoopIntakeAbi = [
  {
    type: "function",
    name: "depositNative",
    stateMutability: "payable",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "depositToken",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { indexed: true, name: "projectId", type: "uint256" },
      { indexed: true, name: "asset", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: true, name: "sender", type: "address" },
      { indexed: false, name: "treasury", type: "address" },
      { indexed: false, name: "isNative", type: "bool" },
    ],
  },
] as const

export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const
