import { edgeCommandFailure } from "./result.ts"

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization,apikey,content-type",
}

export function commandFailure(code: string, message: string, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(edgeCommandFailure(code, message)), {
    status,
    headers: { ...corsHeaders, ...(headers ?? {}) },
  })
}

export async function handleRequest(
  request: Request,
  authenticate: (request: Request) => Promise<any>,
  handle: (auth: any) => Promise<Response>,
) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const authorization = request.headers.get("authorization")
  if (!authorization || !/^Bearer[ \t]+[A-Za-z0-9\-._~+/]+=*$/i.test(authorization)) {
    return commandFailure("not_authenticated", "User not authenticated.", 401)
  }
  let auth
  try {
    auth = await authenticate(request)
  } catch {
    return commandFailure("authentication_failed", "Authentication could not be completed.", 500)
  }
  if (!auth.ok || !auth.user) {
    const code = auth.code ?? "authentication_failed"
    const message = code === "not_authenticated" ? "User not authenticated." : "Authentication could not be completed."
    return commandFailure(code, message, code === "not_authenticated" ? 401 : 500)
  }
  if (request.method !== "POST") return commandFailure("method_not_allowed", "POST required.", 405, { Allow: "POST" })
  return handle(auth)
}
