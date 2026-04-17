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
  const t = await getTranslations({ locale, namespace: "metadata.privacy" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function PrivacyPage({ params }: PageProps) {
  await params
  const t = await getTranslations("legalPages")

  return (
    <LegalPageShell
      backToHomeLabel={t("backToHome")}
      eyebrow={t("relatedLinks.privacy")}
      title={t("relatedLinks.privacy")}
      summary="This policy explains how FundLoop collects, uses, stores, and shares personal information while the product continues to evolve toward identity-aware and payout-aware workflows."
      updatedLabel={t("updatedLabel", { date: UPDATED_AT })}
      relatedLinks={[
        { href: "/cookies", label: t("relatedLinks.cookies") },
        { href: "/terms", label: t("relatedLinks.terms") },
        { href: "/support", label: t("relatedLinks.support") },
      ]}
    >
      <h2>1. Introduction</h2>
      <p>
        At FundLoop (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), we respect your privacy and are committed to
        protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard
        your information when you use our website, services, and applications (collectively, the &quot;Services&quot;).
      </p>
      <p>
        Please read this Privacy Policy carefully. By accessing or using the Services, you acknowledge that you have
        read, understood, and agree to be bound by this Privacy Policy.
      </p>

      <h2>2. Information We Collect</h2>
      <p>We collect several types of information from and about users of our Services:</p>
      <h3>2.1 Personal Information</h3>
      <p>Personal information is information that identifies you as an individual. We may collect the following:</p>
      <ul>
        <li>Name</li>
        <li>Email address</li>
        <li>Wallet address</li>
        <li>Demographic information such as age, gender, or location</li>
        <li>Occupation</li>
        <li>Skills, interests, and contribution notes</li>
      </ul>

      <h3>2.2 Project Information</h3>
      <p>If you register or operate a project inside FundLoop, we may collect:</p>
      <ul>
        <li>Project name</li>
        <li>Website</li>
        <li>Description</li>
        <li>Contact information</li>
        <li>Logo and public profile information</li>
        <li>Categories</li>
        <li>Payment and route configuration metadata</li>
      </ul>

      <h3>2.3 Usage Information</h3>
      <p>We may automatically collect certain information about how you use the Services, including:</p>
      <ul>
        <li>IP address</li>
        <li>Browser type</li>
        <li>Device information</li>
        <li>Operating system</li>
        <li>Pages visited</li>
        <li>Time and date of visits</li>
        <li>Referring website</li>
        <li>Other service diagnostics and usage statistics</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>We may use the information we collect for several purposes, including:</p>
      <ul>
        <li>Providing, maintaining, and improving the Services</li>
        <li>Processing transactions and sending related information</li>
        <li>Sending administrative messages, security alerts, and support responses</li>
        <li>Responding to your comments, questions, and requests</li>
        <li>Facilitating contribution, reporting, and payout-adjacent workflows</li>
        <li>Connecting users with relevant projects</li>
        <li>Analyzing usage patterns and trends</li>
        <li>Protecting the security and integrity of the Services</li>
        <li>Complying with legal obligations</li>
      </ul>

      <h2>4. How We Share Your Information</h2>
      <p>We may share information in the following circumstances:</p>
      <h3>4.1 With Projects</h3>
      <p>
        If you are a user, we may share anonymized or scoped participation data with projects in the ecosystem. The
        goal is to support meaningful participation analysis without turning raw personal identity into a casual
        inspection surface.
      </p>

      <h3>4.2 With Service Providers</h3>
      <p>
        We may share your information with third-party providers who perform services on our behalf, such as payment
        processing, data analysis, email delivery, hosting, and customer service.
      </p>

      <h3>4.3 For Legal Reasons</h3>
      <p>
        We may disclose your information if required to do so by law or in response to valid requests by public
        authorities, such as a court or government agency.
      </p>

      <h3>4.4 Business Transfers</h3>
      <p>
        If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of
        that transaction.
      </p>

      <h3>4.5 With Your Consent</h3>
      <p>We may share your information with third parties when you have given us your consent to do so.</p>

      <h2>5. Data Security</h2>
      <p>
        We implement appropriate technical and organizational measures to protect your information against unauthorized
        access, alteration, disclosure, or destruction. However, no method of transmission or storage is completely
        secure, and we cannot guarantee absolute security.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain personal information for as long as necessary to provide the Services, comply with legal obligations,
        resolve disputes, and enforce our agreements. Retention periods may vary depending on the type of data and the
        operational context in which it is used.
      </p>

      <h2>7. Your Rights and Choices</h2>
      <p>
        Depending on your jurisdiction, you may have rights to access, correct, delete, restrict, or object to the use
        of your personal information. To exercise those rights, please contact us through the support channels linked on
        this page.
      </p>

      <h2>8. Children’s Privacy</h2>
      <p>
        The Services are not intended for children under the age of 18, and we do not knowingly collect personal
        information from children under 18.
      </p>

      <h2>9. Changes to This Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will revise the last-updated date above and
        make the revised version accessible through the Services.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please use <Link href="/support">the support page</Link> or
        review the related legal and documentation links above.
      </p>
    </LegalPageShell>
  )
}
