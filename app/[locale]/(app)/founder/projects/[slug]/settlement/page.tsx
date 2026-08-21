import { notFound, redirect } from "next/navigation"
import { EpochProjectPackageReview } from "@/components/founder/epoch-project-package-review"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getNavigationContext } from "@/lib/navigation-context"
import { invokeEpochProjectPackageWorkflowServer } from "@/lib/edge-functions/epoch-project-package-workflow-server"

export default async function FounderProjectSettlementPage({params}:{params:Promise<{locale:string;slug:string}>}) {
  const {locale,slug}=await params;const navigation=await getNavigationContext()
  if(!navigation.isAuthenticated)redirect(`/${locale}/join`)
  if(!navigation.managedProjects.some(project=>project.slug===slug))notFound()
  const result=await invokeEpochProjectPackageWorkflowServer({action:"read",projectSlug:slug}).catch(()=>null)
  const packages=result?.ok&&result.data.action==="read"?result.data.packages:[]
  return <div className="space-y-8">
    <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border bg-[var(--surface-panel)] p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">Settlement package review</p>
      <h1 className="mt-3 text-4xl font-semibold">Paired lists and settled funding</h1>
      <p className="mt-3 max-w-3xl text-[var(--text-muted)]">Review frozen, versioned project packages. Only accepted reconciliation-email delivery starts the deadline. Approval remains provisional and never opens payouts.</p>
    </section>
    {!result?.ok ? <Card className="border-amber-300"><CardHeader><CardTitle>Package read unavailable</CardTitle><CardDescription>{result?.error.message??"The local package command is not running."}</CardDescription></CardHeader></Card> : null}
    <EpochProjectPackageReview packages={packages}/>
  </div>
}
