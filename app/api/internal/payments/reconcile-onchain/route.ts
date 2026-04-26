import { NextResponse } from "next/server"
import { invokeInternalServerEdgeCommand } from "@/lib/edge-functions/invoke-internal-server"
import {
  ADMIN_ONCHAIN_PAYMENT_RECONCILIATION_RUN_FUNCTION,
  normalizeAdminOnchainPaymentReconciliationRunResult,
} from "@/lib/edge-functions/admin-payment-operations-contract"

function getRequestSecret(request: Request) {
  const authorization = request.headers.get("authorization")
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim()
  }

  return request.headers.get("x-fundloop-cron-secret")?.trim() ?? null
}

type ReconciliationRequestBody = {
  limit?: number
  paymentId?: number
  submissionId?: number
}

function parseOptionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: undefined }
  }

  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 1) {
    return {
      ok: false as const,
      error: `${field} must be a positive integer.`,
    }
  }

  return { ok: true as const, value: parsed }
}

function parseRequestBody(value: unknown) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: {} satisfies ReconciliationRequestBody }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false as const,
      error: "Request body must be a JSON object.",
    }
  }

  const body = value as Record<string, unknown>
  const limit = parseOptionalPositiveInteger(body.limit, "limit")
  if (!limit.ok) {
    return limit
  }

  const paymentId = parseOptionalPositiveInteger(body.paymentId, "paymentId")
  if (!paymentId.ok) {
    return paymentId
  }

  const submissionId = parseOptionalPositiveInteger(body.submissionId, "submissionId")
  if (!submissionId.ok) {
    return submissionId
  }

  return {
    ok: true as const,
    value: {
      limit: limit.value,
      paymentId: paymentId.value,
      submissionId: submissionId.value,
    } satisfies ReconciliationRequestBody,
  }
}

export async function POST(request: Request) {
  const configuredSecret = process.env.FUNDLOOP_PAYMENTS_CRON_SECRET?.trim()
  if (!configuredSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "FUNDLOOP_PAYMENTS_CRON_SECRET is not configured.",
      },
      { status: 500 },
    )
  }

  const requestSecret = getRequestSecret(request)
  const isSecretCaller = Boolean(requestSecret && requestSecret === configuredSecret)
  if (!isSecretCaller) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    )
  }

  let rawBody: unknown = undefined
  try {
    rawBody = await request.json()
  } catch {
    rawBody = undefined
  }

  const body = parseRequestBody(rawBody)
  if (!body.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: body.error,
      },
      { status: 400 },
    )
  }

  try {
    const result = await normalizeAdminOnchainPaymentReconciliationRunResult(
      await invokeInternalServerEdgeCommand(
        ADMIN_ONCHAIN_PAYMENT_RECONCILIATION_RUN_FUNCTION,
        body.value,
      ),
    )

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.message,
        },
        { status: result.error.code === "invalid_payload" ? 400 : result.error.code === "invalid_internal_secret" ? 401 : 500 },
      )
    }

    return NextResponse.json({ ok: true, data: result.data })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reconcile onchain payments.",
      },
      { status: 500 },
    )
  }
}
