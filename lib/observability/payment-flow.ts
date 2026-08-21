import { z } from "zod"
import type { Json } from "../../types/supabase.ts"

export const PAYMENT_FLOWS = [
  "wallet_connect",
  "payment_save",
  "receipt_recording",
  "admin_confirmation",
  "admin_reconciliation",
] as const

export const PAYMENT_FLOW_OUTCOMES = ["attempt", "success", "failure"] as const
export const PAYMENT_FLOW_SEVERITIES = ["info", "warning", "error"] as const
export const PAYMENT_FLOW_ACTOR_ROLES = [
  "unauthenticated",
  "authenticated_user",
  "project_admin",
  "internal_admin",
  "system",
] as const
export const PAYMENT_FLOW_STAGES = [
  "cta_click",
  "runtime_blocked",
  "modal_open",
  "connected",
  "timeout",
  "validation",
  "submit",
  "chain_switch",
  "approval",
  "deposit",
  "submission_record",
] as const

export type PaymentFlow = (typeof PAYMENT_FLOWS)[number]
export type PaymentFlowOutcome = (typeof PAYMENT_FLOW_OUTCOMES)[number]
export type PaymentFlowSeverity = (typeof PAYMENT_FLOW_SEVERITIES)[number]
export type PaymentFlowActorRole = (typeof PAYMENT_FLOW_ACTOR_ROLES)[number]
export type PaymentFlowStage = (typeof PAYMENT_FLOW_STAGES)[number]

const paymentFlowSchema = z.enum(PAYMENT_FLOWS)
const paymentFlowOutcomeSchema = z.enum(PAYMENT_FLOW_OUTCOMES)
const paymentFlowSeveritySchema = z.enum(PAYMENT_FLOW_SEVERITIES)
const paymentFlowActorRoleSchema = z.enum(PAYMENT_FLOW_ACTOR_ROLES)
const paymentFlowStageSchema = z.enum(PAYMENT_FLOW_STAGES)

const FLOW_STAGE_MAP: Record<PaymentFlow, readonly PaymentFlowStage[]> = {
  wallet_connect: ["cta_click", "runtime_blocked", "modal_open", "connected", "timeout"],
  payment_save: ["validation", "submit"],
  receipt_recording: ["runtime_blocked", "chain_switch", "approval", "deposit", "submission_record"],
  admin_confirmation: ["submit"],
  admin_reconciliation: ["submit"],
}

const MAX_METADATA_DEPTH = 3
const MAX_METADATA_KEYS = 20
const MAX_METADATA_ARRAY_ITEMS = 20
const MAX_STRING_LENGTH = 300

function truncateString(value: string) {
  return value.length <= MAX_STRING_LENGTH ? value : `${value.slice(0, MAX_STRING_LENGTH - 1)}…`
}

function sanitizeJsonValue(value: unknown, depth = 0): Json | undefined {
  if (value === null) {
    return null
  }

  if (typeof value === "string") {
    return truncateString(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (typeof value === "bigint") {
    return truncateString(value.toString())
  }

  if (depth >= MAX_METADATA_DEPTH) {
    return truncateString(JSON.stringify(value))
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_ARRAY_ITEMS).map((item) => sanitizeJsonValue(item, depth + 1) ?? null)
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_METADATA_KEYS)
      .flatMap(([key, entry]) => {
        const sanitized = sanitizeJsonValue(entry, depth + 1)
        return sanitized === undefined ? [] : [[truncateString(key), sanitized] as const]
      })

    return Object.fromEntries(entries)
  }

  return undefined
}

export function sanitizePaymentFlowMetadata(value: unknown): Json {
  return (sanitizeJsonValue(value) ?? {}) as Json
}

export type PaymentFlowEventInput = {
  flow: PaymentFlow
  stage: PaymentFlowStage
  outcome: PaymentFlowOutcome
  severity?: PaymentFlowSeverity
  attemptId: string
  actorUserId?: string | null
  actorRole?: PaymentFlowActorRole
  projectId?: number | null
  paymentId?: number | null
  submissionId?: number | null
  paymentMethodId?: number | null
  chainId?: number | null
  chainAssetId?: number | null
  intakeContractId?: number | null
  txHash?: string | null
  walletAddress?: string | null
  environment: "local" | "preview" | "production"
  errorCode?: string | null
  errorMessage?: string | null
  metadata?: unknown
}

const basePaymentFlowEventSchema = z.object({
  flow: paymentFlowSchema,
  stage: paymentFlowStageSchema,
  outcome: paymentFlowOutcomeSchema,
  severity: paymentFlowSeveritySchema.default("info"),
  attemptId: z.string().trim().min(1).max(120),
  actorUserId: z.string().trim().min(1).max(120).nullable().optional(),
  actorRole: paymentFlowActorRoleSchema.optional(),
  projectId: z.number().int().positive().nullable().optional(),
  paymentId: z.number().int().positive().nullable().optional(),
  submissionId: z.number().int().positive().nullable().optional(),
  paymentMethodId: z.number().int().positive().nullable().optional(),
  chainId: z.number().int().positive().nullable().optional(),
  chainAssetId: z.number().int().positive().nullable().optional(),
  intakeContractId: z.number().int().positive().nullable().optional(),
  txHash: z.string().trim().min(1).max(120).nullable().optional(),
  walletAddress: z.string().trim().min(1).max(120).nullable().optional(),
  environment: z.enum(["local", "preview", "production"]),
  errorCode: z.string().trim().min(1).max(120).nullable().optional(),
  errorMessage: z.string().trim().min(1).max(500).nullable().optional(),
  metadata: z.unknown().optional(),
})

export const paymentFlowEventSchema = basePaymentFlowEventSchema.superRefine((value, context) => {
  if (!FLOW_STAGE_MAP[value.flow].includes(value.stage)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Stage ${value.stage} is not allowed for flow ${value.flow}.`,
      path: ["stage"],
    })
  }
})

export const paymentFlowEventBatchSchema = z.union([
  paymentFlowEventSchema,
  z.object({
    events: z.array(paymentFlowEventSchema).min(1).max(10),
  }),
])

export function parsePaymentFlowEventBatch(input: unknown) {
  const parsed = paymentFlowEventBatchSchema.parse(input)
  const events = "events" in parsed ? parsed.events : [parsed]

  return events.map((event) => ({
    ...event,
    metadata: sanitizePaymentFlowMetadata(event.metadata),
  })) satisfies PaymentFlowEventInput[]
}

export function normalizePaymentFlowErrorCode(stage: PaymentFlowStage, error: unknown) {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : ""
  const normalized = message.trim().toLowerCase()

  if (!normalized) {
    return `${stage}_failed`
  }

  if (normalized.includes("not authenticated")) {
    return "not_authenticated"
  }

  if (normalized.includes("do not have") || normalized.includes("permission")) {
    return "forbidden"
  }

  if (normalized.includes("route is not available") || normalized.includes("route unavailable")) {
    return "route_unavailable"
  }

  if (normalized.includes("unresolved onchain submission")) {
    return "submission_unresolved"
  }

  if (normalized.includes("status is not configured")) {
    return "status_not_configured"
  }

  if (normalized.includes("payment not found")) {
    return "payment_not_found"
  }

  if (normalized.includes("reconciliation")) {
    return "requires_reconciliation"
  }

  if (normalized.includes("wallet")) {
    return "wallet_error"
  }

  if (normalized.includes("transaction")) {
    return "transaction_failed"
  }

  if (normalized.includes("validation")) {
    return "validation_failed"
  }

  return `${stage}_failed`
}

export function normalizePaymentFlowErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return truncateString(error.trim())
  }

  if (error instanceof Error) {
    return truncateString(error.message.trim())
  }

  return null
}

export function getAttemptHandle(attemptId: string) {
  return attemptId.slice(0, 8)
}
