import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FundloopForUsersVisual } from "@/components/marketing/fundloop-for-users-visual"
import { FundloopForProjectsVisual } from "@/components/marketing/fundloop-for-projects-visual"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}))

describe("FundloopForUsersVisual", () => {
  const props = {
    eyebrow: "People-Powered Impact",
    title: "Find projects. Join in. Make an impact. Get rewarded.",
    body: "FundLoop helps people participate meaningfully in projects that matter.",
    cta: "Start Your Participant Journey",
    center: "People-Powered Impact",
    nodes: {
      find: { step: "01", title: "1. Find projects", body: "Discover aligned apps." },
      signup: { step: "02", title: "2. Sign up", body: "Create your profile." },
      participate: { step: "03", title: "3. Participate meaningfully", body: "Contribute time." },
      reward: { step: "04", title: "4. Get a monthly reward", body: "Receive give-backs." },
    },
  }

  it("renders all 4 user steps and action link to user onboarding", () => {
    render(<FundloopForUsersVisual {...props} />)

    expect(screen.getByText("1. Find projects")).toBeDefined()
    expect(screen.getByText("2. Sign up")).toBeDefined()
    expect(screen.getByText("3. Participate meaningfully")).toBeDefined()
    expect(screen.getByText("4. Get a monthly reward")).toBeDefined()

    const link = screen.getByRole("link", { name: new RegExp(props.cta, "i") })
    expect(link.getAttribute("href")).toBe("/?onboarding=user")
  })

  it("handles hover states on step cards", () => {
    render(<FundloopForUsersVisual {...props} />)
    const stepCard = screen.getByText("1. Find projects").closest("div")
    if (stepCard) {
      fireEvent.mouseEnter(stepCard)
      fireEvent.mouseLeave(stepCard)
    }
  })
})

describe("FundloopForProjectsVisual", () => {
  const props = {
    eyebrow: "Growth Through Participation",
    title: "Reward participation. Grow your project. Repeat.",
    body: "FundLoop helps projects reward real usage and grow retention.",
    cta: "Start Project Onboarding",
    center: "Grow Your Project",
    nodes: {
      reward: { step: "01", title: "1. Reward participation", body: "Reward users." },
      visibility: { step: "02", title: "2. Get visibility", body: "Gain reach." },
      participants: { step: "03", title: "3. Get more participants", body: "Attract contributors." },
      revenue: { step: "04", title: "4. Generate more revenue", body: "Grow capacity." },
    },
  }

  it("renders all 4 project steps and action link to project onboarding", () => {
    render(<FundloopForProjectsVisual {...props} />)

    expect(screen.getByText("1. Reward participation")).toBeDefined()
    expect(screen.getByText("2. Get visibility")).toBeDefined()
    expect(screen.getByText("3. Get more participants")).toBeDefined()
    expect(screen.getByText("4. Generate more revenue")).toBeDefined()

    const link = screen.getByRole("link", { name: new RegExp(props.cta, "i") })
    expect(link.getAttribute("href")).toBe("/?onboarding=project")
  })

  it("handles hover states on step cards", () => {
    render(<FundloopForProjectsVisual {...props} />)
    const stepCard = screen.getByText("1. Reward participation").closest("div")
    if (stepCard) {
      fireEvent.mouseEnter(stepCard)
      fireEvent.mouseLeave(stepCard)
    }
  })
})
