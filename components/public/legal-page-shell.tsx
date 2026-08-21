import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import {
  MarketingPage,
  MarketingSection,
  SectionBody,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

type RelatedLink = {
  href: string
  label: string
}

type LegalPageShellProps = {
  backToHomeLabel: string
  eyebrow: string
  title: string
  summary: string
  updatedLabel: string
  relatedLinks: RelatedLink[]
  statusBanner?: string
  statusDetail?: string
  children: ReactNode
}

export default function LegalPageShell({
  backToHomeLabel,
  eyebrow,
  title,
  summary,
  updatedLabel,
  relatedLinks,
  statusBanner,
  statusDetail,
  children,
}: LegalPageShellProps) {
  return (
    <MarketingPage>
      <MarketingSection className="pb-10 pt-10">
        <Reveal>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-0 text-[var(--marketing-muted-strong)] hover:bg-transparent hover:text-[var(--marketing-accent)]"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {backToHomeLabel}
            </Link>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
        {statusBanner ? (
          <div
            className="mb-8 rounded-2xl border-2 border-amber-500 bg-amber-50 p-5 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100"
            role="status"
            data-testid="legal-review-status"
          >
            <p className="font-bold tracking-wide">{statusBanner}</p>
            {statusDetail ? <p className="mt-2 text-sm leading-6">{statusDetail}</p> : null}
          </div>
        ) : null}
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
          <Reveal>
            <SectionEyebrow>{eyebrow}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{title}</SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">{summary}</SectionBody>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-6 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {updatedLabel}
              </p>
              <div className="mt-6 space-y-3">
                {relatedLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-2xl border border-[color:var(--marketing-line)] px-4 py-3 text-sm text-[var(--marketing-muted-strong)] transition-colors hover:bg-black/[0.03] hover:text-[var(--marketing-accent)] dark:hover:bg-white/[0.04]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-12">
        <Reveal>
          <article className="mx-auto max-w-4xl rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-6 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] sm:p-8">
            <div className="prose prose-slate max-w-none dark:prose-invert">{children}</div>
          </article>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
