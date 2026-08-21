import { describe, expect, it } from "vitest"
import { enMessages } from "@/i18n/messages/en"
import { esMessages } from "@/i18n/messages/es"
import { frMessages } from "@/i18n/messages/fr"

describe("Marketing Fork Section Translations", () => {
  it("has correct heading and individual track chip for everyday users in English", () => {
    expect(enMessages.home.fork.participants.eyebrow).toBe("Individual track")
    expect(enMessages.home.fork.participants.title).toBe("For Everyday Users & Contributors")
    expect(enMessages.home.fork.participants.body).toContain("Explore how FundLoop works for individuals")
    expect(enMessages.home.fork.founders.eyebrow).toBe("Founder track")
    expect(enMessages.home.fork.founders.title).toBe("For App Founders & Builders")
    expect(enMessages.home.fork.founders.body).toContain("Explore how FundLoop works for founders")
  })

  it("has localized individual track chip and headings in Spanish", () => {
    expect(esMessages.home.fork.participants.eyebrow).toBe("Track individual")
    expect(esMessages.home.fork.participants.title).toBe("Para usuarios y colaboradores cotidianos")
    expect(esMessages.home.fork.founders.eyebrow).toBe("Track para fundadores")
  })

  it("has localized individual track chip and headings in French", () => {
    expect(frMessages.home.fork.participants.eyebrow).toBe("Individual track")
    expect(frMessages.home.fork.participants.title).toBe("Pour les utilisateurs et contributeurs du quotidien")
    expect(frMessages.home.fork.founders.eyebrow).toBe("Parcours fondateur")
  })
})
