import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const DRAFT_BANNER = "DRAFT - NOT APPROVED - NOT EFFECTIVE"
export const PACKET_SCHEMA = "fundloop.counsel-review-packet/v1"
export const REQUIRED_DECISIONS = [
  "ownership-refunds-escrow",
  "payout-ownership-and-finality",
  "holds-expiry-and-carryover",
  "sanctions-and-payment-regulation",
  "privacy-consent-and-invitations",
  "governing-law-and-disputes",
  "prominent-disclosures-and-acceptance",
]

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}
export const counselReviewPacketDigest = (packet) => {
  const unsigned = { ...packet }
  delete unsigned.packetSha256
  return sha256(`${JSON.stringify(canonicalize(unsigned))}\n`)
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const isSha256 = (value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value)
const assertExactKeys = (value, expectedKeys, label) => {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} has unknown or missing fields`)
}

export function verifyCounselReviewPacket({ packet, repoRoot }) {
  assertExactKeys(packet, [
    "schemaVersion", "status", "packetId", "preparedAt", "effectiveDate", "entity",
    "reviewJurisdiction", "productionAuthority", "valueFlowAuthority", "sourceArtifacts",
    "runtimeEvidence", "decisions", "packetSha256",
  ], "counsel packet")
  assert(packet.schemaVersion === PACKET_SCHEMA, "unexpected counsel packet schema")
  assert(packet.status === DRAFT_BANNER, "counsel packet must remain visibly non-effective")
  assert(packet.effectiveDate === null, "draft counsel packet cannot have an effective date")
  assert(packet.productionAuthority === false, "draft counsel packet cannot grant production authority")
  assert(packet.valueFlowAuthority === false, "draft counsel packet cannot grant value-flow authority")
  assert(/^fundloop-ca-counsel-review-\d{4}-\d{2}-\d{2}-v\d+$/.test(packet.packetId), "invalid packet id")

  const artifactPaths = new Set()
  for (const group of [packet.sourceArtifacts, packet.runtimeEvidence]) {
    assert(Array.isArray(group) && group.length > 0, "packet evidence groups cannot be empty")
    for (const item of group) {
      assertExactKeys(item, group === packet.sourceArtifacts ? ["path", "role", "sha256"] : ["path", "control", "sha256"], `evidence item ${item?.path ?? "unknown"}`)
      assert(typeof item.path === "string" && !item.path.startsWith("/") && !item.path.includes(".."), "unsafe evidence path")
      assert(!artifactPaths.has(item.path), `duplicate evidence path: ${item.path}`)
      artifactPaths.add(item.path)
      const bytes = readFileSync(resolve(repoRoot, item.path))
      assert(isSha256(item.sha256) && sha256(bytes) === item.sha256, `evidence digest mismatch: ${item.path}`)
      if (item.path.startsWith("docs/legal/review-drafts/") && item.path.endsWith(".md")) {
        assert(bytes.toString("utf8").startsWith(`# ${DRAFT_BANNER}\n`), `missing draft banner: ${item.path}`)
      }
    }
  }

  assert(Array.isArray(packet.decisions), "packet decisions are required")
  const decisionIds = packet.decisions.map((decision) => decision.id)
  assert(JSON.stringify(decisionIds) === JSON.stringify(REQUIRED_DECISIONS), "counsel decisions are missing, reordered, or unexpected")
  for (const decision of packet.decisions) {
    assertExactKeys(decision, [
      "id", "title", "status", "sourceArtifacts", "runtimeEvidence", "authoritativeSources",
      "approver", "decision", "conditions", "decidedAt", "engineeringDisposition", "reReviewTriggers",
    ], `decision ${decision?.id ?? "unknown"}`)
    assertExactKeys(decision.approver, ["name", "professionalStatus", "engagementReference"], `decision ${decision.id} approver`)
    assert(decision.status === "pending_qualified_counsel", `${decision.id} must remain pending qualified counsel`)
    assert(decision.engineeringDisposition === "production_blocked_pending_qualified_counsel", `${decision.id} must block production`)
    assert(Array.isArray(decision.sourceArtifacts) && decision.sourceArtifacts.length > 0, `${decision.id} needs draft sources`)
    assert(Array.isArray(decision.runtimeEvidence) && decision.runtimeEvidence.length > 0, `${decision.id} needs runtime evidence`)
    assert(decision.sourceArtifacts.every((path) => artifactPaths.has(path)), `${decision.id} references an unknown draft source`)
    assert(decision.runtimeEvidence.every((path) => artifactPaths.has(path)), `${decision.id} references unknown runtime evidence`)
    assert(Array.isArray(decision.authoritativeSources) && decision.authoritativeSources.every((url) => /^https:\/\//.test(url)), `${decision.id} has invalid sources`)
    assert(decision.approver?.name === null && decision.approver?.professionalStatus === null && decision.approver?.engagementReference === null, `${decision.id} must not fabricate an approver`)
    assert(decision.decision === null && decision.conditions === null && decision.decidedAt === null, `${decision.id} must not fabricate a conclusion`)
    assert(Array.isArray(decision.reReviewTriggers) && decision.reReviewTriggers.length > 0, `${decision.id} needs re-review triggers`)
  }

  assert(isSha256(packet.packetSha256), "packet self digest is invalid")
  assert(counselReviewPacketDigest(packet) === packet.packetSha256, "packet self digest mismatch")
  return { ok: true, packetId: packet.packetId, packetSha256: packet.packetSha256 }
}

export function writeCounselReviewPacket({ packetPath, repoRoot }) {
  const packet = JSON.parse(readFileSync(packetPath, "utf8"))
  for (const group of [packet.sourceArtifacts, packet.runtimeEvidence]) {
    for (const item of group) item.sha256 = sha256(readFileSync(resolve(repoRoot, item.path)))
  }
  packet.packetSha256 = counselReviewPacketDigest(packet)
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`)
  return verifyCounselReviewPacket({ packet, repoRoot })
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const repoRoot = resolve(dirname(scriptPath), "..")
  const packetPath = resolve(repoRoot, "docs/legal/review-drafts/counsel-review-packet.json")
  const command = process.argv[2] ?? "verify"
  const packet = command === "write"
    ? writeCounselReviewPacket({ packetPath, repoRoot })
    : verifyCounselReviewPacket({ packet: JSON.parse(readFileSync(packetPath, "utf8")), repoRoot })
  process.stdout.write(`${JSON.stringify(packet)}\n`)
}
