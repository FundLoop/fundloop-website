"use client"

import { useState, useTransition } from "react"
import { useRouter } from "@/i18n/navigation"
import { invokeProjectMonthlyContributionSubmitBrowser } from "@/lib/edge-functions/project-monthly-contribution-submit"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

type OpenCycle = {
  cycleKey: string
  periodStart: string
  periodEnd: string
}

type CurrentSubmission = {
  cycleKey: string
  sourceCurrency: string
  sourceAmount: number
  usdEquivalentAmount: number
  calculatedContributionAmount: number
  sourceReference: string | null
  notes: string | null
  submittedAt: string
  updatedAt: string
} | null

type ProjectMonthlyContributionFormProps = {
  projectSlug: string
  contributionPercentage: number | null
  defaultReportingCurrencyCode: string
  canSubmit: boolean
  blockedReason: "missing_commitment" | "no_open_cycle" | null
  openCycles: OpenCycle[]
  currentSubmission: CurrentSubmission
  labels: {
    title: string
    description: string
    currentTitle: string
    currentDescription: string
    currentEmpty: string
    cycle: string
    period: string
    sourceCurrency: string
    sourceAmount: string
    usdEquivalentAmount: string
    commitmentPercentage: string
    calculatedContributionAmount: string
    sourceReference: string
    notes: string
    submit: string
    submitting: string
    blockedMissingCommitment: string
    blockedNoOpenCycle: string
    validationTitle: string
    validationAmount: string
    successTitle: string
    successDescription: string
    failureTitle: string
  }
}

function numberInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value)
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

function sourceAmount(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function ProjectMonthlyContributionForm({
  projectSlug,
  contributionPercentage,
  defaultReportingCurrencyCode,
  canSubmit,
  blockedReason,
  openCycles,
  currentSubmission,
  labels,
}: ProjectMonthlyContributionFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const initialCycle = openCycles.find((cycle) => cycle.cycleKey === currentSubmission?.cycleKey) ?? openCycles[0] ?? null
  const [cycleKey, setCycleKey] = useState(initialCycle?.cycleKey ?? "")
  const [currency, setCurrency] = useState(currentSubmission?.sourceCurrency ?? defaultReportingCurrencyCode ?? "USD")
  const [sourceAmountValue, setSourceAmountValue] = useState(numberInputValue(currentSubmission?.sourceAmount))
  const [usdEquivalentAmountValue, setUsdEquivalentAmountValue] = useState(numberInputValue(currentSubmission?.usdEquivalentAmount))
  const [sourceReference, setSourceReference] = useState(currentSubmission?.sourceReference ?? "")
  const [notes, setNotes] = useState(currentSubmission?.notes ?? "")

  const selectedCycle = openCycles.find((cycle) => cycle.cycleKey === cycleKey) ?? null
  const parsedSourceAmount = Number(sourceAmountValue)
  const parsedUsdEquivalentAmount = Number(usdEquivalentAmountValue)
  const calculatedContributionAmount = money((Number.isFinite(parsedUsdEquivalentAmount) ? parsedUsdEquivalentAmount : 0) * ((contributionPercentage ?? 0) / 100))
  const submitDisabled = !canSubmit || !selectedCycle || isPending
  const blockedCopy =
    blockedReason === "missing_commitment"
      ? labels.blockedMissingCommitment
      : blockedReason === "no_open_cycle"
        ? labels.blockedNoOpenCycle
        : null

  function submitContribution() {
    if (!selectedCycle || contributionPercentage === null || contributionPercentage <= 0) {
      toast({ title: labels.validationTitle, description: blockedCopy ?? labels.blockedMissingCommitment, variant: "destructive" })
      return
    }

    if (
      !Number.isFinite(parsedSourceAmount) ||
      parsedSourceAmount < 0 ||
      !Number.isFinite(parsedUsdEquivalentAmount) ||
      parsedUsdEquivalentAmount < 0
    ) {
      toast({ title: labels.validationTitle, description: labels.validationAmount, variant: "destructive" })
      return
    }

    startTransition(async () => {
      const result = await invokeProjectMonthlyContributionSubmitBrowser({
        projectSlug,
        cycleKey: selectedCycle.cycleKey,
        periodStart: selectedCycle.periodStart,
        periodEnd: selectedCycle.periodEnd,
        sourceCurrency: currency.trim().toUpperCase(),
        sourceAmount: sourceAmount(parsedSourceAmount),
        usdEquivalentAmount: money(parsedUsdEquivalentAmount),
        commitmentPercentage: contributionPercentage,
        calculatedContributionAmount,
        sourceReference: sourceReference.trim() || undefined,
        notes: notes.trim() || undefined,
        attemptId: globalThis.crypto.randomUUID(),
      })

      if (!result.ok) {
        toast({ title: labels.failureTitle, description: result.error.message, variant: "destructive" })
        return
      }

      toast({
        title: labels.successTitle,
        description: labels.successDescription.replace("{cycle}", result.data.cycleKey),
      })
      router.refresh()
    })
  }

  return (
    <Card className="bg-[var(--surface-panel-strong)]">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
          <p className="text-sm font-semibold text-[var(--text-strong)]">{labels.currentTitle}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
            {currentSubmission
              ? labels.currentDescription
                  .replace("{cycle}", currentSubmission.cycleKey)
                  .replace("{amount}", `${currentSubmission.sourceAmount} ${currentSubmission.sourceCurrency}`)
                  .replace("{usd}", `$${currentSubmission.usdEquivalentAmount.toFixed(2)}`)
              : labels.currentEmpty}
          </p>
        </div>

        {blockedCopy ? (
          <div className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-100">
            {blockedCopy}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="monthly-cycle">{labels.cycle}</Label>
            <select
              id="monthly-cycle"
              value={cycleKey}
              onChange={(event) => setCycleKey(event.target.value)}
              disabled={!canSubmit || openCycles.length === 0}
              className="flex h-10 w-full rounded-[calc(var(--radius-lg)-0.125rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-3 py-2 text-sm text-[var(--text-strong)] shadow-[var(--surface-shadow-soft)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {openCycles.map((cycle) => (
                <option key={cycle.cycleKey} value={cycle.cycleKey}>
                  {cycle.cycleKey}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{labels.period}</Label>
            <div className="flex h-10 items-center rounded-[calc(var(--radius-lg)-0.125rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-muted)]">
              {selectedCycle ? `${selectedCycle.periodStart} - ${selectedCycle.periodEnd}` : "-"}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-currency">{labels.sourceCurrency}</Label>
            <Input id="source-currency" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} disabled={!canSubmit} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-amount">{labels.sourceAmount}</Label>
            <Input
              id="source-amount"
              type="number"
              min="0"
              step="0.000001"
              value={sourceAmountValue}
              onChange={(event) => setSourceAmountValue(event.target.value)}
              disabled={!canSubmit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usd-equivalent">{labels.usdEquivalentAmount}</Label>
            <Input
              id="usd-equivalent"
              type="number"
              min="0"
              step="0.01"
              value={usdEquivalentAmountValue}
              onChange={(event) => setUsdEquivalentAmountValue(event.target.value)}
              disabled={!canSubmit}
            />
          </div>
          <div className="space-y-2">
            <Label>{labels.commitmentPercentage}</Label>
            <div className="flex h-10 items-center rounded-[calc(var(--radius-lg)-0.125rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-muted)]">
              {contributionPercentage ?? 0}%
            </div>
          </div>
          <div className="space-y-2">
            <Label>{labels.calculatedContributionAmount}</Label>
            <div className="flex h-10 items-center rounded-[calc(var(--radius-lg)-0.125rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-3 text-sm font-semibold text-[var(--text-strong)]">
              ${calculatedContributionAmount.toFixed(2)}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-reference">{labels.sourceReference}</Label>
            <Input id="source-reference" value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} disabled={!canSubmit} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contribution-notes">{labels.notes}</Label>
          <Textarea id="contribution-notes" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canSubmit} />
        </div>

        <Button type="button" onClick={submitContribution} disabled={submitDisabled} className="w-full">
          {isPending ? labels.submitting : labels.submit}
        </Button>
      </CardContent>
    </Card>
  )
}
