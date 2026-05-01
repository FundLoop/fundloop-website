import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { DatasetStatusBadge } from "@/components/zkas/dataset-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getNavigationContext } from "@/lib/navigation-context"
import { findFounderWorkspaceProject, getFounderWorkspaceHome } from "@/lib/workspace/founder-workspace"
import {
  ZKAS_DATASET_CHECKLIST,
  ZKAS_DATASET_DERIVATION_STEPS,
  ZKAS_DATASET_TEMPLATE_CSV,
  ZKAS_DATASET_TEMPLATE_JSON,
  ZKAS_IDENTITY_ARTIFACT_FIELDS,
} from "@/lib/zkas/guide"
import type { ZkasDatasetStatus } from "@/types/zkas"

type FounderProjectAttributionPageProps = {
  params: Promise<{ locale: string; slug: string }>
}

const csvTemplateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(ZKAS_DATASET_TEMPLATE_CSV)}`
const jsonTemplateHref = `data:application/json;charset=utf-8,${encodeURIComponent(ZKAS_DATASET_TEMPLATE_JSON)}`

function isZkasDatasetStatus(value: string): value is ZkasDatasetStatus {
  return ["uploaded", "validated", "failed", "approved", "included", "replaced", "archived"].includes(value)
}

export default async function FounderProjectAttributionPage({ params }: FounderProjectAttributionPageProps) {
  const { locale, slug } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("founderAttribution")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const home = await getFounderWorkspaceHome(navigationContext)
  const project = findFounderWorkspaceProject(home, slug)

  if (!project) {
    notFound()
  }

  const projectSlug = project.slug ?? slug
  const latestCycle = project.contributionCycles[0]?.cycleKey ?? null
  const latestDatasetCoversLatestCycle = Boolean(latestCycle && project.attribution.latestDatasetMonth === latestCycle)

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow-panel)]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-10">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)] md:text-5xl">
              {t("title", { project: project.name })}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/projects/${projectSlug}/zkas`}
                className="rounded-full bg-[var(--interactive-primary)] px-5 py-3 text-sm font-semibold text-[var(--interactive-primary-foreground)] shadow-[var(--surface-shadow-soft)]"
              >
                {t("primaryCta")}
              </Link>
              <Link href={`/founder/projects/${projectSlug}/contributions`} className="rounded-full border border-[color:var(--surface-border)] px-5 py-3 text-sm font-semibold text-[var(--text-strong)]">
                {t("secondaryCta")}
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <SummaryMetric label={t("summary.latestCycle")} value={latestCycle ?? t("none")} />
            <SummaryMetric label={t("summary.latestDataset")} value={project.attribution.latestDatasetMonth ?? t("none")} />
            <SummaryMetric label={t("summary.approved")} value={String(project.attribution.approvedDatasetCount)} />
          </div>
        </div>
      </section>

      {home.warnings.length > 0 ? (
        <section className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-100">
          <p className="font-semibold">{t("warnings.title")}</p>
          <p className="mt-2">{t("warnings.body")}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <ReadinessCard
          title={t("readiness.cycle.title")}
          description={latestCycle ? t("readiness.cycle.ready") : t("readiness.cycle.needsWork")}
          state={latestCycle ?? t("none")}
          ready={Boolean(latestCycle)}
        />
        <ReadinessCard
          title={t("readiness.dataset.title")}
          description={latestDatasetCoversLatestCycle ? t("readiness.dataset.ready") : t("readiness.dataset.needsWork")}
          state={project.attribution.latestDatasetStatus ?? t("none")}
          ready={latestDatasetCoversLatestCycle}
        />
        <ReadinessCard
          title={t("readiness.validation.title")}
          description={project.attribution.issueCount === 0 ? t("readiness.validation.ready") : t("readiness.validation.needsWork")}
          state={String(project.attribution.issueCount)}
          ready={project.attribution.issueCount === 0}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="bg-[var(--surface-panel-strong)]">
          <CardHeader>
            <CardTitle>{t("guide.title")}</CardTitle>
            <CardDescription>{t("guide.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Checklist title={t("guide.derive")} items={ZKAS_DATASET_DERIVATION_STEPS} />
            <Checklist title={t("guide.checklist")} items={ZKAS_DATASET_CHECKLIST} />
            <Checklist title={t("guide.identity")} items={ZKAS_IDENTITY_ARTIFACT_FIELDS} />
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href={csvTemplateHref} download="zkas-template.csv">
                  {t("guide.csv")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={jsonTemplateHref} download="zkas-template.json">
                  {t("guide.json")}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-panel-strong)]">
          <CardHeader>
            <CardTitle>{t("submissions.title")}</CardTitle>
            <CardDescription>{t("submissions.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("submissions.month")}</TableHead>
                  <TableHead>{t("submissions.file")}</TableHead>
                  <TableHead>{t("submissions.rows")}</TableHead>
                  <TableHead>{t("submissions.issues")}</TableHead>
                  <TableHead>{t("submissions.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.attribution.recentSubmissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-[var(--text-muted)]">
                      {t("submissions.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  project.attribution.recentSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>{submission.month}</TableCell>
                      <TableCell>
                        <Link href={`/projects/${projectSlug}/zkas/uploads/${submission.id}`} className="text-[var(--interactive-primary)] hover:underline">
                          {submission.fileName}
                        </Link>
                      </TableCell>
                      <TableCell>{submission.rowCount}</TableCell>
                      <TableCell>{submission.issueCount}</TableCell>
                      <TableCell>
                        {isZkasDatasetStatus(submission.status) ? (
                          <DatasetStatusBadge status={submission.status} />
                        ) : (
                          <Badge variant="outline">{submission.status}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/projects/${projectSlug}/zkas`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                {t("links.upload")}
              </Link>
              <Link href={`/founder/projects/${projectSlug}`} className="text-sm font-semibold text-[var(--interactive-primary)]">
                {t("links.projectHome")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{value}</p>
    </div>
  )
}

function ReadinessCard({ title, description, state, ready }: { title: string; description: string; state: string; ready: boolean }) {
  return (
    <Card className="bg-[var(--surface-panel-strong)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge
            variant="outline"
            className={
              ready
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
            }
          >
            {state}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[var(--text-strong)]">{title}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--text-muted)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
