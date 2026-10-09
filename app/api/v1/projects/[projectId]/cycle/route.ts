import { getPublicProjectCycle } from "@/lib/api/v1/public-projects"
import { apiData, apiError, requestId } from "@/lib/api/v1/response"

// GET /api/v1/projects/{projectId}/cycle — public, no token (#266).
// projectId is the project's slug, as returned by /api/v1/projects; a numeric id also resolves.
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const id = requestId()
  const { projectId } = await context.params
  if (!projectId || projectId.length > 200) {
    return apiError("validation_failed", "projectId is required.", { details: { projectId: "required" }, requestId: id })
  }

  try {
    const result = await getPublicProjectCycle(projectId)
    if (!result.ok) {
      if (result.reason === "not_found") {
        return apiError("not_found", "No public project matches that id.", { requestId: id })
      }
      return apiError("internal_error", "Cycle status could not be read.", { requestId: id })
    }
    // A public project with no closed cycle yet is a valid answer, not a 404.
    return apiData(result.cycle, { requestId: id })
  } catch {
    return apiError("internal_error", "Cycle status could not be read.", { requestId: id })
  }
}
