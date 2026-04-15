import { defineRouting } from "next-intl/routing"

export const supportedLocales = ["en", "fr", "es"] as const
export type Locale = (typeof supportedLocales)[number]
export const defaultLocale: Locale = "en"
export const localeCookieName = "FUNDLOOP_LOCALE"

export const routing = defineRouting({
  locales: supportedLocales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: false,
  localeCookie: {
    name: localeCookieName,
  },
})

export function isValidLocale(value: string): value is Locale {
  return supportedLocales.includes(value as Locale)
}

