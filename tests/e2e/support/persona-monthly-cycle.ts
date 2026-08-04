import type { PersonaId, CycleClock, ControlledCadenceDriver } from "../personas/contracts"

const DEFAULT_OFFSETS: Partial<Record<PersonaId, number>> = {
  "new-founder": 0,
  "returning-founder": 1,
  "returning-operator": 3,
}

function addMonths(cycleKey: string, offset: number) {
  const [year, month] = cycleKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export function createCycleClock(baseCycleKey = "2035-01"): CycleClock {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(baseCycleKey)) throw new Error("persona-cycle-base-invalid")
  return {
    baseCycleKey,
    cycleKeyFor(personaId, offset = DEFAULT_OFFSETS[personaId] ?? 0) {
      return addMonths(baseCycleKey, offset)
    },
    boundsFor(cycleKey) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(cycleKey)) throw new Error("persona-cycle-key-invalid")
      return {
        periodStart: `${cycleKey}-01`,
        periodEnd: new Date(new Date(`${addMonths(cycleKey, 1)}-01T00:00:00.000Z`).getTime() - 86_400_000)
          .toISOString()
          .slice(0, 10),
      }
    },
  }
}

export function createControlledCadenceDriver(input: ControlledCadenceDriver): ControlledCadenceDriver {
  return input
}
