import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RotatingHeroTitle } from "@/components/marketing/rotating-hero-title"

describe("RotatingHeroTitle", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("rotates after progressively longer pauses", () => {
    vi.useFakeTimers()
    render(<RotatingHeroTitle prefixes={["First idea", "Second idea", "Third idea"]} suffix="for everyone" />)

    expect(screen.getByText("First idea")).toBeTruthy()

    act(() => vi.advanceTimersByTime(2_000))
    act(() => vi.advanceTimersByTime(260))
    expect(screen.getByText("Second idea")).toBeTruthy()

    act(() => vi.advanceTimersByTime(2_999))
    expect(screen.getByText("Second idea")).toBeTruthy()

    act(() => vi.advanceTimersByTime(1))
    act(() => vi.advanceTimersByTime(260))
    expect(screen.getByText("Third idea")).toBeTruthy()
  })

  it("keeps the first complete heading available to assistive technology", () => {
    render(<RotatingHeroTitle prefixes={["A Network State", "A Cooperative Economy"]} suffix="for Mutual Prosperity" />)

    expect(screen.getByRole("heading", { name: "A Network State for Mutual Prosperity" })).toBeTruthy()
  })
})
