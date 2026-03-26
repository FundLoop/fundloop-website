import "server-only"

import { createHash } from "node:crypto"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"

export function hashTextContent(content: string) {
  return createHash("sha256").update(content).digest("hex")
}

export async function uploadTextArtifact(bucket: string, path: string, content: string, contentType: string) {
  const supabase = getAdminSupabaseClient()
  const file = new Blob([content], { type: contentType })
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType,
    upsert: true,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function uploadBinaryArtifact(bucket: string, path: string, file: File, contentType?: string) {
  const supabase = getAdminSupabaseClient()
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: contentType ?? (file.type || "application/octet-stream"),
    upsert: true,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function downloadTextArtifact(bucket: string, path: string) {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase.storage.from(bucket).download(path)

  if (error || !data) {
    throw new Error(error?.message ?? "Could not download artifact")
  }

  return data.text()
}
