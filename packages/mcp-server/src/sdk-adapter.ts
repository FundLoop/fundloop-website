import { z } from "zod"
import type { McpToolDefinition } from "./protocol.ts"
import type { McpToolHandlerContext, McpToolRegistry } from "./tools.ts"

export type SdkMcpServerLike = {
  registerTool(
    name: string,
    config: {
      title?: string
      description?: string
      inputSchema?: z.ZodType
    },
    handler: (args: unknown) => Promise<unknown> | unknown,
  ): unknown
}

function zodForProperty(property: NonNullable<McpToolDefinition["inputSchema"]["properties"]>[string]) {
  if (property.type === "string") return z.string()
  if (property.type === "number") return z.number()
  if (property.type === "boolean") return z.boolean()
  if (property.type === "object") return z.record(z.string(), z.unknown())
  return z.unknown()
}

export function mcpInputSchemaToZod(definition: McpToolDefinition) {
  const properties = definition.inputSchema.properties ?? {}
  const required = new Set(definition.inputSchema.required ?? [])
  const shape: Record<string, z.ZodType> = {}

  for (const [key, property] of Object.entries(properties)) {
    const schema = zodForProperty(property)
    shape[key] = required.has(key) ? schema : schema.optional()
  }

  const objectSchema = z.object(shape)
  return definition.inputSchema.additionalProperties === false ? objectSchema.strict() : objectSchema.passthrough()
}

export function registerRegistryToolsWithSdkServer(
  server: SdkMcpServerLike,
  registry: McpToolRegistry,
  context: McpToolHandlerContext,
) {
  for (const definition of registry.list()) {
    server.registerTool(
      definition.name,
      {
        title: definition.name,
        description: definition.description,
        inputSchema: mcpInputSchemaToZod(definition),
      },
      async (args) => registry.call(definition.name, args, context),
    )
  }
}
