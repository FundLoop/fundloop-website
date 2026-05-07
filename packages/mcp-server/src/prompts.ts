import type { McpPromptDefinition, McpPromptGetResult } from "./protocol.ts"

export type McpPromptHandler = (args: Record<string, unknown>) => McpPromptGetResult | Promise<McpPromptGetResult>

export type McpRegisteredPrompt = {
  definition: McpPromptDefinition
  handler: McpPromptHandler
}

function readString(args: Record<string, unknown>, key: string) {
  return typeof args[key] === "string" && args[key].trim() ? args[key].trim() : null
}

function userMessage(text: string): McpPromptGetResult["messages"][number] {
  return {
    role: "user",
    content: {
      type: "text",
      text,
    },
  }
}

export class McpPromptRegistry {
  private readonly prompts = new Map<string, McpRegisteredPrompt>()

  register(prompt: McpRegisteredPrompt) {
    if (this.prompts.has(prompt.definition.name)) {
      throw new Error(`MCP prompt ${prompt.definition.name} is already registered.`)
    }

    this.prompts.set(prompt.definition.name, prompt)
  }

  list(): McpPromptDefinition[] {
    return [...this.prompts.values()].map((prompt) => prompt.definition)
  }

  async get(name: string, args: Record<string, unknown>): Promise<McpPromptGetResult | { isError: true; errorCode: string; message: string }> {
    const prompt = this.prompts.get(name)
    if (!prompt) {
      return {
        isError: true,
        errorCode: "prompt_not_found",
        message: `Unknown prompt: ${name}`,
      }
    }

    try {
      return await prompt.handler(args)
    } catch {
      return {
        isError: true,
        errorCode: "prompt_failed",
        message: "MCP prompt generation failed.",
      }
    }
  }
}

export function createBaseMcpPromptRegistry() {
  const registry = new McpPromptRegistry()

  registry.register({
    definition: {
      name: "create-funding-update",
      title: "Create Funding Update",
      description: "Draft a founder-facing funding update from project and cycle status.",
      arguments: [
        { name: "projectSlug", description: "Project slug to summarize.", required: true },
        { name: "cycleKey", description: "Optional monthly cycle key in YYYY-MM format." },
      ],
      argsSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          cycleKey: { type: "string", format: "cycle_key" },
        },
        required: ["projectSlug"],
        additionalProperties: false,
      },
    },
    handler(args) {
      const projectSlug = readString(args, "projectSlug") ?? "[project-slug]"
      const cycleKey = readString(args, "cycleKey")
      return {
        description: "Use safe founder read tools to draft a concise funding update.",
        messages: [
          userMessage(
            [
              `Draft a concise funding update for project \`${projectSlug}\`${cycleKey ? ` and cycle \`${cycleKey}\`` : ""}.`,
              "First call `founder.project.cycle_status` for the project and selected cycle if provided.",
              "Use only returned MCP data and user-provided context; do not invent revenue, contribution, or payout figures.",
              "Include: current contribution readiness, route/payment blockers, next actions, and one short founder-friendly summary paragraph.",
            ].join("\n"),
          ),
        ],
      }
    },
  })

  registry.register({
    definition: {
      name: "summarize-project-status",
      title: "Summarize Project Status",
      description: "Summarize a project's current founder/member reporting status.",
      arguments: [
        { name: "projectSlug", description: "Project slug to summarize.", required: true },
        { name: "cycleKey", description: "Optional monthly cycle key in YYYY-MM format." },
      ],
      argsSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          cycleKey: { type: "string", format: "cycle_key" },
        },
        required: ["projectSlug"],
        additionalProperties: false,
      },
    },
    handler(args) {
      const projectSlug = readString(args, "projectSlug") ?? "[project-slug]"
      const cycleKey = readString(args, "cycleKey")
      return {
        description: "Use safe read-only project tools to prepare a project status brief.",
        messages: [
          userMessage(
            [
              `Summarize project \`${projectSlug}\`${cycleKey ? ` for cycle \`${cycleKey}\`` : ""}.`,
              "Use `founder.project.cycle_status` and, if relevant, `project_member.project.reporting_status`.",
              "Separate observed facts from recommended next actions.",
              "Do not include private artifact bodies, signed URLs, raw manifests, or secret identifiers.",
            ].join("\n"),
          ),
        ],
      }
    },
  })

  registry.register({
    definition: {
      name: "prepare-investor-follow-up",
      title: "Prepare Investor Follow-Up",
      description: "Prepare a short founder follow-up note grounded in MCP-visible project status.",
      arguments: [{ name: "projectSlug", description: "Project slug to prepare follow-up for.", required: true }],
      argsSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
        },
        required: ["projectSlug"],
        additionalProperties: false,
      },
    },
    handler(args) {
      const projectSlug = readString(args, "projectSlug") ?? "[project-slug]"
      return {
        description: "Prepare a grounded, non-hype founder follow-up note.",
        messages: [
          userMessage(
            [
              `Prepare a short investor or supporter follow-up for project \`${projectSlug}\`.`,
              "Call `founder.project.cycle_status` first and use only MCP-visible data plus user-provided facts.",
              "Keep it concrete: current status, credible progress, blockers, and one explicit ask.",
              "Do not imply commitments, payouts, or financial performance that were not returned by tools.",
            ].join("\n"),
          ),
        ],
      }
    },
  })

  registry.register({
    definition: {
      name: "review-pending-tasks",
      title: "Review Pending Tasks",
      description: "Review user/founder/operator next actions from safe MCP summaries.",
      arguments: [{ name: "projectSlug", description: "Optional founder project slug." }],
      argsSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
        },
        additionalProperties: false,
      },
    },
    handler(args) {
      const projectSlug = readString(args, "projectSlug")
      return {
        description: "Collect safe next actions without changing product state.",
        messages: [
          userMessage(
            [
              "Review pending FundLoop tasks for the authenticated actor.",
              "Start with `user.workspace.summary` and `user.payout.routes.list`.",
              projectSlug ? `Also call \`founder.project.cycle_status\` for \`${projectSlug}\`.` : "If the actor manages projects, call `founder.projects.list` before choosing project-specific reads.",
              "Return a short prioritized checklist. Do not call mutating tools unless the user explicitly asks for a specific action.",
            ].join("\n"),
          ),
        ],
      }
    },
  })

  return registry
}
