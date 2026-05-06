import {
  PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION,
  PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION,
  PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION,
} from "../../../lib/edge-functions/project-payment-operations-contract.ts"
import type { EdgeCommandResult } from "../../../lib/edge-functions/result.ts"
import { errorResult, jsonTextResult } from "./protocol.ts"
import type { McpToolHandlerContext, McpToolRegistry } from "./tools.ts"
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

function deriveCycleStatusNextActions(status: Awaited<ReturnType<FounderWorkflowReader["getProjectCycleStatus"]>>) {
  const actions: string[] = []
  if (status.routes.enabledCount === 0) {
    actions.push("Add an enabled contribution route.")
  }
  if (status.routes.defaultCount === 0) {
    actions.push("Choose a default contribution route.")
  }
  if (status.payments.awaitingConfirmationCount > 0) {
    actions.push("Review payments awaiting confirmation.")
  }
  if (!status.cycle.status) {
    actions.push("Confirm the project is attached to an active monthly cycle.")
  }

  return actions
}

async function edgeCommandToolResult<TOutput>(
  context: McpToolHandlerContext,
  functionName: string,
  input: unknown,
) {
  const result = await context.edge.invoke<unknown, TOutput>(functionName, input, context.auth)
  if (!result.ok) return edgeCommandFailureToolResult(result)
  return jsonTextResult(result)
}

function edgeCommandFailureToolResult(result: Extract<EdgeCommandResult<unknown>, { ok: false }>) {
  return {
    ...errorResult(result.error.message),
    structuredContent: result,
    errorCode: result.error.code,
  }
}

export function registerFounderMcpTools(registry: McpToolRegistry) {
  registry.register({
    definition: {
      name: "founder.projects.list",
      title: "List Founder Projects",
      description: "List projects managed by the authenticated founder or project admin.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          count: { type: "number", integer: true, minimum: 0 },
          projects: { type: "array" },
          emptyState: { type: "string", maxLength: 240 },
        },
        required: ["ok", "count", "projects"],
        additionalProperties: false,
      },
    },
    async handler(_input, context) {
      if (!context.founderReader) {
        return { ...errorResult("Founder workflow reader is not configured."), errorCode: "reader_not_configured" }
      }

      try {
        const projects = (await context.founderReader.listManagedProjects(context.auth)).map((project) => ({
          id: project.id,
          slug: project.slug,
          name: project.name,
          setupStatus: project.setupStatus ?? null,
          nextActions: project.nextActions ?? [],
        }))

        return jsonTextResult({
          ok: true,
          count: projects.length,
          projects,
          ...(projects.length === 0 ? { emptyState: "No managed projects are available for this actor." } : {}),
        })
      } catch {
        return {
          ...errorResult("Founder project list is temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "founder.project.cycle_status",
      title: "Read Founder Project Cycle Status",
      description: "Read monthly contribution, route, and cycle status for one managed founder project.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          cycleKey: { type: "string", format: "cycle_key" },
        },
        required: ["projectSlug"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          project: { type: "object" },
          cycle: { type: "object" },
          payments: { type: "object" },
          routes: { type: "object" },
          nextActions: { type: "array" },
        },
        required: ["ok", "project", "cycle", "payments", "routes", "nextActions"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.founderReader) {
        return { ...errorResult("Founder workflow reader is not configured."), errorCode: "reader_not_configured" }
      }
      const projectSlug = requireProjectSlug(input)
      if (!projectSlug) return { ...errorResult("projectSlug is required."), errorCode: "invalid_payload" }
      const cycleKey = isRecord(input) && typeof input.cycleKey === "string" ? input.cycleKey.trim() : undefined
      try {
        const status = await context.founderReader.getProjectCycleStatus({ projectSlug, cycleKey }, context.auth)
        const nextActions = deriveCycleStatusNextActions(status)

        return jsonTextResult({
          ok: true,
          project: status.project,
          cycle: status.cycle,
          payments: status.payments,
          routes: status.routes,
          nextActions,
        })
      } catch {
        return {
          ...errorResult("Founder project cycle status is temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "founder.project.crypto_route.create",
      title: "Create Founder Crypto Route",
      description: "Create a project crypto payment route through the canonical Edge Function command.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
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
      outputSchema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          data: { type: "object" },
          error: { type: "object" },
        },
        required: ["ok"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      return edgeCommandToolResult(context, PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION, input)
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
