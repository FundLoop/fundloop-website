import createMiddleware from "next-intl/middleware"
import { NextRequest, NextResponse } from "next/server"
import { isValidLocale, routing } from "./i18n/routing"
import { getLocaleRedirectTarget, hasUnsupportedLocalePrefix, shouldSkipLocaleRouting } from "./i18n/proxy-helpers"

const handleI18nRouting = createMiddleware(routing)

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (shouldSkipLocaleRouting(pathname)) {
    return NextResponse.next()
  }

  if (hasUnsupportedLocalePrefix(pathname)) {
    return NextResponse.next()
  }

  const firstSegment = pathname.split("/")[1]
  if (isValidLocale(firstSegment)) {
    return handleI18nRouting(request)
  }

  return NextResponse.redirect(getLocaleRedirectTarget(request))
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
