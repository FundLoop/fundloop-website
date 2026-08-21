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
  const t = await getTranslations({ locale, namespace: "metadata.cookies" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function CookiesPage({ params }: PageProps) {
  await params
  const t = await getTranslations("legalPages")

  return (
    <LegalPageShell
      backToHomeLabel={t("backToHome")}
      eyebrow={t("relatedLinks.cookies")}
      title={t("relatedLinks.cookies")}
      summary="This Cookie Policy explains how FundLoop uses cookies and similar technologies to support essential product behavior, analytics-adjacent diagnostics, and user experience continuity."
      updatedLabel={t("updatedLabel", { date: UPDATED_AT })}
      relatedLinks={[
        { href: "/privacy", label: t("relatedLinks.privacy") },
        { href: "/terms", label: t("relatedLinks.terms") },
        { href: "/support", label: t("relatedLinks.support") },
      ]}
    >
      <h2>1. Introduction</h2>
      <p>
        This Cookie Policy explains how FundLoop (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) uses cookies and
        similar technologies on our website, services, and applications (collectively, the &quot;Services&quot;).
      </p>
      <p>
        By using the Services, you consent to the use of cookies and similar technologies in accordance with this
        Cookie Policy.
      </p>

      <h2>2. What Are Cookies?</h2>
      <p>
        Cookies are small text files stored on your device when you visit a website. They are widely used to make
        websites work more efficiently, provide a better user experience, and give website owners information about how
        people interact with their sites.
      </p>

      <h2>3. Types of Cookies We Use</h2>
      <p>We may use the following categories of cookies on the Services:</p>
      <h3>3.1 Essential Cookies</h3>
      <p>
        These cookies are necessary for the Services to function properly. They enable core functionality such as
        security, session continuity, and account access.
      </p>

      <h3>3.2 Performance Cookies</h3>
      <p>
        These cookies collect information about how you use the Services, such as which pages you visit most often and
        whether you encounter any errors. This information helps us improve product performance and reliability.
      </p>

      <h3>3.3 Functionality Cookies</h3>
      <p>
        These cookies allow the Services to remember choices you make, such as language or region, and provide enhanced
        personalized features.
      </p>

      <h3>3.4 Analytics or Measurement Cookies</h3>
      <p>
        Where used, these cookies help us understand how public and product surfaces are used so we can improve the
        experience over time. We aim to keep this proportional to the operational needs of the platform.
      </p>

      <h2>4. Similar Technologies</h2>
      <p>In addition to cookies, we may use related storage or measurement mechanisms, including:</p>
      <ul>
        <li>Local storage for client-side persistence</li>
        <li>Session storage for in-browser continuity</li>
        <li>Small measurement tags or diagnostics used for service reliability</li>
      </ul>

      <h2>5. How to Manage Cookies</h2>
      <p>
        Most browsers allow you to control cookies through their settings. You can typically find these settings in the
        Options or Preferences menu of your browser. Disabling cookies may affect the functionality of the Services.
      </p>

      <h2>6. Third-Party Cookies</h2>
      <p>
        Some features may rely on third-party providers, which may set their own cookies or similar technologies. We
        encourage you to review the relevant third-party privacy and cookie policies when those services are involved.
      </p>

      <h2>7. Changes to This Cookie Policy</h2>
      <p>
        We may update this Cookie Policy from time to time. When we do, we will revise the last-updated date above and
        make the revised version accessible through the Services.
      </p>

      <h2>8. Contact Us</h2>
      <p>
        If you have questions about how cookies or related technologies are used on FundLoop, please visit{" "}
        <Link href="/support">the support page</Link>.
      </p>
    </LegalPageShell>
  )
}
