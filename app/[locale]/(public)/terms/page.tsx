import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import LegalPageShell from "@/components/public/legal-page-shell"
import { isReviewPolicyPreviewEnabled, REVIEW_POLICY_BANNER, termsReviewDocument } from "@/lib/policies/review-policy"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.terms" })
  if (!isReviewPolicyPreviewEnabled()) {
    return { title: `Policy unavailable | ${t("title")}`, description: "No approved effective policy document is currently published." }
  }
  return { title: `${REVIEW_POLICY_BANNER} | ${t("title")}`, description: `Non-effective review preview. ${t("description")}` }
}

export default async function TermsPage({ params }: PageProps) {
  await params
  const t = await getTranslations("legalPages")
  const previewEnabled = isReviewPolicyPreviewEnabled()
  if (!previewEnabled) {
    return (
      <LegalPageShell
        backToHomeLabel={t("backToHome")}
        eyebrow="Policy unavailable"
        title="Terms are not currently published"
        summary="No approved effective Terms document is configured for this environment."
        updatedLabel="Unavailable"
        relatedLinks={[{ href: "/privacy", label: t("relatedLinks.privacy") }, { href: "/support", label: t("relatedLinks.support") }]}
      >
        <p>This page will remain unavailable until the required production approvals and effective publication controls are complete.</p>
      </LegalPageShell>
    )
  }
  return (
    <LegalPageShell
      backToHomeLabel={t("backToHome")}
      eyebrow="Terms review preview"
      title="Canadian Terms review preview"
      summary="A non-effective product-intent draft for exercising version and acknowledgement controls on local and dev environments."
      updatedLabel={`Version ${termsReviewDocument.version}`}
      statusBanner={REVIEW_POLICY_BANNER}
      statusDetail="This review copy is visible for local/dev testing. Acknowledgement is not legal acceptance and cannot enable live value flow."
      relatedLinks={[{ href: "/privacy", label: t("relatedLinks.privacy") }, { href: "/cookies", label: t("relatedLinks.cookies") }, { href: "/documentation", label: t("relatedLinks.documentation") }]}
    >
      <p><strong>Document:</strong> <code>{termsReviewDocument.documentId}</code></p>
      <p><strong>Immutable review hash:</strong> <code className="break-all">{termsReviewDocument.contentHash}</code></p>
      <h2>1. Review boundary</h2>
      <p>This is product-intent review text only. It is not approved, effective, or a substitute for qualified Canadian legal or accounting advice. No live contribution, allocation, ownership transfer, payout, refund rule, or other value flow is authorized by viewing or acknowledging it.</p>
      <h2>2. Proposed service scope</h2>
      <p>FundLoop is exploring Canadian project contribution, monthly calculation, conditional-award, and possible payout workflows. Eligibility, provider screening, supported rails, assets, operating cadence, and availability remain subject to final controls and professional review.</p>
      <h2>3. Proposed project boundary</h2>
      <p>A future workflow may require a versioned project list and finally settled contribution before a monthly cutoff. Declarations and pending transfers are not settled funds. Ownership, refunds, insolvency treatment, payment-regulatory classification, and any silence-as-approval mechanism remain unresolved production questions.</p>
      <h2>4. Proposed user boundary</h2>
      <p>Displayed calculations and conditional awards must not be described as guaranteed earnings, deposits, escrow, wages, investments, or presently enforceable debt. The legal and accounting recognition event remains unapproved. A request is not execution or settlement.</p>
      <h2>5. Proposed no-refund, no-escrow, and best-effort model</h2>
      <p>Subject to qualified counsel and accountant review, the product intent is that a finally settled project submission would be non-refundable as of right. FundLoop could attempt a discretionary refund on a best-effort basis, without guaranteeing that a refund is available or successful.</p>
      <p>FundLoop does not intend to provide escrow, deposit, trust, or stored-value accounts. Internal platform and epoch treasury labels would be operational controls only, not user escrow or proof that a project or user owns segregated funds.</p>
      <p>FundLoop would attempt an eligible payout request on a best-effort basis only. A request would not guarantee execution, timing, rail or currency availability, final settlement, or success. Holds, provider or network limits, fees, expiry, and carryover could apply under the final approved terms.</p>
      <h2>6. Fees, assets, and public chains</h2>
      <p>Fee presentation, tax treatment, gross-versus-net accounting, exchange rates, custody, supported assets, and payout rails remain subject to final approval. Public blockchain activity can expose persistent wallet, asset, amount, destination, and transaction information.</p>
      <h2>7. Privacy and optional choices</h2>
      <p>General Terms acknowledgement must remain separate from optional public-profile publication and project membership. See the <Link href="/privacy">non-effective Privacy Notice preview</Link> for the data-flow inventory and unresolved questions.</p>
      <h2>8. Production gates</h2>
      <ul><li>qualified counsel and accountant/bookkeeper approval evidence;</li><li>approved immutable text and version hashes;</li><li>verified provider, treasury, data-flow, retention, and runtime controls;</li><li>production launch review proving review drafts cannot become effective.</li></ul>
      <h2>9. Questions remain open</h2>
      <p>Payment regulation, FINTRAC duties, ownership, refunds, user claims, securities, consumer protection, tax, employment, privacy, abandoned property, enforceability, governing law, and dispute terms are deliberately not answered by this preview.</p>
    </LegalPageShell>
  )
}
