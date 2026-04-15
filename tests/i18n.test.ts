import { describe, expect, it } from "vitest"
import { getLocaleMessages, mergeMessageDictionaries } from "@/i18n/messages"
import { defaultLocale, isValidLocale, supportedLocales } from "@/i18n/routing"

describe("i18n message loading", () => {
  it("uses english as the default locale", () => {
    expect(defaultLocale).toBe("en")
    expect(supportedLocales).toEqual(["en", "fr", "es"])
  })

  it("recognizes supported locales", () => {
    expect(isValidLocale("en")).toBe(true)
    expect(isValidLocale("fr")).toBe(true)
    expect(isValidLocale("es")).toBe(true)
    expect(isValidLocale("de")).toBe(false)
  })

  it("merges locale overrides over the english base", () => {
    const merged = mergeMessageDictionaries(
      {
        shell: {
          title: "FundLoop",
          actions: ["Join", "Explore"],
        },
      },
      {
        shell: {
          title: "Boucle",
        },
      },
    )

    expect(merged).toEqual({
      shell: {
        title: "Boucle",
        actions: ["Join", "Explore"],
      },
    })
  })

  it("returns localized message packs", () => {
    const messages = getLocaleMessages("fr")

    expect(messages.home.heroTitle).toContain("économie")
    expect(messages.shell.nav.resources).toBe("Ressources")
    expect(messages.shell.nav.primary.founders).toBe("Fondateurs")
    expect(messages.shell.nav.resourceLinks.founders.label).toBe("Parcours fondateur")
    expect(messages.home.entryPaths[0].href).toBe("/founders")
  })
})
