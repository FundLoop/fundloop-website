import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { isAuthorizedE2ERequest, isE2EAuthEnabled } from "@/lib/e2e/config"

type LoginBody = {
  email?: string
  password?: string
}

export async function POST(request: Request) {
  if (!isE2EAuthEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 })
  }

  if (!isAuthorizedE2ERequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  let body: LoginBody = {}

  try {
    body = (await request.json()) as LoginBody
  } catch {
    body = {}
  }

  const email = body.email?.trim()
  const password = body.password?.trim()

  if (!email || !password) {
    return NextResponse.json(
      {
        ok: false,
        error: "email and password are required.",
      },
      { status: 400 },
    )
  }

  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Could not sign in test user.",
      },
      { status: 401 },
    )
  }

  return NextResponse.json({
    ok: true,
    data: {
      userId: data.user.id,
      email: data.user.email ?? email,
    },
  })
}
