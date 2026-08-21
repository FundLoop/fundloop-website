"use client"

import { useMemo, useState, useTransition } from "react"
import { ArrowDown, ArrowUp, Coins, Plus, Trash2 } from "lucide-react"
import {
  type UserAssetPreferenceInput,
  type UserAssetPreferenceSummary,
  type UserAssetPreferenceType,
} from "@/lib/edge-functions/user-asset-preferences-update-contract"
import { invokeUserAssetPreferencesUpdateBrowser } from "@/lib/edge-functions/user-asset-preferences-update"
import { useRouter } from "@/i18n/navigation"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type EditablePreference = {
  key: string
  assetType: UserAssetPreferenceType
  assetCode: string
  projectId: string
  accepted: boolean
}

type AssetPreferencesPanelProps = {
  preferences: UserAssetPreferenceSummary[]
  defaultPreferences: UserAssetPreferenceSummary[]
  hasCustomPreferences: boolean
  rejectsAllProjectTokens: boolean
  labels: {
    tabTitle: string
    title: string
    description: string
    defaultsBadge: string
    customBadge: string
    planningNote: string
    rejectAllWarningTitle: string
    rejectAllWarningBody: string
    usingDefaultsTitle: string
    usingDefaultsBody: string
    rank: string
    assetType: string
    assetCode: string
    projectId: string
    projectIdPlaceholder: string
    accepted: string
    acceptedHint: string
    addStablecoin: string
    addFiat: string
    addProjectToken: string
    moveUp: string
    moveDown: string
    remove: string
    resetDefaults: string
    save: string
    saving: string
    validationTitle: string
    validationAssetCode: string
    validationProjectId: string
    successTitle: string
    successDescription: string
    failureTitle: string
    typeLabels: Record<UserAssetPreferenceType, string>
  }
}

const ASSET_CODE_PATTERN = /^[A-Z0-9]{2,32}$/

function editableFromPreference(preference: UserAssetPreferenceSummary, index: number): EditablePreference {
  return {
    key: `${preference.id ?? "default"}-${preference.assetType}-${preference.assetCode}-${index}`,
    assetType: preference.assetType,
    assetCode: preference.assetCode,
    projectId: preference.projectId ? String(preference.projectId) : "",
    accepted: preference.accepted,
  }
}

function preferenceInput(row: EditablePreference): UserAssetPreferenceInput {
  return {
    assetType: row.assetType,
    assetCode: row.assetCode.trim().toUpperCase(),
    projectId: row.assetType === "project_token" ? Number(row.projectId) : undefined,
    accepted: row.accepted,
  }
}

function newPreference(assetType: UserAssetPreferenceType): EditablePreference {
  const assetCode = assetType === "stablecoin" ? "USDC" : assetType === "fiat" ? "USD" : "PROJECT"
  return {
    key: globalThis.crypto.randomUUID(),
    assetType,
    assetCode,
    projectId: "",
    accepted: true,
  }
}

export function AssetPreferencesPanel({
  preferences,
  defaultPreferences,
  hasCustomPreferences,
  rejectsAllProjectTokens,
  labels,
}: AssetPreferencesPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const startingPreferences = hasCustomPreferences ? preferences : defaultPreferences
  const [rows, setRows] = useState<EditablePreference[]>(() => startingPreferences.map(editableFromPreference))

  const draftRejectsAllProjectTokens = useMemo(() => {
    const projectTokens = rows.filter((row) => row.assetType === "project_token")
    return projectTokens.length > 0 && projectTokens.every((row) => !row.accepted)
  }, [rows])

  function updateRow(index: number, patch: Partial<EditablePreference>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
  }

  function resetDefaults() {
    setRows([])
  }

  function savePreferences() {
    for (const row of rows) {
      const assetCode = row.assetCode.trim().toUpperCase()
      if (!ASSET_CODE_PATTERN.test(assetCode)) {
        toast({ title: labels.validationTitle, description: labels.validationAssetCode, variant: "destructive" })
        return
      }

      if (row.assetType === "project_token" && (!Number.isInteger(Number(row.projectId)) || Number(row.projectId) <= 0)) {
        toast({ title: labels.validationTitle, description: labels.validationProjectId, variant: "destructive" })
        return
      }
    }

    startTransition(async () => {
      const result = await invokeUserAssetPreferencesUpdateBrowser({
        preferences: rows.map(preferenceInput),
        attemptId: globalThis.crypto.randomUUID(),
      })

      if (!result.ok) {
        toast({ title: labels.failureTitle, description: result.error.message, variant: "destructive" })
        return
      }

      toast({ title: labels.successTitle, description: labels.successDescription })
      setRows((result.data.hasCustomPreferences ? result.data.preferences : result.data.defaultPreferences).map(editableFromPreference))
      router.refresh()
    })
  }

  return (
    <Card className="bg-[var(--surface-panel)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[var(--interactive-primary)]" />
              <CardTitle>{labels.title}</CardTitle>
            </div>
            <CardDescription>{labels.description}</CardDescription>
          </div>
          <Badge variant={hasCustomPreferences ? "default" : "outline"}>{hasCustomPreferences ? labels.customBadge : labels.defaultsBadge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-cyan-300/60 bg-cyan-50/80 p-4 text-sm leading-6 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100">
          {labels.planningNote}
        </div>

        {!hasCustomPreferences ? (
          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4">
            <p className="font-semibold text-[var(--text-strong)]">{labels.usingDefaultsTitle}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{labels.usingDefaultsBody}</p>
          </div>
        ) : null}

        {rejectsAllProjectTokens || draftRejectsAllProjectTokens ? (
          <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            <p className="font-semibold">{labels.rejectAllWarningTitle}</p>
            <p className="mt-1">{labels.rejectAllWarningBody}</p>
          </div>
        ) : null}

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.key} className="grid gap-3 rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-4 lg:grid-cols-[4rem_10rem_1fr_1fr_9rem]">
              <div>
                <Label>{labels.rank}</Label>
                <p className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{index + 1}</p>
              </div>
              <div>
                <Label>{labels.assetType}</Label>
                <Select
                  value={row.assetType}
                  onValueChange={(value: UserAssetPreferenceType) =>
                    updateRow(index, { assetType: value, projectId: value === "project_token" ? row.projectId : "" })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stablecoin">{labels.typeLabels.stablecoin}</SelectItem>
                    <SelectItem value="fiat">{labels.typeLabels.fiat}</SelectItem>
                    <SelectItem value="project_token">{labels.typeLabels.project_token}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${row.key}-asset-code`}>{labels.assetCode}</Label>
                <Input
                  id={`${row.key}-asset-code`}
                  className="mt-2"
                  value={row.assetCode}
                  onChange={(event) => updateRow(index, { assetCode: event.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor={`${row.key}-project-id`}>{labels.projectId}</Label>
                <Input
                  id={`${row.key}-project-id`}
                  className="mt-2"
                  inputMode="numeric"
                  disabled={row.assetType !== "project_token"}
                  placeholder={labels.projectIdPlaceholder}
                  value={row.assetType === "project_token" ? row.projectId : ""}
                  onChange={(event) => updateRow(index, { projectId: event.target.value })}
                />
              </div>
              <div className="flex flex-col justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-strong)]">
                  <Checkbox checked={row.accepted} onCheckedChange={(checked) => updateRow(index, { accepted: checked === true })} />
                  {labels.accepted}
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label={labels.moveUp} onClick={() => moveRow(index, -1)} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" aria-label={labels.moveDown} onClick={() => moveRow(index, 1)} disabled={index === rows.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" aria-label={labels.remove} onClick={() => removeRow(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm leading-6 text-[var(--text-muted)]">{labels.acceptedHint}</p>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, newPreference("stablecoin")])}>
            <Plus className="mr-2 h-4 w-4" />
            {labels.addStablecoin}
          </Button>
          <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, newPreference("fiat")])}>
            <Plus className="mr-2 h-4 w-4" />
            {labels.addFiat}
          </Button>
          <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, newPreference("project_token")])}>
            <Plus className="mr-2 h-4 w-4" />
            {labels.addProjectToken}
          </Button>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={resetDefaults} disabled={isPending}>
            {labels.resetDefaults}
          </Button>
          <Button type="button" onClick={savePreferences} disabled={isPending}>
            {isPending ? labels.saving : labels.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
