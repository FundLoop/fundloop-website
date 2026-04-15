import { getRequestConfig } from "next-intl/server"
import { defaultLocale, isValidLocale } from "./routing"
import { getLocaleMessages } from "./messages"

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale
  const locale = requestedLocale && isValidLocale(requestedLocale) ? requestedLocale : defaultLocale

  return {
    locale,
    messages: getLocaleMessages(locale),
  }
})

