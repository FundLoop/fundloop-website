import { edgeCommandFailure, edgeCommandSuccess } from "./result.ts"

export type EpochShadowSchedulerInput = { fakeNow?: string; workerId?: string }

export function validateEpochShadowSchedulerInput(value: unknown, trustedEnvironment: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return edgeCommandFailure("invalid_payload", "Expected an object.")
  const input = value as EpochShadowSchedulerInput
  if (input.fakeNow && trustedEnvironment === "production") return edgeCommandFailure("production_disabled", "Fake clock is unavailable in production.")
  if (input.fakeNow && Number.isNaN(Date.parse(input.fakeNow))) return edgeCommandFailure("invalid_fake_clock", "fakeNow must be ISO-8601.")
  if (input.workerId && !/^[a-zA-Z0-9:_-]{3,80}$/.test(input.workerId)) return edgeCommandFailure("invalid_worker", "workerId is invalid.")
  return edgeCommandSuccess({
    now: input.fakeNow ? new Date(input.fakeNow) : new Date(),
    environment: trustedEnvironment,
    workerId: input.workerId ?? `epoch-scheduler:${crypto.randomUUID()}`,
  })
}
