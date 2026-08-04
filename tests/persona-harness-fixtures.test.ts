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

  it("records an Auth user idempotently as soon as ownership is known", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "persona-fixture-"))
    const controller = createPersonaFixtureController({ run, outputRoot })
    const authUserId = "00000000-0000-4000-8000-000000000001"

    await controller.recordAuthUser(authUserId)
    await controller.recordAuthUser(authUserId)

    expect(controller.ledger.authUserIds).toEqual([authUserId])
  })

  it("retains public and Auth cycle owners when cycle cleanup fails", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "persona-fixture-"))
    const deleteUser = vi.fn(async () => ({ error: null }))
    const touchedTables: string[] = []
    const cycleOwnerId = "00000000-0000-4000-8000-000000000002"
    const query = (result: { data: unknown; error: { message: string } | null }) => {
      const builder: Record<string, unknown> = {}
      Object.assign(builder, {
        delete: () => builder,
        select: () => builder,
        eq: () => builder,
        limit: async () => result,
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      })
      return builder
    }
    const supabase = {
      from: (table: string) => {
        touchedTables.push(table)
        if (table === "monthly_cycles") {
          return query({
            data: { id: 7, cycle_key: "2035-01", operator_note: "persona-owner", created_by_user_id: cycleOwnerId },
            error: null,
          })
        }
        if (table === "monthly_cycle_events") return query({ data: [{ id: 9 }], error: { message: "event-delete-failed" } })
        return query({ data: null, error: null })
      },
      auth: { admin: { deleteUser } },
      storage: { from: vi.fn() },
    }
    const controller = createPersonaFixtureController({ run, outputRoot, supabase: supabase as never })
    await controller.recordDatabaseRow({ table: "users", primaryKey: { id: 42 }, cleanupPhase: 90 })
    await controller.recordAuthUser(cycleOwnerId)
    await controller.recordCycle({
      cycleId: 7,
      cycleKey: "2035-01",
      operatorNoteMarker: "persona-owner",
      createdByUserId: cycleOwnerId,
      state: "created",
    })

    await expect(controller.cleanup()).resolves.toMatchObject({ status: "residual", reasonCode: "cleanup-residual" })
    expect(touchedTables).not.toContain("users")
    expect(deleteUser).not.toHaveBeenCalled()
    expect(controller.ledger.authUserIds).toEqual([cycleOwnerId])
    expect(controller.ledger.cycles[0]?.state).toBe("created")
  })

  it("consumes one post-request OTP without returning it as evidence", async () => {
    const fill = vi.fn(async () => undefined)
    const requestedAfter = new Date("2035-01-01T00:00:00.000Z")
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/search?")) {
        return new Response(JSON.stringify({ Messages: [{ ID: "message-1", Created: "2035-01-01T00:00:01.000Z" }] }))
      }
      return Response.json({ Text: "Your local login code is 123456; ignore https://local.test/654321" })
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
