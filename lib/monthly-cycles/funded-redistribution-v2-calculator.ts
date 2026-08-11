const ZERO_BIGINT = BigInt(0)
const ONE_BIGINT = BigInt(1)
const TEN_BIGINT = BigInt(10)

export const FUNDED_REDISTRIBUTION_V2_POLICY = "settled_cubid_redistribution_v2" as const

type Fraction = { numerator: bigint; denominator: bigint }

export type FundedProjectSourceInput = {
  sourceLotId: string
  sourceLotKey: string
  projectId: number
  projectKey: string
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
}

export type FundedRedistributionPoolSourceInput = Omit<FundedProjectSourceInput, "projectKey"> & {
  originKind: "harvested_unclaimed" | "carryforward_residue"
  originCycleKey: string
}

export type FundedAllocationCohortV2Input = {
  projectId: number
  projectKey: string
  userId: string
  projectPseudonym: string
  lockedScore: string
  lockedMaximumScore: string
  cubidEvidenceHash: string
}

export type FundedRedistributionV2Input = {
  cycleKey: string
  manifestHash: string
  minorUnitScale: number
  capMultiple: string
  selectedPreviewHash: string
  projectSources: FundedProjectSourceInput[]
  redistributionSources: FundedRedistributionPoolSourceInput[]
  cohort: FundedAllocationCohortV2Input[]
}

export type FundedSourceDispositionV2 = {
  sourceLotId: string
  sourceLotKey: string
  userId: string | null
  projectId: number
  kind: "initial_claim" | "score_pool" | "harvested_pool" | "carryin_pool" | "top_up" | "carryout_residue"
  canonicalMinor: string
  exactUsd: string
}

export type FundedUserAllocationV2 = {
  userId: string
  aggregateInitialExactUsd: string
  baselineExactUsd: string
  capMultiple: string
  redistributionCeilingExactUsd: string
  redistributionCeilingMinor: string
  initialClaimMinor: string
  topUpCapacityMinor: string
  topUpMinor: string
  finalMinor: string
  projectClaims: Array<{
    projectId: number
    theoreticalShareExactUsd: string
    scoreFactor: string
    initialClaimExactUsd: string
    scorePoolContributionExactUsd: string
  }>
}

export type FundedRedistributionV2Result = {
  policy: typeof FUNDED_REDISTRIBUTION_V2_POLICY
  cycleKey: string
  manifestHash: string
  selectedPreviewHash: string
  minorUnitScale: number
  capMultiple: string
  totals: {
    currentFundedExactUsd: string
    currentFundedMinor: string
    harvestedUnclaimedMinor: string
    carryInMinor: string
    totalInputMinor: string
    initialClaimMinor: string
    scorePoolMinor: string
    topUpMinor: string
    carryOutResidueMinor: string
    finalAllocationMinor: string
    subMinorExactUsd: string
  }
  users: FundedUserAllocationV2[]
  sourceDispositions: FundedSourceDispositionV2[]
  invariantChecks: Array<{ code: string; ok: boolean }>
  hashInput: unknown
  resultHash: string
}

const ZERO: Fraction = { numerator: ZERO_BIGINT, denominator: ONE_BIGINT }

function abs(value: bigint) {
  return value < ZERO_BIGINT ? -value : value
}

function gcd(left: bigint, right: bigint): bigint {
  let a = abs(left)
  let b = abs(right)
  while (b !== ZERO_BIGINT) {
    const next = a % b
    a = b
    b = next
  }
  return a === ZERO_BIGINT ? ONE_BIGINT : a
}

function fraction(numerator: bigint, denominator = ONE_BIGINT): Fraction {
  if (denominator === ZERO_BIGINT) throw new Error("funded_allocation_v2_division_by_zero")
  const sign = denominator < ZERO_BIGINT ? -ONE_BIGINT : ONE_BIGINT
  const divisor = gcd(numerator, denominator)
  return { numerator: (numerator / divisor) * sign, denominator: abs(denominator) / divisor }
}

function add(left: Fraction, right: Fraction) {
  return fraction(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator)
}

function subtract(left: Fraction, right: Fraction) {
  return fraction(left.numerator * right.denominator - right.numerator * left.denominator, left.denominator * right.denominator)
}

function multiply(left: Fraction, right: Fraction) {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator)
}

function divide(left: Fraction, right: Fraction) {
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator)
}

function compare(left: Fraction, right: Fraction) {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator
  return difference < ZERO_BIGINT ? -1 : difference > ZERO_BIGINT ? 1 : 0
}

function floorFraction(value: Fraction) {
  if (value.numerator < ZERO_BIGINT) throw new Error("funded_allocation_v2_negative_value")
  return value.numerator / value.denominator
}

function power10(scale: number) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) throw new Error("funded_allocation_v2_minor_scale_invalid")
  let result = ONE_BIGINT
  for (let index = 0; index < scale; index += 1) result *= TEN_BIGINT
  return result
}

function parseDecimal(value: string): Fraction {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error("funded_allocation_v2_decimal_invalid")
  const negative = value.startsWith("-")
  const unsigned = negative ? value.slice(1) : value
  const [whole, decimals = ""] = unsigned.split(".")
  const denominator = power10(decimals.length)
  const numerator = BigInt(whole) * denominator + BigInt(decimals || "0")
  return fraction(negative ? -numerator : numerator, denominator)
}

function toMinorFraction(value: Fraction, scale: number) {
  return multiply(value, fraction(power10(scale)))
}

function decimalString(value: Fraction, maxScale = 18) {
  const negative = value.numerator < ZERO_BIGINT
  const numerator = abs(value.numerator)
  const scale = power10(maxScale)
  const scaled = (numerator * scale) / value.denominator
  const whole = scaled / scale
  const decimals = (scaled % scale).toString().padStart(maxScale, "0").replace(/0+$/, "")
  return `${negative ? "-" : ""}${whole}${decimals ? `.${decimals}` : ""}`
}

function stableCompare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

async function sha256Hex(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableStringify(value)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

type RoundingCandidate = { key: string; exactMinor: Fraction; capacity?: bigint }

function allocateMinorTarget(candidates: RoundingCandidate[], target: bigint) {
  const assigned = new Map<string, bigint>()
  for (const candidate of candidates) {
    const floored = floorFraction(candidate.exactMinor)
    assigned.set(candidate.key, candidate.capacity == null || floored < candidate.capacity ? floored : candidate.capacity)
  }
  let remaining = target - [...assigned.values()].reduce((sum, value) => sum + value, ZERO_BIGINT)
  const order = [...candidates].sort((left, right) => {
    const leftFloor = floorFraction(left.exactMinor)
    const rightFloor = floorFraction(right.exactMinor)
    return compare(
      subtract(right.exactMinor, fraction(rightFloor)),
      subtract(left.exactMinor, fraction(leftFloor)),
    ) || stableCompare(left.key, right.key)
  })
  while (remaining > ZERO_BIGINT) {
    let progressed = false
    for (const candidate of order) {
      if (remaining === ZERO_BIGINT) break
      const current = assigned.get(candidate.key) ?? ZERO_BIGINT
      if (candidate.capacity != null && current >= candidate.capacity) continue
      assigned.set(candidate.key, current + ONE_BIGINT)
      remaining -= ONE_BIGINT
      progressed = true
    }
    if (!progressed) break
  }
  if (remaining !== ZERO_BIGINT) throw new Error("funded_allocation_v2_rounding_capacity_exhausted")
  return assigned
}

type ExactClaim = {
  key: string
  userId: string
  projectId: number
  source: FundedProjectSourceInput
  theoretical: Fraction
  initial: Fraction
  scoreContribution: Fraction
}

function validateCapMultiple(value: string) {
  if (!/^(?:[1-9](?:\.\d{2})?|10(?:\.00)?)$/.test(value)) throw new Error("funded_allocation_v2_cap_multiple_invalid")
  const parsed = parseDecimal(value)
  if (compare(parsed, fraction(ONE_BIGINT)) < 0 || compare(parsed, fraction(BigInt(10))) > 0) {
    throw new Error("funded_allocation_v2_cap_multiple_invalid")
  }
  const [, decimals = ""] = value.split(".")
  if (decimals.length !== 2) throw new Error("funded_allocation_v2_cap_multiple_invalid")
  return parsed
}

function validateAndNormalize(input: FundedRedistributionV2Input) {
  if (!/^\d{4}-\d{2}$/.test(input.cycleKey) || !/^[0-9a-f]{64}$/.test(input.manifestHash) || !/^[0-9a-f]{64}$/.test(input.selectedPreviewHash)) {
    throw new Error("funded_allocation_v2_manifest_invalid")
  }
  const scale = input.minorUnitScale
  power10(scale)
  const capMultiple = validateCapMultiple(input.capMultiple)
  const projectSources = [...input.projectSources].sort(
    (left, right) => stableCompare(left.sourceOrder, right.sourceOrder) || stableCompare(left.sourceLotKey, right.sourceLotKey),
  )
  if (projectSources.length === 0) throw new Error("funded_allocation_v2_project_sources_missing")
  const redistributionSources = [...input.redistributionSources].sort(
    (left, right) => stableCompare(left.sourceOrder, right.sourceOrder) || stableCompare(left.sourceLotKey, right.sourceLotKey),
  )
  const sourceKeys = new Set<string>()
  for (const source of [...projectSources, ...redistributionSources]) {
    if (sourceKeys.has(source.sourceLotKey)) throw new Error("funded_allocation_v2_source_duplicate")
    sourceKeys.add(source.sourceLotKey)
    if (source.minorUnitScale !== scale || compare(parseDecimal(source.exactUsd), ZERO) <= 0
      || !/^\d+$/.test(source.canonicalMinorCapacity)) {
      throw new Error("funded_allocation_v2_source_invalid")
    }
  }
  const cohort = [...input.cohort].sort(
    (left, right) => left.projectId - right.projectId || stableCompare(left.userId, right.userId),
  )
  const cohortKeys = new Set<string>()
  for (const member of cohort) {
    const key = `${member.projectId}:${member.userId}`
    if (cohortKeys.has(key)) throw new Error("funded_allocation_v2_cohort_duplicate")
    cohortKeys.add(key)
    const score = parseDecimal(member.lockedScore)
    const maximum = parseDecimal(member.lockedMaximumScore)
    if (compare(maximum, ZERO) <= 0 || compare(score, ZERO) < 0 || compare(score, maximum) > 0) {
      throw new Error("funded_allocation_v2_score_invalid")
    }
  }
  return { projectSources, redistributionSources, cohort, scale, capMultiple }
}

export async function calculateFundedRedistributionV2(input: FundedRedistributionV2Input): Promise<FundedRedistributionV2Result> {
  const { projectSources, redistributionSources, cohort, scale, capMultiple } = validateAndNormalize(input)
  const cohortByProject = new Map<number, FundedAllocationCohortV2Input[]>()
  for (const member of cohort) cohortByProject.set(member.projectId, [...(cohortByProject.get(member.projectId) ?? []), member])
  for (const projectId of new Set(projectSources.map((source) => source.projectId))) {
    if ((cohortByProject.get(projectId)?.length ?? 0) === 0) throw new Error("funded_allocation_v2_project_cohort_missing")
  }

  const allSources = [...projectSources, ...redistributionSources]
  const totalInputExact = allSources.reduce((sum, source) => add(sum, parseDecimal(source.exactUsd)), ZERO)
  const totalInputMinor = allSources.reduce((sum, source) => sum + BigInt(source.canonicalMinorCapacity), ZERO_BIGINT)
  const sourceCapacity = new Map(allSources.map((source) => [source.sourceLotKey, BigInt(source.canonicalMinorCapacity)]))

  const claims: ExactClaim[] = []
  for (const source of projectSources) {
    const members = cohortByProject.get(source.projectId) ?? []
    const theoretical = divide(parseDecimal(source.exactUsd), fraction(BigInt(members.length)))
    for (const member of members) {
      const scoreFactor = divide(parseDecimal(member.lockedScore), parseDecimal(member.lockedMaximumScore))
      const initial = multiply(theoretical, scoreFactor)
      claims.push({
        key: `${member.userId}:${source.sourceLotKey}`,
        userId: member.userId,
        projectId: source.projectId,
        source,
        theoretical,
        initial,
        scoreContribution: subtract(theoretical, initial),
      })
    }
  }

  const canonicalInitialByClaim = new Map<string, bigint>()
  const canonicalScorePoolBySource = new Map<string, bigint>()
  for (const source of projectSources) {
    const sourceClaims = claims.filter((claim) => claim.source.sourceLotKey === source.sourceLotKey)
    const assigned = allocateMinorTarget([
      ...sourceClaims.map((claim) => ({ key: `initial:${claim.key}`, exactMinor: toMinorFraction(claim.initial, scale) })),
      ...sourceClaims.map((claim) => ({ key: `score:${claim.key}`, exactMinor: toMinorFraction(claim.scoreContribution, scale) })),
    ], sourceCapacity.get(source.sourceLotKey) ?? ZERO_BIGINT)
    for (const claim of sourceClaims) canonicalInitialByClaim.set(claim.key, assigned.get(`initial:${claim.key}`) ?? ZERO_BIGINT)
    canonicalScorePoolBySource.set(source.sourceLotKey, sourceClaims.reduce(
      (sum, claim) => sum + (assigned.get(`score:${claim.key}`) ?? ZERO_BIGINT), ZERO_BIGINT,
    ))
  }

  const userState = [...new Set(cohort.map((member) => member.userId))].sort(stableCompare).map((userId) => {
    const userClaims = claims.filter((claim) => claim.userId === userId)
    const projectTotals = new Map<number, Fraction>()
    for (const claim of userClaims) projectTotals.set(claim.projectId, add(projectTotals.get(claim.projectId) ?? ZERO, claim.initial))
    const aggregate = userClaims.reduce((sum, claim) => add(sum, claim.initial), ZERO)
    const baseline = [...projectTotals.values()].reduce((largest, value) => compare(value, largest) > 0 ? value : largest, ZERO)
    const redistributionCeiling = multiply(baseline, capMultiple)
    const redistributionCeilingMinor = floorFraction(toMinorFraction(redistributionCeiling, scale))
    const initialClaimMinor = userClaims.reduce((sum, claim) => sum + (canonicalInitialByClaim.get(claim.key) ?? ZERO_BIGINT), ZERO_BIGINT)
    const topUpCapacityMinor = redistributionCeilingMinor > initialClaimMinor ? redistributionCeilingMinor - initialClaimMinor : ZERO_BIGINT
    return {
      userId,
      aggregate,
      baseline,
      redistributionCeiling,
      redistributionCeilingMinor,
      initialClaimMinor,
      topUpCapacityMinor,
      currentMinor: initialClaimMinor,
      topUpMinor: ZERO_BIGINT,
      claims: userClaims,
    }
  })

  const availablePoolBySource = new Map<string, bigint>()
  const availableExactPoolBySource = new Map<string, Fraction>()
  for (const source of projectSources) {
    const sourceClaims = claims.filter((claim) => claim.source.sourceLotKey === source.sourceLotKey)
    availablePoolBySource.set(source.sourceLotKey, canonicalScorePoolBySource.get(source.sourceLotKey) ?? ZERO_BIGINT)
    availableExactPoolBySource.set(source.sourceLotKey, sourceClaims.reduce((sum, claim) => add(sum, claim.scoreContribution), ZERO))
  }
  for (const source of redistributionSources) {
    availablePoolBySource.set(source.sourceLotKey, sourceCapacity.get(source.sourceLotKey) ?? ZERO_BIGINT)
    availableExactPoolBySource.set(source.sourceLotKey, parseDecimal(source.exactUsd))
  }

  let poolMinor = [...availablePoolBySource.values()].reduce((sum, value) => sum + value, ZERO_BIGINT)
  const maximumIterations = userState.length * 4 + allSources.length + 10
  let iterations = 0
  while (poolMinor > ZERO_BIGINT) {
    iterations += 1
    if (iterations > maximumIterations) throw new Error("funded_allocation_v2_waterfill_stalled")
    const candidates = userState
      .filter((user) => user.currentMinor < user.redistributionCeilingMinor)
      .sort((left, right) => left.currentMinor < right.currentMinor ? -1 : left.currentMinor > right.currentMinor ? 1 : stableCompare(left.userId, right.userId))
    if (candidates.length === 0) break
    const level = candidates[0].currentMinor
    const group = candidates.filter((candidate) => candidate.currentMinor === level)
    const nextLevel = candidates.find((candidate) => candidate.currentMinor > level)?.currentMinor
    const groupCeiling = group.reduce(
      (lowest, user) => user.redistributionCeilingMinor < lowest ? user.redistributionCeilingMinor : lowest,
      group[0].redistributionCeilingMinor,
    )
    const target = nextLevel == null || groupCeiling < nextLevel ? groupCeiling : nextLevel
    const needed = (target - level) * BigInt(group.length)
    if (needed > ZERO_BIGINT && needed <= poolMinor) {
      for (const user of group) {
        const delta = target - user.currentMinor
        user.currentMinor = target
        user.topUpMinor += delta
      }
      poolMinor -= needed
      continue
    }
    const perUser = poolMinor / BigInt(group.length)
    const residual = poolMinor % BigInt(group.length)
    for (const [index, user] of group.entries()) {
      const requested = perUser + (BigInt(index) < residual ? ONE_BIGINT : ZERO_BIGINT)
      const capacity = user.redistributionCeilingMinor - user.currentMinor
      const delta = requested < capacity ? requested : capacity
      user.currentMinor += delta
      user.topUpMinor += delta
      poolMinor -= delta
    }
    if (perUser === ZERO_BIGINT && residual === ZERO_BIGINT) break
  }

  const sourceDispositions: FundedSourceDispositionV2[] = []
  for (const claim of claims) {
    const canonicalMinor = canonicalInitialByClaim.get(claim.key) ?? ZERO_BIGINT
    if (canonicalMinor > ZERO_BIGINT || compare(claim.initial, ZERO) > 0) sourceDispositions.push({
      sourceLotId: claim.source.sourceLotId,
      sourceLotKey: claim.source.sourceLotKey,
      userId: claim.userId,
      projectId: claim.projectId,
      kind: "initial_claim",
      canonicalMinor: canonicalMinor.toString(),
      exactUsd: decimalString(claim.initial),
    })
  }
  for (const source of projectSources) {
    const canonicalMinor = canonicalScorePoolBySource.get(source.sourceLotKey) ?? ZERO_BIGINT
    const exactUsd = availableExactPoolBySource.get(source.sourceLotKey) ?? ZERO
    if (canonicalMinor > ZERO_BIGINT || compare(exactUsd, ZERO) > 0) sourceDispositions.push({
      sourceLotId: source.sourceLotId, sourceLotKey: source.sourceLotKey, userId: null, projectId: source.projectId,
      kind: "score_pool", canonicalMinor: canonicalMinor.toString(), exactUsd: decimalString(exactUsd),
    })
  }
  for (const source of redistributionSources) sourceDispositions.push({
    sourceLotId: source.sourceLotId, sourceLotKey: source.sourceLotKey, userId: null, projectId: source.projectId,
    kind: source.originKind === "harvested_unclaimed" ? "harvested_pool" : "carryin_pool",
    canonicalMinor: (sourceCapacity.get(source.sourceLotKey) ?? ZERO_BIGINT).toString(), exactUsd: source.exactUsd,
  })

  for (const user of [...userState].sort((left, right) => stableCompare(left.userId, right.userId))) {
    let needed = user.topUpMinor
    for (const source of allSources) {
      if (needed === ZERO_BIGINT) break
      const available = availablePoolBySource.get(source.sourceLotKey) ?? ZERO_BIGINT
      const consumed = needed < available ? needed : available
      if (consumed === ZERO_BIGINT) continue
      const availableExact = availableExactPoolBySource.get(source.sourceLotKey) ?? ZERO
      const canonicalExact = fraction(consumed, power10(scale))
      const consumedExact = compare(canonicalExact, availableExact) < 0 ? canonicalExact : availableExact
      sourceDispositions.push({
        sourceLotId: source.sourceLotId, sourceLotKey: source.sourceLotKey, userId: user.userId, projectId: source.projectId,
        kind: "top_up", canonicalMinor: consumed.toString(), exactUsd: decimalString(consumedExact),
      })
      availablePoolBySource.set(source.sourceLotKey, available - consumed)
      availableExactPoolBySource.set(source.sourceLotKey, subtract(availableExact, consumedExact))
      needed -= consumed
    }
    if (needed !== ZERO_BIGINT) throw new Error("funded_allocation_v2_pool_provenance_exhausted")
  }

  for (const source of allSources) {
    const canonicalMinor = availablePoolBySource.get(source.sourceLotKey) ?? ZERO_BIGINT
    const exactUsd = availableExactPoolBySource.get(source.sourceLotKey) ?? ZERO
    if (canonicalMinor > ZERO_BIGINT || compare(exactUsd, ZERO) > 0) sourceDispositions.push({
      sourceLotId: source.sourceLotId, sourceLotKey: source.sourceLotKey, userId: null, projectId: source.projectId,
      kind: "carryout_residue", canonicalMinor: canonicalMinor.toString(), exactUsd: decimalString(exactUsd),
    })
  }

  const users: FundedUserAllocationV2[] = userState.map((user) => ({
    userId: user.userId,
    aggregateInitialExactUsd: decimalString(user.aggregate),
    baselineExactUsd: decimalString(user.baseline),
    capMultiple: input.capMultiple,
    redistributionCeilingExactUsd: decimalString(user.redistributionCeiling),
    redistributionCeilingMinor: user.redistributionCeilingMinor.toString(),
    initialClaimMinor: user.initialClaimMinor.toString(),
    topUpCapacityMinor: user.topUpCapacityMinor.toString(),
    topUpMinor: user.topUpMinor.toString(),
    finalMinor: user.currentMinor.toString(),
    projectClaims: [...new Set(user.claims.map((claim) => claim.projectId))].sort((a, b) => a - b).map((projectId) => {
      const rows = user.claims.filter((claim) => claim.projectId === projectId)
      const member = cohort.find((row) => row.projectId === projectId && row.userId === user.userId)
      return {
        projectId,
        theoreticalShareExactUsd: decimalString(rows.reduce((sum, row) => add(sum, row.theoretical), ZERO)),
        scoreFactor: member ? decimalString(divide(parseDecimal(member.lockedScore), parseDecimal(member.lockedMaximumScore))) : "0",
        initialClaimExactUsd: decimalString(rows.reduce((sum, row) => add(sum, row.initial), ZERO)),
        scorePoolContributionExactUsd: decimalString(rows.reduce((sum, row) => add(sum, row.scoreContribution), ZERO)),
      }
    }),
  }))

  const currentFundedExact = projectSources.reduce((sum, source) => add(sum, parseDecimal(source.exactUsd)), ZERO)
  const currentFundedMinor = projectSources.reduce((sum, source) => sum + (sourceCapacity.get(source.sourceLotKey) ?? ZERO_BIGINT), ZERO_BIGINT)
  const harvestedUnclaimedMinor = redistributionSources.filter((source) => source.originKind === "harvested_unclaimed")
    .reduce((sum, source) => sum + (sourceCapacity.get(source.sourceLotKey) ?? ZERO_BIGINT), ZERO_BIGINT)
  const carryInMinor = redistributionSources.filter((source) => source.originKind === "carryforward_residue")
    .reduce((sum, source) => sum + (sourceCapacity.get(source.sourceLotKey) ?? ZERO_BIGINT), ZERO_BIGINT)
  const initialClaimMinor = userState.reduce((sum, user) => sum + user.initialClaimMinor, ZERO_BIGINT)
  const scorePoolMinor = [...canonicalScorePoolBySource.values()].reduce((sum, value) => sum + value, ZERO_BIGINT)
  const topUpMinor = userState.reduce((sum, user) => sum + user.topUpMinor, ZERO_BIGINT)
  const carryOutResidueMinor = [...availablePoolBySource.values()].reduce((sum, value) => sum + value, ZERO_BIGINT)
  const finalAllocationMinor = userState.reduce((sum, user) => sum + user.currentMinor, ZERO_BIGINT)
  const canonicalConserved = finalAllocationMinor + carryOutResidueMinor === totalInputMinor
  const topUpCeilingsRespected = userState.every((user) => user.topUpMinor <= user.topUpCapacityMinor)
  const poolConserved = topUpMinor + carryOutResidueMinor === scorePoolMinor + harvestedUnclaimedMinor + carryInMinor
  const sourceConserved = allSources.every((source) => sourceDispositions
    .filter((row) => row.sourceLotKey === source.sourceLotKey && ["initial_claim", "top_up", "carryout_residue"].includes(row.kind))
    .reduce((sum, row) => sum + BigInt(row.canonicalMinor), ZERO_BIGINT) === (sourceCapacity.get(source.sourceLotKey) ?? ZERO_BIGINT))
  const exactSourceConserved = allSources.every((source) => compare(sourceDispositions
    .filter((row) => row.sourceLotKey === source.sourceLotKey && ["initial_claim", "top_up", "carryout_residue"].includes(row.kind))
    .reduce((sum, row) => add(sum, parseDecimal(row.exactUsd)), ZERO), parseDecimal(source.exactUsd)) === 0)
  if (!canonicalConserved || !topUpCeilingsRespected || !poolConserved || !sourceConserved || !exactSourceConserved) {
    throw new Error("funded_allocation_v2_invariant_failed")
  }

  const totals = {
    currentFundedExactUsd: decimalString(currentFundedExact),
    currentFundedMinor: currentFundedMinor.toString(),
    harvestedUnclaimedMinor: harvestedUnclaimedMinor.toString(),
    carryInMinor: carryInMinor.toString(),
    totalInputMinor: totalInputMinor.toString(),
    initialClaimMinor: initialClaimMinor.toString(),
    scorePoolMinor: scorePoolMinor.toString(),
    topUpMinor: topUpMinor.toString(),
    carryOutResidueMinor: carryOutResidueMinor.toString(),
    finalAllocationMinor: finalAllocationMinor.toString(),
    subMinorExactUsd: decimalString(subtract(totalInputExact, fraction(totalInputMinor, power10(scale)))),
  }
  const invariantChecks = [
    { code: "canonical_minor_conservation", ok: canonicalConserved },
    { code: "redistribution_top_up_ceilings_respected", ok: topUpCeilingsRespected },
    { code: "redistribution_pool_conserved", ok: poolConserved },
    { code: "source_provenance_conserved", ok: sourceConserved },
    { code: "exact_source_provenance_conserved", ok: exactSourceConserved },
    { code: "overlap_pool_absent", ok: true },
  ]
  const hashInput = {
    policy: FUNDED_REDISTRIBUTION_V2_POLICY,
    cycleKey: input.cycleKey,
    manifestHash: input.manifestHash,
    selectedPreviewHash: input.selectedPreviewHash,
    minorUnitScale: scale,
    capMultiple: input.capMultiple,
    totals,
    users,
    sourceDispositions: sourceDispositions.sort(
      (left, right) => stableCompare(left.sourceLotKey, right.sourceLotKey) || stableCompare(left.kind, right.kind) || stableCompare(left.userId ?? "", right.userId ?? ""),
    ),
    invariantChecks,
  }
  return { ...hashInput, hashInput, resultHash: await sha256Hex(hashInput) }
}
