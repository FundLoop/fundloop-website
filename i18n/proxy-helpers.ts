import { NextRequest } from "next/server"
import { defaultLocale, isValidLocale, localeCookieName } from "./routing"

export function shouldSkipLocaleRouting(pathname: string) {
  return pathname.startsWith("/api/internal") || pathname.startsWith("/_next") || pathname.startsWith("/_vercel") || /\.[^/]+$/.test(pathname)
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
