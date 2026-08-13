import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  const environment = process.env.FUNDLOOP_DEPLOYMENT_ENV?.trim() || "unknown"
  if (environment !== "local") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({
    runtime: "fundloop-next",
    environment,
    readinessNonce: process.env.FUNDLOOP_PERSONA_READINESS_NONCE?.trim() || null,
    commitSha: process.env.FUNDLOOP_PERSONA_COMMIT_SHA?.trim() || null,
  }, { headers: { "Cache-Control": "no-store" } })
}
