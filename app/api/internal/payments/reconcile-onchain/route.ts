import { NextResponse } from "next/server"
import { runOnchainPaymentReconciliation } from "@/lib/onchain/payment-reconciliation"

function getRequestSecret(request: Request) {
  const authorization = request.headers.get("authorization")
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim()
  }

  return request.headers.get("x-fundloop-cron-secret")?.trim() ?? null
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
  if (!requestSecret || requestSecret !== configuredSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    )
  }

  let body: { limit?: number; paymentId?: number; submissionId?: number } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  try {
    const summary = await runOnchainPaymentReconciliation({
      source: "cron",
      limit: body.limit,
      paymentId: body.paymentId,
      submissionId: body.submissionId,
    })

    return NextResponse.json({
      ok: true,
      data: summary,
    })
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
