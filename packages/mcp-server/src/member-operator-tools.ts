import { errorResult, jsonTextResult } from "./protocol.ts"
import type {
  OperatorCycleEvent,
  OperatorCycleStatus,
  OperatorReconciliationVisibility,
  OperatorReportingCoverage,
  ProjectMemberReportingStatus,
  UserWorkspaceSummary,
  UserPayoutRoutesList,
} from "./member-operator-readers.ts"
import type { McpToolRegistry } from "./tools.ts"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readOptionalString(input: unknown, key: string) {
  return isRecord(input) && typeof input[key] === "string" && input[key].trim() ? input[key].trim() : undefined
}

function readRequiredString(input: unknown, key: string) {
  return readOptionalString(input, key) ?? null
}

function deriveReportingStatusNextActions(status: ProjectMemberReportingStatus) {
  const actions: string[] = []
  if (!status.cycleKey) {
    actions.push("Confirm the project is attached to an active monthly cycle.")
  }
  if (status.attribution.pendingDatasetCount > 0) {
    actions.push("Review pending attribution datasets.")
  }
  if (status.attribution.approvedDatasetCount === 0) {
    actions.push("Submit or approve attribution data for this cycle.")
  }
  if (status.reports.founderReportCount === 0) {
    actions.push("Wait for founder reporting to be published for this cycle.")
  }

  return actions
}

function summarizeUserWorkspace(summary: UserWorkspaceSummary) {
  return {
    ok: true,
    profileStatus: {
      signedInEmail: summary.profileStatus.signedInEmail,
      cubidIdentityStatus: summary.profileStatus.cubidIdentityStatus,
      cubidScore: summary.profileStatus.cubidScore,
      completionPercent: summary.profileStatus.completionPercent,
      missingItems: summary.profileStatus.missingItems,
      identitySnapshot: summary.profileStatus.identitySnapshot,
    },
    participation: summary.participation,
    results: summary.results,
    payoutReadiness: summary.payoutReadiness,
    discovery: summary.discovery,
    warnings: summary.warnings,
  }
}

function summarizeUserPayoutRoutes(summary: UserPayoutRoutesList) {
  return {
    ok: true,
    summary: summary.summary,
    routes: summary.routes,
    warnings: summary.warnings,
  }
}

function summarizeOperatorCycle(cycle: OperatorCycleStatus) {
  return {
    cycleKey: cycle.cycleKey,
    status: cycle.status,
    lockedAt: cycle.lockedAt,
    calculationStartedAt: cycle.calculationStartedAt,
    distributionStartedAt: cycle.distributionStartedAt,
    reportingPublishedAt: cycle.reportingPublishedAt,
  }
}

function summarizeOperatorCycleEvent(event: OperatorCycleEvent) {
  return {
    cycleKey: event.cycleKey,
    eventType: event.eventType,
    outcome: event.outcome,
    severity: event.severity,
    attemptId: event.attemptId,
    message: typeof event.message === "string" ? event.message.slice(0, 300) : null,
    createdAt: event.createdAt,
  }
}

function deriveReconciliationHealth(input: OperatorReconciliationVisibility) {
  const openQueueCount = input.submitted + input.confirming + input.awaitingConfirmation
  const warningStates: string[] = []
  const nextActions: string[] = []

  if (input.awaitingConfirmation > 0) {
    warningStates.push("awaiting_confirmation_queue")
    nextActions.push("Review onchain submissions awaiting operator confirmation.")
  }
  if (input.confirming > 0 || input.submitted > 0) {
    warningStates.push("pending_chain_confirmation")
    nextActions.push("Let chain confirmation or reconciliation jobs continue before manually confirming payments.")
  }
  if (input.failed > 0) {
    warningStates.push("failed_submissions")
    nextActions.push("Inspect failed onchain submissions in the admin reconciliation console.")
  }
  if (openQueueCount === 0 && input.failed === 0) {
    nextActions.push("No immediate reconciliation action is required.")
  }

  return {
    counts: input,
    openQueueCount,
    warningStates,
    nextActions,
  }
}

function deriveReportingCoverage(input: OperatorReportingCoverage) {
  const counts = {
    publicReports: input.publicReports,
    userReports: input.userReports,
    founderReports: input.founderReports,
    operatorReports: input.operatorReports,
    artifactCount: input.artifactCount,
  }
  const missingAudiences = [
    ...(input.publicReports === 0 ? ["public"] : []),
    ...(input.userReports === 0 ? ["user"] : []),
    ...(input.founderReports === 0 ? ["founder"] : []),
    ...(input.operatorReports === 0 ? ["operator"] : []),
  ]
  const warningStates: string[] = []
  const nextActions: string[] = []

  if (missingAudiences.length > 0) {
    warningStates.push("missing_report_audiences")
    nextActions.push(`Publish or verify missing report audiences: ${missingAudiences.join(", ")}.`)
  }
  if (input.artifactCount === 0) {
    warningStates.push("missing_report_artifacts")
    nextActions.push("Verify that report artifacts were generated and attached before treating coverage as complete.")
  }
  if (warningStates.length === 0) {
    nextActions.push("Reporting coverage is complete for the available audience counts.")
  }

  return {
    cycleKey: input.cycleKey,
    counts,
    missingAudiences,
    warningStates,
    nextActions,
  }
}

export function registerProjectMemberAndOperatorMcpTools(registry: McpToolRegistry) {
  registry.register({
    definition: {
      name: "user.workspace.summary",
      title: "Read User Workspace Summary",
      description: "Read the authenticated user's workspace summary without exposing private identity payloads or payout destinations.",
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
          profileStatus: { type: "object" },
          participation: { type: "object" },
          results: { type: "object" },
          payoutReadiness: { type: "object" },
          discovery: { type: "object" },
          warnings: { type: "array" },
        },
        required: ["ok", "profileStatus", "participation", "results", "payoutReadiness", "discovery", "warnings"],
        additionalProperties: false,
      },
    },
    async handler(_input, context) {
      if (!context.userReader) {
        return { ...errorResult("User workflow reader is not configured."), errorCode: "reader_not_configured" }
      }

      try {
        return jsonTextResult(summarizeUserWorkspace(await context.userReader.getWorkspaceSummary(context.auth)))
      } catch {
        return {
          ...errorResult("User workspace summary is temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "user.payout.routes.list",
      title: "List User Payout Routes",
      description: "List the authenticated user's payout route readiness without exposing payout destinations or provider secrets.",
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
          summary: { type: "object" },
          routes: { type: "array" },
          warnings: { type: "array" },
        },
        required: ["ok", "summary", "routes", "warnings"],
        additionalProperties: false,
      },
    },
    async handler(_input, context) {
      if (!context.userReader) {
        return { ...errorResult("User workflow reader is not configured."), errorCode: "reader_not_configured" }
      }

      try {
        return jsonTextResult(summarizeUserPayoutRoutes(await context.userReader.listPayoutRoutes(context.auth)))
      } catch {
        return {
          ...errorResult("User payout routes are temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "project_member.project.reporting_status",
      title: "Read Project Member Reporting Status",
      description: "Read project reporting and attribution status for a project member visible project.",
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
          projectSlug: { type: "string" },
          cycleKey: { type: ["string", "null"] },
          reports: { type: "object" },
          attribution: { type: "object" },
          nextActions: { type: "array" },
        },
        required: ["ok", "projectSlug", "cycleKey", "reports", "attribution", "nextActions"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.projectMemberReader) {
        return { ...errorResult("Project-member workflow reader is not configured."), errorCode: "reader_not_configured" }
      }
      const projectSlug = readRequiredString(input, "projectSlug")
      if (!projectSlug) return { ...errorResult("projectSlug is required."), errorCode: "invalid_payload" }
      try {
        const status = await context.projectMemberReader.getProjectReportingStatus(
          { projectSlug, cycleKey: readOptionalString(input, "cycleKey") },
          context.auth,
        )

        return jsonTextResult({
          ok: true,
          projectSlug: status.projectSlug,
          cycleKey: status.cycleKey,
          reports: status.reports,
          attribution: status.attribution,
          nextActions: deriveReportingStatusNextActions(status),
        })
      } catch {
        return {
          ...errorResult("Project reporting status is temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "operator.cycles.list",
      title: "List Operator Monthly Cycles",
      description: "List recent monthly cycles and lifecycle statuses for an internal operator.",
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
          cycles: { type: "array" },
          emptyState: { type: "string", maxLength: 240 },
        },
        required: ["ok", "count", "cycles"],
        additionalProperties: false,
      },
    },
    async handler(_input, context) {
      if (!context.operatorReader) {
        return { ...errorResult("Operator workflow reader is not configured."), errorCode: "reader_not_configured" }
      }
      try {
        const cycles = (await context.operatorReader.listCycleStatuses(context.auth)).slice(0, 12).map(summarizeOperatorCycle)

        return jsonTextResult({
          ok: true,
          count: cycles.length,
          cycles,
          ...(cycles.length === 0 ? { emptyState: "No monthly cycles are available to review." } : {}),
        })
      } catch {
        return {
          ...errorResult("Operator monthly cycles are temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "operator.cycle.observability",
      title: "Read Operator Cycle Observability",
      description: "Read monthly-cycle observability events by cycle key or attempt id.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: "object",
        properties: {
          cycleKey: { type: "string", format: "cycle_key" },
          attemptId: { type: "string", format: "attempt_id" },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          count: { type: "number", integer: true, minimum: 0 },
          filters: { type: "object" },
          events: { type: "array" },
          emptyState: { type: "string", maxLength: 240 },
        },
        required: ["ok", "count", "filters", "events"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.operatorReader) {
        return { ...errorResult("Operator workflow reader is not configured."), errorCode: "reader_not_configured" }
      }
      const filters = { cycleKey: readOptionalString(input, "cycleKey") ?? null, attemptId: readOptionalString(input, "attemptId") ?? null }
      try {
        const events = (await context.operatorReader.listCycleEvents(
          {
            cycleKey: filters.cycleKey ?? undefined,
            attemptId: filters.attemptId ?? undefined,
          },
          context.auth,
        ))
          .slice(0, 50)
          .map(summarizeOperatorCycleEvent)

        return jsonTextResult({
          ok: true,
          count: events.length,
          filters,
          events,
          ...(events.length === 0 ? { emptyState: "No monthly-cycle events matched the current filters." } : {}),
        })
      } catch {
        return {
          ...errorResult("Operator cycle observability is temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "operator.payments.reconciliation_visibility",
      title: "Read Operator Payment Reconciliation Visibility",
      description: "Read onchain reconciliation status counts for internal operators.",
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
          counts: { type: "object" },
          openQueueCount: { type: "number", integer: true, minimum: 0 },
          warningStates: { type: "array" },
          nextActions: { type: "array" },
        },
        required: ["ok", "counts", "openQueueCount", "warningStates", "nextActions"],
        additionalProperties: false,
      },
    },
    async handler(_input, context) {
      if (!context.operatorReader) {
        return { ...errorResult("Operator workflow reader is not configured."), errorCode: "reader_not_configured" }
      }
      try {
        return jsonTextResult({
          ok: true,
          ...deriveReconciliationHealth(await context.operatorReader.getReconciliationVisibility(context.auth)),
        })
      } catch {
        return {
          ...errorResult("Operator payment reconciliation visibility is temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "operator.reporting.coverage",
      title: "Read Operator Reporting Coverage",
      description: "Read monthly report publication coverage counts for internal operators.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: "object",
        properties: {
          cycleKey: { type: "string", format: "cycle_key" },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          cycleKey: { type: ["string", "null"] },
          counts: { type: "object" },
          missingAudiences: { type: "array" },
          warningStates: { type: "array" },
          nextActions: { type: "array" },
        },
        required: ["ok", "cycleKey", "counts", "missingAudiences", "warningStates", "nextActions"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.operatorReader) {
        return { ...errorResult("Operator workflow reader is not configured."), errorCode: "reader_not_configured" }
      }
      try {
        return jsonTextResult({
          ok: true,
          ...deriveReportingCoverage(
            await context.operatorReader.getReportingCoverage({ cycleKey: readOptionalString(input, "cycleKey") }, context.auth),
          ),
        })
      } catch {
        return {
          ...errorResult("Operator reporting coverage is temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })
}
