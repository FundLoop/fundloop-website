import { createHash } from "node:crypto"
import type { ZkasRunManifest } from "@/types/zkas"

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(",")}}`
}

export function serializeManifest(manifest: ZkasRunManifest) {
  return JSON.stringify(manifest, null, 2)
}

export function hashManifest(manifest: ZkasRunManifest) {
  return createHash("sha256").update(stableSerialize(manifest)).digest("hex")
}
