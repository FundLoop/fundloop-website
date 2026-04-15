import { defaultLocale, type Locale } from "./routing"
import { enMessages } from "./messages/en"
import { frMessages } from "./messages/fr"
import { esMessages } from "./messages/es"

type MessagePrimitive = string | number | boolean | null
type MessageValue = MessagePrimitive | MessageDictionary | readonly MessageValue[]
type MessageDictionary = { [key: string]: MessageValue }
type WidenLiterals<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? readonly WidenLiterals<U>[]
        : T extends MessageDictionary
          ? { [K in keyof T]: WidenLiterals<T[K]> }
          : T
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly DeepPartial<U>[]
    : T[K] extends MessageDictionary
      ? DeepPartial<T[K]>
      : T[K]
}

export type AppMessages = WidenLiterals<typeof enMessages>

function isMessageDictionary(value: unknown): value is MessageDictionary {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function mergeMessageDictionaries<T extends MessageDictionary>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) {
    return structuredClone(base)
  }

  const output = structuredClone(base) as MessageDictionary

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue
    }

    const current = output[key]
    if (isMessageDictionary(current) && isMessageDictionary(value)) {
      output[key] = mergeMessageDictionaries(current, value)
      continue
    }

    output[key] = Array.isArray(value) ? structuredClone(value) : (value as MessageValue)
  }

  return output as T
}

const localizedMessageOverrides: Partial<Record<Locale, DeepPartial<AppMessages>>> = {
  fr: frMessages,
  es: esMessages,
}

export function getLocaleMessages(locale: Locale): AppMessages {
  if (locale === defaultLocale) {
    return structuredClone(enMessages) as AppMessages
  }

  return mergeMessageDictionaries(structuredClone(enMessages) as AppMessages, localizedMessageOverrides[locale])
}
