import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"
import { createClient } from "@supabase/supabase-js"

const rootCwd = new URL("..", import.meta.url)

function requireEnv(name, fallback = null) {
  const value = process.env[name]?.trim() ?? fallback
  if (!value) {
    throw new Error(`${name} is required for the local wallet Playwright lane.`)
  }

  return value
}

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "pipe",
    cwd: new URL(".", rootCwd),
    env: process.env,
    ...options,
  })

  child.stdout?.pipe(process.stdout)
  child.stderr?.pipe(process.stderr)

  return child
}

async function waitForHttp(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status < 500) {
        return
      }
    } catch {}

    await delay(1000)
  }

  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForRpc(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      })

      const body = await response.json()
      if (body.result) {
        return
      }
    } catch {}

    await delay(1000)
  }

  throw new Error(`Timed out waiting for local RPC at ${url}`)
}

async function runCommand(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: new URL(".", rootCwd),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
      process.stdout.write(chunk)
    })

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
      process.stderr.write(chunk)
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim())
        return
      }

      reject(new Error(stderr.trim() || stdout.trim() || `${command} ${args.join(" ")} failed with code ${code}`))
    })
  })
}

async function main() {
  const baseURL = process.env.PLAYWRIGHT_LOCAL_BASE_URL?.trim() || "http://127.0.0.1:3001"
  const rpcUrl = process.env.PLAYWRIGHT_LOCAL_RPC_URL?.trim() || "http://127.0.0.1:8545"
  const chainId = Number.parseInt(process.env.PLAYWRIGHT_LOCAL_CHAIN_ID ?? "8453", 10)
  const e2eSecret = process.env.FUNDLOOP_E2E_SECRET?.trim() || `playwright-${randomUUID()}`
  const cronSecret = process.env.FUNDLOOP_PAYMENTS_CRON_SECRET?.trim() || `payments-${randomUUID()}`

  requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  const nodeProcess = spawnProcess("pnpm", [
    "--dir",
    "contracts",
    "exec",
    "hardhat",
    "node",
    "--chain-id",
    String(chainId),
    "--hostname",
    "127.0.0.1",
    "--port",
    new URL(rpcUrl).port || "8545",
  ])

  const stopChildren = () => {
    nodeProcess.kill("SIGTERM")
    appProcess?.kill("SIGTERM")
  }

  let appProcess = null

  process.on("SIGINT", stopChildren)
  process.on("SIGTERM", stopChildren)

  try {
    await waitForRpc(rpcUrl)

    await runCommand("pnpm", ["--dir", "contracts", "build"])

    const deployStdout = await runCommand("pnpm", [
      "--dir",
      "contracts",
      "exec",
      "hardhat",
      "run",
      "scripts/deploy-playwright-local-wallet.js",
      "--network",
      "localhost",
    ])

    const deployment = JSON.parse(deployStdout.split("\n").at(-1))
    const manifest = {
      version: "fundloop-wallet-deployments.playwright-local.v1",
      environment: "local",
      chains: [
        {
          networkKey: "ethereum",
          evmChainId: 1,
          enabled: false,
          confirmationDepth: 1,
          abiVersion: "fundloop-intake-v1",
          contractAddress: "0x0000000000000000000000000000000000000000",
          treasuryAddress: "0x0000000000000000000000000000000000000000",
        },
        {
          networkKey: "base",
          evmChainId: chainId,
          enabled: true,
          confirmationDepth: 1,
          abiVersion: deployment.abiVersion,
          contractAddress: deployment.intakeAddress,
          treasuryAddress: deployment.treasuryAddress,
        },
        {
          networkKey: "celo",
          evmChainId: 42220,
          enabled: false,
          confirmationDepth: 1,
          abiVersion: "fundloop-intake-v1",
          contractAddress: "0x0000000000000000000000000000000000000000",
          treasuryAddress: "0x0000000000000000000000000000000000000000",
        },
      ],
    }

    const sharedEnv = {
      ...process.env,
      PLAYWRIGHT_LOCAL_BASE_URL: baseURL,
      PLAYWRIGHT_LOCAL_RPC_URL: rpcUrl,
      PLAYWRIGHT_LOCAL_CHAIN_ID: String(chainId),
      PLAYWRIGHT_LOCAL_WALLET_ADDRESS: deployment.payerAddress,
      PLAYWRIGHT_LOCAL_TREASURY_ADDRESS: deployment.treasuryAddress,
      PLAYWRIGHT_LOCAL_TOKEN_ADDRESS: deployment.tokenAddress,
      PLAYWRIGHT_LOCAL_INTAKE_ADDRESS: deployment.intakeAddress,
      FUNDLOOP_DEPLOYMENT_ENV: "local",
      FUNDLOOP_E2E_ENABLED: "true",
      FUNDLOOP_E2E_SECRET: e2eSecret,
      FUNDLOOP_PAYMENTS_CRON_SECRET: cronSecret,
      NEXT_PUBLIC_REOWN_PROJECT_ID: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() || "fundloop-playwright-local",
      NEXT_PUBLIC_BASE_RPC_URL: rpcUrl,
      NEXT_PUBLIC_FUNDLOOP_E2E_LOCAL_WALLET: "true",
      NEXT_PUBLIC_FUNDLOOP_LOCAL_WALLET_MANIFEST_JSON: JSON.stringify(manifest),
      FUNDLOOP_DEPLOYMENT_MANIFEST_JSON: JSON.stringify(manifest),
    }

    const supabase = createClient(sharedEnv.NEXT_PUBLIC_SUPABASE_URL, sharedEnv.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    await runCommand("node", ["scripts/sync-chain-deployments.mjs", "--env", "local", "--apply"], sharedEnv)

    const { data: baseChain, error: baseChainError } = await supabase
      .from("ref_chains")
      .select("id")
      .eq("network_key", "base")
      .single()

    if (baseChainError || !baseChain?.id) {
      throw new Error(baseChainError?.message ?? "Could not resolve the local Base chain row.")
    }

    const { error: assetUpdateError } = await supabase
      .from("ref_chain_assets")
      .update({
        token_address: deployment.tokenAddress,
        is_active: true,
        is_stablecoin: true,
      })
      .eq("chain_id", baseChain.id)
      .eq("asset_key", "usdc")

    if (assetUpdateError) {
      throw new Error(assetUpdateError.message)
    }

    appProcess = spawnProcess(
      "pnpm",
      ["dev", "--port", new URL(baseURL).port || "3001", "--hostname", "127.0.0.1"],
      { env: sharedEnv },
    )

    await waitForHttp(baseURL)

    await runCommand("pnpm", ["exec", "playwright", "test", "--project=local-wallet"], sharedEnv)
  } finally {
    stopChildren()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
