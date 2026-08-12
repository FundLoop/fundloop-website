import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const SUPABASE_DEPLOY_PATH_GLOBS = [
  ".github/workflows/supabase-deploy.yml",
  ".github/workflows/supabase-drift.yml",
  "lib/**",
  "types/**",
  "package.json",
  "pnpm-lock.yaml",
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

export function shouldObservePush(paths) {
  return !paths.some((file) => deployPathMatchers.some((matcher) => matcher.test(file)))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = readFileSync(0, "utf8").split("\n").filter(Boolean)
  process.stdout.write(shouldObservePush(paths) ? "true\n" : "false\n")
}
