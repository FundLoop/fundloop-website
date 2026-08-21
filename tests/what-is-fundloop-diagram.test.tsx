import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { WhatIsFundLoopDiagram } from "@/components/marketing/what-is-fundloop-diagram"
import { enMessages } from "@/i18n/messages/en"
import { esMessages } from "@/i18n/messages/es"
import { frMessages } from "@/i18n/messages/fr"

const mockProps = {
  stages: {
    people: { title: "People", subtitle: "Participate in projects" },
    projectsRevenue: { title: "Projects", subtitle: "Collect platform revenue" },
    projectsReward: { title: "Projects", subtitle: "Share 1% into FundLoop pool" },
    peopleRewards: { title: "People", subtitle: "Earn credited rewards (governed)" },
  },
  center: {
    cubidLabel: "CUBID",
    cubidDesc: "Verified Identity & Proof of Personhood",
    allocatorLabel: "Allocator",
    allocatorDesc: "Governed Value Redistribution",
  },
  tagline: "A continuous cycle of value creation and community reward.",
  subtagline: "Capital · Impact · Community",
}

describe("WhatIsFundLoopDiagram", () => {
  it("renders all four continuous loop stages without 1-4 numbering", () => {
    render(<WhatIsFundLoopDiagram {...mockProps} />)

    expect(screen.getByText("Participate in projects")).toBeDefined()
    expect(screen.getByText("Collect platform revenue")).toBeDefined()
    expect(screen.getByText("Share 1% into FundLoop pool")).toBeDefined()
    expect(screen.getByText("Earn credited rewards (governed)")).toBeDefined()

    // Assert that numeric 1-4 step tags are removed
    expect(screen.queryByText(/Step 01/i)).toBeNull()
    expect(screen.queryByText(/Step 02/i)).toBeNull()
    expect(screen.queryByText(/Step 03/i)).toBeNull()
    expect(screen.queryByText(/Step 04/i)).toBeNull()
  })

  it("renders CUBID identity and Allocator roles accurately", () => {
    render(<WhatIsFundLoopDiagram {...mockProps} />)

    expect(screen.getByText(/Verified Identity & Proof of Personhood/i)).toBeDefined()
    expect(screen.getByText(/Governed Value Redistribution/i)).toBeDefined()
  })

  it("has complete translations across EN, ES, and FR catalogs", () => {
    expect(enMessages.home.fork.whatIsFundLoop.stages.people.title).toBe("People")
    expect(enMessages.home.fork.whatIsFundLoop.center.cubidDesc).toContain("Proof of Personhood")

    expect(esMessages.home.fork.whatIsFundLoop.stages.people.title).toBe("Personas")
    expect(esMessages.home.fork.whatIsFundLoop.center.cubidDesc).toContain("prueba de humanidad")

    expect(frMessages.home.fork.whatIsFundLoop.stages.people.title).toBe("Personnes")
    expect(frMessages.home.fork.whatIsFundLoop.center.cubidDesc).toContain("preuve d'humanité")
  })
})
