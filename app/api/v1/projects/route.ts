import type { NextRequest } from "next/server"
import { listPublicProjects } from "@/lib/api/v1/public-projects"
import { PUBLIC_READ_CACHE_CONTROL, apiData, apiError, methodNotAllowed, parseLimit, requestId } from "@/lib/api/v1/response"

// GET /api/v1/projects — public, no token (#266). Lists the same projects fundloop.org shows.
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const id = requestId()
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"))
  if (!limit.ok) {
    return apiError("validation_failed", limit.message, { details: { limit: limit.message }, requestId: id })
  }

  const search = request.nextUrl.searchParams.get("search")
  if (search !== null && search.length > 200) {
    return apiError("validation_failed", "search must be at most 200 characters.", {
      details: { search: "must be at most 200 characters" },
      requestId: id,
    })
  }

  try {
    const result = await listPublicProjects({ limit: limit.limit, cursor: request.nextUrl.searchParams.get("cursor"), search })
    if (!result.ok) {
      return apiError("validation_failed", "cursor is not a cursor from a previous response.", {
        details: { cursor: "malformed or from another version of this API" },
        requestId: id,
      })
    }
    return apiData(result.projects, {
      meta: result.meta,
      requestId: id,
      // Identical for every caller, so the edge can absorb repeat traffic on a tokenless endpoint.
      headers: { "Cache-Control": PUBLIC_READ_CACHE_CONTROL },
    })
  } catch {
    return apiError("internal_error", "Projects could not be read.", { requestId: id })
  }
}

export async function POST() {
  return methodNotAllowed(["GET"])
}
