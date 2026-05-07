#!/usr/bin/env node
import { readFile } from "node:fs/promises"

const path = new URL("../server.json", import.meta.url)
const metadata = JSON.parse(await readFile(path, "utf8"))

const errors = []

function requireString(key, maxLength) {
  if (typeof metadata[key] !== "string" || !metadata[key].trim()) {
    errors.push(`${key} must be a non-empty string.`)
    return
  }
  if (maxLength && metadata[key].length > maxLength) {
    errors.push(`${key} must be ${maxLength} characters or fewer.`)
  }
}

requireString("name", 200)
requireString("description", 100)
requireString("version", 255)

if (typeof metadata.name === "string" && !/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(metadata.name)) {
  errors.push("name must use reverse-DNS namespace format with one slash.")
}

if (metadata.$schema !== "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json") {
  errors.push("server.json should use the current 2025-12-11 MCP registry schema URL.")
}

if (!Array.isArray(metadata.remotes) || metadata.remotes.length === 0) {
  errors.push("server.json must define at least one remote endpoint.")
}

for (const [index, remote] of (metadata.remotes ?? []).entries()) {
  if (remote?.type !== "streamable-http") {
    errors.push(`remotes[${index}].type must be streamable-http.`)
  }
  if (typeof remote?.url !== "string" || !/^https:\/\/[^\s]+\/functions\/v1\/mcp$/.test(remote.url)) {
    errors.push(`remotes[${index}].url must be an HTTPS Supabase MCP function URL or template.`)
  }
  const authorizationHeader = remote?.headers?.find?.((header) => header?.name === "Authorization")
  if (!authorizationHeader?.isRequired || !authorizationHeader?.isSecret) {
    errors.push(`remotes[${index}] must declare a required secret Authorization header.`)
  }
}

if (!metadata.repository?.url || metadata.repository.source !== "github") {
  errors.push("repository must point to the GitHub source repository.")
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`server.json validation error: ${error}`)
  }
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, name: metadata.name, version: metadata.version, remotes: metadata.remotes.length }, null, 2))
