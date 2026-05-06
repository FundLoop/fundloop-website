import { createMcpAuthContext, type McpAuthContext } from "./auth.ts"

export type RemoteMcpAuthResult =
  | {
      ok: true
      auth: McpAuthContext
    }
  | {
      ok: false
      status: number
      code: string
      message: string
    }

export function createRemoteMcpAuthContext(authorizationHeader: string | null): RemoteMcpAuthResult {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i)
  const bearerToken = match?.[1]?.trim()
  if (!bearerToken) {
    return {
      ok: false,
      status: 401,
      code: "not_authenticated",
      message: "FundLoop MCP requests require a bearer token.",
    }
  }

  return {
    ok: true,
    auth: createMcpAuthContext({ bearerToken }),
  }
}
