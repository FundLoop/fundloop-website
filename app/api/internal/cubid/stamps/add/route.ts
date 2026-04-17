import { NextResponse } from "next/server"
import { createServerCubidApiClient } from "@/lib/cubid/server-client"
import { createServerSupabaseClient } from "@/lib/supabase-server"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

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

  if (!isPlainObject(body)) {
    return NextResponse.json({ ok: false, error: "Request body must be a JSON object." }, { status: 400 })
  }

  const pageId = body.pageId
  const stampType = typeof body.stampType === "string" ? body.stampType.trim() : ""
  const userId = typeof body.userId === "string" ? body.userId.trim() : ""
  const stampData = isPlainObject(body.stampData) ? body.stampData : null

  if ((!pageId && pageId !== 0) || !stampType || !userId || !stampData) {
    return NextResponse.json(
      { ok: false, error: "pageId, userId, stampType, and stampData are required." },
      { status: 400 },
    )
  }

  const { data: profile } = await supabase.from("users").select("cubid_id").eq("user_id", user.id).maybeSingle()
  if (!profile?.cubid_id || profile.cubid_id !== userId) {
    return NextResponse.json({ ok: false, error: "CUBID user mismatch." }, { status: 403 })
  }

  try {
    const cubidClient = createServerCubidApiClient()
    const result = await cubidClient.addStamp({
      pageId: String(pageId),
      stampData,
      stampType,
      userId,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (routeError) {
    return NextResponse.json(
      {
        ok: false,
        error: routeError instanceof Error ? routeError.message : "Failed to persist the verified stamp.",
      },
      { status: 400 },
    )
  }
}
