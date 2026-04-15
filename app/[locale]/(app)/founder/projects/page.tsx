import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type FounderProjectsPageProps = {
  params: Promise<{ locale: string }>
}

export default async function FounderProjectsPage({ params }: FounderProjectsPageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("founderProjects")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-3xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">{t("title")}</h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {navigationContext.managedProjects.map((project) => (
          <Card key={project.id} className="h-full bg-[var(--surface-panel-strong)]">
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>{project.slug ? `/${project.slug}` : "Slug pending"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.slug ? (
                <>
                  <Link href={`/projects/${project.slug}`} className="block text-sm font-semibold text-[var(--interactive-primary)]">
                    {t("links.project")}
                  </Link>
                  <Link href={`/projects/${project.slug}/payments`} className="block text-sm font-semibold text-[var(--interactive-primary)]">
                    {t("links.payments")}
                  </Link>
                  <Link href={`/projects/${project.slug}/zkas`} className="block text-sm font-semibold text-[var(--interactive-primary)]">
                    {t("links.zkas")}
                  </Link>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">{t("missingSlug")}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
