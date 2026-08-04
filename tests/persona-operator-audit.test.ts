import { describe, expect, it } from "vitest"
import {
  assertSupportedRequiredInputOverrideFailure,
  PERSONA_REQUIRED_INPUT_OVERRIDE_REASON,
} from "@/tests/e2e/support/persona-operator-audit"

const operatorUserId = "operator-user"
const blockers = [{ code: "missing_contribution_submissions", count: 1 }]
const recordedCycle = {
  locked_manifest: { override: { required_inputs: true, reason: PERSONA_REQUIRED_INPUT_OVERRIDE_REASON } },
  lock_override_reason: PERSONA_REQUIRED_INPUT_OVERRIDE_REASON,
}

function supportedEvents() {
  return [
    { actor_user_id: operatorUserId, attempt_id: "initial", event_type: "lock_attempt", message: "Monthly cycle lock attempt started.", metadata: { overrideRequiredInputs: false }, outcome: "attempt" },
    { actor_user_id: operatorUserId, attempt_id: "initial", event_type: "lock_failure", message: "Required MVP monthly-cycle inputs block the lock.", metadata: { blockers }, outcome: "failure" },
    { actor_user_id: operatorUserId, attempt_id: "override", event_type: "lock_attempt", message: "Monthly cycle lock attempt started.", metadata: { overrideRequiredInputs: true }, outcome: "attempt" },
    { actor_user_id: operatorUserId, attempt_id: "override", event_type: "lock_success", message: "Monthly cycle locked into immutable manifest.", metadata: { overrideApplied: true, requiredInputBlockers: blockers }, outcome: "success" },
  ]
}

describe("operator persona supported lock override audit", () => {
  it("permits the one failure correlated to the recorded required-input override", () => {
    expect(() => assertSupportedRequiredInputOverrideFailure({
      cycle: recordedCycle,
      events: supportedEvents(),
      operatorUserId,
    })).not.toThrow()
  })

  it.each([
    ["wrong recorded reason", { cycle: { ...recordedCycle, lock_override_reason: "different" } }],
    ["different actor", { events: supportedEvents().map((event) => event.event_type === "lock_failure" ? { ...event, actor_user_id: "other-user" } : event) }],
    ["unrelated blocker", { events: supportedEvents().map((event) => event.event_type === "lock_success" ? { ...event, metadata: { overrideApplied: true, requiredInputBlockers: [{ code: "other" }] } } : event) }],
    ["uncorrelated attempt", { events: supportedEvents().filter((event) => !(event.event_type === "lock_attempt" && event.attempt_id === "initial")) }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => assertSupportedRequiredInputOverrideFailure({
      cycle: recordedCycle,
      events: supportedEvents(),
      operatorUserId,
      ...overrides,
    })).toThrow("persona-operator-event-failure")
  })
})
