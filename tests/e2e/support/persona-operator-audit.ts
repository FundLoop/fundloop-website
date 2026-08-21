import type { Json } from "../../../types/supabase"

export const PERSONA_REQUIRED_INPUT_OVERRIDE_REASON = "Ignore unrelated canonical seed commitments for this run-owned local cycle."

type OperatorCycleEvent = {
  actor_user_id: string | null
  attempt_id: string
  event_type: string
  message: string | null
  metadata: Json
  outcome: string
}

type RecordedCycleOverride = {
  locked_manifest: Json
  lock_override_reason: string | null
}

function objectMetadata(value: Json): Record<string, Json | undefined> | null {
  return value !== null && !Array.isArray(value) && typeof value === "object" ? value : null
}

function stableJson(value: Json | undefined): string {
  if (value === undefined) return "undefined"
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export function assertSupportedRequiredInputOverrideFailure(input: {
  cycle: RecordedCycleOverride
  events: OperatorCycleEvent[]
  operatorUserId: string
}) {
  const failures = input.events.filter((event) => event.outcome === "failure")
  if (failures.length === 0) return
  if (failures.length !== 1) throw new Error("persona-operator-event-failure")

  const failure = failures[0]
  const failureMetadata = objectMetadata(failure.metadata)
  const blockers = failureMetadata?.blockers
  const manifest = objectMetadata(input.cycle.locked_manifest)
  const recordedOverride = objectMetadata(manifest?.override ?? null)
  if (
    failure.event_type !== "lock_failure"
    || failure.actor_user_id !== input.operatorUserId
    || failure.message !== "Required MVP monthly-cycle inputs block the lock."
    || !Array.isArray(blockers)
    || blockers.length === 0
    || recordedOverride?.required_inputs !== true
    || recordedOverride?.reason !== PERSONA_REQUIRED_INPUT_OVERRIDE_REASON
    || input.cycle.lock_override_reason !== PERSONA_REQUIRED_INPUT_OVERRIDE_REASON
  ) {
    throw new Error("persona-operator-event-failure")
  }

  const failedAttempt = input.events.find((event) => event.event_type === "lock_attempt" && event.attempt_id === failure.attempt_id)
  const successfulOverride = input.events.find((event) => {
    if (event.event_type !== "lock_success" || event.outcome !== "success" || event.actor_user_id !== input.operatorUserId) return false
    const metadata = objectMetadata(event.metadata)
    return metadata?.overrideApplied === true && stableJson(metadata.requiredInputBlockers ?? null) === stableJson(blockers)
  })
  const overrideAttempt = successfulOverride
    ? input.events.find((event) => event.event_type === "lock_attempt" && event.attempt_id === successfulOverride.attempt_id)
    : undefined
  const failedAttemptMetadata = failedAttempt ? objectMetadata(failedAttempt.metadata) : null
  const overrideAttemptMetadata = overrideAttempt ? objectMetadata(overrideAttempt.metadata) : null

  if (
    !failedAttempt
    || failedAttempt.actor_user_id !== input.operatorUserId
    || failedAttemptMetadata?.overrideRequiredInputs !== false
    || !successfulOverride
    || successfulOverride.attempt_id === failure.attempt_id
    || !overrideAttempt
    || overrideAttempt.actor_user_id !== input.operatorUserId
    || overrideAttemptMetadata?.overrideRequiredInputs !== true
  ) {
    throw new Error("persona-operator-event-failure")
  }
}
