import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const SUPABASE_DEPLOY_PATH_GLOBS = [
  ".github/workflows/supabase-deploy.yml",
  ".github/workflows/supabase-drift.yml",
  "contracts/lib/**",
  "lib/**",
  "packages/mcp-server/**",
  "types/**",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/classify-supabase-drift-push.mjs",
  "scripts/verify-supabase-*.mjs",
  "supabase/config.toml",
  "supabase/functions/**",
  "supabase/migrations/**",
  "supabase/retired-functions.json",
  "vendor/cubid/**",
]

const globRegex = (glob) => {
  let pattern = ""
  for (let index = 0; index < glob.length; index += 1) {
    if (glob[index] === "*" && glob[index + 1] === "*") {
      pattern += ".*"
      index += 1
    } else if (glob[index] === "*") {
      pattern += "[^/]*"
    } else {
      pattern += glob[index].replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    }
  }
  return new RegExp(`^${pattern}$`)
}
const deployPathMatchers = SUPABASE_DEPLOY_PATH_GLOBS.map(globRegex)

export function isSupabaseDeployPath(file) {
  return deployPathMatchers.some((matcher) => matcher.test(file))
}

export function shouldRunSupabaseDeploy(paths) {
  return paths.some(isSupabaseDeployPath)
}

export function shouldObservePush(paths) {
  return !shouldRunSupabaseDeploy(paths)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = readFileSync(0, "utf8").split("\n").filter(Boolean)
  const mode = process.argv[2] ?? "observe"
  if (!new Set(["deploy", "observe"]).has(mode)) {
    throw new Error(`Unsupported classification mode: ${mode}`)
  }
  const result = mode === "deploy" ? shouldRunSupabaseDeploy(paths) : shouldObservePush(paths)
  process.stdout.write(result ? "true\n" : "false\n")
}
