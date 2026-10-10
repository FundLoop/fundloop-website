import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

// Disconnecting a Cubid identity from a FundLoop account (#275, stage 2c UI).
//
// A typed Edge Function command rather than a route handler, deliberately. The recorded exception in
// `docs/engineering/sign-in-with-cubid.md` covers the OIDC callback only — it exists because
// establishing a session means setting cookies on the Next response — and disconnecting has no
// cookie semantics at all. It is an ordinary authenticated mutation, so it belongs on the command
// boundary AGENTS.md §3.2 asks for.

export const CUBID_IDENTITY_DISCONNECT_FUNCTION = "cubid-identity-disconnect"

/** No input beyond the caller's identity: a person may only disconnect their own. */
export type CubidIdentityDisconnectInput = Record<string, never>

export type CubidIdentityDisconnectOutput = {
  outcome: "unlinked" | "not_linked"
  /** How many requesting clients lost their delegated access with the link. */
  revokedClients: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateCubidIdentityDisconnectInput(input: unknown): EdgeCommandResult<CubidIdentityDisconnectInput> {
  // An empty object or nothing at all. Anything else is a caller that thinks it can name a target,
  // and refusing it is cheaper than explaining why the field is ignored.
  if (input !== undefined && input !== null && (!isObject(input) || Object.keys(input).length > 0)) {
    return edgeCommandFailure("invalid_payload", "This command takes no arguments.")
  }
  return edgeCommandSuccess({} as CubidIdentityDisconnectInput)
}

export function normalizeCubidIdentityDisconnectResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<CubidIdentityDisconnectOutput> {
  if (!result.ok) return result
  if (
    !isObject(result.data) ||
    (result.data.outcome !== "unlinked" && result.data.outcome !== "not_linked") ||
    typeof result.data.revokedClients !== "number"
  ) {
    return edgeCommandFailure("invalid_edge_response", "Disconnecting Cubid returned an invalid response.")
  }
  return edgeCommandSuccess(result.data as CubidIdentityDisconnectOutput)
}
