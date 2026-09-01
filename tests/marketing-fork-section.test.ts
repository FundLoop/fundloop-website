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
    expect(frMessages.home.fork.participants.eyebrow).toBe("Parcours individuel")
    expect(frMessages.home.fork.participants.title).toBe("Pour les utilisateurs et contributeurs du quotidien")
    expect(frMessages.home.fork.founders.eyebrow).toBe("Parcours fondateur")
  })

  it("has updated What is Fund Loop description in English, Spanish, and French", () => {
    expect(enMessages.home.fork.whatIsFundLoop.body).toContain("A continuous cycle where companies and projects share a portion of their revenue")
    expect(enMessages.home.fork.whatIsFundLoop.body).toContain("cash back loyalty program for users")
    expect(enMessages.home.fork.whatIsFundLoop.body).toContain("managed universal basic income platform")

    expect(esMessages.home.fork.whatIsFundLoop.body).toContain("Un ciclo continuo donde las empresas y proyectos comparten una parte de sus ingresos")
    expect(esMessages.home.fork.whatIsFundLoop.body).toContain("renta básica universal")

    expect(frMessages.home.fork.whatIsFundLoop.body).toContain("Un cycle continu où les entreprises et projets partagent une partie de leurs revenus")
    expect(frMessages.home.fork.whatIsFundLoop.body).toContain("revenu universel de base")
  })

  it("has localized What is Fund Loop diagram stages in English, Spanish, and French", () => {
    // English
    expect(enMessages.home.fork.whatIsFundLoop.stages.people.title).toBe("People")
    expect(enMessages.home.fork.whatIsFundLoop.stages.people.subtitle).toBe("Participate in projects")
    expect(enMessages.home.fork.whatIsFundLoop.stages.projectsRevenue.title).toBe("Projects")
    expect(enMessages.home.fork.whatIsFundLoop.stages.projectsRevenue.subtitle).toBe("Collect platform revenue")
    expect(enMessages.home.fork.whatIsFundLoop.stages.projectsReward.title).toBe("Projects")
    expect(enMessages.home.fork.whatIsFundLoop.stages.projectsReward.subtitle).toBe("Share 1% into FundLoop pool")
    expect(enMessages.home.fork.whatIsFundLoop.stages.peopleRewards.title).toBe("People")
    expect(enMessages.home.fork.whatIsFundLoop.stages.peopleRewards.subtitle).toBe("Earn credited rewards (governed)")

    // Spanish
    expect(esMessages.home.fork.whatIsFundLoop.stages.people.title).toBe("Personas")
    expect(esMessages.home.fork.whatIsFundLoop.stages.people.subtitle).toBe("Participan en proyectos")
    expect(esMessages.home.fork.whatIsFundLoop.stages.projectsRevenue.title).toBe("Proyectos")
    expect(esMessages.home.fork.whatIsFundLoop.stages.projectsRevenue.subtitle).toBe("Generan ingresos de plataforma")
    expect(esMessages.home.fork.whatIsFundLoop.stages.projectsReward.title).toBe("Proyectos")
    expect(esMessages.home.fork.whatIsFundLoop.stages.projectsReward.subtitle).toBe("Aportan el 1 % a la pool de FundLoop")
    expect(esMessages.home.fork.whatIsFundLoop.stages.peopleRewards.title).toBe("Personas")
    expect(esMessages.home.fork.whatIsFundLoop.stages.peopleRewards.subtitle).toBe("Obtienen recompensas acreditadas")

    // French
    expect(frMessages.home.fork.whatIsFundLoop.stages.people.title).toBe("Personnes")
    expect(frMessages.home.fork.whatIsFundLoop.stages.people.subtitle).toBe("Participent aux projets")
    expect(frMessages.home.fork.whatIsFundLoop.stages.projectsRevenue.title).toBe("Projets")
    expect(frMessages.home.fork.whatIsFundLoop.stages.projectsRevenue.subtitle).toBe("Collectent des revenus de plateforme")
    expect(frMessages.home.fork.whatIsFundLoop.stages.projectsReward.title).toBe("Projets")
    expect(frMessages.home.fork.whatIsFundLoop.stages.projectsReward.subtitle).toBe("Partagent 1 % dans le pool FundLoop")
    expect(frMessages.home.fork.whatIsFundLoop.stages.peopleRewards.title).toBe("Personnes")
    expect(frMessages.home.fork.whatIsFundLoop.stages.peopleRewards.subtitle).toBe("Cumulent des récompenses créditées")
  })
})
