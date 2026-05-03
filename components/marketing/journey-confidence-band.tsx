import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/marketing/reveal"

export type JourneyConfidenceItem = {
  label: string
  body: string
}

export type JourneyConfidenceBandProps = {
  eyebrow: string
  title: string
  body: string
  primaryCta: string
  primaryHref: string
  secondaryCta: string
  secondaryHref: string
  items: JourneyConfidenceItem[]
}

export function JourneyConfidenceBand({
  eyebrow,
  title,
  body,
  primaryCta,
  primaryHref,
  secondaryCta,
  secondaryHref,
  items,
}: JourneyConfidenceBandProps) {
  return (
    <section className="px-6 py-8 sm:px-8 lg:px-12">
      <Reveal>
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[2.25rem] border border-[color:var(--marketing-line)] bg-[radial-gradient(circle_at_top_left,rgba(239,139,87,0.18),transparent_34%),linear-gradient(135deg,rgba(255,248,238,0.92),rgba(126,175,203,0.16))] p-6 shadow-[0_28px_90px_rgba(15,23,23,0.1)] dark:bg-[radial-gradient(circle_at_top_left,rgba(239,139,87,0.12),transparent_34%),linear-gradient(135deg,rgba(13,21,21,0.96),rgba(126,175,203,0.08))] sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:p-10">
          <div className="space-y-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-accent)]">
              {eyebrow}
            </p>
            <h2 className="max-w-2xl font-display text-4xl leading-none tracking-[var(--tracking-display)] sm:text-5xl">
              {title}
            </h2>
            <p className="max-w-xl text-base leading-7 text-[var(--marketing-muted-strong)]">{body}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="rounded-full bg-[var(--marketing-accent)] px-6 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href={primaryHref}>
                  {primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-6 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href={secondaryHref}>{secondaryCta}</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {items.map((item) => (
              <div key={item.label} className="rounded-[1.5rem] border border-[color:var(--marketing-line)] bg-white/58 p-5 dark:bg-white/[0.04]">
                <CheckCircle2 className="h-5 w-5 text-[var(--marketing-accent)]" />
                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--marketing-ink)] dark:text-[var(--marketing-paper)]">
                  {item.label}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
