import {
  PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION,
  PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION,
  PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION,
} from "../../../lib/edge-functions/project-payment-operations-contract.ts"
import { errorResult, jsonTextResult } from "./protocol.ts"
import type { McpToolRegistry } from "./tools.ts"
import type { FounderWorkflowReader } from "./founder-reader.ts"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function requireProjectSlug(input: unknown) {
  if (!isRecord(input) || typeof input.projectSlug !== "string" || !input.projectSlug.trim()) {
    return null
  }

  return input.projectSlug.trim()
}

export function registerFounderMcpTools(registry: McpToolRegistry) {
  registry.register({
    definition: {
      name: "founder.projects.list",
      description: "List projects managed by the authenticated founder or project admin.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    async handler(_input, context) {
      if (!context.founderReader) return errorResult("Founder workflow reader is not configured.")
      return jsonTextResult(await context.founderReader.listManagedProjects(context.auth))
    },
  })

  registry.register({
    definition: {
      name: "founder.project.cycle_status",
      description: "Read monthly contribution, route, and cycle status for one managed founder project.",
      inputSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          cycleKey: { type: "string", format: "cycle_key" },
        },
        required: ["projectSlug"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.founderReader) return errorResult("Founder workflow reader is not configured.")
      const projectSlug = requireProjectSlug(input)
      if (!projectSlug) return errorResult("projectSlug is required.")
      const cycleKey = isRecord(input) && typeof input.cycleKey === "string" ? input.cycleKey.trim() : undefined
      return jsonTextResult(await context.founderReader.getProjectCycleStatus({ projectSlug, cycleKey }, context.auth))
    },
  })

  registry.register({
    definition: {
      name: "founder.project.crypto_route.create",
      description: "Create a project crypto payment route through the canonical Edge Function command.",
      inputSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          chainId: { type: "number", integer: true, minimum: 1, maximum: 2_147_483_647 },
          chainAssetId: { type: "number", integer: true, minimum: 1, maximum: 2_147_483_647 },
          intakeContractId: { type: "number", integer: true, minimum: 1, maximum: 2_147_483_647 },
          label: { type: "string", maxLength: 80 },
          isDefault: { type: "boolean" },
        },
        required: ["projectSlug", "chainId", "chainAssetId", "intakeContractId"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      return jsonTextResult(await context.edge.invoke(PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION, input, context.auth))
    },
  })

  registry.register({
    definition: {
      name: "founder.project.crypto_route.update",
      description: "Update a project crypto payment route through the canonical Edge Function command.",
      inputSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          paymentMethodId: { type: "number", integer: true, minimum: 1, maximum: 2_147_483_647 },
          label: { type: "string", maxLength: 80 },
          isDefault: { type: "boolean" },
        },
        required: ["projectSlug", "paymentMethodId"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      return jsonTextResult(await context.edge.invoke(PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION, input, context.auth))
    },
  })

  registry.register({
    definition: {
      name: "founder.project.onchain_receipt.record",
      description: "Record a founder onchain payment receipt through the canonical Edge Function command.",
      inputSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          paymentId: { type: "number", integer: true, minimum: 1, maximum: 2_147_483_647 },
          paymentMethodId: { type: "number", integer: true, minimum: 1, maximum: 2_147_483_647 },
          txHash: { type: "string", format: "tx_hash" },
          walletAddress: { type: "string", format: "wallet_address" },
          amount: { type: "string", minLength: 1, maxLength: 80, pattern: "^\\d+(\\.\\d+)?$" },
          attemptId: { type: "string", format: "attempt_id" },
        },
        required: ["projectSlug", "paymentId", "paymentMethodId", "txHash"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      return jsonTextResult(await context.edge.invoke(PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION, input, context.auth))
    },
  })
}
