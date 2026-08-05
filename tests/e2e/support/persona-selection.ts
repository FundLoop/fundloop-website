import { CAPABILITY_REGISTRY } from "../personas/capabilities"
import { PERSONA_IDS, type PersonaId, type PersonaJourney } from "../personas/contracts"

export function parsePersonaSelection(value?: string | null): PersonaId[] {
  if (value == null) return [...PERSONA_IDS]

  const requested = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
  if (requested.length === 0) throw new Error("persona-filter-empty")

  const unknown = requested.filter((item) => !PERSONA_IDS.includes(item as PersonaId))
  if (unknown.length > 0) throw new Error("persona-filter-unknown")

  return PERSONA_IDS.filter((id) => requested.includes(id))
}

export function personaGrep(personas: readonly PersonaId[]) {
  return `@persona:(${personas.join("|")})`
}

export function validatePersonaJourneys(journeys: readonly PersonaJourney[]) {
  const ids = new Set<PersonaId>()
  for (const journey of journeys) {
    if (ids.has(journey.id)) throw new Error("persona-journey-duplicate")
    ids.add(journey.id)
    const checkpoints = new Set<string>()
    for (const checkpoint of journey.checkpoints) {
      if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(checkpoint.id)) throw new Error("checkpoint-id-invalid")
      if (checkpoints.has(checkpoint.id)) throw new Error("checkpoint-id-duplicate")
      checkpoints.add(checkpoint.id)
      if (checkpoint.mode === "expected-pending" && !(checkpoint.capabilityId in CAPABILITY_REGISTRY)) {
        throw new Error("undeclared-capability-gap")
      }
    }
  }
  return true
}
