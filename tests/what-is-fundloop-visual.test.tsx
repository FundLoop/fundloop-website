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
      title: "People participate in projects",
      body: "Users discover aligned apps, engage regularly, and build verified activity records with private CUBID stamps.",
    },
    participation: {
      title: "Projects collect revenue",
      body: "Software products grow sustainable platform usage and collect customer subscriptions and fees.",
    },
    projects: {
      title: "Projects reward community through FundLoop",
      body: "Projects pool a percentage of monthly revenue into a transparent, governed redistribution cycle.",
    },
    fundloop: {
      title: "People get paid",
      body: "Verified active community members receive transparent, proportional monthly reward distributions.",
    },
  },
}

describe("WhatIsFundLoopVisual", () => {
  it("renders all four continuous loop stages and protocol hub without 01-04 numbering", () => {
    render(<WhatIsFundLoopVisual {...mockProps} />)

    expect(screen.getByText("People participate in projects")).toBeDefined()
    expect(screen.getByText("Projects collect revenue")).toBeDefined()
    expect(screen.getByText("Projects reward community through FundLoop")).toBeDefined()
    expect(screen.getByText("People get paid")).toBeDefined()
    expect(screen.getByText("FundLoop Continuous Coordination")).toBeDefined()

    // Assert that numeric 01-04 step tags are removed
    expect(screen.queryByText(/Step 01/i)).toBeNull()
    expect(screen.queryByText(/Step 02/i)).toBeNull()
    expect(screen.queryByText(/Step 03/i)).toBeNull()
    expect(screen.queryByText(/Step 04/i)).toBeNull()
  })

  it("renders both onboarding CTA links", () => {
    render(<WhatIsFundLoopVisual {...mockProps} />)

    const participantLink = screen.getByText(mockProps.participantCta).closest("a")
    expect(participantLink).toBeDefined()
    expect(participantLink?.getAttribute("href")).toBe("/?onboarding=user")

    const projectLink = screen.getByText(mockProps.projectCta).closest("a")
    expect(projectLink).toBeDefined()
    expect(projectLink?.getAttribute("href")).toBe("/?onboarding=project")
  })

  it("correlates hover focus to participant and project steps", () => {
    render(<WhatIsFundLoopVisual {...mockProps} />)

    const participantNode = screen.getByText("People participate in projects").closest("div")
    const projectNode = screen.getByText("Projects collect revenue").closest("div")

    expect(participantNode).toBeDefined()
    expect(projectNode).toBeDefined()

    if (participantNode) {
      fireEvent.mouseEnter(participantNode)
      expect(screen.getByText("Participant Focus")).toBeDefined()
      fireEvent.mouseLeave(participantNode)
    }

    if (projectNode) {
      fireEvent.mouseEnter(projectNode)
      expect(screen.getByText("Project Focus")).toBeDefined()
      fireEvent.mouseLeave(projectNode)
    }
  })
})
