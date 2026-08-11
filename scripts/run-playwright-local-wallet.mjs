import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { mkdir, open, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const rootCwd = new URL("..", import.meta.url)
const rootPath = fileURLToPath(rootCwd)
const localOperatorEmail = "maya@fundloop.example.com"
const activeCommandProcesses = new Set()

function loadLocalEnv() {
  const envPath = path.join(rootPath, ".env.local")
  if (typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(envPath) } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error
    }
  }
}

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
    detached: true,
    ...options,
  })

  child.stdout?.pipe(process.stdout)
  child.stderr?.pipe(process.stderr)

  return child
}

function stopProcessGroup(child) {
  if (!child?.pid || child.exitCode !== null) return
  try { process.kill(-child.pid, "SIGTERM") } catch { child.kill("SIGTERM") }
}

function stopActiveCommands() {
  for (const child of activeCommandProcesses) stopProcessGroup(child)
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
      detached: true,
    })
    activeCommandProcesses.add(child)

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

    child.on("error", (error) => {
      activeCommandProcesses.delete(child)
      reject(error)
    })
    child.on("exit", (code) => {
      activeCommandProcesses.delete(child)
      if (code === 0) {
        resolve(stdout.trim())
        return
      }

      reject(new Error(stderr.trim() || stdout.trim() || `${command} ${args.join(" ")} failed with code ${code}`))
    })
  })
}

async function runCommandWithInput(command, args, input, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: new URL(".", rootCwd),
      env,
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    })
    activeCommandProcesses.add(child)
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); process.stdout.write(chunk) })
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); process.stderr.write(chunk) })
    child.on("error", (error) => {
      activeCommandProcesses.delete(child)
      reject(error)
    })
    child.on("exit", (code) => {
      activeCommandProcesses.delete(child)
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || stdout.trim() || `${command} ${args.join(" ")} failed with code ${code}`))
    })
    child.stdin?.end(input)
  })
}

async function applyCommittedSqlFixture(relativePath, dbUrl, env) {
  const source = await readFile(path.join(rootPath, relativePath), "utf8")
  if (!source.startsWith("BEGIN;\n") || !/\nROLLBACK;\s*$/.test(source)) {
    throw new Error(`local-wallet-fixture-contract-invalid-${path.basename(relativePath)}`)
  }
  const fixture = source.replace(/^BEGIN;\n/, "").replace(/\nROLLBACK;\s*$/, "\n")
  await runCommandWithInput("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "--single-transaction"], fixture, env)
}

async function resetLocalDatabase(env = process.env) {
  let lastError = null
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await runCommand("supabase", ["db", "reset", "--local"], env)
      return
    } catch (error) {
      lastError = error
      if (attempt < 2) {
        await delay(1_500)
      }
    }
  }
  throw lastError
}

async function startLocalEdgeRuntime(env) {
  const directory = path.join(rootPath, "output", "playwright", "local-wallet")
  const envPath = path.join(directory, "edge-runtime.env")
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const values = {
    FUNDLOOP_DEPLOYMENT_ENV: "local",
    FUNDLOOP_INTERNAL_ADMIN_EMAILS: localOperatorEmail,
    FUNDLOOP_ZKAS_SUPERADMIN_EMAILS: localOperatorEmail,
    FUNDLOOP_MAILPIT_API_URL: "http://host.docker.internal:55324",
    FUNDLOOP_PAYMENTS_CRON_SECRET: env.FUNDLOOP_PAYMENTS_CRON_SECRET,
    NEXT_PUBLIC_POLICY_REVIEW_PREVIEW: "1",
    NEXT_PUBLIC_REOWN_PROJECT_ID: env.NEXT_PUBLIC_REOWN_PROJECT_ID,
    NEXT_PUBLIC_BASE_RPC_URL: "http://host.docker.internal:8545",
    NEXT_PUBLIC_FUNDLOOP_LOCAL_WALLET_MANIFEST_JSON: env.NEXT_PUBLIC_FUNDLOOP_LOCAL_WALLET_MANIFEST_JSON,
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    STRIPE_CONNECT_WEBHOOK_SECRET: env.STRIPE_CONNECT_WEBHOOK_SECRET,
  }
  const lines = Object.entries(values).filter(([, value]) => value).map(([key, value]) => {
    if (String(value).includes("\n")) throw new Error("local-wallet-edge-env-invalid")
    return `${key}=${value}`
  })
  const handle = await open(envPath, "w", 0o600)
  try { await handle.writeFile(`${lines.join("\n")}\n`); await handle.sync() } finally { await handle.close() }
  const child = spawnProcess("supabase", ["functions", "serve", "--env-file", envPath], { env })
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error("local-wallet-edge-runtime-exited")
    try {
      const response = await fetch("http://127.0.0.1:55321/functions/v1/monthly-cycle-lock", { method: "OPTIONS", signal: AbortSignal.timeout(1_000) })
      if (response.ok) return { child, envPath }
    } catch {}
    await delay(500)
  }
  stopProcessGroup(child)
  throw new Error("local-wallet-edge-runtime-readiness-timeout")
}

async function main() {
  loadLocalEnv()
  const phaseOrder = ["wallet", "allocation", "withdrawal", "base", "stripe-connect", "stripe-pad", "stripe-pay-by-bank", "operational"]
  const startPhase = process.env.PLAYWRIGHT_LOCAL_START_PHASE?.trim() || "wallet"
  const startPhaseIndex = phaseOrder.indexOf(startPhase)
  if (startPhaseIndex < 0) {
    throw new Error(`PLAYWRIGHT_LOCAL_START_PHASE must be one of: ${phaseOrder.join(", ")}`)
  }
  const shouldRunPhase = (phase) => phaseOrder.indexOf(phase) >= startPhaseIndex
  const baseURL = process.env.PLAYWRIGHT_LOCAL_BASE_URL?.trim() || "http://127.0.0.1:3001"
  const rpcUrl = process.env.PLAYWRIGHT_LOCAL_RPC_URL?.trim() || "http://127.0.0.1:8545"
  const chainId = Number.parseInt(process.env.PLAYWRIGHT_LOCAL_CHAIN_ID ?? "8453", 10)
  const e2eSecret = process.env.FUNDLOOP_E2E_SECRET?.trim() || `playwright-${randomUUID()}`
  const cronSecret = process.env.FUNDLOOP_PAYMENTS_CRON_SECRET?.trim() || `payments-${randomUUID()}`
  const dbUrl = process.env.PLAYWRIGHT_LOCAL_DB_URL?.trim() || "postgresql://postgres:postgres@127.0.0.1:55322/postgres"

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
    stopActiveCommands()
    stopProcessGroup(nodeProcess)
    stopProcessGroup(appProcess)
    stopProcessGroup(edgeProcess)
  }

  let appProcess = null
  let edgeProcess = null
  let edgeEnvPath = null
  let interrupted = false

  const interrupt = () => {
    interrupted = true
    stopChildren()
  }
  process.on("SIGINT", interrupt)
  process.on("SIGTERM", interrupt)

  try {
    await resetLocalDatabase()
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
      PLAYWRIGHT_LOCAL_DB_URL: dbUrl,
      PLAYWRIGHT_LOCAL_WALLET_ADDRESS: deployment.payerAddress,
      PLAYWRIGHT_LOCAL_TREASURY_ADDRESS: deployment.treasuryAddress,
      PLAYWRIGHT_LOCAL_TOKEN_ADDRESS: deployment.tokenAddress,
      PLAYWRIGHT_LOCAL_INTAKE_ADDRESS: deployment.intakeAddress,
      FUNDLOOP_DEPLOYMENT_ENV: "local",
      FUNDLOOP_INTERNAL_ADMIN_EMAILS: localOperatorEmail,
      FUNDLOOP_ZKAS_SUPERADMIN_EMAILS: localOperatorEmail,
      NEXT_PUBLIC_POLICY_REVIEW_PREVIEW: "1",
      NEXT_PUBLIC_BASE_PAYOUT_REVIEW_ENABLED: "true",
      NEXT_PUBLIC_STRIPE_CONNECT_REVIEW_ENABLED: "true",
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

    const edgeRuntime = await startLocalEdgeRuntime(sharedEnv)
    edgeProcess = edgeRuntime.child
    edgeEnvPath = edgeRuntime.envPath

    appProcess = spawnProcess(
      "pnpm",
      ["dev", "--port", new URL(baseURL).port || "3001", "--hostname", "127.0.0.1"],
      { env: sharedEnv },
    )

    await waitForHttp(baseURL)

    const runBrowserFiles = (...files) => runCommand("pnpm", ["exec", "playwright", "test", "--project=local-wallet", ...files], sharedEnv)
    const resetDatabase = async () => {
      await resetLocalDatabase(sharedEnv)
      await waitForHttp(`${sharedEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`)
    }

    if (shouldRunPhase("wallet")) {
      await runBrowserFiles("tests/e2e/local/wallet-payments.spec.ts", "tests/e2e/local/review-policy-consent.spec.ts")
    }

    if (shouldRunPhase("allocation")) {
      await resetDatabase()
      await applyCommittedSqlFixture("supabase/tests/fixtures/epoch_funded_allocation_browser.sql", dbUrl, sharedEnv)
      await runBrowserFiles("tests/e2e/local/epoch-funded-allocation.spec.ts")
    }

    if (shouldRunPhase("withdrawal")) {
      await resetDatabase()
      await applyCommittedSqlFixture("supabase/tests/withdrawal_obligation_control_plane.sql", dbUrl, sharedEnv)
      await runBrowserFiles("tests/e2e/local/withdrawal-obligation-control-plane.spec.ts")
    }

    if (shouldRunPhase("base")) {
      await resetDatabase()
      await applyCommittedSqlFixture("supabase/tests/withdrawal_obligation_control_plane.sql", dbUrl, sharedEnv)
      await applyCommittedSqlFixture("supabase/tests/base_safe_payout_control_plane.sql", dbUrl, sharedEnv)
      await runBrowserFiles("tests/e2e/local/base-safe-payout-control-plane.spec.ts")
    }

    if (shouldRunPhase("stripe-connect")) {
      await resetDatabase()
      await applyCommittedSqlFixture("supabase/tests/withdrawal_obligation_control_plane.sql", dbUrl, sharedEnv)
      await applyCommittedSqlFixture("supabase/tests/stripe_connect_payout_control_plane.sql", dbUrl, sharedEnv)
      await applyCommittedSqlFixture("supabase/tests/fixtures/stripe_connect_browser_ready.sql", dbUrl, sharedEnv)
      await runBrowserFiles("tests/e2e/local/stripe-connect-payout-control-plane.spec.ts")
    }

    if (shouldRunPhase("stripe-pad")) {
      await resetDatabase()
      await runBrowserFiles("tests/e2e/local/stripe-acss-debit-intake.spec.ts")
    }

    if (shouldRunPhase("stripe-pay-by-bank")) {
      await resetDatabase()
      await runBrowserFiles("tests/e2e/local/stripe-pay-by-bank-intake.spec.ts")
    }

    if (shouldRunPhase("operational")) {
      await resetDatabase()
      await runCommand("pnpm", ["exec", "playwright", "test", "--project=operational-local"], sharedEnv)
    }
  } finally {
    stopChildren()
    if (edgeEnvPath) await rm(edgeEnvPath, { force: true })
    if (!interrupted) await resetLocalDatabase().catch(() => {})
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
