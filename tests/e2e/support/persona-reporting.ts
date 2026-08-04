import { mkdir, open, rename } from "node:fs/promises"
import path from "node:path"
import type { Page } from "@playwright/test"
import { CAPABILITY_REGISTRY } from "../personas/capabilities"
import { PERSONA_IDS } from "../personas/contracts"
import type {
  CheckpointObservation,
  CheckpointResult,
  CleanupResult,
  HarnessRunSummary,
  PersonaCheckpoint,
  PersonaId,
  PersonaResult,
  RunIdentity,
  RunStatus,
  SanitizedEvidence,
  ServiceOwnership,
} from "../personas/contracts"

const FORBIDDEN_KEY = /(authorization|cookie|email|jwt|otp|password|private|secret|service.?role|token|uuid|wallet)/i
const FORBIDDEN_VALUE = [
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  /\b\d{6}\b/,
  /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /\b0x[0-9a-f]{40}\b/i,
]

export function sanitizeEvidence(evidence: SanitizedEvidence): SanitizedEvidence {
  const output: Record<string, string | number | boolean | null> = {}

  for (const [key, value] of Object.entries(evidence)) {
    if (!/^[a-z][a-z0-9-]*$/.test(key) || FORBIDDEN_KEY.test(key)) {
      throw new Error("evidence-key-rejected")
    }
    if (typeof value === "string") {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(value) || FORBIDDEN_VALUE.some((pattern) => pattern.test(value))) {
        throw new Error("evidence-value-rejected")
      }
    }
    if (typeof value === "number" && Number.isInteger(value) && value >= 100_000 && value <= 999_999) {
      throw new Error("evidence-value-rejected")
    }
    output[key] = value
  }

  return Object.freeze(output)
}

export function boundedPersonaFailureReason(prefix: string, detail: string | undefined, fallback: string) {
  const normalized = (detail ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback
  return `${prefix}-${normalized}`.slice(0, 80).replace(/-+$/g, "")
}

export async function assertSafePersonaScreenshotSurface(page: Page) {
  const sensitiveControls = page.locator([
    'input[type="email"]',
    'input[type="password"]',
    'input[autocomplete="one-time-code"]',
    '[data-private="true"]',
  ].join(","))
  if (await sensitiveControls.count()) throw new Error("screenshot-sensitive-control-visible")
  const text = await page.locator("body").innerText()
  if (FORBIDDEN_VALUE.some((pattern) => pattern.test(text))) throw new Error("screenshot-sensitive-value-visible")
  const controlValues = await page.locator("input, textarea").evaluateAll((controls) =>
    controls.map((control) => (control as HTMLInputElement | HTMLTextAreaElement).value).filter(Boolean),
  )
  if (controlValues.some((value) => FORBIDDEN_VALUE.some((pattern) => pattern.test(value)))) {
    throw new Error("screenshot-sensitive-value-visible")
  }
}

export function deriveCheckpointResult(
  checkpoint: Pick<PersonaCheckpoint, "id" | "mode" | "capabilityId">,
  observation: CheckpointObservation,
  durationMs = 0,
): CheckpointResult {
  let status: CheckpointResult["status"] = "pass"
  let reasonCode: string | null = null

  if (observation.outcome === "capability-unavailable") {
    if (checkpoint.mode === "required") {
      status = "fail"
      reasonCode = "required-capability-unavailable"
    } else {
      const registry = (CAPABILITY_REGISTRY as Readonly<Record<string, { reasonCode: string }>>)[checkpoint.capabilityId]
      if (!registry) {
        status = "fail"
        reasonCode = "undeclared-capability-gap"
      } else if (observation.reasonCode !== registry.reasonCode) {
        status = "fail"
        reasonCode = "pending-reason-mismatch"
      } else {
        status = "expected-pending"
        reasonCode = registry.reasonCode
      }
    }
  } else if (checkpoint.mode === "expected-pending") {
    status = "fail"
    reasonCode = "stale-pending-declaration"
  }

  return {
    checkpointId: checkpoint.id,
    capabilityId: checkpoint.capabilityId,
    status,
    durationMs,
    reasonCode,
    evidence: sanitizeEvidence(observation.evidence),
  }
}

export function aggregateStatus(statuses: readonly (RunStatus | CheckpointResult["status"])[]): RunStatus {
  if (statuses.some((status) => status === "failed" || status === "fail")) return "failed"
  if (statuses.some((status) => status === "incomplete" || status === "expected-pending")) return "incomplete"
  return "passed"
}

export function exitCodeFor(status: RunStatus): 0 | 1 | 2 {
  if (status === "passed") return 0
  if (status === "incomplete") return 2
  return 1
}

export async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
  const tempPath = `${filePath}.tmp`
  const handle = await open(tempPath, "w", 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(tempPath, filePath)
}

export async function writePersonaResult(outputRoot: string, runId: string, result: PersonaResult) {
  await writeJsonAtomic(path.join(outputRoot, runId, "personas", `${result.personaId}.json`), result)
}

export function buildHarnessSummary(input: {
  run: RunIdentity
  durationMs: number
  cycleKeys?: Partial<Record<PersonaId, string>>
  services: ServiceOwnership
  personas: readonly PersonaResult[]
  cleanup: CleanupResult
}): HarnessRunSummary {
  const selected = [...input.run.selectedPersonas]
  const missing = selected.filter((id) => !input.personas.some((result) => result.personaId === id))
  const status = missing.length > 0 || input.cleanup.status === "residual"
    ? "failed"
    : aggregateStatus(input.personas.map((result) => result.status))

  return {
    schemaVersion: 1,
    runId: input.run.runId,
    selectedPersonas: selected,
    unselectedPersonas: PERSONA_IDS.filter((id) => !selected.includes(id)),
    status,
    exitCode: exitCodeFor(status),
    startedAt: input.run.startedAt,
    durationMs: input.durationMs,
    cycleKeys: input.cycleKeys ?? {},
    services: {
      supabase: input.services.supabase,
      mailpit: input.services.mailpit,
      next: input.services.next,
    },
    personas: input.personas,
    cleanup: input.cleanup,
  }
}

export function formatSummary(summary: HarnessRunSummary) {
  const lines = [
    `persona harness ${summary.runId}: ${summary.status}`,
    "persona | status | checkpoints | cleanup",
  ]
  for (const persona of summary.personas) {
    const checkpoints = persona.checkpoints.map((item) => `${item.checkpointId}:${item.status}`).join(",") || "none"
    lines.push(`${persona.personaId} | ${persona.status} | ${checkpoints} | ${persona.cleanup.status}`)
  }
  return lines.join("\n")
}
