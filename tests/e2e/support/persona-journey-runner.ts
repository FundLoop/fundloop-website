import type { CleanupResult, PersonaJourney, PersonaResult } from "../personas/contracts"
import { aggregateStatus, deriveCheckpointResult, writePersonaResult } from "./persona-reporting"

export async function executePersonaJourney(input: {
  journey: PersonaJourney
  outputRoot: string
  runId: string
  cleanup: () => Promise<CleanupResult>
}): Promise<PersonaResult> {
  const startedAt = Date.now()
  const checkpoints: PersonaResult["checkpoints"][number][] = []
  let executionFailed = false

  try {
    for (const checkpoint of input.journey.checkpoints) {
      const checkpointStartedAt = Date.now()
      try {
        const observation = await checkpoint.execute({} as never)
        const result = deriveCheckpointResult(checkpoint, observation, Date.now() - checkpointStartedAt)
        checkpoints.push(result)
        if (result.status === "fail") {
          executionFailed = true
          break
        }
      } catch (error) {
        const candidate = error instanceof Error ? error.message : ""
        const reasonCode = /^[a-z][a-z0-9-]{2,80}$/.test(candidate) ? candidate : "checkpoint-execution-failed"
        checkpoints.push({
          checkpointId: checkpoint.id,
          capabilityId: checkpoint.capabilityId,
          status: "fail",
          durationMs: Date.now() - checkpointStartedAt,
          reasonCode,
          evidence: {},
        })
        executionFailed = true
        break
      }
    }
  } finally {
    const cleanup = await input.cleanup().catch((): CleanupResult => ({
      status: "residual",
      deletedCount: 0,
      residualCount: 1,
      reasonCode: "cleanup-execution-failed",
    }))
    const status = executionFailed || cleanup.status === "residual"
      ? "failed"
      : aggregateStatus(checkpoints.map((checkpoint) => checkpoint.status))
    const result: PersonaResult = {
      personaId: input.journey.id,
      status,
      durationMs: Date.now() - startedAt,
      checkpoints,
      cleanup,
    }
    await writePersonaResult(input.outputRoot, input.runId, result)
    return result
  }
}
