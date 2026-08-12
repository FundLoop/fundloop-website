const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/
const TRUSTED_POOLER_HOST_PATTERN = /^(?:[a-z0-9-]+\.)+pooler\.supabase\.com$/

export function resolveSupabasePoolerTarget(environment, urls) {
  if (!['dev', 'main'].includes(environment)) throw new Error('unsupported-target-environment')
  const rawUrl = environment === 'dev' ? urls.dev : urls.main
  if (!rawUrl) throw new Error(`missing-${environment}-pooler-credential`)

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('invalid-pooler-url')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('invalid-pooler-protocol')
  if (!TRUSTED_POOLER_HOST_PATTERN.test(parsed.hostname)) throw new Error('invalid-pooler-host')
  if (parsed.port !== '5432') throw new Error('invalid-session-pooler-port')
  if (parsed.pathname !== '/postgres' || parsed.search || parsed.hash) throw new Error('invalid-pooler-database')
  if (!parsed.password) throw new Error('missing-pooler-password')

  const username = decodeURIComponent(parsed.username)
  const match = username.match(/^postgres\.([a-z0-9]{20})$/)
  if (!match || !PROJECT_REF_PATTERN.test(match[1])) throw new Error('invalid-pooler-username')
  return { projectRef: match[1], url: rawUrl }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const resolved = resolveSupabasePoolerTarget(process.env.TARGET_ENVIRONMENT, {
    dev: process.env.DEV_SUPABASE_SESSION_POOLER_URL,
    main: process.env.MAIN_SUPABASE_SESSION_POOLER_URL,
  })
  process.stdout.write(`${resolved.projectRef}\n`)
}
