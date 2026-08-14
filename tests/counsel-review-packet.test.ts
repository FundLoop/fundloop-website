import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  counselReviewPacketDigest,
  DRAFT_BANNER,
  REQUIRED_DECISIONS,
  verifyCounselReviewPacket,
} from "../scripts/verify-counsel-review-packet.mjs"

const repoRoot = process.cwd()
const packetPath = resolve(repoRoot, "docs/legal/review-drafts/counsel-review-packet.json")
const loadPacket = () => JSON.parse(readFileSync(packetPath, "utf8"))

describe("qualified counsel review packet", () => {
  it("binds every draft and runtime control to the non-effective packet", () => {
    const packet = loadPacket()
    expect(verifyCounselReviewPacket({ packet, repoRoot })).toEqual({
      ok: true,
      packetId: "fundloop-ca-counsel-review-2026-08-14-v1",
      packetSha256: packet.packetSha256,
    })
    expect(packet.status).toBe(DRAFT_BANNER)
    expect(packet.decisions.map((decision: { id: string }) => decision.id)).toEqual(REQUIRED_DECISIONS)
  })

  it("rejects a fabricated professional approval", () => {
    const packet = loadPacket()
    packet.decisions[0].status = "approved"
    packet.decisions[0].approver.name = "Invented Reviewer"
    expect(() => verifyCounselReviewPacket({ packet, repoRoot })).toThrow("must remain pending qualified counsel")
  })

  it("rejects production or value-flow authority", () => {
    const production = loadPacket()
    production.productionAuthority = true
    expect(() => verifyCounselReviewPacket({ packet: production, repoRoot })).toThrow("cannot grant production authority")

    const valueFlow = loadPacket()
    valueFlow.valueFlowAuthority = true
    expect(() => verifyCounselReviewPacket({ packet: valueFlow, repoRoot })).toThrow("cannot grant value-flow authority")
  })

  it("rejects recomputed manifests with unknown approval-bearing fields", () => {
    const topLevel = loadPacket()
    topLevel.qualifiedCounselApproval = { approved: true, reviewer: "Invented Reviewer" }
    topLevel.packetSha256 = counselReviewPacketDigest(topLevel)
    expect(() => verifyCounselReviewPacket({ packet: topLevel, repoRoot })).toThrow("counsel packet has unknown or missing fields")

    const decisionLevel = loadPacket()
    decisionLevel.decisions[0].approved = true
    decisionLevel.packetSha256 = counselReviewPacketDigest(decisionLevel)
    expect(() => verifyCounselReviewPacket({ packet: decisionLevel, repoRoot })).toThrow("decision ownership-refunds-escrow has unknown or missing fields")

    const approverLevel = loadPacket()
    approverLevel.decisions[0].approver.licenseVerified = true
    approverLevel.packetSha256 = counselReviewPacketDigest(approverLevel)
    expect(() => verifyCounselReviewPacket({ packet: approverLevel, repoRoot })).toThrow("decision ownership-refunds-escrow approver has unknown or missing fields")

    const nestedArray = loadPacket()
    nestedArray.decisions[0].reReviewTriggers.push({ qualifiedCounselApproval: true, reviewer: "Invented Reviewer" })
    nestedArray.packetSha256 = counselReviewPacketDigest(nestedArray)
    expect(() => verifyCounselReviewPacket({ packet: nestedArray, repoRoot })).toThrow("re-review triggers must contain only nonempty strings")
  })

  it("rejects non-string nested evidence references and sources", () => {
    for (const field of ["sourceArtifacts", "runtimeEvidence", "authoritativeSources"] as const) {
      const packet = loadPacket()
      packet.decisions[0][field].push({ path: "invented", approved: true })
      packet.packetSha256 = counselReviewPacketDigest(packet)
      expect(() => verifyCounselReviewPacket({ packet, repoRoot })).toThrow("must contain only nonempty strings")
    }
  })

  it("rejects missing decisions and unknown runtime mappings", () => {
    const missing = loadPacket()
    missing.decisions.splice(2, 1)
    expect(() => verifyCounselReviewPacket({ packet: missing, repoRoot })).toThrow("decisions are missing")

    const unknown = loadPacket()
    unknown.decisions[0].runtimeEvidence.push("supabase/migrations/not-reviewed.sql")
    expect(() => verifyCounselReviewPacket({ packet: unknown, repoRoot })).toThrow("unknown runtime evidence")
  })

  it("rejects changed source bytes and a recomputed-looking self digest", () => {
    const changedSource = loadPacket()
    changedSource.sourceArtifacts[0].sha256 = "0".repeat(64)
    expect(() => verifyCounselReviewPacket({ packet: changedSource, repoRoot })).toThrow("evidence digest mismatch")

    const changedPacket = loadPacket()
    changedPacket.packetSha256 = "f".repeat(64)
    expect(() => verifyCounselReviewPacket({ packet: changedPacket, repoRoot })).toThrow("packet self digest mismatch")
  })

  it("keeps all packet Markdown visibly non-effective and local links resolvable", () => {
    const packet = loadPacket()
    const markdown = packet.sourceArtifacts.filter((item: { path: string }) => item.path.endsWith(".md"))
    for (const item of markdown) {
      const text = readFileSync(resolve(repoRoot, item.path), "utf8")
      expect(text.startsWith(`# ${DRAFT_BANNER}\n`), item.path).toBe(true)
      for (const match of text.matchAll(/\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g)) {
        expect(() => readFileSync(resolve(repoRoot, "docs/legal/review-drafts", match[1]), "utf8"), `${item.path}: ${match[1]}`).not.toThrow()
      }
    }
  })
})
