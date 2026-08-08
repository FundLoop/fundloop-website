import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import LegalPageShell from "@/components/public/legal-page-shell"
import { isReviewPolicyPreviewEnabled, privacyReviewDocument, REVIEW_POLICY_BANNER } from "@/lib/policies/review-policy"

type PageProps = { params: Promise<{ locale: string }> }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: "metadata.privacy" })
  return { title: `${REVIEW_POLICY_BANNER} | ${t("title")}`, description: `Non-effective review preview. ${t("description")}` }
}
export default async function PrivacyPage({ params }: PageProps) {
  await params; const t = await getTranslations("legalPages"); const enabled = isReviewPolicyPreviewEnabled()
  return <LegalPageShell backToHomeLabel={t("backToHome")} eyebrow="Privacy review preview" title="Canadian Privacy Notice review preview" summary="A truthful, non-effective inventory of current and planned data handling for local/dev consent testing." updatedLabel={`Version ${privacyReviewDocument.version}`} statusBanner={REVIEW_POLICY_BANNER} statusDetail={enabled ? "This review copy is visible for local/dev testing. Optional profile publication remains separate and withdrawable." : "Production review preview and review publication choices are disabled."} relatedLinks={[{ href: "/terms", label: t("relatedLinks.terms") }, { href: "/cookies", label: t("relatedLinks.cookies") }, { href: "/support", label: t("relatedLinks.support") }]}>
    <p><strong>Document:</strong> <code>{privacyReviewDocument.documentId}</code></p><p><strong>Immutable review hash:</strong> <code className="break-all">{privacyReviewDocument.contentHash}</code></p>
    <h2>1. Review boundary</h2><p>This preview is not an approved or effective Privacy Notice and does not decide legal authority, retention periods, provider roles, or cross-border terms. It describes product intent and unresolved controls for review.</p>
    <h2>2. Information in scope</h2><p>FundLoop may handle account and profile fields, authentication and security evidence, project participation, Cubid status and scores, contribution and allocation records, payout route metadata, wallet and public-chain information, support messages, and technical request diagnostics.</p>
    <h2>3. Purposes and recipients</h2><p>Proposed purposes include authentication, project administration, eligibility, reconciliation, conditional-award administration, support, security, reporting, and possible payouts. Potential recipients include Supabase, Vercel, Cubid, Stripe and financial institutions, Base/Ethereum infrastructure, Safe/paymaster/RPC services, email/support providers, accepted project members, advisers, and authorities where legally required.</p>
    <h2>4. Optional public profile</h2><p>Profiles are private by default. Local/dev publication requires a separate, unselected affirmative choice for named fields. Withdrawal applies prospectively and immediately removes the profile from FundLoop discovery while neutral audit evidence remains. It cannot delete public-chain data or records later determined to require lawful retention.</p>
    <h2>5. Public chains and cross-border processing</h2><p>Confirmed blockchain data can be globally visible, persistent, copied, indexed, and correlated. Providers may process data outside Canada. Exact regions, subprocessors, contracts, roles, logs, backups, and transfer safeguards remain production approval questions.</p>
    <h2>6. Retention, rights, and safeguards</h2><p>No final retention period is promised. The target design uses event-based retention, least privilege, RLS, secret isolation, audit evidence, and incident controls. Access, correction, deletion, complaint, breach, and refusal-review processes require final contacts and professional approval.</p>
    <h2>7. Unresolved production gates</h2><ul><li>applicable privacy laws and authority for each purpose;</li><li>verified provider roles, regions, subprocessors, and contracts;</li><li>approved retention/deletion schedule and mandatory record rules;</li><li>privacy officer, contact, complaint, rights, and incident processes;</li><li>approved immutable notice text and production runtime evidence.</li></ul>
  </LegalPageShell>
}
