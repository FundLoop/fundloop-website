import { describe, expect, it } from "vitest"
import { CAPABILITY_REGISTRY } from "@/tests/e2e/personas/capabilities"
import type { PersonaJourney } from "@/tests/e2e/personas/contracts"
import {
  newFounderJourney,
  newMemberJourney,
  returningFounderJourney,
  returningMemberJourney,
} from "@/tests/e2e/personas/journeys"
import { establishNewActor, provisionalNewActor } from "@/tests/e2e/support/persona-fixtures"
import { createCycleClock } from "@/tests/e2e/support/persona-monthly-cycle"
import { parsePersonaSelection, personaGrep, validatePersonaJourneys } from "@/tests/e2e/support/persona-selection"

describe("persona harness contracts", () => {
  it("selects all personas in registry order or filters a stable subset", () => {
    expect(parsePersonaSelection()).toEqual([
      "new-member", "returning-member", "new-founder", "returning-founder", "returning-operator",
    ])
    expect(parsePersonaSelection("returning-operator,new-member,new-member")).toEqual(["new-member", "returning-operator"])
    expect(personaGrep(["new-member", "returning-operator"])).toBe("@persona:(new-member|returning-operator)")
    expect(() => parsePersonaSelection("")).toThrow("persona-filter-empty")
    expect(() => parsePersonaSelection("stranger")).toThrow("persona-filter-unknown")
  })

  it("validates checkpoint ids and registry-owned pending declarations", () => {
    const journey: PersonaJourney = {
      id: "new-member",
      title: "New member",
      actorKind: "new",
      checkpoints: [{
        id: "member.withdraw-earnings",
        title: "Withdraw",
        actorAlias: "new-member",
        surface: "browser",
        mode: "expected-pending",
        capabilityId: "member-withdrawal",
        execute: async () => ({ outcome: "capability-unavailable", evidence: {}, reasonCode: "withdrawal-not-implemented" }),
      }],
    }
    expect(validatePersonaJourneys([journey])).toBe(true)
    expect(CAPABILITY_REGISTRY["member-withdrawal"].state).toBe("expected-pending")
    expect(() => validatePersonaJourneys([{ ...journey, checkpoints: [{ ...journey.checkpoints[0], id: "bad" }] }]))
      .toThrow("checkpoint-id-invalid")
  })

  it("never invents an Auth UUID for a provisional new actor", () => {
    const provisional = provisionalNewActor("new-member")
    expect(provisional.authUserId).toBeNull()
    expect(() => establishNewActor(provisional, "not-a-uuid")).toThrow("persona-auth-user-id-invalid")
    expect(establishNewActor(provisional, "123e4567-e89b-42d3-a456-426614174000").authUserId)
      .toBe("123e4567-e89b-42d3-a456-426614174000")
  })

  it("derives stable UTC cycle keys and inclusive month bounds", () => {
    const clock = createCycleClock("2035-01")
    expect(clock.cycleKeyFor("new-founder")).toBe("2035-01")
    expect(clock.cycleKeyFor("returning-founder", 2)).toBe("2035-03")
    expect(clock.cycleKeyFor("returning-operator")).toBe("2035-04")
    expect(clock.boundsFor("2036-02")).toEqual({ periodStart: "2036-02-01", periodEnd: "2036-02-29" })
  })

  it("fixes the independently selectable member and founder checkpoint order", () => {
    const action = async () => ({ outcome: "observed" as const, evidence: {} })
    const actions = new Proxy({}, { get: () => action }) as Record<string, typeof action>
    const journeys = [
      newMemberJourney(actions),
      returningMemberJourney(actions),
      newFounderJourney(actions),
      returningFounderJourney(actions),
    ]

    expect(validatePersonaJourneys(journeys)).toBe(true)
    expect(journeys.map((journey) => journey.id)).toEqual([
      "new-member", "returning-member", "new-founder", "returning-founder",
    ])
    expect(journeys[0].checkpoints.map((checkpoint) => checkpoint.id)).toEqual([
      "auth.request-local-otp",
      "auth.verify-local-otp",
      "member.publish-profile",
      "member.view-earnings-total",
      "member.view-project-sources",
      "member.withdraw-earnings",
    ])
    expect(journeys[2].checkpoints.at(-1)).toMatchObject({
      id: "cadence.await-operator-distribution",
      mode: "expected-pending",
      capabilityId: "founder-distribution-after-operator-cadence",
    })
  })
})
