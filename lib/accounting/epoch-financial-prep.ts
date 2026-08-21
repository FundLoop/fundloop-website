export const EPOCH_FINANCIAL_PREP_ENVIRONMENTS = ["local", "development", "dev", "preview", "test"] as const

export function isEpochFinancialPrepEnabled(environment: Record<string, string | undefined>) {
  const value = (environment.FUNDLOOP_DEPLOYMENT_ENV ?? environment.VERCEL_ENV ?? "production").trim().toLowerCase()
  return EPOCH_FINANCIAL_PREP_ENVIRONMENTS.includes(value as (typeof EPOCH_FINANCIAL_PREP_ENVIRONMENTS)[number])
}

export function stablecoinPegStatus(rate: string) {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,18})?$/.test(rate)) return "invalid" as const
  const [whole,fraction=""] = rate.split(".")
  const decimals=fraction.padEnd(18,"0")
  if (whole==="0" && /^0+$/.test(decimals)) return "invalid" as const
  const within=(whole==="0" && decimals>="997000000000000000") || (whole==="1" && decimals<="003000000000000000")
  return within ? "within_band" as const : "outside_band" as const
}

export function pacificCycleBoundary(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("invalid_cycle_month")
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", timeZoneName: "longOffset", year: "numeric", month: "2-digit", day: "2-digit",
  })
  const approximate = new Date(Date.UTC(year, month - 1, 1, 8))
  const offset = formatter.formatToParts(approximate).find((part) => part.type === "timeZoneName")?.value ?? "GMT-08:00"
  const normalized = offset.replace("GMT", "") || "+00:00"
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01T00:00:00${normalized}`
}

export type EpochFinancialPrepSummary = {
  cycleKey: string
  sourceCount: number
  grossExactUsd: string
  projectFeeExactUsd: string
  baseFeeExactUsd: string
  distributableExactUsd: string
  reservedExactUsd: string
  productionDisabled: boolean
}
