// Client credential parsing, shared by every endpoint that authenticates a requesting client
// (#266 stage 2).
//
// This lives on its own because the discovery document advertises both client_secret_basic and
// client_secret_post for the token endpoint *and* the revocation endpoint: a client that follows
// discovery and sends Basic credentials must be understood by both, or it gets invalid_client from
// one of them for no reason it can see.

export type PresentedClientCredentials = { clientId: string | null; clientSecret: string | null }

export function readClientCredentials(request: Request, form: URLSearchParams): PresentedClientCredentials {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8")
      const separator = decoded.indexOf(":")
      if (separator > 0) {
        // RFC 6749 §2.3.1: both halves are form-urlencoded before base64.
        return {
          clientId: decodeURIComponent(decoded.slice(0, separator)),
          clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
        }
      }
    } catch {
      return { clientId: null, clientSecret: null }
    }
    return { clientId: null, clientSecret: null }
  }
  return { clientId: form.get("client_id"), clientSecret: form.get("client_secret") }
}
