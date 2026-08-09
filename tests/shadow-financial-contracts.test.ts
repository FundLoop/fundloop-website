import { describe, expect, it } from "vitest"
import { validateShadowFinancialEvent } from "@/lib/edge-functions/shadow-financial-event-contract"
import { validateShadowJournal } from "@/lib/edge-functions/shadow-financial-journal-contract"

const event = {
  providerKey: "fixture-provider",
  providerEventId: "event-1",
  custodyAccountId: 1,
  assetId: 1,
  eventType: "settlement",
  providerSequence: 1,
  settledNativeAmount: "100",
  occurredAt: "2026-08-09T00:00:00.000Z",
  evidenceHash: "a".repeat(64),
  legacyTimestampEvidence: { source: "legacy fixture" },
}

const journal = {
  eventId: 1,
  ledgerTransactionId: 1,
  journalType: "receipt",
  comparisonStatus: "matched",
  evidenceHash: "b".repeat(64),
  detail: { fixture: true },
}

describe("shadow financial Edge contracts", () => {
  it.each(["local", "dev", "test"])("accepts valid event and journal commands in %s", (environment) => {
    expect(validateShadowFinancialEvent(event, environment)).toMatchObject({ ok: true })
    expect(validateShadowJournal(journal, environment)).toMatchObject({ ok: true })
  })

  it.each(["production", "preview", "development", "staging", ""])(
    "fails closed with a stable error outside the runtime allowlist: %s",
    (environment) => {
      expect(validateShadowFinancialEvent(event, environment)).toEqual({
        ok: false,
        error: { code: "production_disabled", message: "Shadow ingestion is unavailable in this environment." },
      })
      expect(validateShadowJournal(journal, environment)).toEqual({
        ok: false,
        error: { code: "production_disabled", message: "Shadow posting unavailable in this environment." },
      })
    },
  )

  it("rejects malformed event evidence and DB-shaped fields before RPC execution", () => {
    for (const invalid of [
      { ...event, custodyAccountId: 0 },
      { ...event, providerSequence: 1.5 },
      { ...event, settledNativeAmount: "1.5" },
      { ...event, occurredAt: "not-a-date" },
      { ...event, evidenceHash: "ABC" },
      { ...event, legacyTimestampEvidence: [] },
    ]) {
      expect(validateShadowFinancialEvent(invalid, "local")).toMatchObject({
        ok: false,
        error: { code: "invalid_payload", message: "External financial event fields are invalid." },
      })
    }
  })

  it("rejects invalid journal enums, evidence, and detail before RPC execution", () => {
    for (const invalid of [
      { ...journal, journalType: "payable" },
      { ...journal, comparisonStatus: "certified" },
      { ...journal, evidenceHash: "short" },
      { ...journal, detail: [] },
    ]) {
      expect(validateShadowJournal(invalid, "local")).toMatchObject({
        ok: false,
        error: { code: "invalid_payload", message: "Shadow journal fields are invalid." },
      })
    }
  })
})
