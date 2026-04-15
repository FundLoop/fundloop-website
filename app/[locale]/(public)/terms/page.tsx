import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import LegalPageShell from "@/components/public/legal-page-shell"

type PageProps = {
  params: Promise<{ locale: string }>
}

const UPDATED_AT = "April 14, 2026"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.terms" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function TermsPage({ params }: PageProps) {
  await params
  const t = await getTranslations("legalPages")

  return (
    <LegalPageShell
      backToHomeLabel={t("backToHome")}
      eyebrow={t("relatedLinks.terms")}
      title={t("relatedLinks.terms")}
      summary="These Terms govern access to the FundLoop public site, product surfaces, and related services while the platform continues moving toward a fuller monthly operating and reporting model."
      updatedLabel={t("updatedLabel", { date: UPDATED_AT })}
      relatedLinks={[
        { href: "/privacy", label: t("relatedLinks.privacy") },
        { href: "/cookies", label: t("relatedLinks.cookies") },
        { href: "/documentation", label: t("relatedLinks.documentation") },
      ]}
    >
      <h2>1. Introduction</h2>
      <p>
        Welcome to FundLoop (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). These Terms of Service (&quot;Terms&quot;)
        govern your access to and use of the FundLoop website, services, and applications (collectively, the
        &quot;Services&quot;).
      </p>
      <p>
        By accessing or using the Services, you agree to be bound by these Terms. If you do not agree, you may not
        access or use the Services.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old to use the Services. By using the Services, you represent and warrant that
        you are at least 18 years old and have the legal capacity to enter into these Terms.
      </p>

      <h2>3. Account Registration</h2>
      <p>
        To access certain features of the Services, you may need to register for an account. You agree to provide
        accurate, current, and complete information during registration and to keep it updated.
      </p>
      <p>
        You are responsible for safeguarding your account credentials and for all activities that occur under your
        account. You agree to notify us immediately of any unauthorized use of your account.
      </p>

      <h2>4. Project Contribution Commitments</h2>
      <p>
        FundLoop is designed around the idea that aligned projects may contribute a meaningful share of revenue or
        distributed value back into the network. Specific operational obligations, payment routes, and monthly handling
        may evolve as the product matures.
      </p>
      <p>
        If you operate a project inside FundLoop, you agree to follow the contribution, payment, and reporting rules
        presented in the product and related documentation for the workflows you choose to use.
      </p>

      <h2>5. Participation and Rewards</h2>
      <p>
        Users may become eligible for distributions, rewards, or visibility based on participation in the ecosystem.
        Eligibility depends on the rules of the relevant workflow and the operational state of the network. We do not
        guarantee any specific amount, payout frequency, or result.
      </p>

      <h2>6. User Conduct</h2>
      <p>You agree not to use the Services to:</p>
      <ul>
        <li>Violate any applicable law or regulation</li>
        <li>Infringe the rights of any third party</li>
        <li>Harass, abuse, or harm another person</li>
        <li>Send spam or other unsolicited messages</li>
        <li>Interfere with the proper functioning of the Services</li>
        <li>Attempt to gain unauthorized access to the Services or related systems</li>
        <li>Misrepresent identity, authorship, or authorization in payout-touching or operator-facing flows</li>
      </ul>

      <h2>7. Intellectual Property</h2>
      <p>
        The Services and all content and materials included on the Services, including text, graphics, logos, images,
        and software, are the property of FundLoop or its licensors and are protected by copyright, trademark, and
        other intellectual property laws.
      </p>
      <p>
        We grant you a limited, non-exclusive, non-transferable, and revocable license to access and use the Services
        for their intended purposes, subject to these Terms.
      </p>

      <h2>8. Privacy</h2>
      <p>
        Our <Link href="/privacy">Privacy Policy</Link> describes how we collect, use, and share information about you
        when you use the Services. By using the Services, you agree to those practices.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may terminate or suspend your access to the Services at any time, with or without cause, and with or without
        notice. Upon termination, your right to use the Services will immediately cease.
      </p>

      <h2>10. Disclaimer of Warranties</h2>
      <p>
        THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
        AND NON-INFRINGEMENT.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, FUNDLOOP, ITS AFFILIATES, AND THEIR LICENSORS, SERVICE PROVIDERS,
        EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
        DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUES, DATA, OR GOODWILL.
      </p>

      <h2>12. Changes to the Services</h2>
      <p>
        We may modify, suspend, or discontinue any part of the Services at any time. We may also update these Terms
        when the product, legal, or operational context changes.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms are governed by the laws applicable in the jurisdiction where FundLoop is operated, without regard
        to conflict-of-law principles.
      </p>

      <h2>14. Contact Us</h2>
      <p>
        If you have questions about these Terms, please use <Link href="/support">the support page</Link> or review the
        related documentation and legal materials linked above.
      </p>
    </LegalPageShell>
  )
}
