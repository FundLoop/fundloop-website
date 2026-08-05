"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react"
import {
  invokeProjectCryptoRouteCreateBrowser,
  invokeProjectCryptoRouteEnabledSetBrowser,
  invokeProjectCryptoRouteMoveBrowser,
  invokeProjectCryptoRouteUpdateBrowser,
} from "@/lib/edge-functions/project-payment-operations"
import type { ManagedCryptoPaymentMethodSummary } from "@/app/actions/project-payment-actions"
import { useWalletRuntime } from "@/components/web3-provider"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { getDeploymentAvailabilityForRoute } from "@/lib/onchain/runtime-config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

type ProjectCryptoRouteManagerProps = {
  projectSlug: string
  routes: ManagedCryptoPaymentMethodSummary[]
  onRoutesChange: (routes: ManagedCryptoPaymentMethodSummary[]) => void
}

type ReferenceOption = {
  value: string
  label: string
}

type ChainOption = ReferenceOption & {
  networkKey: string
}

type ChainAssetOption = ReferenceOption & {
  chainId: string
}

type IntakeContractOption = ReferenceOption & {
  chainId: string
  treasuryAddress: string
  abiVersion: string
}

type EditableRoute = {
  localId: string
  paymentMethodId: number | null
  label: string
  chainId: string
  chainAssetId: string
  intakeContractId: string
  isDefault: boolean
  isEnabled: boolean
  sortOrder: number
  persisted: boolean
  hasInactiveReference: boolean
  isRuntimeAvailable: boolean
  runtimeAvailabilityIssue: string | null
}

type ReferenceData = {
  chains: ChainOption[]
  chainAssets: ChainAssetOption[]
  intakeContracts: IntakeContractOption[]
}

function toLocalRoute(route: ManagedCryptoPaymentMethodSummary): EditableRoute {
  return {
    localId: `persisted-${route.id}`,
    paymentMethodId: route.id,
    label: route.label ?? "",
    chainId: String(route.chain.id),
    chainAssetId: String(route.asset.id),
    intakeContractId: String(route.intakeContract.id),
    isDefault: route.is_default,
    isEnabled: route.is_enabled,
    sortOrder: route.sort_order,
    persisted: true,
    hasInactiveReference: !route.chain.is_active || !route.asset.is_active || !route.intakeContract.is_active,
    isRuntimeAvailable: route.is_runtime_available,
    runtimeAvailabilityIssue: route.runtime_availability_issue,
  }
}

function sortEditableRoutes(routes: EditableRoute[]) {
  return [...routes].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }

    return left.localId.localeCompare(right.localId)
  })
}

function isRouteReady(route: EditableRoute) {
  return Boolean(route.chainId && route.chainAssetId && route.intakeContractId)
}

export function ProjectCryptoRouteManager({ projectSlug, routes, onRoutesChange }: ProjectCryptoRouteManagerProps) {
  const { runtimeConfig } = useWalletRuntime()
  const [references, setReferences] = useState<ReferenceData>({
    chains: [],
    chainAssets: [],
    intakeContracts: [],
  })
  const [referencesLoading, setReferencesLoading] = useState(true)
  const [editableRoutes, setEditableRoutes] = useState<EditableRoute[]>([])
  const [busyRouteId, setBusyRouteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setEditableRoutes((previous) => {
      const drafts = previous.filter((route) => !route.persisted)
      return [...routes.map(toLocalRoute), ...drafts]
    })
  }, [routes])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const loadReferences = async () => {
      try {
        setReferencesLoading(true)

        const [{ data: chains }, { data: assets }, { data: intakeContracts }] = await Promise.all([
          supabase.from("ref_chains").select("id, display_name, network_key").eq("is_active", true).order("display_name"),
          supabase
            .from("ref_chain_assets")
            .select("id, chain_id, symbol, name")
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("chain_intake_contracts")
            .select("id, chain_id, contract_address, treasury_address, abi_version")
            .eq("collection_mode", "contract")
            .eq("is_active", true)
            .order("id"),
        ])

        setReferences({
          chains:
            chains?.map((chain) => ({
              value: String(chain.id),
              label: chain.display_name ?? chain.network_key ?? `Chain ${chain.id}`,
              networkKey: chain.network_key ?? "",
            })) ?? [],
          chainAssets:
            assets?.map((asset) => ({
              value: String(asset.id),
              label: `${asset.symbol} · ${asset.name}`,
              chainId: String(asset.chain_id),
            })) ?? [],
          intakeContracts:
            intakeContracts?.map((contract) => ({
              value: String(contract.id),
              label: contract.contract_address,
              chainId: String(contract.chain_id),
              treasuryAddress: contract.treasury_address,
              abiVersion: contract.abi_version,
            })) ?? [],
        })
      } finally {
        setReferencesLoading(false)
      }
    }

    void loadReferences()
  }, [])

  const orderedRoutes = useMemo(() => sortEditableRoutes(editableRoutes), [editableRoutes])
  const enabledRoutes = useMemo(() => orderedRoutes.filter((route) => route.isEnabled), [orderedRoutes])
  const disabledRoutes = useMemo(() => orderedRoutes.filter((route) => !route.isEnabled), [orderedRoutes])

  const updateEditableRoute = (localId: string, partial: Partial<EditableRoute>) => {
    setEditableRoutes((previous) =>
      previous.map((route) => {
        if (route.localId !== localId) {
          return partial.isDefault ? { ...route, isDefault: false } : route
        }

        const nextRoute = {
          ...route,
          ...partial,
        }
        const selectedChain = references.chains.find((chain) => chain.value === nextRoute.chainId)
        const selectedContract = references.intakeContracts.find((contract) => contract.value === nextRoute.intakeContractId)

        if (!selectedChain || !selectedContract) {
          return {
            ...nextRoute,
            isRuntimeAvailable: false,
            runtimeAvailabilityIssue: "Choose an active chain and intake contract to validate this route.",
          }
        }

        const availability = getDeploymentAvailabilityForRoute(runtimeConfig, {
          networkKey: selectedChain.networkKey,
          contractAddress: selectedContract.label,
          treasuryAddress: selectedContract.treasuryAddress,
          abiVersion: selectedContract.abiVersion,
        })

        return {
          ...nextRoute,
          isRuntimeAvailable: availability.available,
          runtimeAvailabilityIssue: availability.reason,
        }
      }),
    )
  }

  const addDraftRoute = () => {
    setEditableRoutes((previous) => [
      ...previous,
      {
        localId: `draft-${crypto.randomUUID()}`,
        paymentMethodId: null,
        label: "",
        chainId: "",
        chainAssetId: "",
        intakeContractId: "",
        isDefault: previous.filter((route) => route.isEnabled).length === 0,
        isEnabled: true,
        sortOrder: previous.length + 1,
        persisted: false,
        hasInactiveReference: false,
        isRuntimeAvailable: false,
        runtimeAvailabilityIssue: "Choose an active chain and intake contract to validate this route.",
      },
    ])
  }

  const removeDraftRoute = (localId: string) => {
    setEditableRoutes((previous) => previous.filter((route) => route.localId !== localId))
  }

  const handlePersistRoute = (route: EditableRoute) => {
    if (!isRouteReady(route)) {
      toast({
        title: "Route incomplete",
        description: "Choose a chain, token, and intake contract before saving the crypto route.",
        variant: "destructive",
      })
      return
    }

    setBusyRouteId(route.localId)
    startTransition(async () => {
      const payload = {
        projectSlug,
        chainId: Number.parseInt(route.chainId, 10),
        chainAssetId: Number.parseInt(route.chainAssetId, 10),
        intakeContractId: Number.parseInt(route.intakeContractId, 10),
        label: route.label,
        isDefault: route.isDefault,
      }

      const result = route.persisted && route.paymentMethodId !== null
        ? await invokeProjectCryptoRouteUpdateBrowser({
            ...payload,
            paymentMethodId: route.paymentMethodId,
          })
        : await invokeProjectCryptoRouteCreateBrowser(payload)

      setBusyRouteId(null)

      if (!result.ok) {
        toast({
          title: route.persisted ? "Route update failed" : "Route creation failed",
          description: result.error.message,
          variant: "destructive",
        })
        return
      }

      setEditableRoutes((previous) => {
        const unsavedDrafts = previous.filter(
          (editableRoute) => !editableRoute.persisted && editableRoute.localId !== route.localId,
        )
        return [...result.data.map(toLocalRoute), ...unsavedDrafts]
      })
      onRoutesChange(result.data)
      toast({
        title: route.persisted ? "Route updated" : "Route created",
        description: route.persisted
          ? "The crypto route has been updated."
          : "The new crypto route is now available for project payments.",
      })
    })
  }

  const handleMoveRoute = (route: EditableRoute, direction: "up" | "down") => {
    if (!route.persisted || route.paymentMethodId === null) {
      return
    }

    const paymentMethodId = route.paymentMethodId
    setBusyRouteId(route.localId)
    startTransition(async () => {
      const result = await invokeProjectCryptoRouteMoveBrowser({
        projectSlug,
        paymentMethodId,
        direction,
      })

      setBusyRouteId(null)

      if (!result.ok) {
        toast({
          title: "Route reorder failed",
          description: result.error.message,
          variant: "destructive",
        })
        return
      }

      onRoutesChange(result.data)
    })
  }

  const handleToggleEnabled = (route: EditableRoute, enabled: boolean) => {
    if (!route.persisted || route.paymentMethodId === null) {
      return
    }

    const paymentMethodId = route.paymentMethodId
    setBusyRouteId(route.localId)
    startTransition(async () => {
      const result = await invokeProjectCryptoRouteEnabledSetBrowser({
        projectSlug,
        paymentMethodId,
        enabled,
      })

      setBusyRouteId(null)

      if (!result.ok) {
        toast({
          title: enabled ? "Could not enable route" : "Could not disable route",
          description: result.error.message,
          variant: "destructive",
        })
        return
      }

      onRoutesChange(result.data)
      toast({
        title: enabled ? "Route enabled" : "Route disabled",
        description: enabled
          ? "The crypto route is available again for project payments."
          : "The crypto route has been disabled without deleting its configuration.",
      })
    })
  }

  return (
    <Card data-testid="crypto-route-manager">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <CardTitle>Crypto collection routes</CardTitle>
          <CardDescription>
            Manage the onchain routes that tag incoming payments to this project. Disabled routes stay visible so you can
            re-enable them later without losing context.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addDraftRoute}
          disabled={referencesLoading || isPending}
          data-testid="add-crypto-route"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add crypto route
        </Button>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">Enabled routes</p>
              <p className="text-sm text-slate-600">These routes can be selected when the project submits a crypto payment.</p>
            </div>
            <Badge variant="outline">{enabledRoutes.length}</Badge>
          </div>

          {enabledRoutes.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
              No active crypto routes yet. Add one to let project admins pay through a FundLoop intake contract.
            </div>
          ) : (
            <div className="space-y-4">
              {enabledRoutes.map((route, index) => {
                const availableAssets = references.chainAssets.filter((asset) => asset.chainId === route.chainId)
                const defaultContract =
                  references.intakeContracts.find((contract) => contract.chainId === route.chainId) ?? null
                const isBusy = busyRouteId === route.localId && isPending

                return (
                  <div
                    key={route.localId}
                    className="space-y-4 rounded-2xl border p-4"
                    data-testid={
                      route.persisted && route.paymentMethodId !== null
                        ? `enabled-route-${route.paymentMethodId}`
                        : `enabled-route-draft-${route.localId}`
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Route {index + 1}</p>
                        <p className="text-xs text-slate-500">Order {route.sortOrder}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {route.isDefault ? <Badge>Default</Badge> : null}
                        {!route.persisted ? <Badge variant="outline">New</Badge> : null}
                      </div>
                    </div>

                    {route.hasInactiveReference ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                        This route references a chain, token, or intake contract that is no longer active. Update it before
                        reusing it.
                      </div>
                    ) : null}

                    {!route.hasInactiveReference && !route.isRuntimeAvailable ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                        {route.runtimeAvailabilityIssue ??
                          "This route is saved, but it does not match the active wallet deployment for this environment."}
                      </div>
                    ) : null}

                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Chain</Label>
                        <Select
                          value={route.chainId}
                          onValueChange={(value) =>
                            updateEditableRoute(route.localId, {
                              chainId: value,
                              chainAssetId: "",
                              intakeContractId:
                                references.intakeContracts.find((contract) => contract.chainId === value)?.value ?? "",
                              hasInactiveReference: false,
                            })
                          }
                        >
                        <SelectTrigger data-testid={`route-chain-trigger-${route.paymentMethodId ?? route.localId}`}>
                            <SelectValue placeholder="Choose a chain" />
                          </SelectTrigger>
                          <SelectContent>
                            {references.chains.map((chain) => (
                              <SelectItem key={chain.value} value={chain.value}>
                                {chain.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Token</Label>
                        <Select
                          value={route.chainAssetId}
                          onValueChange={(value) =>
                            updateEditableRoute(route.localId, {
                              chainAssetId: value,
                              intakeContractId: defaultContract?.value ?? route.intakeContractId,
                              hasInactiveReference: false,
                            })
                          }
                          disabled={!route.chainId}
                        >
                          <SelectTrigger data-testid={`route-token-trigger-${route.paymentMethodId ?? route.localId}`}>
                            <SelectValue placeholder="Choose a token" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAssets.map((asset) => (
                              <SelectItem key={asset.value} value={asset.value}>
                                {asset.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`route-label-${route.localId}`}>Label</Label>
                        <Input
                          id={`route-label-${route.localId}`}
                          value={route.label}
                          onChange={(event) => updateEditableRoute(route.localId, { label: event.target.value })}
                          placeholder="Base USDC default route"
                          data-testid={`route-label-input-${route.paymentMethodId ?? route.localId}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Intake contract</Label>
                        <div className="rounded-2xl border bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                          {references.intakeContracts.find((contract) => contract.value === route.intakeContractId)?.label ||
                            "Choose a chain first"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={route.isDefault ? "default" : "outline"}
                        onClick={() => updateEditableRoute(route.localId, { isDefault: true })}
                        disabled={!route.isRuntimeAvailable}
                        data-testid={`route-default-button-${route.paymentMethodId ?? route.localId}`}
                      >
                        {route.isDefault ? "Default route" : "Mark as default"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleMoveRoute(route, "up")}
                        disabled={isBusy || index === 0}
                        data-testid={`route-move-up-${route.paymentMethodId ?? route.localId}`}
                      >
                        <ArrowUp className="mr-2 h-4 w-4" />
                        Move up
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleMoveRoute(route, "down")}
                        disabled={isBusy || index === enabledRoutes.length - 1}
                        data-testid={`route-move-down-${route.paymentMethodId ?? route.localId}`}
                      >
                        <ArrowDown className="mr-2 h-4 w-4" />
                        Move down
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handlePersistRoute(route)}
                        disabled={isBusy || referencesLoading || !isRouteReady(route) || (route.isDefault && !route.isRuntimeAvailable)}
                        data-testid={`route-save-${route.paymentMethodId ?? route.localId}`}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {route.persisted ? "Save changes" : "Create route"}
                      </Button>
                      {route.persisted ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleToggleEnabled(route, false)}
                          disabled={isBusy}
                          data-testid={`route-disable-${route.paymentMethodId}`}
                        >
                          Disable route
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeDraftRoute(route.localId)}
                          disabled={isBusy}
                          data-testid={`route-remove-draft-${route.localId}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove draft
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">Disabled routes</p>
              <p className="text-sm text-slate-600">Disabled routes stay here so you can inspect them and re-enable them later.</p>
            </div>
            <Badge variant="outline">{disabledRoutes.length}</Badge>
          </div>

          {disabledRoutes.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
              No disabled routes right now.
            </div>
          ) : (
            <div className="space-y-4">
              {disabledRoutes.map((route) => {
                const routeLabel =
                  route.label ||
                  references.chainAssets.find((asset) => asset.value === route.chainAssetId)?.label ||
                  "Saved crypto route"
                const chainLabel =
                  references.chains.find((chain) => chain.value === route.chainId)?.label || `Chain ${route.chainId}`
                const contractLabel =
                  references.intakeContracts.find((contract) => contract.value === route.intakeContractId)?.label ||
                  "Unavailable contract"
                const isBusy = busyRouteId === route.localId && isPending

                return (
                  <div
                    key={route.localId}
                    className="space-y-3 rounded-2xl border bg-slate-50/60 p-4"
                    data-testid={`disabled-route-${route.paymentMethodId ?? route.localId}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{routeLabel}</p>
                        <p className="text-xs text-slate-500">
                          {chainLabel} • order {route.sortOrder}
                        </p>
                      </div>
                      <Badge variant="outline">Disabled</Badge>
                    </div>

                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Token: {references.chainAssets.find((asset) => asset.value === route.chainAssetId)?.label || route.chainAssetId}</p>
                      <p className="break-all">Contract: {contractLabel}</p>
                    </div>

                    {route.hasInactiveReference ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                        This disabled route references inactive infrastructure. Re-enabling will require a valid active chain,
                        token, and intake contract.
                      </div>
                    ) : null}

                    {!route.hasInactiveReference && !route.isRuntimeAvailable ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                        {route.runtimeAvailabilityIssue ??
                          "This route is out of sync with the active wallet deployment and will stay unavailable until the deployment rows are synced."}
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleToggleEnabled(route, true)}
                      disabled={isBusy}
                      data-testid={`route-enable-${route.paymentMethodId ?? route.localId}`}
                    >
                      Re-enable route
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-dashed bg-slate-50/50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">More payment methods coming later</p>
          <p className="mt-1">
            This first manager focuses on crypto intake-contract routes. Fiat, manual, and other payment rails will be added
            in a future project settings pass.
          </p>
          {referencesLoading ? (
            <p className="mt-2 text-xs text-slate-500">Loading available chains and tokens...</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
