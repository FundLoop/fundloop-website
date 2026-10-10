import { readClientCredentials } from "@/lib/oauth/client-auth"
import { oauthErrorResponse } from "@/lib/oauth/errors"
import { authenticateClient, findRequestingClient, revokeByToken } from "@/lib/oauth/store"

// POST /oauth/revoke — RFC 7009 (#266 stage 2).
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let form: URLSearchParams
  try {
    form = new URLSearchParams(await request.text())
  } catch {
    return oauthErrorResponse("invalid_request", "The request body must be application/x-www-form-urlencoded.")
  }

  // Basic as well as form credentials, because the discovery document advertises both for this
  // endpoint and a client that follows discovery would otherwise be refused.
  const { clientId, clientSecret } = readClientCredentials(request, form)
  if (!clientId) return oauthErrorResponse("invalid_client", "Client authentication failed.")

  const client = await findRequestingClient(clientId)
  if (!client || !authenticateClient(client, clientSecret)) {
    return oauthErrorResponse("invalid_client", "Client authentication failed.")
  }

  const token = form.get("token")
  if (!token) return oauthErrorResponse("invalid_request", "token is required.")

  // §2.1: the token must have been issued to the client presenting it. Without that, any
  // registered client that learned another's token could disconnect that client's grant.
  await revokeByToken(token, client.client_id)

  // §2.2: an unknown token is still a success, so this endpoint cannot be used to test whether a
  // token exists — and a token belonging to another client is treated exactly like an unknown one,
  // so it cannot be used to probe for one either.
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } })
}

export async function GET() {
  return oauthErrorResponse("invalid_request", "The revocation endpoint accepts POST only.", { status: 405, headers: { Allow: "POST" } })
}
