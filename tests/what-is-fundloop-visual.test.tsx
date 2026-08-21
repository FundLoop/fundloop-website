import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { WhatIsFundLoopVisual } from "@/components/marketing/what-is-fundloop-visual"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}))

const mockProps = {
  projectLabel: "Projects & Companies",
  participantLabel: "People & Participants",
  projectCta: "This is me, I run a company which would like to participate",
  participantCta: "This is me, I'd like to participate and build monthly reward eligibility",
  nodes: {
    people: {
      title: "People",
      body: "A community of supporters driving change and usage.",
    },
    participation: {
      title: "Participation",
      body: "Engage, verify identity, match, and contribute.",
    },
    projects: {
      title: "Projects",
      body: "Mission-driven projects pooling 1% monthly revenue.",
    },
    fundloop: {
      title: "FundLoop",
      body: "Capital recycled and distributed back to active users.",
    },
  },
}

describe("WhatIsFundLoopVisual", () => {
  it("renders all four loop nodes and protocol hub", () => {
    render(<WhatIsFundLoopVisual {...mockProps} />)

    expect(screen.getByText("People")).toBeDefined()
    expect(screen.getByText("Participation")).toBeDefined()
    expect(screen.getByText("Projects")).toBeDefined()
    expect(screen.getAllByText("FundLoop").length).toBeGreaterThan(0)
  })

  it("renders both dynamic CTAs with correct onboarding target links", () => {
    render(<WhatIsFundLoopVisual {...mockProps} />)

    const participantLink = screen.getByText(mockProps.participantCta).closest("a")
    expect(participantLink).toBeDefined()
    expect(participantLink?.getAttribute("href")).toBe("/?onboarding=user")

    const projectLink = screen.getByText(mockProps.projectCta).closest("a")
    expect(projectLink).toBeDefined()
    expect(projectLink?.getAttribute("href")).toBe("/?onboarding=project")
  })

  it("handles mouse enter and leave on project and participant sides", () => {
    render(<WhatIsFundLoopVisual {...mockProps} />)

    const projectNode = screen.getByText("Projects").closest("div")
    expect(projectNode).toBeDefined()

    if (projectNode) {
      fireEvent.mouseEnter(projectNode)
      fireEvent.mouseLeave(projectNode)
    }
  })
})
