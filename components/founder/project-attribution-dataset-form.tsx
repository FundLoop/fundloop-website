"use client"

import { useState, useTransition } from "react"
import type { ReactNode } from "react"
import { useRouter } from "@/i18n/navigation"
import { invokeProjectAttributionDatasetSubmitBrowser } from "@/lib/edge-functions/project-attribution-dataset-submit"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

type OpenCycle = {
  cycleKey: string
}

type CurrentDataset = {
  cycleKey: string
  status: string
  rowCount: number
  totalAttributionPoints: number
  note: string | null
  submittedAt: string
  updatedAt: string
} | null

type DraftRow = {
  id: string
  scopedCubidId: string
  userId: string
  userEmail: string
  attributionPoints: string
  category: string
  evidenceReference: string
  notes: string
}

type ProjectAttributionDatasetFormProps = {
  projectSlug: string
  openCycles: OpenCycle[]
  currentDataset: CurrentDataset
  labels: {
    title: string
    description: string
    currentTitle: string
    currentDescription: string
    currentEmpty: string
    blockedNoOpenCycle: string
    cycle: string
    note: string
    rowsTitle: string
    scopedCubidId: string
    userId: string
    userEmail: string
    resolutionHelp: string
    attributionPoints: string
    category: string
    evidenceReference: string
    rowNotes: string
    addRow: string
    removeRow: string
    saveDraft: string
    submit: string
    submitting: string
    validationTitle: string
    validationScopedCubid: string
    validationPoints: string
    successDraftTitle: string
    successSubmittedTitle: string
    successDescription: string
    failureTitle: string
  }
}

function newRow(id = randomId()): DraftRow {
  return {
    id,
    scopedCubidId: "",
    userId: "",
    userEmail: "",
    attributionPoints: "",
    category: "",
    evidenceReference: "",
    notes: "",
  }
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function points(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 1_000_000) / 1_000_000 : Number.NaN
}

export function ProjectAttributionDatasetForm({ projectSlug, openCycles, currentDataset, labels }: ProjectAttributionDatasetFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [cycleKey, setCycleKey] = useState(currentDataset?.cycleKey ?? openCycles[0]?.cycleKey ?? "")
  const [note, setNote] = useState(currentDataset?.note ?? "")
  const [rows, setRows] = useState<DraftRow[]>([newRow("initial-attribution-row")])
  const canSubmit = openCycles.length > 0 && Boolean(cycleKey) && !isPending

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((currentRows) => currentRows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string) {
    setRows((currentRows) => (currentRows.length > 1 ? currentRows.filter((row) => row.id !== id) : currentRows))
  }

  function submitDataset(status: "draft" | "submitted") {
    if (!cycleKey) {
      toast({ title: labels.validationTitle, description: labels.blockedNoOpenCycle, variant: "destructive" })
      return
    }

    const normalizedRows = rows.map((row) => ({
      scopedCubidId: row.scopedCubidId.trim(),
      userId: row.userId.trim() || undefined,
      userEmail: row.userEmail.trim() || undefined,
      attributionPoints: points(row.attributionPoints),
      category: row.category.trim() || undefined,
      evidenceReference: row.evidenceReference.trim() || undefined,
      notes: row.notes.trim() || undefined,
    }))

    if (normalizedRows.some((row) => !row.scopedCubidId)) {
      toast({ title: labels.validationTitle, description: labels.validationScopedCubid, variant: "destructive" })
      return
    }

    if (normalizedRows.some((row) => !Number.isFinite(row.attributionPoints) || row.attributionPoints < 0)) {
      toast({ title: labels.validationTitle, description: labels.validationPoints, variant: "destructive" })
      return
    }

    startTransition(async () => {
      const result = await invokeProjectAttributionDatasetSubmitBrowser({
        projectSlug,
        cycleKey,
        status,
        rows: normalizedRows,
        note: note.trim() || undefined,
        attemptId: randomId(),
      })

      if (!result.ok) {
        toast({ title: labels.failureTitle, description: result.error.message, variant: "destructive" })
        return
      }

      toast({
        title: status === "draft" ? labels.successDraftTitle : labels.successSubmittedTitle,
        description: labels.successDescription.replace("{cycle}", result.data.cycleKey).replace("{rows}", String(result.data.rowCount)),
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
            {currentDataset
              ? labels.currentDescription
                  .replace("{cycle}", currentDataset.cycleKey)
                  .replace("{status}", currentDataset.status)
                  .replace("{rows}", String(currentDataset.rowCount))
                  .replace("{points}", String(currentDataset.totalAttributionPoints))
              : labels.currentEmpty}
          </p>
        </div>

        {openCycles.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-100">
            {labels.blockedNoOpenCycle}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[0.45fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="attribution-cycle">{labels.cycle}</Label>
            <select
              id="attribution-cycle"
              value={cycleKey}
              onChange={(event) => setCycleKey(event.target.value)}
              disabled={openCycles.length === 0}
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
            <Label htmlFor="attribution-note">{labels.note}</Label>
            <Input id="attribution-note" value={note} onChange={(event) => setNote(event.target.value)} disabled={!canSubmit} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-strong)]">{labels.rowsTitle}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{labels.resolutionHelp}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((currentRows) => [...currentRows, newRow()])}>
              {labels.addRow}
            </Button>
          </div>

          {rows.map((row, index) => (
            <div key={row.id} className="rounded-[var(--radius-xl)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text-strong)]">#{index + 1}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                  {labels.removeRow}
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={labels.scopedCubidId} id={`scoped-cubid-${row.id}`}>
                  <Input
                    id={`scoped-cubid-${row.id}`}
                    value={row.scopedCubidId}
                    onChange={(event) => updateRow(row.id, { scopedCubidId: event.target.value })}
                    disabled={!canSubmit}
                  />
                </Field>
                <Field label={labels.attributionPoints} id={`attribution-points-${row.id}`}>
                  <Input
                    id={`attribution-points-${row.id}`}
                    type="number"
                    min="0"
                    step="0.000001"
                    value={row.attributionPoints}
                    onChange={(event) => updateRow(row.id, { attributionPoints: event.target.value })}
                    disabled={!canSubmit}
                  />
                </Field>
                <Field label={labels.userId} id={`user-id-${row.id}`}>
                  <Input id={`user-id-${row.id}`} value={row.userId} onChange={(event) => updateRow(row.id, { userId: event.target.value })} disabled={!canSubmit} />
                </Field>
                <Field label={labels.userEmail} id={`user-email-${row.id}`}>
                  <Input
                    id={`user-email-${row.id}`}
                    value={row.userEmail}
                    onChange={(event) => updateRow(row.id, { userEmail: event.target.value })}
                    disabled={!canSubmit}
                  />
                </Field>
                <Field label={labels.category} id={`category-${row.id}`}>
                  <Input id={`category-${row.id}`} value={row.category} onChange={(event) => updateRow(row.id, { category: event.target.value })} disabled={!canSubmit} />
                </Field>
                <Field label={labels.evidenceReference} id={`evidence-reference-${row.id}`}>
                  <Input
                    id={`evidence-reference-${row.id}`}
                    value={row.evidenceReference}
                    onChange={(event) => updateRow(row.id, { evidenceReference: event.target.value })}
                    disabled={!canSubmit}
                  />
                </Field>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor={`row-notes-${row.id}`}>{labels.rowNotes}</Label>
                <Textarea
                  id={`row-notes-${row.id}`}
                  value={row.notes}
                  onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                  disabled={!canSubmit}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => submitDataset("draft")} disabled={!canSubmit}>
            {isPending ? labels.submitting : labels.saveDraft}
          </Button>
          <Button type="button" onClick={() => submitDataset("submitted")} disabled={!canSubmit}>
            {isPending ? labels.submitting : labels.submit}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
