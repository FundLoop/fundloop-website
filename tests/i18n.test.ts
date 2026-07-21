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
    expect(messages.home.heroPrefixes).toHaveLength(19)
    expect(messages.home.heroPrefixes[0]).toBe("Un État-réseau")
    expect(messages.home.heroThesis).toContain("économie en réseau")
    expect(messages.home.theoryOfChange.ideas.pluralism.body).toContain("FundLoop")
    expect(messages.shell.nav.resources).toBe("Ressources")
    expect(messages.shell.nav.primary.founders).toBe("Fondateurs")
    expect(messages.shell.nav.resourceLinks.founders.label).toBe("Parcours fondateur")
    expect(messages.shell.nav.resourceLinks.reports.label).toBe("Rapports")
    expect(messages.shell.nav.resourceLinks.integrations.label).toBe("Intégrations")
    expect(messages.home.entryPaths[0].href).toBe("/founders")
    expect(messages.projectsDirectory.hero.eyebrow).toBe("Découverte de projets")
    expect(messages.usersDirectory.hero.eyebrow).toBe("Personnes dans la boucle")
    expect(messages.participation.nextSteps.steps[0]?.step).toBe("01")
    expect(messages.journeyPolish.home.items).toHaveLength(3)
    expect(messages.journeyPolish.founders.primaryCta).toBe("Démarrer l'onboarding projet")
    expect(messages.documentationPage.hero.eyebrow).toBe("Documentation")
    expect(messages.reportsPage.hero.eyebrow).toBe("Rapports")
  })
})
