const BIGINT_ZERO = BigInt(0)
const BIGINT_ONE = BigInt(1)
const BIGINT_THREE = BigInt(3)
const BIGINT_TEN = BigInt(10)

export const FUNDED_REDISTRIBUTION_POLICY = "settled_cubid_redistribution_v1" as const
export const FUNDED_REDISTRIBUTION_CAP_MULTIPLE = BIGINT_THREE

type Fraction = { numerator: bigint; denominator: bigint }

export type FundedAllocationSourceInput = {
  sourceLotId: string
  sourceLotKey: string
  projectId: number
  projectKey: string
  exactUsd: string
  minorUnitScale: number
  sourceOrder: string
  railKey: string
  assetKey: string
  custodyKey: string
  nativeAtomicAmount: string
  fxSnapshotId: string
  evidenceHash: string
}

export type FundedAllocationCohortInput = {
  projectId: number
  projectKey: string
  userId: string
  projectPseudonym: string
  lockedScore: string
  lockedMaximumScore: string
  cubidEvidenceHash: string
}

export type FundedRedistributionInput = {
  cycleKey: string
  manifestHash: string
  minorUnitScale: number
  sources: FundedAllocationSourceInput[]
  cohort: FundedAllocationCohortInput[]
}

export type FundedSourceDisposition = {
  sourceLotId: string
  sourceLotKey: string
  userId: string | null
  projectId: number
  kind: "initial_retained" | "score_pool" | "overlap_pool" | "top_up" | "returned_residue"
  canonicalMinor: string
  exactUsd: string
}

export type FundedUserAllocation = {
  userId: string
  aggregateInitialExactUsd: string
  baselineExactUsd: string
  exactCapUsd: string
  minorUnitCap: string
  retainedInitialMinor: string
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

export type FundedRedistributionResult = {
  policy: typeof FUNDED_REDISTRIBUTION_POLICY
  cycleKey: string
  manifestHash: string
  minorUnitScale: number
  totals: {
    fundedExactUsd: string
    fundedMinor: string
    retainedInitialMinor: string
    scorePoolMinor: string
    overlapPoolMinor: string
    topUpMinor: string
    returnedResidueMinor: string
    finalAllocationMinor: string
    subMinorExactUsd: string
  }
  users: FundedUserAllocation[]
  sourceDispositions: FundedSourceDisposition[]
  invariantChecks: Array<{ code: string; ok: boolean }>
  hashInput: unknown
  resultHash: string
}

const ZERO: Fraction = { numerator: BIGINT_ZERO, denominator: BIGINT_ONE }

function abs(value: bigint) {
  return value < BIGINT_ZERO ? -value : value
}

function gcd(left: bigint, right: bigint): bigint {
  let a = abs(left)
  let b = abs(right)
  while (b !== BIGINT_ZERO) {
    const next = a % b
    a = b
    b = next
  }
  return a === BIGINT_ZERO ? BIGINT_ONE : a
}

function fraction(numerator: bigint, denominator = BIGINT_ONE): Fraction {
  if (denominator === BIGINT_ZERO) throw new Error("funded_allocation_division_by_zero")
  const sign = denominator < BIGINT_ZERO ? -BIGINT_ONE : BIGINT_ONE
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
  return difference < BIGINT_ZERO ? -1 : difference > BIGINT_ZERO ? 1 : 0
}

function floorFraction(value: Fraction) {
  if (value.numerator < BIGINT_ZERO) throw new Error("funded_allocation_negative_value")
  return value.numerator / value.denominator
}

function power10(scale: number) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) throw new Error("funded_allocation_minor_scale_invalid")
  let result = BIGINT_ONE
  for (let index = 0; index < scale; index += 1) result *= BIGINT_TEN
  return result
}

function parseDecimal(value: string): Fraction {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error("funded_allocation_decimal_invalid")
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
  const negative = value.numerator < BIGINT_ZERO
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
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

async function sha256Hex(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableStringify(value)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

type RoundingCandidate = {
  key: string
  exactMinor: Fraction
  capacity?: bigint
}

function allocateMinorTarget(candidates: RoundingCandidate[], target: bigint) {
  const assigned = new Map<string, bigint>()
  for (const candidate of candidates) {
    const floored = floorFraction(candidate.exactMinor)
    assigned.set(candidate.key, candidate.capacity == null ? floored : floored < candidate.capacity ? floored : candidate.capacity)
  }
  let remaining = target - [...assigned.values()].reduce((sum, value) => sum + value, BIGINT_ZERO)
  const order = [...candidates].sort((left, right) => {
    const leftFloor = floorFraction(left.exactMinor)
    const rightFloor = floorFraction(right.exactMinor)
    const fractionOrder = compare(
      subtract(right.exactMinor, fraction(rightFloor)),
      subtract(left.exactMinor, fraction(leftFloor)),
    )
    return fractionOrder || stableCompare(left.key, right.key)
  })
  while (remaining > BIGINT_ZERO) {
    let progressed = false
    for (const candidate of order) {
      if (remaining === BIGINT_ZERO) break
      const current = assigned.get(candidate.key) ?? BIGINT_ZERO
      if (candidate.capacity != null && current >= candidate.capacity) continue
      assigned.set(candidate.key, current + BIGINT_ONE)
      remaining -= BIGINT_ONE
      progressed = true
    }
    if (!progressed) break
  }
  if (remaining !== BIGINT_ZERO) throw new Error("funded_allocation_rounding_capacity_exhausted")
  return assigned
}

type ExactClaim = {
  key: string
  userId: string
  projectId: number
  source: FundedAllocationSourceInput
  theoretical: Fraction
  initial: Fraction
  scoreContribution: Fraction
}

function validateAndNormalize(input: FundedRedistributionInput) {
  if (!/^\d{4}-\d{2}$/.test(input.cycleKey) || !/^[0-9a-f]{64}$/.test(input.manifestHash)) {
    throw new Error("funded_allocation_manifest_invalid")
  }
  const scale = input.minorUnitScale
  power10(scale)
  const sources = [...input.sources].sort(
    (left, right) => stableCompare(left.sourceOrder, right.sourceOrder) || stableCompare(left.sourceLotKey, right.sourceLotKey),
  )
  if (sources.length === 0) throw new Error("funded_allocation_sources_missing")
  const sourceKeys = new Set<string>()
  for (const source of sources) {
    if (sourceKeys.has(source.sourceLotKey)) throw new Error("funded_allocation_source_duplicate")
    sourceKeys.add(source.sourceLotKey)
    if (source.minorUnitScale !== scale || compare(parseDecimal(source.exactUsd), ZERO) <= 0) {
      throw new Error("funded_allocation_source_invalid")
    }
  }
  const cohort = [...input.cohort].sort(
    (left, right) => left.projectId - right.projectId || stableCompare(left.userId, right.userId),
  )
  const cohortKeys = new Set<string>()
  for (const member of cohort) {
    const key = `${member.projectId}:${member.userId}`
    if (cohortKeys.has(key)) throw new Error("funded_allocation_cohort_duplicate")
    cohortKeys.add(key)
    const score = parseDecimal(member.lockedScore)
    const maximum = parseDecimal(member.lockedMaximumScore)
    if (compare(maximum, ZERO) <= 0 || compare(score, ZERO) < 0 || compare(score, maximum) > 0) {
      throw new Error("funded_allocation_score_invalid")
    }
  }
  return { sources, cohort, scale }
}

export async function calculateFundedRedistribution(input: FundedRedistributionInput): Promise<FundedRedistributionResult> {
  const { sources, cohort, scale } = validateAndNormalize(input)
  const sourcesByProject = new Map<number, FundedAllocationSourceInput[]>()
  for (const source of sources) {
    const rows = sourcesByProject.get(source.projectId) ?? []
    rows.push(source)
    sourcesByProject.set(source.projectId, rows)
  }
  const cohortByProject = new Map<number, FundedAllocationCohortInput[]>()
  for (const member of cohort) {
    const rows = cohortByProject.get(member.projectId) ?? []
    rows.push(member)
    cohortByProject.set(member.projectId, rows)
  }

  for (const projectId of sourcesByProject.keys()) {
    if ((cohortByProject.get(projectId)?.length ?? 0) === 0) throw new Error("funded_allocation_project_cohort_missing")
  }

  const fundedExact = sources.reduce((sum, source) => add(sum, parseDecimal(source.exactUsd)), ZERO)
  const fundedMinor = floorFraction(toMinorFraction(fundedExact, scale))
  const sourceCapacity = allocateMinorTarget(
    sources.map((source) => ({ key: source.sourceLotKey, exactMinor: toMinorFraction(parseDecimal(source.exactUsd), scale) })),
    fundedMinor,
  )

  const claims: ExactClaim[] = []
  for (const source of sources) {
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
  for (const source of sources) {
    const sourceClaims = claims.filter((claim) => claim.source.sourceLotKey === source.sourceLotKey)
    const candidates = [
      ...sourceClaims.map((claim) => ({ key: `initial:${claim.key}`, exactMinor: toMinorFraction(claim.initial, scale) })),
      ...sourceClaims.map((claim) => ({ key: `score:${claim.key}`, exactMinor: toMinorFraction(claim.scoreContribution, scale) })),
    ]
    const assigned = allocateMinorTarget(candidates, sourceCapacity.get(source.sourceLotKey) ?? BIGINT_ZERO)
    for (const claim of sourceClaims) canonicalInitialByClaim.set(claim.key, assigned.get(`initial:${claim.key}`) ?? BIGINT_ZERO)
    canonicalScorePoolBySource.set(
      source.sourceLotKey,
      sourceClaims.reduce((sum, claim) => sum + (assigned.get(`score:${claim.key}`) ?? BIGINT_ZERO), BIGINT_ZERO),
    )
  }

  const userIds = [...new Set(cohort.map((member) => member.userId))].sort(stableCompare)
  const retainedByClaim = new Map<string, bigint>()
  const exactRetainedByClaim = new Map<string, Fraction>()
  const overlapPoolBySource = new Map(sources.map((source) => [source.sourceLotKey, BIGINT_ZERO]))
  const userState = userIds.map((userId) => {
    const userClaims = claims.filter((claim) => claim.userId === userId)
    const projectTotals = new Map<number, Fraction>()
    for (const claim of userClaims) projectTotals.set(claim.projectId, add(projectTotals.get(claim.projectId) ?? ZERO, claim.initial))
    const aggregate = userClaims.reduce((sum, claim) => add(sum, claim.initial), ZERO)
    const baseline = [...projectTotals.values()].reduce((largest, value) => (compare(value, largest) > 0 ? value : largest), ZERO)
    const exactCap = multiply(baseline, fraction(FUNDED_REDISTRIBUTION_CAP_MULTIPLE))
    const retention = compare(aggregate, exactCap) > 0 ? divide(exactCap, aggregate) : fraction(BIGINT_ONE)
    const rawRetained = multiply(aggregate, retention)
    const capMinor = floorFraction(toMinorFraction(exactCap, scale))
    const canonicalInitialCapacity=userClaims.reduce((sum,claim)=>sum+(canonicalInitialByClaim.get(claim.key) ?? BIGINT_ZERO),BIGINT_ZERO)
    const retainedTarget = [floorFraction(toMinorFraction(rawRetained, scale)), capMinor, canonicalInitialCapacity].reduce((a, b) => (a < b ? a : b))
    const assigned = allocateMinorTarget(
      userClaims.map((claim) => ({
        key: claim.key,
        exactMinor: toMinorFraction(multiply(claim.initial, retention), scale),
        capacity: canonicalInitialByClaim.get(claim.key) ?? BIGINT_ZERO,
      })),
      retainedTarget,
    )
    for (const claim of userClaims) {
      exactRetainedByClaim.set(claim.key, multiply(claim.initial, retention))
      const retained = assigned.get(claim.key) ?? BIGINT_ZERO
      retainedByClaim.set(claim.key, retained)
      const overflow = (canonicalInitialByClaim.get(claim.key) ?? BIGINT_ZERO) - retained
      overlapPoolBySource.set(claim.source.sourceLotKey, (overlapPoolBySource.get(claim.source.sourceLotKey) ?? BIGINT_ZERO) + overflow)
    }
    return {
      userId,
      aggregate,
      baseline,
      exactCap,
      capMinor,
      currentMinor: retainedTarget,
      retainedMinor: retainedTarget,
      topUpMinor: BIGINT_ZERO,
      claims: userClaims,
    }
  })

  let poolMinor = sources.reduce(
    (sum, source) =>
      sum + (canonicalScorePoolBySource.get(source.sourceLotKey) ?? BIGINT_ZERO) + (overlapPoolBySource.get(source.sourceLotKey) ?? BIGINT_ZERO),
    BIGINT_ZERO,
  )
  let waterfillIterations=0
  const maximumWaterfillIterations=userState.length*4+sources.length+10
  while (poolMinor > BIGINT_ZERO) {
    waterfillIterations+=1
    if(waterfillIterations>maximumWaterfillIterations) throw new Error("funded_allocation_waterfill_stalled")
    const candidates = userState
      .filter((user) => user.currentMinor < user.capMinor && user.capMinor > BIGINT_ZERO)
      .sort(
        (left, right) =>
          (left.currentMinor < right.currentMinor ? -1 : left.currentMinor > right.currentMinor ? 1 : 0) ||
          compare(left.aggregate, right.aggregate) ||
          compare(left.baseline, right.baseline) ||
          stableCompare(left.userId, right.userId),
      )
    if (candidates.length === 0) break
    const level = candidates[0].currentMinor
    const group = candidates.filter((candidate) => candidate.currentMinor === level)
    const nextLevel = candidates.find((candidate) => candidate.currentMinor > level)?.currentMinor
    const groupCap = group.reduce((lowest, user) => (user.capMinor < lowest ? user.capMinor : lowest), group[0].capMinor)
    const target = nextLevel == null || groupCap < nextLevel ? groupCap : nextLevel
    const needed = (target - level) * BigInt(group.length)
    if (needed > BIGINT_ZERO && needed <= poolMinor) {
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
      const delta = perUser + (BigInt(index) < residual ? BIGINT_ONE : BIGINT_ZERO)
      const bounded = delta < user.capMinor - user.currentMinor ? delta : user.capMinor - user.currentMinor
      user.currentMinor += bounded
      user.topUpMinor += bounded
      poolMinor -= bounded
    }
    if (perUser === BIGINT_ZERO && residual === BIGINT_ZERO) break
  }

  const sourceDispositions: FundedSourceDisposition[] = []
  for (const claim of claims) {
    const retained = retainedByClaim.get(claim.key) ?? BIGINT_ZERO
    if (retained > BIGINT_ZERO) {
      sourceDispositions.push({
        sourceLotId: claim.source.sourceLotId,
        sourceLotKey: claim.source.sourceLotKey,
        userId: claim.userId,
        projectId: claim.projectId,
        kind: "initial_retained",
        canonicalMinor: retained.toString(),
        exactUsd: decimalString(exactRetainedByClaim.get(claim.key) ?? ZERO),
      })
    }
  }
  const availablePoolBySource = new Map<string, bigint>()
  for (const source of sources) {
    const score = canonicalScorePoolBySource.get(source.sourceLotKey) ?? BIGINT_ZERO
    const overlap = overlapPoolBySource.get(source.sourceLotKey) ?? BIGINT_ZERO
    const sourceClaims=claims.filter(claim=>claim.source.sourceLotKey===source.sourceLotKey)
    const exactScore=sourceClaims.reduce((sum,claim)=>add(sum,claim.scoreContribution),ZERO)
    const exactOverlap=sourceClaims.reduce((sum,claim)=>subtract(add(sum,claim.initial),exactRetainedByClaim.get(claim.key) ?? ZERO),ZERO)
    availablePoolBySource.set(source.sourceLotKey, score + overlap)
    if (score > BIGINT_ZERO) sourceDispositions.push({ sourceLotId: source.sourceLotId, sourceLotKey: source.sourceLotKey, userId: null, projectId: source.projectId, kind: "score_pool", canonicalMinor: score.toString(), exactUsd: decimalString(exactScore) })
    if (overlap > BIGINT_ZERO) sourceDispositions.push({ sourceLotId: source.sourceLotId, sourceLotKey: source.sourceLotKey, userId: null, projectId: source.projectId, kind: "overlap_pool", canonicalMinor: overlap.toString(), exactUsd: decimalString(exactOverlap) })
  }
  for (const user of [...userState].sort((left, right) => stableCompare(left.userId, right.userId))) {
    let needed = user.topUpMinor
    for (const source of sources) {
      if (needed === BIGINT_ZERO) break
      const available = availablePoolBySource.get(source.sourceLotKey) ?? BIGINT_ZERO
      const consumed = needed < available ? needed : available
      if (consumed === BIGINT_ZERO) continue
      sourceDispositions.push({ sourceLotId: source.sourceLotId, sourceLotKey: source.sourceLotKey, userId: user.userId, projectId: source.projectId, kind: "top_up", canonicalMinor: consumed.toString(), exactUsd: decimalString(fraction(consumed,power10(scale))) })
      availablePoolBySource.set(source.sourceLotKey, available - consumed)
      needed -= consumed
    }
    if (needed !== BIGINT_ZERO) throw new Error("funded_allocation_pool_provenance_exhausted")
  }
  for (const source of sources) {
    const residue = availablePoolBySource.get(source.sourceLotKey) ?? BIGINT_ZERO
    if (residue > BIGINT_ZERO) sourceDispositions.push({ sourceLotId: source.sourceLotId, sourceLotKey: source.sourceLotKey, userId: null, projectId: source.projectId, kind: "returned_residue", canonicalMinor: residue.toString(), exactUsd: decimalString(fraction(residue,power10(scale))) })
  }

  const users: FundedUserAllocation[] = userState.map((user) => {
    const projectClaims = [...new Set(user.claims.map((claim) => claim.projectId))]
      .sort((a, b) => a - b)
      .map((projectId) => {
        const rows = user.claims.filter((claim) => claim.projectId === projectId)
        const theoretical = rows.reduce((sum, row) => add(sum, row.theoretical), ZERO)
        const initial = rows.reduce((sum, row) => add(sum, row.initial), ZERO)
        const contribution = rows.reduce((sum, row) => add(sum, row.scoreContribution), ZERO)
        const member = cohort.find((row) => row.projectId === projectId && row.userId === user.userId)
        return {
          projectId,
          theoreticalShareExactUsd: decimalString(theoretical),
          scoreFactor: member ? decimalString(divide(parseDecimal(member.lockedScore), parseDecimal(member.lockedMaximumScore))) : "0",
          initialClaimExactUsd: decimalString(initial),
          scorePoolContributionExactUsd: decimalString(contribution),
        }
      })
    return {
      userId: user.userId,
      aggregateInitialExactUsd: decimalString(user.aggregate),
      baselineExactUsd: decimalString(user.baseline),
      exactCapUsd: decimalString(user.exactCap),
      minorUnitCap: user.capMinor.toString(),
      retainedInitialMinor: user.retainedMinor.toString(),
      topUpMinor: user.topUpMinor.toString(),
      finalMinor: user.currentMinor.toString(),
      projectClaims,
    }
  })

  const retainedInitialMinor = userState.reduce((sum, user) => sum + user.retainedMinor, BIGINT_ZERO)
  const scorePoolMinor = [...canonicalScorePoolBySource.values()].reduce((sum, value) => sum + value, BIGINT_ZERO)
  const overlapPoolMinor = [...overlapPoolBySource.values()].reduce((sum, value) => sum + value, BIGINT_ZERO)
  const topUpMinor = userState.reduce((sum, user) => sum + user.topUpMinor, BIGINT_ZERO)
  const returnedResidueMinor = [...availablePoolBySource.values()].reduce((sum, value) => sum + value, BIGINT_ZERO)
  const finalAllocationMinor = userState.reduce((sum, user) => sum + user.currentMinor, BIGINT_ZERO)
  const canonicalConserved = finalAllocationMinor + returnedResidueMinor === fundedMinor
  const capRespected = userState.every((user) => user.currentMinor <= user.capMinor)
  const sourceConserved = sources.every((source) =>
    sourceDispositions
      .filter((row) => row.sourceLotKey === source.sourceLotKey && row.kind !== "score_pool" && row.kind !== "overlap_pool")
      .reduce((sum, row) => sum + BigInt(row.canonicalMinor), BIGINT_ZERO) === (sourceCapacity.get(source.sourceLotKey) ?? BIGINT_ZERO),
  )
  if (!canonicalConserved || !capRespected || !sourceConserved) throw new Error("funded_allocation_invariant_failed")

  const totals = {
    fundedExactUsd: decimalString(fundedExact),
    fundedMinor: fundedMinor.toString(),
    retainedInitialMinor: retainedInitialMinor.toString(),
    scorePoolMinor: scorePoolMinor.toString(),
    overlapPoolMinor: overlapPoolMinor.toString(),
    topUpMinor: topUpMinor.toString(),
    returnedResidueMinor: returnedResidueMinor.toString(),
    finalAllocationMinor: finalAllocationMinor.toString(),
    subMinorExactUsd: decimalString(subtract(fundedExact, fraction(fundedMinor, power10(scale)))),
  }
  const invariantChecks = [
    { code: "canonical_minor_conservation", ok: canonicalConserved },
    { code: "user_caps_respected", ok: capRespected },
    { code: "source_provenance_conserved", ok: sourceConserved },
    { code: "pool_consumption_conserved", ok: topUpMinor + returnedResidueMinor === scorePoolMinor + overlapPoolMinor },
  ]
  const hashInput = {
    policy: FUNDED_REDISTRIBUTION_POLICY,
    cycleKey: input.cycleKey,
    manifestHash: input.manifestHash,
    minorUnitScale: scale,
    totals,
    users,
    sourceDispositions: sourceDispositions.sort(
      (left, right) => stableCompare(left.sourceLotKey, right.sourceLotKey) || stableCompare(left.kind, right.kind) || stableCompare(left.userId ?? "", right.userId ?? ""),
    ),
    invariantChecks,
  }
  return { ...hashInput, hashInput, resultHash: await sha256Hex(hashInput) }
}
