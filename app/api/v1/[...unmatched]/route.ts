import { apiError, requestId } from "@/lib/api/v1/response"

// Anything under /api/v1 that no route claims (#266). Without this, an unknown path answers with
// Next's HTML 404, so a client that only ever parses the JSON envelope would fail on the error it is
// most likely to hit first: a typo in a path.
export const dynamic = "force-dynamic"

function unknownEndpoint() {
  return apiError("not_found", "No such endpoint. See /api/v1/openapi.json for the current surface.", { requestId: requestId() })
}

export const GET = unknownEndpoint
export const POST = unknownEndpoint
export const PUT = unknownEndpoint
export const PATCH = unknownEndpoint
export const DELETE = unknownEndpoint
