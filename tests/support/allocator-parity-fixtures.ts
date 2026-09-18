// Deterministic synthetic fixtures for allocator parity (#216).
// Kept free of repository-specific imports so it can move unchanged when the allocator is
// extracted into its own repository (#209).
import { createHash } from "node:crypto"

export const ALLOCATOR_PARITY_FIXTURE_VERSION = "allocator-parity-fixtures.v1" as const

export type ParityScoreMode = "random" | "zero" | "tied" | "max" | "mixed" | "sparse"

export type ParityFixtureSpec = {
  id: string
  seed: number
  users: number
  projects: number
  sourcesPerProject: number
  redistributionSources: number
  minorUnitScale: number
  capMultiple: string
  currency: "USD" | "CAD" | "EUR" | "GBP"
  scoreMode: ParityScoreMode
  // Extra decimal places on exactUsd beyond minorUnitScale, forcing sub-minor residue.
  fractionalDigits: number
  // Probability (0-100) that a user belongs to more than one project cohort.
  overlapPercent: number
  // Upper bound of whole currency units per source lot.
  maxSourceUnits: number
}

export type ParitySource = {
  sourceLotId: string
  sourceLotKey: string
  projectId: number
  exactUsd: string
  canonicalMinorCapacity: string
  minorUnitScale: number
  sourceOrder: string
  railKey: string
  assetKey: string
  custodyKey: string
  nativeAtomicAmount: string
  fxSnapshotId: string
  evidenceHash: string
  currency: string
}

export type ParityInput = {
  cycleKey: string
  manifestHash: string
  minorUnitScale: number
  capMultiple: string
  selectedPreviewHash: string
  currency: string
  projectSources: Array<ParitySource & { projectKey: string }>
  redistributionSources: Array<ParitySource & { originKind: "harvested_unclaimed" | "carryforward_residue"; originCycleKey: string }>
  cohort: Array<{
    projectId: number
    projectKey: string
    userId: string
    projectPseudonym: string
    lockedScore: string
    lockedMaximumScore: string
    cubidEvidenceHash: string
  }>
}

// mulberry32: small, well-known 32-bit PRNG; identical output on every JS engine.
function prng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function int(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1))
}

function digits(random: () => number, count: number) {
  let out = ""
  for (let index = 0; index < count; index += 1) out += String(int(random, 0, 9))
  return out
}

function hex64(label: string) {
  return createHash("sha256").update(label).digest("hex")
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0")
}

// Builds an exact decimal with (scale + fractionalDigits) places and its floored minor capacity.
function amount(random: () => number, spec: ParityFixtureSpec) {
  const whole = int(random, 1, spec.maxSourceUnits)
  const places = spec.minorUnitScale + spec.fractionalDigits
  const fractionDigits = digits(random, places)
  const exactUsd = places === 0 ? String(whole) : `${whole}.${fractionDigits}`
  const minorDigits = fractionDigits.slice(0, spec.minorUnitScale)
  const minorUnit = BigInt(`1${"0".repeat(spec.minorUnitScale)}`)
  const canonicalMinorCapacity = (BigInt(whole) * minorUnit + BigInt(minorDigits || "0")).toString()
  return { exactUsd, canonicalMinorCapacity }
}

function score(random: () => number, mode: ParityScoreMode, userIndex: number) {
  const maximum = "100"
  switch (mode) {
    case "zero": return { lockedScore: "0", lockedMaximumScore: maximum }
    case "max": return { lockedScore: maximum, lockedMaximumScore: maximum }
    case "tied": return { lockedScore: "50", lockedMaximumScore: maximum }
    case "sparse": return { lockedScore: userIndex % 7 === 0 ? String(int(random, 1, 100)) : "0", lockedMaximumScore: maximum }
    case "mixed": {
      const pick = int(random, 0, 3)
      if (pick === 0) return { lockedScore: "0", lockedMaximumScore: maximum }
      if (pick === 1) return { lockedScore: maximum, lockedMaximumScore: maximum }
      return { lockedScore: `${int(random, 0, 99)}.${digits(random, 3)}`, lockedMaximumScore: maximum }
    }
    default: return { lockedScore: `${int(random, 0, 99)}.${digits(random, 2)}`, lockedMaximumScore: maximum }
  }
}

export function buildParityInput(spec: ParityFixtureSpec): ParityInput {
  const random = prng(spec.seed)
  const cycleKey = "2026-08"
  const projectIds = Array.from({ length: spec.projects }, (_, index) => 1000 + index)
  const projectKey = (projectId: number) => `project-${projectId}`

  const sourceBase = (id: string, order: number, projectId: number) => {
    const { exactUsd, canonicalMinorCapacity } = amount(random, spec)
    return {
      sourceLotId: id,
      sourceLotKey: `lot:${cycleKey}:${id}`,
      projectId,
      exactUsd,
      canonicalMinorCapacity,
      minorUnitScale: spec.minorUnitScale,
      sourceOrder: pad(order, 6),
      railKey: "parity_rail",
      assetKey: `${spec.currency.toLowerCase()}_fiat`,
      custodyKey: "parity_custody",
      nativeAtomicAmount: canonicalMinorCapacity,
      fxSnapshotId: `fx-${spec.id}`,
      evidenceHash: hex64(`evidence:${spec.id}:${id}`),
      currency: spec.currency,
    }
  }

  let order = 0
  const projectSources = projectIds.flatMap((projectId) => Array.from({ length: spec.sourcesPerProject }, (_, index) => ({
    ...sourceBase(`p${projectId}-s${index}`, (order += 1), projectId),
    projectKey: projectKey(projectId),
  })))
  const redistributionSources = Array.from({ length: spec.redistributionSources }, (_, index) => ({
    ...sourceBase(`r${index}`, (order += 1), projectIds[index % projectIds.length]),
    originKind: index % 2 === 0 ? "harvested_unclaimed" as const : "carryforward_residue" as const,
    originCycleKey: "2026-07",
  }))

  const cohort: ParityInput["cohort"] = []
  for (let userIndex = 0; userIndex < spec.users; userIndex += 1) {
    const userId = `user-${pad(userIndex, 5)}`
    // Round-robin guarantees every project has at least one member when users >= projects.
    const memberships = new Set([projectIds[userIndex % projectIds.length]])
    if (spec.projects > 1 && int(random, 1, 100) <= spec.overlapPercent) memberships.add(projectIds[int(random, 0, projectIds.length - 1)])
    for (const projectId of [...memberships].sort((a, b) => a - b)) {
      cohort.push({
        projectId,
        projectKey: projectKey(projectId),
        userId,
        projectPseudonym: hex64(`pseudonym:${projectId}:${userId}`).slice(0, 32),
        ...score(random, spec.scoreMode, userIndex),
        cubidEvidenceHash: hex64(`cubid:${spec.id}:${userId}`),
      })
    }
  }

  return {
    cycleKey,
    manifestHash: hex64(`manifest:${spec.id}`),
    minorUnitScale: spec.minorUnitScale,
    capMultiple: spec.capMultiple,
    selectedPreviewHash: hex64(`preview:${spec.id}`),
    currency: spec.currency,
    projectSources,
    redistributionSources,
    cohort,
  }
}

const base: Omit<ParityFixtureSpec, "id" | "seed"> = {
  users: 10, projects: 2, sourcesPerProject: 1, redistributionSources: 1, minorUnitScale: 2,
  capMultiple: "3.00", currency: "USD", scoreMode: "random", fractionalDigits: 0, overlapPercent: 20, maxSourceUnits: 10_000,
}

const spec = (id: string, seed: number, overrides: Partial<ParityFixtureSpec>): ParityFixtureSpec => ({ ...base, id, seed, ...overrides })

// 50 fixtures spanning cohort size (1 to 10,000), score shape, caps, currencies, and residue.
export const ALLOCATOR_PARITY_FIXTURES: ParityFixtureSpec[] = [
  // Cohort size sweep.
  spec("size-001", 1, { users: 1, projects: 1, redistributionSources: 0 }),
  spec("size-002", 2, { users: 2, projects: 1 }),
  spec("size-003", 3, { users: 3, projects: 2 }),
  spec("size-005", 5, { users: 5, projects: 2 }),
  spec("size-010", 10, { users: 10, projects: 3 }),
  spec("size-025", 25, { users: 25, projects: 3 }),
  spec("size-050", 50, { users: 50, projects: 4, sourcesPerProject: 2 }),
  spec("size-100", 100, { users: 100, projects: 5, sourcesPerProject: 2, redistributionSources: 2 }),
  spec("size-250", 250, { users: 250, projects: 6, redistributionSources: 3 }),
  spec("size-500", 500, { users: 500, projects: 8, redistributionSources: 3 }),
  spec("size-1000", 1000, { users: 1000, projects: 10, redistributionSources: 4 }),
  spec("size-2500", 2500, { users: 2500, projects: 5, redistributionSources: 2, overlapPercent: 5 }),
  spec("size-5000", 5000, { users: 5000, projects: 4, redistributionSources: 1, overlapPercent: 0, scoreMode: "tied" }),
  spec("size-10000", 10000, { users: 10000, projects: 2, redistributionSources: 1, overlapPercent: 0, scoreMode: "tied" }),
  // Score shape.
  spec("score-zero", 101, { scoreMode: "zero", users: 20 }),
  spec("score-max", 102, { scoreMode: "max", users: 20 }),
  spec("score-tied", 103, { scoreMode: "tied", users: 20 }),
  spec("score-mixed", 104, { scoreMode: "mixed", users: 40, projects: 3 }),
  spec("score-sparse", 105, { scoreMode: "sparse", users: 60, projects: 3 }),
  spec("score-zero-large", 106, { scoreMode: "zero", users: 400, projects: 4 }),
  spec("score-max-no-pool", 107, { scoreMode: "max", users: 30, redistributionSources: 0 }),
  spec("score-mixed-overlap", 108, { scoreMode: "mixed", users: 80, projects: 5, overlapPercent: 60 }),
  // Cap multiple.
  spec("cap-1.00", 201, { capMultiple: "1.00", users: 30 }),
  spec("cap-1.25", 202, { capMultiple: "1.25", users: 30 }),
  spec("cap-2.00", 203, { capMultiple: "2.00", users: 30 }),
  spec("cap-5.50", 204, { capMultiple: "5.50", users: 30 }),
  spec("cap-9.99", 205, { capMultiple: "9.99", users: 30 }),
  spec("cap-10.00", 206, { capMultiple: "10.00", users: 30, redistributionSources: 3 }),
  spec("cap-1.00-large-pool", 207, { capMultiple: "1.00", users: 15, redistributionSources: 5 }),
  spec("cap-10.00-sparse", 208, { capMultiple: "10.00", users: 50, scoreMode: "sparse" }),
  // Fractional residue and minor-unit scale.
  spec("frac-1", 301, { fractionalDigits: 1 }),
  spec("frac-4", 302, { fractionalDigits: 4, users: 17 }),
  spec("frac-8", 303, { fractionalDigits: 8, users: 23, projects: 3 }),
  spec("scale-0", 304, { minorUnitScale: 0, users: 7, maxSourceUnits: 50 }),
  spec("scale-0-frac", 305, { minorUnitScale: 0, fractionalDigits: 3, users: 11 }),
  spec("scale-6", 306, { minorUnitScale: 6, users: 13 }),
  spec("scale-8-frac", 307, { minorUnitScale: 8, fractionalDigits: 2, users: 9 }),
  spec("tiny-sources", 308, { maxSourceUnits: 1, users: 37, projects: 3, fractionalDigits: 2 }),
  spec("prime-cohort", 309, { users: 97, projects: 7, fractionalDigits: 3 }),
  spec("huge-sources", 310, { maxSourceUnits: 900_000_000, users: 12 }),
  // Currency binding.
  spec("currency-cad", 401, { currency: "CAD", users: 25 }),
  spec("currency-eur", 402, { currency: "EUR", users: 25 }),
  spec("currency-gbp", 403, { currency: "GBP", users: 25 }),
  spec("currency-eur-frac", 404, { currency: "EUR", fractionalDigits: 5, users: 31 }),
  // Source topology.
  spec("many-sources", 501, { sourcesPerProject: 6, projects: 4, users: 60 }),
  spec("many-pool-sources", 502, { redistributionSources: 12, users: 40 }),
  spec("single-project-overlap", 503, { projects: 1, users: 50, redistributionSources: 2 }),
  spec("wide-projects", 504, { projects: 25, users: 200, overlapPercent: 40 }),
  spec("full-overlap", 505, { projects: 3, users: 45, overlapPercent: 100 }),
  spec("no-pool-sources", 506, { redistributionSources: 0, users: 35, scoreMode: "mixed" }),
]

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`
}

export function paritySha256(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

type ParityResultShape = {
  manifestHash: string
  selectedPreviewHash: string
  resultHash: string
  totals: Record<string, string>
  users: unknown[]
  sourceDispositions: unknown[]
  invariantChecks: Array<{ code: string; ok: boolean }>
}

export type ParityOutcome =
  | { id: string; inputSha256: string; ok: false; error: string }
  | {
    id: string
    inputSha256: string
    ok: true
    manifestHash: string
    selectedPreviewHash: string
    resultHash: string
    userAllocationsSha256: string
    sourceDispositionsSha256: string
    resultSha256: string
    userCount: number
    dispositionCount: number
    totals: Record<string, string>
    invariantsOk: boolean
  }

// Runs one fixture through an engine and reduces the result to comparable digests.
export async function computeParityOutcome(
  spec: ParityFixtureSpec,
  calculate: (input: ParityInput) => Promise<ParityResultShape>,
): Promise<ParityOutcome> {
  const input = buildParityInput(spec)
  const inputSha256 = paritySha256(input)
  let result: ParityResultShape
  try {
    result = await calculate(input)
  } catch (error) {
    return { id: spec.id, inputSha256, ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  return {
    id: spec.id,
    inputSha256,
    ok: true,
    manifestHash: result.manifestHash,
    selectedPreviewHash: result.selectedPreviewHash,
    resultHash: result.resultHash,
    userAllocationsSha256: paritySha256(result.users),
    sourceDispositionsSha256: paritySha256(result.sourceDispositions),
    resultSha256: paritySha256(result),
    userCount: result.users.length,
    dispositionCount: result.sourceDispositions.length,
    totals: result.totals,
    invariantsOk: result.invariantChecks.every((check) => check.ok),
  }
}
