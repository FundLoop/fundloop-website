import { notFound } from "next/navigation"
import { isValidLocale } from "@/i18n/routing"
import { ProjectInvitationAcceptance } from "@/components/project-invitation-acceptance"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"

type PageProps = {
  params: Promise<{ locale: string; token: string }>
}

export default async function ProjectInvitationPage({ params }: PageProps) {
  const { locale, token } = await params

  if (!isValidLocale(locale)) {
    notFound()
  }

  return (
    <MarketingPage>
      <MarketingSection className="flex min-h-[calc(100svh-5.5rem)] items-center pb-20 pt-16">
        <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/70 p-8 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.04] sm:p-10">
          <SectionEyebrow>Project invitation</SectionEyebrow>
          <SectionTitle className="mt-4 text-5xl sm:text-6xl">Join a FundLoop project.</SectionTitle>
          <SectionBody className="mt-6">Sign in with the invited email, then accept. The link is single-purpose and expires after seven days.</SectionBody>
          <div className="mt-8"><ProjectInvitationAcceptance token={token} locale={locale} /></div>
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
