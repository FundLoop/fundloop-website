import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const ACCOUNTING_DRAFT_BANNER = "DRAFT - NOT APPROVED - NOT EFFECTIVE"
export const REQUIRED_ACCOUNTING_DECISIONS = [
  "reporting-framework-and-currencies", "contribution-recognition-and-principal-agent",
  "custody-and-safeguarding", "fees-gross-net-and-tax", "fx-and-token-measurement",
  "awards-liabilities-and-payout-timing", "e3-harvest-claims-and-carryover",
  "refunds-disputes-reserves-and-losses", "opening-balances-and-cutover",
  "reconciliation-close-and-retention", "retention-and-unclaimed-property",
]
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value
export const accountingPacketDigest = (packet) => {
  const unsigned = { ...packet }; delete unsigned.packetSha256
  return sha256(`${JSON.stringify(canonical(unsigned))}\n`)
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const exactKeys = (value, keys, label) => {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} has unknown or missing fields`)
}
const signed = (posting, field) => BigInt(posting[field]) * (posting.side === "debit" ? 1n : -1n)

export function verifyAccountingReviewExample(example) {
  exactKeys(example, ["schemaVersion", "status", "scenarioId", "classification", "nativeCurrency", "nativeUnit", "functionalCurrency", "functionalUnit", "fxUsdPerNativeUnit", "events", "trialBalanceCheckpoints", "allocationMemorandum", "openingBalancePosted", "productionCutoverAuthorized", "valueFlowAuthorized"], "accounting example")
  assert(example.schemaVersion === "fundloop.accounting-review-example/v1" && example.status === ACCOUNTING_DRAFT_BANNER, "accounting example must remain a draft")
  assert(example.openingBalancePosted === false && example.productionCutoverAuthorized === false && example.valueFlowAuthorized === false, "accounting example cannot authorize cutover or value flow")
  assert(Array.isArray(example.events) && example.events.length === 4, "accounting example event set is incomplete")
  const balances = new Map()
  const snapshots = new Map()
  const coveredDecisions = new Set()
  for (const event of example.events) {
    exactKeys(event, ["id", "decisionRefs", "postings"], `event ${event?.id ?? "unknown"}`)
    assert(Array.isArray(event.decisionRefs) && event.decisionRefs.length > 0 && event.decisionRefs.every((id) => REQUIRED_ACCOUNTING_DECISIONS.includes(id)), `${event.id} has invalid decision references`)
    event.decisionRefs.forEach((id) => coveredDecisions.add(id))
    let native = 0n; let functional = 0n
    for (const posting of event.postings) {
      exactKeys(posting, ["account", "side", "nativeMinor", "functionalUsdCent"], `posting ${event.id}`)
      assert(["debit", "credit"].includes(posting.side) && /^\d+$/.test(posting.nativeMinor) && /^\d+$/.test(posting.functionalUsdCent), `${event.id} has invalid posting values`)
      native += signed(posting, "nativeMinor"); functional += signed(posting, "functionalUsdCent")
      const prior = balances.get(posting.account) ?? [0n, 0n]
      balances.set(posting.account, [prior[0] + signed(posting, "nativeMinor"), prior[1] + signed(posting, "functionalUsdCent")])
    }
    assert(native === 0n && functional === 0n, `${event.id} is not balanced in native and functional values`)
    snapshots.set(event.id, new Map([...balances].map(([key, value]) => [key, [...value]])))
  }
  for (const checkpoint of example.trialBalanceCheckpoints) {
    exactKeys(checkpoint, ["afterEvent", "balances"], `checkpoint ${checkpoint?.afterEvent ?? "unknown"}`)
    const actual = snapshots.get(checkpoint.afterEvent); assert(actual, `unknown checkpoint event ${checkpoint.afterEvent}`)
    assert(checkpoint.balances.length === actual.size, `checkpoint ${checkpoint.afterEvent} account count mismatch`)
    for (const row of checkpoint.balances) {
      exactKeys(row, ["account", "nativeMinor", "functionalUsdCent"], `checkpoint row ${checkpoint.afterEvent}`)
      const value = actual.get(row.account)
      assert(value && value[0] === BigInt(row.nativeMinor) && value[1] === BigInt(row.functionalUsdCent), `checkpoint mismatch: ${checkpoint.afterEvent}/${row.account}`)
    }
  }
  const memo = example.allocationMemorandum
  exactKeys(memo, ["journalPosted", "decisionRefs", "originDistributableUsdCent", "protectedTimelyClaimsUsdCent", "e3HarvestedUsdCent", "carryInUsdCent", "independentCurrentFundingUsdCent", "targetInputUsdCent", "capLimitedTopUpUsdCent", "carryOutUsdCent", "preservedInitialClaims", "releasedClaimsReeligible"], "allocation memorandum")
  assert(memo.journalPosted === false && memo.preservedInitialClaims === true && memo.releasedClaimsReeligible === true, "allocation memorandum boundary is invalid")
  assert(Array.isArray(memo.decisionRefs) && memo.decisionRefs.every((id) => REQUIRED_ACCOUNTING_DECISIONS.includes(id)), "allocation memorandum has invalid decision references")
  memo.decisionRefs.forEach((id) => coveredDecisions.add(id))
  assert(JSON.stringify([...coveredDecisions].sort()) === JSON.stringify([...REQUIRED_ACCOUNTING_DECISIONS].sort()), "accounting example does not expose every required decision")
  assert(BigInt(memo.originDistributableUsdCent) === BigInt(memo.protectedTimelyClaimsUsdCent) + BigInt(memo.e3HarvestedUsdCent) + BigInt(memo.carryInUsdCent), "origin claim/harvest/carry conservation failed")
  assert(BigInt(memo.targetInputUsdCent) === BigInt(memo.independentCurrentFundingUsdCent) + BigInt(memo.e3HarvestedUsdCent) + BigInt(memo.carryInUsdCent), "target funding conservation failed")
  assert(BigInt(memo.targetInputUsdCent) === BigInt(memo.capLimitedTopUpUsdCent) + BigInt(memo.carryOutUsdCent), "top-up/carry-out conservation failed")
  return { ok: true }
}

export function verifyAccountingReviewPacket({ packet, repoRoot }) {
  exactKeys(packet, ["schemaVersion", "status", "packetId", "preparedAt", "effectiveDate", "productionCutoverAuthority", "valueFlowAuthority", "openingBalanceAuthority", "sourceArtifacts", "runtimeEvidence", "requiredDecisions", "reviewer", "decisions", "conditions", "decidedAt", "engineeringDisposition", "packetSha256"], "accounting packet")
  assert(packet.schemaVersion === "fundloop.accounting-review-packet/v1" && packet.status === ACCOUNTING_DRAFT_BANNER, "accounting packet must remain a draft")
  assert(/^fundloop-ca-accounting-review-\d{4}-\d{2}-\d{2}-v\d+$/.test(packet.packetId) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(packet.preparedAt), "accounting packet identity is invalid")
  assert(packet.effectiveDate === null && packet.productionCutoverAuthority === false && packet.valueFlowAuthority === false && packet.openingBalanceAuthority === false, "accounting packet cannot authorize cutover, openings, or value flow")
  assert(JSON.stringify(packet.requiredDecisions) === JSON.stringify(REQUIRED_ACCOUNTING_DECISIONS), "accounting decisions are missing or reordered")
  exactKeys(packet.reviewer, ["name", "designation", "engagementReference"], "accounting reviewer")
  assert(Object.values(packet.reviewer).every((value) => value === null) && packet.decisions === null && packet.conditions === null && packet.decidedAt === null, "accounting packet cannot fabricate a professional conclusion")
  assert(packet.engineeringDisposition === "cutover_blocked_pending_qualified_accountant", "accounting packet must block cutover")
  for (const [groupName, group] of [["source", packet.sourceArtifacts], ["runtime", packet.runtimeEvidence]]) {
    assert(Array.isArray(group) && group.length > 0, `${groupName} evidence is required`)
    for (const item of group) {
      exactKeys(item, ["path", groupName === "source" ? "role" : "control", "sha256"], `${groupName} evidence`)
      assert(typeof item.path === "string" && !item.path.includes("..") && /^[0-9a-f]{64}$/.test(item.sha256), `invalid ${groupName} evidence`)
      const description = groupName === "source" ? item.role : item.control
      assert(typeof description === "string" && description.trim() === description && description.length > 0, `invalid ${groupName} evidence description`)
      assert(sha256(readFileSync(resolve(repoRoot, item.path))) === item.sha256, `evidence digest mismatch: ${item.path}`)
      if (item.path.startsWith("docs/accounting/review-drafts/") && item.path.endsWith(".md")) {
        assert(readFileSync(resolve(repoRoot, item.path), "utf8").startsWith(`# ${ACCOUNTING_DRAFT_BANNER}\n`), `missing accounting draft banner: ${item.path}`)
      }
    }
  }
  const examplePath = packet.sourceArtifacts.find((item) => item.role === "balanced-native-functional-example")?.path
  assert(examplePath, "accounting example is missing")
  verifyAccountingReviewExample(JSON.parse(readFileSync(resolve(repoRoot, examplePath), "utf8")))
  assert(accountingPacketDigest(packet) === packet.packetSha256, "accounting packet self digest mismatch")
  return { ok: true, packetId: packet.packetId, packetSha256: packet.packetSha256 }
}

export function writeAccountingReviewPacket({ packetPath, repoRoot }) {
  const packet = JSON.parse(readFileSync(packetPath, "utf8"))
  for (const group of [packet.sourceArtifacts, packet.runtimeEvidence]) for (const item of group) item.sha256 = sha256(readFileSync(resolve(repoRoot, item.path)))
  packet.packetSha256 = accountingPacketDigest(packet)
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`)
  return verifyAccountingReviewPacket({ packet, repoRoot })
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const repoRoot = resolve(dirname(scriptPath), "..")
  const packetPath = resolve(repoRoot, "docs/accounting/review-drafts/accounting-review-packet.json")
  const result = process.argv[2] === "write" ? writeAccountingReviewPacket({ packetPath, repoRoot }) : verifyAccountingReviewPacket({ packet: JSON.parse(readFileSync(packetPath, "utf8")), repoRoot })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
