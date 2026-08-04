// @ts-nocheck

import { randomUUID, createHash } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "../../../types/supabase"

type SupportedNetworkKey = "ethereum" | "base" | "celo"

type E2EFixtureClientInput = {
  supabaseUrl: string
  serviceRoleKey: string
}

type RouteCandidate = {
  chainId: number
  chainDisplayName: string
  networkKey: SupportedNetworkKey
  evmChainId: number
  assetId: number
  assetSymbol: string
  assetName: string
  assetDecimals: number
  assetIsNative: boolean
  assetIsStablecoin: boolean
  tokenAddress: string | null
  intakeContractId: number
  contractAddress: string
  treasuryAddress: string
  abiVersion: string
}

type FixtureScenario = "remote-safe" | "local-wallet"

export type ProjectPaymentsFixture = {
  runId: string
  user: {
    id: string
    email: string
    password: string
  }
  project: {
    id: number
    slug: string
    name: string
  }
  routes: {
    primary: RouteCandidate & { paymentMethodId: number }
    secondary: RouteCandidate & { paymentMethodId: number }
    available: RouteCandidate[]
  }
  payments: {
    draftId: number
    pendingId: number
    awaitingConfirmingId: number
    awaitingSubmittedId: number
    failedId: number
  }
  cleanup: () => Promise<void>
}

type PaymentStatusRefs = {
  draft: number
  pending: number
  awaiting_confirmation: number
  failed: number
}

type ReferenceData = {
  founderRoleId: number
  cryptoContractMethodId: number
  paymentStatuses: PaymentStatusRefs
  routeCandidates: RouteCandidate[]
}

export function createE2EClient(input: E2EFixtureClientInput) {
  return createClient<Database>(input.supabaseUrl, input.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function buildRunId(scenario: FixtureScenario) {
  return `e2e-${scenario}-${Date.now()}-${randomUUID().slice(0, 8)}`
}

function uniqueHexHash(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`
}

function buildFixtureIdBase(runId: string) {
  const hash = createHash("sha256").update(runId).digest().readUInt32BE(0)

  return 1_900_000_000 + (hash % 100_000_000)
}

async function ensureNoError<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>, message: string) {
  const { data, error } = await promise

  if (error || data === null) {
    throw new Error(error?.message ?? message)
  }

  return data
}

async function ensureMutation(
  promise: PromiseLike<{ error: { message: string } | null }>,
  message: string,
) {
  const { error } = await promise

  if (error) {
    throw new Error(error.message || message)
  }
}

async function loadReferenceData(supabase: SupabaseClient<Database>): Promise<ReferenceData> {
  const [roles, paymentMethods, statuses, chains, assets, contracts] = await Promise.all([
    ensureNoError(
      supabase.from("ref_roles").select("id, name").eq("name", "Founder").single(),
      "Founder role is missing.",
    ),
    ensureNoError(
      supabase.from("ref_payment_methods").select("id, code").eq("code", "crypto_contract").single(),
      "crypto_contract payment method is missing.",
    ),
    ensureNoError(
      supabase
        .from("ref_payment_statuses")
        .select("id, code")
        .in("code", ["draft", "pending", "awaiting_confirmation", "failed"]),
      "Payment statuses are missing.",
    ),
    ensureNoError(
      supabase
        .from("ref_chains")
        .select("id, display_name, network_key, evm_chain_id")
        .eq("is_active", true)
        .in("network_key", ["ethereum", "base", "celo"]),
      "Supported ref_chains rows are missing.",
    ),
    ensureNoError(
      supabase
        .from("ref_chain_assets")
        .select("id, chain_id, symbol, name, decimals, is_native, is_stablecoin, token_address")
        .eq("is_active", true)
        .order("sort_order"),
      "Active chain assets are missing.",
    ),
    ensureNoError(
      supabase
        .from("chain_intake_contracts")
        .select("id, chain_id, contract_address, treasury_address, abi_version")
        .eq("collection_mode", "contract")
        .eq("is_active", true),
      "Active intake contracts are missing.",
    ),
  ])

  const statusByCode = new Map(statuses.map((status) => [status.code, status.id]))
  const paymentStatuses = {
    draft: statusByCode.get("draft"),
    pending: statusByCode.get("pending"),
    awaiting_confirmation: statusByCode.get("awaiting_confirmation"),
    failed: statusByCode.get("failed"),
  }

  if (Object.values(paymentStatuses).some((value) => typeof value !== "number")) {
    throw new Error("Required payment statuses are not configured.")
  }

  const candidates = contracts.flatMap((contract) => {
    const chain = chains.find((row) => row.id === contract.chain_id)
    if (!chain) {
      return []
    }

    return assets
      .filter((asset) => asset.chain_id === contract.chain_id)
      .map<RouteCandidate>((asset) => ({
        chainId: chain.id,
        chainDisplayName: chain.display_name,
        networkKey: chain.network_key as SupportedNetworkKey,
        evmChainId: chain.evm_chain_id,
        assetId: asset.id,
        assetSymbol: asset.symbol,
        assetName: asset.name,
        assetDecimals: asset.decimals,
        assetIsNative: asset.is_native,
        assetIsStablecoin: asset.is_stablecoin,
        tokenAddress: asset.token_address,
        intakeContractId: contract.id,
        contractAddress: contract.contract_address,
        treasuryAddress: contract.treasury_address,
        abiVersion: contract.abi_version,
      }))
  })

  const routeCandidates = [...candidates].sort((left, right) => {
    const leftScore = Number(left.networkKey === "base") * 8 + Number(left.assetIsStablecoin) * 4 + Number(!left.assetIsNative)
    const rightScore =
      Number(right.networkKey === "base") * 8 + Number(right.assetIsStablecoin) * 4 + Number(!right.assetIsNative)

    if (leftScore !== rightScore) {
      return rightScore - leftScore
    }

    return left.assetId - right.assetId
  })

  if (routeCandidates.length < 2) {
    throw new Error("At least two active chain/asset/intake route combinations are required for Playwright fixtures.")
  }

  return {
    founderRoleId: roles.id,
    cryptoContractMethodId: paymentMethods.id,
    paymentStatuses: paymentStatuses as PaymentStatusRefs,
    routeCandidates,
  }
}

function buildPaymentSeed(projectId: number, routeMethodId: number, statuses: PaymentStatusRefs, paymentIdBase: number) {
  return [
    {
      key: "draftId",
      row: {
        id: paymentIdBase,
        project_id: projectId,
        period_start: "2026-01-01",
        period_end: "2026-01-31",
        revenue: 12000,
        payment_amount: 120,
        payment_percentage: 1,
        payment_method_id: routeMethodId,
        status_id: statuses.draft,
        notes: "E2E draft payment",
      },
    },
    {
      key: "pendingId",
      row: {
        id: paymentIdBase + 1,
        project_id: projectId,
        period_start: "2026-02-01",
        period_end: "2026-02-28",
        revenue: 15000,
        payment_amount: 150,
        payment_percentage: 1,
        payment_method_id: routeMethodId,
        status_id: statuses.pending,
        notes: "E2E pending payment",
      },
    },
    {
      key: "awaitingConfirmingId",
      row: {
        id: paymentIdBase + 2,
        project_id: projectId,
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        revenue: 18000,
        payment_amount: 180,
        payment_percentage: 1,
        payment_method_id: routeMethodId,
        status_id: statuses.awaiting_confirmation,
        notes: "E2E awaiting confirmation payment",
      },
    },
    {
      key: "awaitingSubmittedId",
      row: {
        id: paymentIdBase + 3,
        project_id: projectId,
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        revenue: 20000,
        payment_amount: 200,
        payment_percentage: 1,
        payment_method_id: routeMethodId,
        status_id: statuses.awaiting_confirmation,
        notes: "E2E submitted receipt payment",
      },
    },
    {
      key: "failedId",
      row: {
        id: paymentIdBase + 4,
        project_id: projectId,
        period_start: "2026-05-01",
        period_end: "2026-05-31",
        revenue: 22000,
        payment_amount: 220,
        payment_percentage: 1,
        payment_method_id: routeMethodId,
        status_id: statuses.failed,
        notes: "E2E failed payment",
      },
    },
  ] as const
}

async function createScenarioPayments(
  supabase: SupabaseClient<Database>,
  projectId: number,
  routeMethodId: number,
  statuses: PaymentStatusRefs,
  paymentIdBase: number,
) {
  const seed = buildPaymentSeed(projectId, routeMethodId, statuses, paymentIdBase)
  const inserted = await ensureNoError(
    supabase
      .from("payments")
      .insert(seed.map((entry) => entry.row))
      .select("id"),
    "Could not insert e2e payments.",
  )

  return {
    draftId: inserted[0].id,
    pendingId: inserted[1].id,
    awaitingConfirmingId: inserted[2].id,
    awaitingSubmittedId: inserted[3].id,
    failedId: inserted[4].id,
  }
}

function buildOnchainSubmissionRow(input: {
  id: number
  route: RouteCandidate
  paymentId: number
  projectId: number
  paymentMethodId: number
  amountDecimal: number
  amountRaw: string
  periodId: number
  txHash: string
  walletAddress: string
  status: "submitted" | "confirming" | "failed"
  confirmationCount: number
  failureCode?: string
  failureReason?: string
}) {
  return {
    id: input.id,
    payment_id: input.paymentId,
    project_id: input.projectId,
    payment_method_id: input.paymentMethodId,
    chain_id: input.route.chainId,
    chain_asset_id: input.route.assetId,
    intake_contract_id: input.route.intakeContractId,
    chain_network_key: input.route.networkKey,
    intake_contract_address: input.route.contractAddress,
    intake_treasury_address: input.route.treasuryAddress,
    intake_abi_version: input.route.abiVersion,
    asset_token_address: input.route.tokenAddress,
    asset_is_native: input.route.assetIsNative,
    wallet_address: input.walletAddress,
    tx_hash: input.txHash,
    amount_raw: input.amountRaw,
    amount_decimal: input.amountDecimal,
    period_id: input.periodId,
    status: input.status,
    confirmation_count: input.confirmationCount,
    failure_code: input.failureCode ?? null,
    failure_reason: input.failureReason ?? null,
    receipt: null as Json,
    metadata: {
      source: "playwright_fixture",
    } satisfies Json,
  }
}

export async function createProjectPaymentsFixture(
  input: E2EFixtureClientInput & { scenario: FixtureScenario },
): Promise<ProjectPaymentsFixture> {
  const supabase = createE2EClient(input)
  const refs = await loadReferenceData(supabase)
  const [primaryRoute, secondaryRoute] = refs.routeCandidates
  const runId = buildRunId(input.scenario)
  const idBase = buildFixtureIdBase(runId)
  const email = `${runId}@fundloop-e2e.test`
  const password = `FundLoop!${randomUUID().replace(/-/g, "").slice(0, 12)}`
  const user = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      source: "playwright_e2e",
      run_id: runId,
    },
  })

  if (user.error || !user.data.user) {
    throw new Error(user.error?.message ?? "Could not create the e2e auth user.")
  }

  const userId = user.data.user.id

  await ensureMutation(
    supabase.from("users").upsert(
      {
        user_id: userId,
        email,
        full_name: `Playwright ${runId}`,
        display_name: `Playwright ${runId}`,
        status: "active",
      },
      { onConflict: "user_id" },
    ),
    "Could not prepare the e2e public user row.",
  )

  const organization = await ensureNoError(
    supabase
      .from("organizations")
      .insert({
        id: idBase + 1,
        name: `Playwright Org ${runId}`,
        description: "Generated for remote-safe Playwright coverage.",
        website: `https://${runId}.example.test`,
        status: "active",
      })
      .select("id")
      .single(),
    "Could not create the e2e organization.",
  )

  await ensureMutation(
    supabase.from("organization_members").insert({
      organization_id: organization.id,
      role_id: refs.founderRoleId,
      status: "active",
      user_id: userId,
    }),
    "Could not create the e2e organization membership.",
  )

  const projectSlug = runId.replace(/[^a-z0-9-]/g, "-").toLowerCase().slice(0, 48)
  const project = await ensureNoError(
    supabase
      .from("projects")
      .insert({
        id: idBase + 2,
        name: `Playwright Project ${runId}`,
        slug: projectSlug,
        description: "Generated for wallet and payments Playwright coverage.",
        detailed_description: "Generated for wallet and payments Playwright coverage.",
        website: `https://${projectSlug}.example.test`,
        email,
        billing_email: email,
        organization_id: organization.id,
        payment_percentage: 1,
        status: "active",
        is_public: false,
        default_payment_method_id: refs.cryptoContractMethodId,
      })
      .select("id, slug, name")
      .single(),
    "Could not create the e2e project.",
  )

  await ensureMutation(
    supabase.from("participants").insert({
      project_id: project.id,
      user_id: userId,
      is_admin: true,
    }),
    "Could not create the e2e project participant.",
  )

  const paymentMethods = await ensureNoError(
    supabase
      .from("payment_methods")
      .insert([
        {
          id: idBase + 10,
          project_id: project.id,
          method_id: refs.cryptoContractMethodId,
          collection_mode: "contract",
          chain_id: primaryRoute.chainId,
          chain_asset_id: primaryRoute.assetId,
          intake_contract_id: primaryRoute.intakeContractId,
          label: `${runId} ${primaryRoute.chainDisplayName} ${primaryRoute.assetSymbol}`,
          is_default: true,
          is_enabled: true,
          sort_order: 1,
          details: { source: "playwright_fixture" } satisfies Json,
        },
        {
          id: idBase + 11,
          project_id: project.id,
          method_id: refs.cryptoContractMethodId,
          collection_mode: "contract",
          chain_id: secondaryRoute.chainId,
          chain_asset_id: secondaryRoute.assetId,
          intake_contract_id: secondaryRoute.intakeContractId,
          label: `${runId} ${secondaryRoute.chainDisplayName} ${secondaryRoute.assetSymbol}`,
          is_default: false,
          is_enabled: true,
          sort_order: 2,
          details: { source: "playwright_fixture" } satisfies Json,
        },
      ])
      .select("id")
      .order("sort_order"),
    "Could not create the e2e crypto routes.",
  )

  const payments = await createScenarioPayments(
    supabase,
    project.id,
    refs.cryptoContractMethodId,
    refs.paymentStatuses,
    idBase + 20,
  )
  const walletAddress = uniqueHexHash(`${runId}-wallet`).slice(0, 42)

  await ensureMutation(
    supabase.from("onchain_payment_submissions").insert([
      buildOnchainSubmissionRow({
        id: idBase + 30,
        route: primaryRoute,
        paymentId: payments.awaitingConfirmingId,
        projectId: project.id,
        paymentMethodId: paymentMethods[0].id,
        amountDecimal: 180,
        amountRaw: "180000000",
        periodId: 3,
        txHash: uniqueHexHash(`${runId}-confirming`),
        walletAddress,
        status: "confirming",
        confirmationCount: 3,
      }),
      buildOnchainSubmissionRow({
        id: idBase + 31,
        route: primaryRoute,
        paymentId: payments.awaitingSubmittedId,
        projectId: project.id,
        paymentMethodId: paymentMethods[0].id,
        amountDecimal: 200,
        amountRaw: "200000000",
        periodId: 4,
        txHash: uniqueHexHash(`${runId}-submitted`),
        walletAddress,
        status: "submitted",
        confirmationCount: 0,
      }),
      buildOnchainSubmissionRow({
        id: idBase + 32,
        route: secondaryRoute,
        paymentId: payments.failedId,
        projectId: project.id,
        paymentMethodId: paymentMethods[1].id,
        amountDecimal: 220,
        amountRaw: secondaryRoute.assetIsStablecoin ? "220000000" : "220000000000000000000",
        periodId: 5,
        txHash: uniqueHexHash(`${runId}-failed`),
        walletAddress,
        status: "failed",
        confirmationCount: 0,
        failureCode: "fixture_failed",
        failureReason: "Fixture seeded a failed reconciliation result for retry coverage.",
      }),
    ]),
    "Could not create the e2e onchain submissions.",
  )

  return {
    runId,
    user: {
      id: userId,
      email,
      password,
    },
    project: {
      id: project.id,
      slug: project.slug ?? projectSlug,
      name: project.name,
    },
    routes: {
      primary: {
        ...primaryRoute,
        paymentMethodId: paymentMethods[0].id,
      },
      secondary: {
        ...secondaryRoute,
        paymentMethodId: paymentMethods[1].id,
      },
      available: refs.routeCandidates,
    },
    payments,
    cleanup: async () => {
      await supabase.from("onchain_payment_submissions").delete().eq("project_id", project.id)
      await supabase.from("payments").delete().eq("project_id", project.id)
      await supabase.from("payment_methods").delete().eq("project_id", project.id)
      await supabase.from("participants").delete().eq("project_id", project.id)
      await supabase.from("projects").delete().eq("id", project.id)
      await supabase.from("organization_members").delete().eq("organization_id", organization.id)
      await supabase.from("organizations").delete().eq("id", organization.id)
      await supabase.from("users").delete().eq("user_id", userId)
      await supabase.auth.admin.deleteUser(userId)
    },
  }
}
