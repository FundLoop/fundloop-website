import { oauthErrorResponse } from "@/lib/oauth/errors"
import { authenticateConfidentialClient, findEnabledClient, revokeByToken } from "@/lib/oauth/store"

// POST /oauth/revoke — RFC 7009 (#266 stage 2).
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let form: URLSearchParams
  try {
    form = new URLSearchParams(await request.text())
  } catch {
    return oauthErrorResponse("invalid_request", "The request body must be application/x-www-form-urlencoded.")
  }

  const clientId = form.get("client_id")
  if (!clientId) return oauthErrorResponse("invalid_client", "Client authentication failed.")

  const client = await findEnabledClient(clientId)
  if (!client || !(await authenticateConfidentialClient(client, form.get("client_secret")))) {
    return oauthErrorResponse("invalid_client", "Client authentication failed.")
  }

  const token = form.get("token")
  if (!token) return oauthErrorResponse("invalid_request", "token is required.")

  await revokeByToken(token)

  // §2.2: an unknown token is still a success, so this endpoint cannot be used to test whether a
  // token exists. Revoking either token of a pair revokes the grant's tokens, which is stricter
  // than the SHOULD in §2.1 and the behaviour a person expects from "disconnect this app".
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } })
}

export async function GET() {
  return oauthErrorResponse("invalid_request", "The revocation endpoint accepts POST only.", { status: 405, headers: { Allow: "POST" } })
}
