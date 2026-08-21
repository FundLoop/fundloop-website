import { execFileSync } from "node:child_process"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { EPOCH_PROJECT_PACKAGE_WORKFLOW_FUNCTION } from "../../../lib/edge-functions/epoch-project-package-contract"

const operatorEmail = "maya@fundloop.example.com"
const operatorPassword = "FundLoopFounder123!"
const mailpitUrl = "http://127.0.0.1:55324"

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`operational-env-missing-${name.toLowerCase().replaceAll("_", "-")}`)
  return value
}

function localDatabaseUrl() {
  const value = required("PLAYWRIGHT_LOCAL_DB_URL")
  const url = new URL(value)
  if (url.hostname !== "127.0.0.1" || url.port !== "55322" || url.pathname !== "/postgres") {
    throw new Error("operational-database-url-refused")
  }
  return value
}

function createReviewPackage() {
  const sql = `
    INSERT INTO public.epoch_project_packages(
      project_id,intended_cycle_id,canonical_cycle_id,version,status,list_status,funding_status,
      compliance_status,cubid_status,cutoff_at,payment_count,funding_source_count,cohort_count,
      eligible_user_count,held_user_count,preliminary_usd,manifest,manifest_hash,created_by_user_id
    )
    SELECT p.id,c.id,c.id,coalesce((SELECT max(version)+1 FROM public.epoch_project_packages x
      WHERE x.project_id=p.id AND x.intended_cycle_id=c.id),1),
      'review_ready','valid','settled','passed','eligible',clock_timestamp(),1,1,3,3,0,10,
      jsonb_build_object('source','feature-118-operational-mailpit'),repeat('a',64),
      '00000000-0000-4000-8000-000000000101'::uuid
    FROM public.projects p CROSS JOIN LATERAL (
      SELECT id FROM public.monthly_cycles ORDER BY period_start DESC LIMIT 1
    ) c WHERE p.id=1
    RETURNING id;
  `
  const output = execFileSync("psql", [localDatabaseUrl(), "-Atqc", sql], { encoding: "utf8" }).trim()
  const packageId = Number(output.split("\n").at(-1))
  if (!Number.isSafeInteger(packageId) || packageId < 1) throw new Error("operational-package-fixture-failed")
  return packageId
}

test("delivers a founder reconciliation email through the real local Edge and Mailpit path", async ({ page }) => {
  await fetch(`${mailpitUrl}/api/v1/messages`, { method: "DELETE" })
  const packageId = createReviewPackage()
  const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const session = await supabase.auth.signInWithPassword({ email: operatorEmail, password: operatorPassword })
  expect(session.error).toBeNull()
  const result = await supabase.functions.invoke(EPOCH_PROJECT_PACKAGE_WORKFLOW_FUNCTION, {
    body: { action: "send_reconciliation_email", packageId },
  })
  expect(result.error).toBeNull()
  expect(result.data).toMatchObject({ ok: true, data: { action: "send_reconciliation_email", packageId } })

  await expect.poll(async () => {
    const response = await fetch(`${mailpitUrl}/api/v1/messages`)
    return response.json() as Promise<{ messages?: Array<{ Subject?: string }> }>
  }).toMatchObject({ messages: expect.arrayContaining([
    expect.objectContaining({ Subject: expect.stringContaining("FundLoop reconciliation review") }),
  ]) })

  const service = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const persisted = await service.from("epoch_project_packages")
    .select("reconciliation_email_delivered_at,reconciliation_deadline_at")
    .eq("id", packageId).single()
  expect(persisted.error).toBeNull()
  expect(persisted.data?.reconciliation_email_delivered_at).toBeTruthy()
  expect(persisted.data?.reconciliation_deadline_at).toBeTruthy()

  await page.goto(mailpitUrl)
  await expect(page.getByText(/FundLoop reconciliation review/).first()).toBeVisible()
  const output = path.join(process.cwd(), "output", "playwright", "feature-118-mailpit")
  await mkdir(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: path.join(output, "mailpit-desktop-1440x900.png") })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(output, "mailpit-mobile-390x844.png") })
})
