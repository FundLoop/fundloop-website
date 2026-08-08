import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { loginThroughE2EEndpoint } from "../support/e2e-login"

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for review-policy consent smoke.`)
  return value
}

test("keeps profiles private until grant and removes discovery after withdrawal", async ({ page }) => {
  test.setTimeout(180_000)
  const baseURL = requiredEnv("PLAYWRIGHT_LOCAL_BASE_URL")
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  const e2eSecret = requiredEnv("FUNDLOOP_E2E_SECRET")
  const runId = randomUUID().slice(0, 8)
  const email = `review-consent-${runId}@example.test`
  const password = `FundLoop-${runId}-review!`
  const displayName = `Review Consent ${runId}`
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) throw new Error(createError?.message ?? "Could not create review consent actor.")

  const userId = created.user.id
  try {
    const { error: profileError } = await supabase.from("users").insert({
      user_id: userId,
      email,
      display_name: displayName,
      full_name: displayName,
      profile_headline: "Private until separately published",
      status: "active",
      is_public: false,
      is_name_public: false,
      is_pfp_public: false,
      is_occupation_public: false,
      is_location_public: false,
    })
    if (profileError) throw new Error(profileError.message)

    const { data: publicProject, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("status", "active")
      .eq("is_public", true)
      .is("deleted_at", null)
      .limit(1)
      .single()
    if (projectError || !publicProject) throw new Error(projectError?.message ?? "No public project is available for discovery smoke.")

    const { error: participantError } = await supabase.from("participants").insert({
      project_id: publicProject.id,
      user_id: userId,
      is_admin: false,
      is_favorite: false,
    })
    if (participantError) throw new Error(participantError.message)

    await page.goto(`${baseURL}/users?q=${encodeURIComponent(displayName)}`)
    await expect(page.getByText(displayName, { exact: true })).toHaveCount(0)

    await loginThroughE2EEndpoint(page.context(), { baseURL, email, password, secret: e2eSecret })
    await page.goto(`${baseURL}/workspace/account`)
    await page.getByRole("tab", { name: "Profile" }).click()

    const consent = page.getByTestId("profile-publication-consent")
    await expect(consent).toContainText("DRAFT - NOT APPROVED - NOT EFFECTIVE")
    await expect(consent.getByRole("button", { name: "Publish profile in review preview" })).toBeDisabled()
    await consent.getByRole("checkbox").click()
    await consent.getByRole("button", { name: "Publish profile in review preview" }).click()
    await expect(consent.getByRole("status")).toContainText("choice recorded", { timeout: 60_000 })

    await page.goto(`${baseURL}/users?q=${encodeURIComponent(displayName)}`)
    await expect(page.getByText(displayName, { exact: true })).toBeVisible()

    await page.goto(`${baseURL}/workspace/account`)
    await page.getByRole("tab", { name: "Profile" }).click()
    await consent.getByRole("button", { name: "Withdraw public-profile publication" }).click()
    await expect(consent.getByRole("status")).toContainText("removed from FundLoop public discovery", { timeout: 60_000 })

    await page.goto(`${baseURL}/users?q=${encodeURIComponent(displayName)}`)
    await expect(page.getByText(displayName, { exact: true })).toHaveCount(0)
  } finally {
    await supabase.from("profile_publication_consents").delete().eq("user_id", userId)
    await supabase.from("users").delete().eq("user_id", userId)
    await supabase.auth.admin.deleteUser(userId)
  }
})
