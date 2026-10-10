import { NextRequest } from "next/server"
import { defaultLocale, isValidLocale, localeCookieName } from "./routing"

export function shouldSkipLocaleRouting(pathname: string) {
  // Machine endpoints are never locale-prefixed: the public /api surface (#266), OAuth endpoints,
  // the Cubid sign-in redirects (#275) and well-known metadata are fetched or redirected to by
  // third parties at exact URLs. Only the endpoint prefixes are exempt — bare /api, /oauth and
  // /auth have no handler, so they keep the locale handling every other unrouted path gets.
  //
  // `/auth/` matters twice over: the start route is a link from our own pages, and the callback URL
  // is registered at Cubid, which will redirect a browser to it exactly. A locale redirect there
  // loses the authorization code.
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/oauth/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_vercel") ||
    /\.[^/]+$/.test(pathname)
  )
}

export function hasUnsupportedLocalePrefix(pathname: string) {
  const firstSegment = pathname.split("/")[1]
  return /^[a-z]{2}$/i.test(firstSegment) && !isValidLocale(firstSegment)
}

export function getLocaleRedirectTarget(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const cookieLocale = request.cookies.get(localeCookieName)?.value
  const locale = cookieLocale && isValidLocale(cookieLocale) ? cookieLocale : defaultLocale
  const suffix = pathname === "/" ? "" : pathname
  const search = request.nextUrl.search
  return new URL(`/${locale}${suffix}${search}`, request.url)
}
