import { describe, expect, it } from "vitest"
import {
  calculateFundedRedistribution,
  type FundedAllocationCohortInput,
  type FundedAllocationSourceInput,
} from "@/lib/monthly-cycles/funded-redistribution-calculator"

function source(projectId: number, exactUsd: string, suffix = "0"): FundedAllocationSourceInput {
  return {
    sourceLotId: `${projectId}-${suffix}`,
    sourceLotKey: `source-${projectId}-${suffix}`,
    projectId,
    projectKey: `project-${projectId}`,
    exactUsd,
    minorUnitScale: 2,
    sourceOrder: `${projectId.toString().padStart(3, "0")}-${suffix}`,
    railKey: "stripe_bank_transfer",
    assetKey: "usd",
    custodyKey: "stripe_usd_review",
    nativeAtomicAmount: exactUsd.replace(".", ""),
    fxSnapshotId: "1",
    evidenceHash: "a".repeat(64),
  }
}

function member(projectId: number, userId: string, score: string, maximum = "20"): FundedAllocationCohortInput {
  return {
    projectId,
    projectKey: `project-${projectId}`,
    userId,
    projectPseudonym: `${projectId}-${userId}`,
    lockedScore: score,
    lockedMaximumScore: maximum,
    cubidEvidenceHash: "b".repeat(64),
  }
}

const manifestHash = "c".repeat(64)

describe("settled Cubid redistribution", () => {
  it("reproduces the canonical A+B pool and deterministic 10/87 cent split", async () => {
    const projectBUsers = Array.from({ length: 100 }, (_, index) => `user-${index.toString().padStart(3, "0")}`)
    const result = await calculateFundedRedistribution({
      cycleKey: "2026-08",
      manifestHash,
      minorUnitScale: 2,
      sources: [source(1, "300"), source(2, "1000")],
      cohort: [
        member(1, projectBUsers[0], "5"),
        member(1, projectBUsers[1], "10"),
        member(1, projectBUsers[2], "15"),
        ...projectBUsers.map((userId) => member(2, userId, "10")),
      ],
    })

    expect(result.totals).toMatchObject({
      fundedMinor: "130000",
      scorePoolMinor: "65000",
      overlapPoolMinor: "0",
      topUpMinor: "65000",
      returnedResidueMinor: "0",
      finalAllocationMinor: "130000",
    })
    expect(result.users.find((user) => user.userId === "user-000")).toMatchObject({ finalMinor: "3000", topUpMinor: "0" })
    expect(result.users.find((user) => user.userId === "user-001")).toMatchObject({ finalMinor: "5500", topUpMinor: "0" })
    expect(result.users.find((user) => user.userId === "user-002")).toMatchObject({ finalMinor: "8000", topUpMinor: "0" })
    const onlyB = result.users.filter((user) => Number(user.userId.slice(-3)) >= 3)
    expect(onlyB.filter((user) => user.finalMinor === "1171")).toHaveLength(10)
    expect(onlyB.filter((user) => user.finalMinor === "1170")).toHaveLength(87)
    expect(onlyB.every((user) => BigInt(user.finalMinor) <= BigInt(user.minorUnitCap))).toBe(true)
    expect(result.invariantChecks.every((check) => check.ok)).toBe(true)
  })

  it("clamps four overlapping $100 claims to $300 and returns four sourced $25 overflow lots", async () => {
    const sources = [1, 2, 3, 4].map((projectId) => source(projectId, "100"))
    const result = await calculateFundedRedistribution({
      cycleKey: "2026-08",
      manifestHash,
      minorUnitScale: 2,
      sources,
      cohort: sources.map((row) => member(row.projectId, "overlap-user", "20")),
    })

    expect(result.users[0]).toMatchObject({ retainedInitialMinor: "30000", minorUnitCap: "30000", topUpMinor: "0" })
    expect(result.totals).toMatchObject({ overlapPoolMinor: "10000", returnedResidueMinor: "10000" })
    expect(
      result.sourceDispositions
        .filter((row) => row.kind === "overlap_pool")
        .map((row) => row.canonicalMinor),
    ).toEqual(["2500", "2500", "2500", "2500"])
  })

  it("floors the fractional cap and preserves $0.34 of source-linked overflow", async () => {
    const sources = [1, 2, 3, 4].map((projectId) => source(projectId, "0.335"))
    const result = await calculateFundedRedistribution({
      cycleKey: "2026-08",
      manifestHash,
      minorUnitScale: 2,
      sources,
      cohort: sources.map((row) => member(row.projectId, "fractional-user", "20")),
    })

    expect(result.users[0]).toMatchObject({ exactCapUsd: "1.005", minorUnitCap: "100", retainedInitialMinor: "100" })
    expect(result.totals).toMatchObject({ fundedMinor: "134", overlapPoolMinor: "34", returnedResidueMinor: "34" })
    expect(result.users[0].finalMinor).not.toBe("101")
  })

  it("is invariant to source and cohort input order", async () => {
    const sources = [source(1, "12.34", "b"), source(1, "5.67", "a"), source(2, "9.99")]
    const cohort = [member(1, "user-b", "10"), member(1, "user-a", "5"), member(2, "user-a", "20")]
    const first = await calculateFundedRedistribution({ cycleKey: "2026-08", manifestHash, minorUnitScale: 2, sources, cohort })
    const second = await calculateFundedRedistribution({
      cycleKey: "2026-08",
      manifestHash,
      minorUnitScale: 2,
      sources: [...sources].reverse(),
      cohort: [...cohort].reverse(),
    })
    expect(second.resultHash).toBe(first.resultHash)
  })

  it("rejects invalid maximum and out-of-range locked scores", async () => {
    await expect(
      calculateFundedRedistribution({
        cycleKey: "2026-08",
        manifestHash,
        minorUnitScale: 2,
        sources: [source(1, "100")],
        cohort: [member(1, "user-a", "21")],
      }),
    ).rejects.toThrow("funded_allocation_score_invalid")
    await expect(
      calculateFundedRedistribution({
        cycleKey: "2026-08",
        manifestHash,
        minorUnitScale: 2,
        sources: [source(1, "100")],
        cohort: [member(1, "user-a", "0", "0")],
      }),
    ).rejects.toThrow("funded_allocation_score_invalid")
  })

  it("preserves caps, source conservation, hashes, and permutations across deterministic overlap fixtures", async () => {
    let state=0x1362026
    const random=()=>{state=(state*1664525+1013904223)>>>0;return state}
    for(let fixture=0;fixture<500;fixture+=1){
      const projectCount=1+(random()%4)
      const userCount=1+(random()%6)
      const users=Array.from({length:userCount},(_,index)=>`property-user-${index.toString().padStart(2,"0")}`)
      const sources:FundedAllocationSourceInput[]=[]
      const cohort:FundedAllocationCohortInput[]=[]
      for(let projectId=1;projectId<=projectCount;projectId+=1){
        const sourceCount=1+(random()%3)
        for(let sourceIndex=0;sourceIndex<sourceCount;sourceIndex+=1){
          const mills=1+(random()%250000)
          sources.push(source(projectId,`${Math.floor(mills/1000)}.${String(mills%1000).padStart(3,"0")}`,String(sourceIndex)))
        }
        const eligible=users.filter((_,index)=>index===0||random()%2===0)
        for(const userId of eligible) cohort.push(member(projectId,userId,String(random()%21)))
      }
      const input={cycleKey:"2026-08",manifestHash,minorUnitScale:2,sources,cohort}
      const first=await calculateFundedRedistribution(input)
      const permuted=await calculateFundedRedistribution({...input,sources:[...sources].reverse(),cohort:[...cohort].reverse()})
      expect(first.invariantChecks.every(check=>check.ok)).toBe(true)
      expect(first.users.every(user=>BigInt(user.finalMinor)<=BigInt(user.minorUnitCap))).toBe(true)
      expect(BigInt(first.totals.finalAllocationMinor)+BigInt(first.totals.returnedResidueMinor)).toBe(BigInt(first.totals.fundedMinor))
      expect(permuted.resultHash).toBe(first.resultHash)
    }
  })

  it("classifies a material locked-score change through a different result hash", async () => {
    const input={cycleKey:"2026-08",manifestHash,minorUnitScale:2,sources:[source(1,"100")],cohort:[member(1,"user-a","10")]}
    const first=await calculateFundedRedistribution(input)
    const changed=await calculateFundedRedistribution({...input,cohort:[member(1,"user-a","11")]})
    expect(changed.resultHash).not.toBe(first.resultHash)
  })
})
