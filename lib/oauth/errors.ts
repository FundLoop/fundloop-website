// OAuth error responses (#266 stage 2).
//
// These endpoints answer in the OAuth vocabulary, not the /api/v1 envelope: a third-party OAuth
// library parses `error` and `error_description` from RFC 6749 §5.2, and wrapping that in our own
// shape would break every standard client.

export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "access_denied"
  | "unsupported_response_type"
  | "server_error"
  | "temporarily_unavailable"

// RFC 6749 §5.2: invalid_client is 401, everything else in a token response is 400, except our own
// failures. A description must stay generic enough not to confirm which half of a credential pair
// was wrong.
const STATUS_BY_CODE: Record<OAuthErrorCode, number> = {
  invalid_request: 400,
  invalid_client: 401,
  invalid_grant: 400,
  unauthorized_client: 400,
  unsupported_grant_type: 400,
  invalid_scope: 400,
  access_denied: 400,
  unsupported_response_type: 400,
  server_error: 500,
  temporarily_unavailable: 503,
}

function noStoreHeaders(extra?: Record<string, string>): Record<string, string> {
  // RFC 6749 §5.1: a token response must never be cached, and the same applies to its errors.
  return { "Cache-Control": "no-store", Pragma: "no-cache", ...extra }
}

export function oauthErrorResponse(
  code: OAuthErrorCode,
  description: string,
  options?: { status?: number; headers?: Record<string, string>; errorUri?: string },
) {
  const body: Record<string, string> = { error: code, error_description: description }
  if (options?.errorUri) body.error_uri = options.errorUri
  const headers = noStoreHeaders(options?.headers)
  // A 401 on the token endpoint must say how to authenticate, per RFC 6749 §5.2.
  if ((options?.status ?? STATUS_BY_CODE[code]) === 401 && !headers["WWW-Authenticate"]) {
    headers["WWW-Authenticate"] = 'Basic realm="fundloop", charset="UTF-8"'
  }
  return Response.json(body, { status: options?.status ?? STATUS_BY_CODE[code], headers })
}

export function oauthTokenResponse(payload: {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  scope: string
}) {
  return Response.json(payload, { status: 200, headers: noStoreHeaders() })
}
