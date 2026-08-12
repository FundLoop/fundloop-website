import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const repoRoot = process.cwd()

export function expectedFunctionNames(root = repoRoot) {
  return readdirSync(path.join(root, "supabase/functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()
      && !entry.name.startsWith("_")
      && statSync(path.join(root, "supabase/functions", entry.name, "index.ts"), { throwIfNoEntry: false })?.isFile())
    .map((entry) => entry.name)
    .sort()
}

function filesUnder(root) {
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(fullPath)
      else if (entry.isFile()) files.push(fullPath)
    }
  }
  visit(root)
  return files.sort()
}

function digestFiles(root, files) {
  const hash = createHash("sha256")
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/")
    hash.update(relative).update("\0").update(createHash("sha256").update(readFileSync(file)).digest("hex")).update("\n")
  }
  return hash.digest("hex")
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

function verifyDownloadedSource(projectRef, functionName) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), `fundloop-function-${functionName}-`))
  try {
    mkdirSync(path.join(tempRoot, "supabase"), { recursive: true })
    cpSync(path.join(repoRoot, "supabase/config.toml"), path.join(tempRoot, "supabase/config.toml"), { recursive: true })
    execFileSync("supabase", ["functions", "download", functionName, "--project-ref", projectRef, "--workdir", tempRoot, "--use-api"], { stdio: "pipe" })
    const downloadedFiles = filesUnder(tempRoot).filter((file) => !file.endsWith("supabase/config.toml"))
    if (downloadedFiles.length === 0) throw new Error(`Downloaded function ${functionName} has no source files`)
    for (const downloaded of downloadedFiles) {
      const relative = path.relative(tempRoot, downloaded)
      const local = path.join(repoRoot, relative)
      if (!statSync(local, { throwIfNoEntry: false })?.isFile()) throw new Error(`Remote ${functionName} contains untracked source: ${relative}`)
      if (!readFileSync(downloaded).equals(readFileSync(local))) throw new Error(`Remote ${functionName} source differs: ${relative}`)
    }
    const observedSourceSha256 = digestFiles(tempRoot, downloadedFiles)
    const localFiles = downloadedFiles.map((downloaded) => path.join(repoRoot, path.relative(tempRoot, downloaded)))
    const expectedSourceSha256 = digestFiles(repoRoot, localFiles)
    if (expectedSourceSha256 !== observedSourceSha256) throw new Error(`Remote ${functionName} source digest differs from reviewed source`)
    return { expectedSourceSha256, observedSourceSha256 }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

function main() {
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
  const functions = observed.sort((left, right) => left.name.localeCompare(right.name)).map((entry) => {
    if (entry.status !== "ACTIVE" || !entry.ezbr_sha256) throw new Error(`Remote function is not verifiable and active: ${entry.name}`)
    const source = verifyDownloadedSource(projectRef, entry.name)
    return {
      name: entry.name,
      ...source,
      deployedBundleSha256: entry.ezbr_sha256,
      remoteVersion: entry.version,
      remoteStatus: entry.status,
    }
  })
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
