import { mkdtemp, readFile, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { consumeLocalOtp } from "@/tests/e2e/support/mailpit-otp"
import { createPersonaFixtureController } from "@/tests/e2e/support/persona-fixtures"

const run = {
  runId: "persona-20350101T000000Z-test",
  selectedPersonas: ["new-member" as const],
  startedAt: "2035-01-01T00:00:00.000Z",
}

describe("persona fixture lifecycle", () => {
  it("checkpoints a private ledger and cleans idempotently after success", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "persona-fixture-"))
    const controller = createPersonaFixtureController({ run, outputRoot })
    await controller.checkpoint()
    await controller.markRunning()
    expect(await controller.cleanup()).toEqual({ status: "clean", deletedCount: 0, residualCount: 0, reasonCode: null })
    expect(await controller.cleanup()).toEqual({ status: "clean", deletedCount: 0, residualCount: 0, reasonCode: null })
    const ledgerPath = path.join(outputRoot, run.runId, "ownership-ledger.json")
    expect(JSON.parse(await readFile(ledgerPath, "utf8")).state).toBe("clean")
    expect((await stat(ledgerPath)).mode & 0o777).toBe(0o600)
  })

  it("reports residue instead of pretending unowned cleanup succeeded", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "persona-fixture-"))
    const controller = createPersonaFixtureController({ run, outputRoot })
    await controller.recordDatabaseRow({ table: "projects", primaryKey: { id: 42 }, cleanupPhase: 10 })
    const result = await controller.cleanup()
    expect(result).toMatchObject({ status: "residual", residualCount: 1, reasonCode: "cleanup-client-unavailable" })
  })

  it("consumes one post-request OTP without returning it as evidence", async () => {
    const fill = vi.fn(async () => undefined)
    const requestedAfter = new Date("2035-01-01T00:00:00.000Z")
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/search?")) {
        return new Response(JSON.stringify({ Messages: [{ ID: "message-1", Created: "2035-01-01T00:00:01.000Z" }] }))
      }
      return new Response("Your local login code is 123456")
    }) as unknown as typeof fetch
    await expect(consumeLocalOtp({
      mailpitUrl: "http://127.0.0.1:55324",
      recipient: "new-member@persona.local",
      requestedAfter,
      fill,
      fetcher,
      attempts: 1,
    })).resolves.toBeUndefined()
    expect(fill).toHaveBeenCalledWith("123456")
  })
})
