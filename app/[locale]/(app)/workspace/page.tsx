import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { isResolvedCubidIdentityStatus } from "@/lib/cubid/types"
import { getNavigationContext } from "@/lib/navigation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type WorkspacePageProps = {
  params: Promise<{ locale: string }>
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("workspace")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const cubidStatus = navigationContext.user?.cubidIdentityStatus ?? "unlinked"
  const cubidStatusIcon =
    cubidStatus === "verified" ? BadgeCheck : cubidStatus === "linked" ? ShieldCheck : ShieldAlert
  const CubidStatusIcon = cubidStatusIcon
  const cubidToneClassName =
    cubidStatus === "verified"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
      : cubidStatus === "linked"
        ? "border-cyan-200 bg-cyan-50/70 text-cyan-950"
        : "border-amber-200 bg-amber-50/80 text-amber-950"
  const completionPercent = navigationContext.user?.profileCompletionPercent ?? 0
  const completionMissingItems = navigationContext.user?.profileCompletionMissingItems ?? []

  const cards = [
    {
      title: t("cards.account.title"),
      description: t("cards.account.description"),
      href: "/workspace/account",
    },
    {
      title: t("cards.participation.title"),
      description: t("cards.participation.description"),
      href: "/participation",
    },
    {
      title: t("cards.results.title"),
      description: t("cards.results.description"),
      href: "/settings/zkas",
    },
  ]

  if (navigationContext.hasFounderAccess) {
    cards.push({
      title: t("cards.founder.title"),
      description: t("cards.founder.description"),
      href: "/founder",
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-3xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
        </div>
      </section>

      <section className={`rounded-[calc(var(--radius-2xl)+0.25rem)] border p-6 shadow-[var(--surface-shadow-panel)] ${cubidToneClassName}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl items-start gap-3">
            <CubidStatusIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]">{t(`identity.status.${cubidStatus}`)}</p>
              <h2 className="text-xl font-semibold">{t("identity.title")}</h2>
              <p className="text-sm leading-6">{t(`identity.body.${cubidStatus}`)}</p>
            </div>
          </div>
          <a
            href="https://passport.cubid.me"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-current/20 px-4 py-2 text-sm font-semibold"
          >
            {t("identity.cta")}
          </a>
        </div>
        {!isResolvedCubidIdentityStatus(cubidStatus) ? (
          <p className="mt-4 text-sm leading-6">{t("identity.followUp")}</p>
        ) : null}
      </section>

      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-6 shadow-[var(--surface-shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
              Profile completion
            </p>
            <h2 className="text-xl font-semibold text-[var(--text-strong)]">{completionPercent}% complete</h2>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Local profile fields count alongside CUBID-backed phone and provider signals. This remains optional beyond basic
              linkage, but it helps move your account toward a richer trust profile.
            </p>
          </div>
          <Link
            href="/workspace/account"
            className="inline-flex items-center rounded-full border border-[color:var(--surface-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-strong)]"
          >
            Continue in account
          </Link>
        </div>
        {completionMissingItems.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {completionMissingItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]"
              >
                {item.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">All current Session 14 completion items are already covered.</p>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block">
            <Card className="h-full bg-[var(--surface-panel-strong)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[color:var(--surface-border-strong)] hover:shadow-[var(--surface-shadow-panel)]">
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-semibold text-[var(--interactive-primary)]">{t("open")}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  )
}
