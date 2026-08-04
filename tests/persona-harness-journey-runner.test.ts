import { mkdtemp, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { newMemberJourney } from "@/tests/e2e/personas/journeys"
import { executePersonaJourney } from "@/tests/e2e/support/persona-journey-runner"

describe("persona journey execution", () => {
  it("reports declared pending checkpoints and always cleans", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "persona-journey-"))
    const cleanup = vi.fn(async () => ({ status: "clean" as const, deletedCount: 4, residualCount: 0, reasonCode: null }))
    const actions = new Proxy({}, {
      get: (_target, checkpointId) => async () => checkpointId === "member.withdraw-earnings"
        ? { outcome: "capability-unavailable" as const, evidence: { declared: true }, reasonCode: "withdrawal-not-implemented" }
        : { outcome: "observed" as const, evidence: { visible: true } },
    }) as never

    const result = await executePersonaJourney({
      journey: newMemberJourney(actions),
      outputRoot,
      runId: "persona-20350101T000000Z-journey",
      cleanup,
    })

    expect(result.status).toBe("incomplete")
    expect(result.checkpoints.at(-1)?.status).toBe("expected-pending")
    expect(cleanup).toHaveBeenCalledOnce()
    expect(JSON.parse(await readFile(path.join(outputRoot, "persona-20350101T000000Z-journey", "personas", "new-member.json"), "utf8"))).toEqual(result)
  })

  it("fails closed, stops later checkpoints, and still cleans", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "persona-journey-"))
    let calls = 0
    const actions = new Proxy({}, {
      get: () => async () => {
        calls += 1
        if (calls === 2) throw new Error("private failure")
        return { outcome: "observed" as const, evidence: {} }
      },
    }) as never
    const cleanup = vi.fn(async () => ({ status: "clean" as const, deletedCount: 1, residualCount: 0, reasonCode: null }))

    const result = await executePersonaJourney({
      journey: newMemberJourney(actions),
      outputRoot,
      runId: "persona-20350101T000000Z-failure",
      cleanup,
    })

    expect(result.status).toBe("failed")
    expect(result.checkpoints).toHaveLength(2)
    expect(result.checkpoints[1]).toMatchObject({ status: "fail", reasonCode: "checkpoint-execution-failed" })
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
