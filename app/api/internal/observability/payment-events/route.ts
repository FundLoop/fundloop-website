import { NextResponse } from "next/server"
import { resolveDeploymentEnvironment } from "@/lib/onchain/runtime-config"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { parsePaymentFlowEventBatch } from "@/lib/observability/payment-flow"
import { recordPaymentFlowEvents, resolvePaymentFlowActorRole } from "@/lib/observability/payment-flow-server"

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  try {
    const parsedEvents = parsePaymentFlowEventBatch(body)
    const environment = resolveDeploymentEnvironment()
    const events = await Promise.all(
      parsedEvents.map(async (event) => ({
        ...event,
        environment,
        actorUserId: user.id,
        actorRole: await resolvePaymentFlowActorRole({
          userId: user.id,
          email: user.email ?? null,
          projectId: event.projectId ?? null,
        }),
      })),
    )

    await recordPaymentFlowEvents(events)

    return NextResponse.json({
      ok: true,
      data: { accepted: events.length },
    })
  } catch (routeError) {
    return NextResponse.json(
      {
        ok: false,
        error: routeError instanceof Error ? routeError.message : "Invalid observability payload.",
      },
      { status: 400 },
    )
  }
}
