// Where published epoch-close aggregates may be shown.
//
// Both public epoch-close views select provisional packages only
// (`WHERE NOT production_enabled AND status = 'payout_readying'`), so every row they can return is
// a pre-payout figure from shadow mode. fundloop.org therefore shows them on non-production
// deployments only, and the public API (#266) has to mirror that: a third party must never read
// numbers the website itself withholds.

const PREVIEW_ENVIRONMENTS = ["local", "development", "dev", "preview", "test"]

export function isEpochClosePreviewEnabled(env: Record<string, string | undefined> = process.env) {
  return PREVIEW_ENVIRONMENTS.includes((env.FUNDLOOP_DEPLOYMENT_ENV ?? "production").trim().toLowerCase())
}
