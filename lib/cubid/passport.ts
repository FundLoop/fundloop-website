import type { CubidProviderStamp } from "@/lib/cubid/types"

type BuildCubidProviderAllowUrlInput = {
  passportOrigin: string
  cubidUserId: string
  stampPageId: string | null
  provider: CubidProviderStamp
  colorMode?: "dark" | "light"
}

export function buildCubidProviderAllowUrl({
  passportOrigin,
  cubidUserId,
  stampPageId,
  provider,
  colorMode,
}: BuildCubidProviderAllowUrlInput) {
  const url = new URL("/widget-allow", passportOrigin)
  url.searchParams.set("uid", cubidUserId)
  url.searchParams.set("social_provider", provider)

  if (stampPageId) {
    url.searchParams.set("page_id", stampPageId)
  }

  if (colorMode) {
    url.searchParams.set("colormode", colorMode)
  }

  url.searchParams.set("success", "true")
  return url.toString()
}
