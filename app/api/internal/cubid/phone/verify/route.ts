import { NextResponse } from "next/server"
import { createServerCubidApiClient } from "@/lib/cubid/server-client"
import { createServerSupabaseClient } from "@/lib/supabase-server"

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

  const phone = typeof (body as { phone?: unknown })?.phone === "string" ? (body as { phone: string }).phone.trim() : ""
  const otpValue = (body as { otp?: unknown })?.otp
  const otp =
    typeof otpValue === "string" || typeof otpValue === "number" ? String(otpValue).trim() : ""

  if (!phone || !otp) {
    return NextResponse.json({ ok: false, error: "phone and otp are required." }, { status: 400 })
  }

  try {
    const cubidClient = createServerCubidApiClient()
    const result = await cubidClient.verifyPhoneOtp({ phone, otp })
    return NextResponse.json({ ok: true, data: result })
  } catch (routeError) {
    return NextResponse.json(
      {
        ok: false,
        error: routeError instanceof Error ? routeError.message : "Failed to verify phone OTP.",
      },
      { status: 400 },
    )
  }
}
