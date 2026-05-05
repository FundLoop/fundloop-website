import { NextResponse } from "next/server"
import { assertZkasRunDownloadArtifactPath } from "@/lib/storage/artifacts"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { ZKAS_RUN_BUCKET } from "@/lib/zkas/constants"
import { requireZkasSuperadmin } from "@/lib/zkas/auth"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  await requireZkasSuperadmin()
  const { id, kind } = await context.params
  const runId = Number.parseInt(id, 10)

  if (!Number.isInteger(runId) || !["result", "attestation"].includes(kind)) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 })
  }

  const supabase = getAdminSupabaseClient()
  const { data: run, error } = await supabase
    .from("zkas_runs")
    .select("id, month, result_artifact_path, attestation_artifact_path")
    .eq("id", runId)
    .single()

  if (error || !run) {
    return NextResponse.json({ error: error?.message ?? "Run not found" }, { status: 404 })
  }

  const rawObjectPath = kind === "result" ? run.result_artifact_path : run.attestation_artifact_path
  if (!rawObjectPath) {
    return NextResponse.json({ error: "Artifact not available" }, { status: 404 })
  }

  let objectPath: string
  try {
    objectPath = assertZkasRunDownloadArtifactPath({
      cycleKey: run.month,
      runId: run.id,
      artifact: kind as "result" | "attestation",
      path: rawObjectPath,
    })
  } catch {
    return NextResponse.json({ error: "Artifact not available" }, { status: 404 })
  }

  const { data: artifact, error: downloadError } = await supabase.storage.from(ZKAS_RUN_BUCKET).download(objectPath)
  if (downloadError || !artifact) {
    return NextResponse.json({ error: downloadError?.message ?? "Could not download artifact" }, { status: 500 })
  }

  const filename = objectPath.split("/").pop() ?? `${kind}-artifact.json`
  const contentType = artifact.type || "application/octet-stream"

  return new NextResponse(await artifact.arrayBuffer(), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  })
}
