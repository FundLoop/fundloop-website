import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const repoRoot = process.cwd()
const managementApiOrigin = "https://api.supabase.com"
const maxResponseBytes = 16 * 1024 * 1024
const maxFileBytes = 2 * 1024 * 1024
const maxFileCount = 256
const knownRepoRootPrefix = "fundloop-website/"

export function expectedFunctionNames(root = repoRoot) {
  return readdirSync(path.join(root, "supabase/functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()
      && !entry.name.startsWith("_")
      && statSync(path.join(root, "supabase/functions", entry.name, "index.ts"), { throwIfNoEntry: false })?.isFile())
    .map((entry) => entry.name)
    .sort()
}

function digestFiles(root, files) {
  const hash = createHash("sha256")
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/")
    hash.update(relative).update("\0").update(createHash("sha256").update(readFileSync(file)).digest("hex")).update("\n")
  }
  return hash.digest("hex")
}

function digestSourceMap(files) {
  const hash = createHash("sha256")
  for (const [relative, contents] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(relative).update("\0").update(createHash("sha256").update(contents).digest("hex")).update("\n")
  }
  return hash.digest("hex")
}

function resolveRepoImport(fromFile, specifier, root) {
  if (!specifier.startsWith(".")) return null
  const candidate = path.resolve(path.dirname(fromFile), specifier)
  const options = [candidate, `${candidate}.ts`, `${candidate}.js`, `${candidate}.mjs`, path.join(candidate, "index.ts")]
  const resolved = options.find((file) => statSync(file, { throwIfNoEntry: false })?.isFile())
  if (!resolved || path.relative(root, resolved).startsWith("..")) throw new Error(`Unresolved or out-of-repository import ${specifier} from ${path.relative(root, fromFile)}`)
  return resolved
}

export function expectedSourceClosure(functionName, root = repoRoot) {
  const entrypoint = path.join(root, "supabase/functions", functionName, "index.ts")
  if (!statSync(entrypoint, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing function entrypoint: ${functionName}`)
  const visited = new Set()
  const visit = (file) => {
    if (visited.has(file)) return
    visited.add(file)
    const source = readFileSync(file, "utf8")
    const imports = [...source.matchAll(/(?:from\s*|import\s*|import\s*\(\s*)["']([^"']+)["']/g)].map((match) => match[1])
    for (const specifier of imports) {
      const dependency = resolveRepoImport(file, specifier, root)
      if (dependency) visit(dependency)
    }
  }
  visit(entrypoint)
  return [...visited].map((file) => path.relative(root, file).split(path.sep).join("/")).sort()
}

export function compareClosurePaths(expectedPaths, observedPaths) {
  const expected = [...expectedPaths].sort()
  const observed = [...observedPaths].sort()
  return {
    missingPaths: expected.filter((relative) => !observed.includes(relative)),
    extraPaths: observed.filter((relative) => !expected.includes(relative)),
  }
}

export function classifyFunctionInventory(expected, observed, retired, environment, now = Date.now()) {
  const expectedSet = new Set(expected)
  const observedSet = new Set(observed.map((entry) => entry.name))
  const missing = expected.filter((name) => !observedSet.has(name))
  const extras = observed.filter((entry) => !expectedSet.has(entry.name)).map((entry) => entry.name).sort()
  const retiredByName = new Map(retired.functions.map((entry) => [entry.name, entry]))
  const permittedRetirements = extras.filter((name) => {
    const entry = retiredByName.get(name)
    return entry
      && entry.environments.includes(environment)
      && Date.parse(entry.deleteAfter) <= now
      && entry.owner.trim().length > 0
      && entry.deletionCondition.trim().length > 0
  })
  const unexplainedExtras = extras.filter((name) => !permittedRetirements.includes(name))
  return { missing, extras, permittedRetirements, unexplainedExtras }
}

function remoteFunctions(projectRef) {
  return JSON.parse(execFileSync("supabase", ["functions", "list", "--project-ref", projectRef, "--output", "json"], { encoding: "utf8" }))
}

function parseMimeParameters(value, expectedType) {
  if (typeof value !== "string") return null
  let cursor = 0
  const skipWhitespace = () => {
    while (value[cursor] === " " || value[cursor] === "\t") cursor += 1
  }
  const readToken = () => {
    const start = cursor
    while (cursor < value.length && /[!#$%&'*+.^_`|~0-9A-Za-z-]/.test(value[cursor])) cursor += 1
    return value.slice(start, cursor)
  }
  skipWhitespace()
  const typeStart = cursor
  while (cursor < value.length && /[!#$%&'*+.^_`|~0-9A-Za-z\/-]/.test(value[cursor])) cursor += 1
  const mediaType = value.slice(typeStart, cursor).toLowerCase()
  if (mediaType !== expectedType) return null
  const params = new Map()
  while (true) {
    skipWhitespace()
    if (cursor === value.length) return params
    if (value[cursor] !== ";") return null
    cursor += 1
    skipWhitespace()
    const name = readToken().toLowerCase()
    if (!name || params.has(name)) return null
    skipWhitespace()
    if (value[cursor] !== "=") return null
    cursor += 1
    skipWhitespace()
    let parameterValue = ""
    if (value[cursor] === '"') {
      cursor += 1
      let closed = false
      while (cursor < value.length) {
        const character = value[cursor]
        cursor += 1
        if (character === '"') {
          closed = true
          break
        }
        if (character === "\\") {
          if (cursor >= value.length || /[\x00-\x08\x0a-\x1f\x7f]/.test(value[cursor])) return null
          parameterValue += value[cursor]
          cursor += 1
          continue
        }
        if (/[^\x20-\x21\x23-\x7e]/.test(character)) return null
        parameterValue += character
      }
      if (!closed) return null
    } else {
      parameterValue = readToken()
      if (!parameterValue) return null
    }
    params.set(name, parameterValue)
  }
}

function parseDisposition(value) {
  return parseMimeParameters(value, "form-data")
}

function safeArchivePath(rawPath) {
  if (!rawPath || rawPath.includes("\0") || rawPath.includes("\\") || rawPath.startsWith("/") || /^[a-zA-Z]:/.test(rawPath)) {
    throw new Error("Remote function archive contains an unsafe path")
  }
  const segments = rawPath.split("/")
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) throw new Error("Remote function archive contains an unsafe path")
  const relative = rawPath.startsWith(knownRepoRootPrefix) ? rawPath.slice(knownRepoRootPrefix.length) : rawPath
  return relative
}

function multipartBoundary(contentType) {
  const params = parseMimeParameters(contentType, "multipart/form-data")
  return params?.get("boundary") ?? null
}

async function readBoundedBody(response) {
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > maxResponseBytes) throw new Error("Remote function response exceeds size limit")
  if (!response.body) throw new Error("Remote function response has no body")
  const chunks = []
  let total = 0
  for await (const chunk of response.body) {
    total += chunk.byteLength
    if (total > maxResponseBytes) throw new Error("Remote function response exceeds size limit")
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks, total)
}

export async function parseFunctionSourceResponse(response, functionName, expectedPaths) {
  if (response.redirected || response.status >= 300 && response.status < 400) throw new Error("Remote function download refused redirect")
  if (response.status !== 200) throw new Error(`Remote function download failed with status ${response.status}`)
  const contentType = response.headers.get("content-type") ?? ""
  const boundary = multipartBoundary(contentType)
  if (!boundary || !/^[0-9A-Za-z'()+_,./:=?-]{1,70}$/.test(boundary)) throw new Error("Remote function response has invalid multipart content type")
  const body = await readBoundedBody(response)
  const delimiter = Buffer.from(`--${boundary}`)
  const files = new Map()
  const collisionKeys = new Set()
  let cursor = 0
  if (!body.subarray(0, delimiter.length).equals(delimiter)) throw new Error("Remote function response has invalid multipart framing")
  cursor = delimiter.length
  while (true) {
    if (body.subarray(cursor, cursor + 2).toString() === "--") {
      cursor += 2
      if (body.subarray(cursor).toString() !== "\r\n") throw new Error("Remote function response has invalid multipart trailer")
      break
    }
    if (body.subarray(cursor, cursor + 2).toString() !== "\r\n") throw new Error("Remote function response has invalid multipart framing")
    cursor += 2
    const headerEnd = body.indexOf("\r\n\r\n", cursor)
    if (headerEnd < 0 || headerEnd - cursor > 16 * 1024) throw new Error("Remote function response has invalid multipart headers")
    const headerLines = body.subarray(cursor, headerEnd).toString("utf8").split("\r\n")
    const headers = new Map()
    for (const line of headerLines) {
      if (/^[ \t]/.test(line)) throw new Error("Remote function response contains folded headers")
      const separator = line.indexOf(":")
      if (separator <= 0) throw new Error("Remote function response has invalid multipart headers")
      const name = line.slice(0, separator).toLowerCase()
      if (headers.has(name)) throw new Error("Remote function response has duplicate multipart headers")
      headers.set(name, line.slice(separator + 1).trim())
    }
    const next = body.indexOf(Buffer.from(`\r\n--${boundary}`), headerEnd + 4)
    if (next < 0) throw new Error("Remote function response has invalid multipart framing")
    const contents = body.subarray(headerEnd + 4, next)
    cursor = next + 2 + delimiter.length
    const disposition = parseDisposition(headers.get("content-disposition"))
    if (!disposition) throw new Error("Remote function response has invalid content disposition")
    const rawPath = headers.get("supabase-path") ?? disposition.get("filename")
    if (!rawPath) {
      if (disposition.get("name") !== "metadata" || contents.byteLength > 64 * 1024) throw new Error("Remote function response contains a non-file entry")
      continue
    }
    const entryType = (headers.get("supabase-file-type") ?? "file").toLowerCase()
    const partType = (headers.get("content-type") ?? "").toLowerCase()
    if (!["file", "regular"].includes(entryType) || partType.includes("symlink") || partType.includes("directory")) throw new Error("Remote function archive contains a non-regular entry")
    if (contents.byteLength > maxFileBytes) throw new Error("Remote function archive file exceeds size limit")
    if (files.size >= maxFileCount) throw new Error("Remote function archive exceeds file count limit")
    const relative = safeArchivePath(rawPath)
    const collisionKey = relative.normalize("NFC").toLowerCase()
    if (files.has(relative) || collisionKeys.has(collisionKey)) throw new Error("Remote function archive contains duplicate or colliding paths")
    collisionKeys.add(collisionKey)
    files.set(relative, Buffer.from(contents))
  }
  if (!files.size) throw new Error(`Remote ${functionName} has no source files`)
  const observedPaths = [...files.keys()].sort()
  const { missingPaths, extraPaths } = compareClosurePaths(expectedPaths, observedPaths)
  if (missingPaths.length || extraPaths.length) {
    const extraPathSha256 = extraPaths.map((relative) => createHash("sha256").update(relative).digest("hex")).sort()
    throw new Error(`Remote ${functionName} closure mismatch: missing=${missingPaths.join(",")} extraCount=${extraPaths.length} extraPathSha256=${extraPathSha256.join(",")}`)
  }
  return files
}

export async function verifyDownloadedSource(projectRef, functionName, accessToken, fetchImpl = fetch) {
  if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error("Invalid Supabase project ref")
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(functionName)) throw new Error("Invalid Edge Function slug")
  if (!accessToken) throw new Error("SUPABASE_ACCESS_TOKEN is required for source read-back")
  const expectedPaths = expectedSourceClosure(functionName)
  let response
  try {
    response = await fetchImpl(`${managementApiOrigin}/v1/projects/${projectRef}/functions/${functionName}/body`, {
      headers: { accept: "multipart/form-data", authorization: `Bearer ${accessToken}` },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new Error("Remote function source read-back transport failed")
  }
  const files = await parseFunctionSourceResponse(response, functionName, expectedPaths)
  for (const relative of expectedPaths) {
    if (!files.get(relative).equals(readFileSync(path.join(repoRoot, relative)))) throw new Error(`Remote ${functionName} source differs: ${relative}`)
  }
  const expectedSourceSha256 = digestFiles(repoRoot, expectedPaths.map((relative) => path.join(repoRoot, relative)))
  const observedSourceSha256 = digestSourceMap(files)
  if (expectedSourceSha256 !== observedSourceSha256) throw new Error(`Remote ${functionName} source digest differs from reviewed source`)
  return { expectedSourceSha256, observedSourceSha256 }
}

async function main() {
  const phase = process.argv[2]
  const projectRef = process.env.SUPABASE_PROJECT_REF
  const environment = process.env.TARGET_ENVIRONMENT
  if (!projectRef || !environment || !["predeploy", "postdeploy"].includes(phase)) {
    throw new Error("Usage: verify-supabase-function-parity.mjs predeploy|postdeploy with SUPABASE_PROJECT_REF and TARGET_ENVIRONMENT")
  }
  const expected = expectedFunctionNames()
  const observed = remoteFunctions(projectRef)
  const retired = JSON.parse(readFileSync("supabase/retired-functions.json", "utf8"))
  const inventory = classifyFunctionInventory(expected, observed, retired, environment)
  if (inventory.unexplainedExtras.length) throw new Error(`Unexplained remote functions: ${inventory.unexplainedExtras.join(", ")}`)

  if (phase === "predeploy") {
    console.log(JSON.stringify({ phase, expectedCount: expected.length, observedCount: observed.length, ...inventory }))
    return
  }

  if (inventory.missing.length || inventory.extras.length) {
    throw new Error(`Function inventory mismatch: missing=${inventory.missing.join(",")} extra=${inventory.extras.join(",")}`)
  }
  const functions = []
  for (const entry of observed.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.status !== "ACTIVE" || !entry.ezbr_sha256) throw new Error(`Remote function is not verifiable and active: ${entry.name}`)
    const source = await verifyDownloadedSource(projectRef, entry.name, process.env.SUPABASE_ACCESS_TOKEN)
    functions.push({
      name: entry.name,
      ...source,
      deployedBundleSha256: entry.ezbr_sha256,
      remoteVersion: entry.version,
      remoteStatus: entry.status,
    })
  }
  const manifest = {
    contractVersion: "fundloop.edge-function-parity/v1",
    candidateGitSha: process.env.GITHUB_SHA ?? "local-unbound",
    environment,
    projectRef,
    observedAt: new Date().toISOString(),
    functions,
  }
  const output = process.env.SUPABASE_PARITY_OUTPUT
  if (output) writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  console.log(`Verified ${functions.length} active Edge Functions with exact downloaded source parity.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
