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
  if (property.type === "string") {
    let schema = z.string()
    if (property.minLength !== undefined) schema = schema.min(property.minLength)
    if (property.maxLength !== undefined) schema = schema.max(property.maxLength)
    if (property.pattern) schema = schema.regex(new RegExp(property.pattern))
    if (property.enum) schema = schema.refine((value) => property.enum?.includes(value), "Unsupported value.")
    return schema
  }
  if (property.type === "number") {
    let schema = z.number()
    if (property.integer) schema = schema.int()
    if (property.minimum !== undefined) schema = schema.min(property.minimum)
    if (property.maximum !== undefined) schema = schema.max(property.maximum)
    return schema
  }
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
