import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { privacyReviewDocument, REVIEW_POLICY_BANNER, termsReviewDocument } from "@/lib/policies/review-policy"

const invokePolicyAcknowledgement = vi.fn()

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => ({
    backToHome: "Back to home",
    title: "Policy",
    description: "Policy description",
    "relatedLinks.privacy": "Privacy",
    "relatedLinks.terms": "Terms",
    "relatedLinks.cookies": "Cookies",
    "relatedLinks.documentation": "Documentation",
    "relatedLinks.support": "Support",
  })[key] ?? key),
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>{children}</a>
  ),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>{children}</a>
  ),
}))

vi.mock("@/lib/edge-functions/policy-acknowledgement", () => ({ invokePolicyAcknowledgement }))

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  invokePolicyAcknowledgement.mockReset()
})

function useProductionEnvironment() {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("NEXT_PUBLIC_FUNDLOOP_DEPLOYMENT_ENV", "production")
  vi.stubEnv("NEXT_PUBLIC_POLICY_REVIEW_PREVIEW", "1")
}

function useLocalEnvironment() {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("NEXT_PUBLIC_FUNDLOOP_DEPLOYMENT_ENV", "local")
  vi.stubEnv("NEXT_PUBLIC_POLICY_REVIEW_PREVIEW", "1")
}

describe("policy review routes", () => {
  it("returns production-safe Terms and Privacy placeholders without review content or metadata", async () => {
    useProductionEnvironment()
    const termsRoute = await import("@/app/[locale]/(public)/terms/page")
    const privacyRoute = await import("@/app/[locale]/(public)/privacy/page")

    const termsView = render(await termsRoute.default({ params: Promise.resolve({ locale: "en" }) }))
    expect(screen.getByRole("heading", { name: "Terms are not currently published" })).toBeTruthy()
    const termsOutput = termsView.container.textContent ?? ""
    expect(termsOutput).not.toContain(REVIEW_POLICY_BANNER)
    expect(termsOutput).not.toContain(termsReviewDocument.documentId)
    expect(termsOutput).not.toContain(termsReviewDocument.contentHash)
    expect(termsOutput).not.toContain("No live contribution")
    termsView.unmount()

    const privacyView = render(await privacyRoute.default({ params: Promise.resolve({ locale: "en" }) }))
    expect(screen.getByRole("heading", { name: "Privacy policy is not currently published" })).toBeTruthy()
    const privacyOutput = privacyView.container.textContent ?? ""
    expect(privacyOutput).not.toContain(REVIEW_POLICY_BANNER)
    expect(privacyOutput).not.toContain(privacyReviewDocument.documentId)
    expect(privacyOutput).not.toContain(privacyReviewDocument.contentHash)
    expect(privacyOutput).not.toContain("No final retention period is promised")

    const metadata = await Promise.all([
      termsRoute.generateMetadata({ params: Promise.resolve({ locale: "en" }) }),
      privacyRoute.generateMetadata({ params: Promise.resolve({ locale: "en" }) }),
    ])
    const metadataOutput = JSON.stringify(metadata)
    expect(metadataOutput).not.toContain(REVIEW_POLICY_BANNER)
    expect(metadataOutput).not.toContain(termsReviewDocument.documentId)
    expect(metadataOutput).not.toContain(privacyReviewDocument.documentId)
    expect(metadataOutput).not.toContain(termsReviewDocument.contentHash)
    expect(metadataOutput).not.toContain(privacyReviewDocument.contentHash)
  })

  it("renders the exact labelled drafts only when local review preview is enabled", async () => {
    useLocalEnvironment()
    const termsRoute = await import("@/app/[locale]/(public)/terms/page")
    const privacyRoute = await import("@/app/[locale]/(public)/privacy/page")

    const termsView = render(await termsRoute.default({ params: Promise.resolve({ locale: "en" }) }))
    expect(screen.getByText(REVIEW_POLICY_BANNER)).toBeTruthy()
    expect(termsView.container.textContent).toContain(termsReviewDocument.documentId)
    expect(termsView.container.textContent).toContain(termsReviewDocument.contentHash)
    expect(termsView.container.textContent).toContain("No live contribution")
    termsView.unmount()

    const privacyView = render(await privacyRoute.default({ params: Promise.resolve({ locale: "en" }) }))
    expect(screen.getByText(REVIEW_POLICY_BANNER)).toBeTruthy()
    expect(privacyView.container.textContent).toContain(privacyReviewDocument.documentId)
    expect(privacyView.container.textContent).toContain(privacyReviewDocument.contentHash)
    expect(privacyView.container.textContent).toContain("No final retention period is promised")
  })

  it("keeps Terms acknowledgement controls unavailable in production", async () => {
    useProductionEnvironment()
    const { TermsPreviewGate } = await import("@/components/policies/terms-preview-gate")
    render(<TermsPreviewGate sourceSurface="payout_preview" actorCapacity="user" />)

    expect(screen.getByText("Review acknowledgement is disabled in production.")).toBeTruthy()
    expect(screen.queryByRole("checkbox")).toBeNull()
    expect(screen.queryByRole("button", { name: "Record review acknowledgement" })).toBeNull()
    expect(invokePolicyAcknowledgement).not.toHaveBeenCalled()
  })
})
