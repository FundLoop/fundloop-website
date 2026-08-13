import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, type Page } from "@playwright/test"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../types/supabase"
import { CAPABILITY_REGISTRY } from "../personas/capabilities"
import type { CheckpointObservation, PersonaId } from "../personas/contracts"
import type { PersonaJourneyActions } from "../personas/journeys"
import { loginThroughE2EEndpoint } from "./e2e-login"
import { consumeLocalOtp } from "./mailpit-otp"
import { readLocalPersonaEnv } from "./persona-env"
import { createCycleClock } from "./persona-monthly-cycle"
import { assertSafePersonaScreenshotSurface, boundedPersonaFailureReason } from "./persona-reporting"
import {
  arrangeFounderProject,
  arrangeMemberEarnings,
  arrangeOpenCycle,
  arrangeReviewReadyProfile,
  arrangeReviewReadyProjectDraft,
  createActiveAttributionUser,
  createPersonaFixtureController,
  createPersonaServiceClient,
  createRunIdentity,
  createRunInvitation,
  createStoredActorWithProfile,
  resolveLocalAuthUserId,
  resolvePublishedProject,
  type MutableFixtureController,
  type PersonaAttributionUserFixture,
  type PersonaProjectFixture,
  type StoredActorCredentials,
} from "./persona-fixtures"

const observed = (evidence: CheckpointObservation["evidence"] = {}): CheckpointObservation => ({ outcome: "observed", evidence })
const pending = (capabilityId: keyof typeof CAPABILITY_REGISTRY): CheckpointObservation => ({
  outcome: "capability-unavailable",
  evidence: { declared: true },
  reasonCode: CAPABILITY_REGISTRY[capabilityId].reasonCode,
})

function commandFailureReason(commandErrors: ReadonlyMap<string, string>, command: string, fallback: string) {
  const code = commandErrors.get(command) ?? fallback
  return code.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || fallback
}

export function createPersonaBrowserActions(personaId: Exclude<PersonaId, "returning-operator">, page: Page) {
  const env = readLocalPersonaEnv()
  const runId = process.env.PLAYWRIGHT_PERSONA_RUN_ID ?? ""
  if (!runId) throw new Error("persona-run-id-missing")
  const run = createRunIdentity([personaId])
  Object.assign(run, { runId, startedAt: process.env.PLAYWRIGHT_PERSONA_STARTED_AT ?? run.startedAt })
  const supabase = createPersonaServiceClient(env) as SupabaseClient<Database>
  const fixtures = createPersonaFixtureController({ run, supabase, outputRoot: process.env.PLAYWRIGHT_PERSONA_OUTPUT_ROOT, ledgerName: personaId })
  const clock = createCycleClock(env.cycleBase)
  const cycleKey = clock.cycleKeyFor(personaId)
  const browserErrors: string[] = []
  const commandErrors = new Map<string, string>()
  page.setDefaultTimeout(10_000)
  page.setDefaultNavigationTimeout(90_000)
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text().toLowerCase()
    browserErrors.push(text.includes("failed to load resource") ? "resource-error" : text.includes("formatting_error") ? "formatting-error" : "console-error")
  })
  page.on("pageerror", () => browserErrors.push("page-error"))
  page.on("response", async (response) => {
    const match = response.url().match(/\/functions\/v1\/([a-z0-9-]+)$/)
    if (!match || response.request().method() !== "POST") return
    try {
      const body = await response.json() as { ok?: boolean; error?: { code?: string; message?: string } }
      if (body.ok === false && body.error?.code) {
        const code = body.error.code.replaceAll("_", "-")
        const message = body.error.message?.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
        commandErrors.set(match[1], message ? `${code}-${message}` : code)
      }
    } catch {}
  })
  const state: {
    email?: string
    requestedAt?: Date
    inviteCode?: string
    actorId?: string
    stored?: StoredActorCredentials
    project?: PersonaProjectFixture
    attributionUser?: PersonaAttributionUserFixture
    cycleId?: number
  } = {}

  async function ensureStored(alias: "returning-member" | "returning-founder") {
    state.stored ??= await createStoredActorWithProfile(supabase, fixtures, alias)
    state.actorId = state.stored.actor.authUserId
    return state.stored
  }

  async function ensureProject() {
    if (!state.actorId) throw new Error("persona-actor-not-established")
    state.project ??= await arrangeFounderProject(supabase, fixtures, state.actorId)
    return state.project
  }

  async function ensureCycle() {
    if (!state.actorId) throw new Error("persona-actor-not-established")
    if (!state.cycleId) {
      const cycle = await arrangeOpenCycle(supabase, fixtures, {
        cycleKey,
        createdByUserId: state.actorId,
      })
      state.cycleId = cycle.id
    }
    if (!state.cycleId) throw new Error("persona-cycle-not-established")
    return state.cycleId
  }

  async function ensureAttributionUser() {
    state.attributionUser ??= await createActiveAttributionUser(supabase, fixtures)
    return state.attributionUser
  }

  async function assertCleanBrowser(errors = browserErrors) {
    if (errors.length > 0) throw new Error(`persona-browser-${errors[0]}`)
  }

  async function capturePageSuccess(targetPage: Page, name = `${personaId}-success.png`, errors = browserErrors) {
    await assertCleanBrowser(errors)
    if (targetPage.viewportSize()?.width !== 1440 || targetPage.viewportSize()?.height !== 900) throw new Error("persona-screenshot-viewport-invalid")
    await assertSafePersonaScreenshotSurface(targetPage)
    const artifactDirectory = path.join(process.cwd(), "output", "playwright", "persona-harness", runId)
    await mkdir(artifactDirectory, { recursive: true })
    const stem = name.replace(/\.png$/, "")
    await targetPage.screenshot({ path: path.join(artifactDirectory, `${stem}-desktop-1440x900.png`), fullPage: false })
    await targetPage.setViewportSize({ width: 390, height: 844 })
    try {
      await assertSafePersonaScreenshotSurface(targetPage)
      await targetPage.screenshot({ path: path.join(artifactDirectory, `${stem}-mobile-390x844.png`), fullPage: false })
    } finally {
      await targetPage.setViewportSize({ width: 1440, height: 900 })
    }
  }

  async function captureInvitationReview(targetPage: Page, name: string, errors = browserErrors) {
    await assertCleanBrowser(errors)
    await assertSafePersonaScreenshotSurface(targetPage)
    const artifactDirectory = path.join(process.cwd(), "output", "playwright", "persona-harness", runId)
    await mkdir(artifactDirectory, { recursive: true })
    await targetPage.screenshot({ path: path.join(artifactDirectory, name), fullPage: false })
  }

  async function captureSuccess() { await capturePageSuccess(page) }

  async function openReview(flow: "user" | "project", title: string | RegExp) {
    await page.goto(`${env.baseURL}/en?onboarding=${flow}`, { waitUntil: "domcontentloaded", timeout: 15_000 })
    const continueDraft = page.getByRole("button", { name: "Continue draft" })
    await expect(continueDraft).toBeVisible({ timeout: 30_000 }).catch(() => { throw new Error(`persona-${flow}-resume-not-visible`) })
    await continueDraft.click({ timeout: 30_000 })
    // First compilation of the project review route can exceed 30 seconds when
    // the full operational matrix has just started all local Edge Functions.
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 60_000 }).catch(() => { throw new Error(`persona-${flow}-review-not-visible`) })
  }

  async function assertPublishedProfile(expectedName: "New Member" | "New Founder") {
    if (!state.actorId || !state.inviteCode) throw new Error("persona-profile-assertion-state-missing")
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await page.getByText("Could not publish profile", { exact: true }).isVisible()) throw new Error("persona-profile-publish-command-failed")
      const profile = await supabase.from("users").select("display_name, invited_by_code, is_public, status").eq("user_id", state.actorId).single()
      const invitation = await supabase.from("invitation_codes").select("usage_count").eq("code", state.inviteCode).single()
      if (!profile.error && profile.data?.display_name === expectedName && profile.data.invited_by_code === state.inviteCode &&
        profile.data.is_public === false && profile.data.status === "active" && !invitation.error && invitation.data?.usage_count === 1) {
        await page.goto(`${env.baseURL}/en/workspace/account`, { waitUntil: "domcontentloaded" })
        await expect(page.getByText(expectedName).first()).toBeVisible()
        return
      }
      await page.waitForTimeout(500)
    }
    const draft = await supabase.from("user_onboarding_drafts").select("id").eq("user_id", state.actorId).maybeSingle()
    if (draft.data) throw new Error("persona-profile-publish-command-incomplete")
    const profile = await supabase.from("users").select("display_name, invited_by_code, is_public, status").eq("user_id", state.actorId).single()
    if (profile.error || !profile.data || profile.data.display_name !== expectedName || profile.data.invited_by_code !== state.inviteCode || profile.data.is_public !== false || profile.data.status !== "active") {
      throw new Error("persona-published-profile-persistence-failed")
    }
    throw new Error("persona-invitation-usage-failed")
  }

  const actions: PersonaJourneyActions = {
    "auth.request-local-otp": async () => {
      const invitation = await createRunInvitation(supabase, fixtures, personaId as "new-member" | "new-founder")
      state.email = invitation.email
      state.inviteCode = invitation.code
      await page.goto(`${env.baseURL}/en/join?invite=${encodeURIComponent(invitation.code)}`)
      await expect(page.getByText("Invitation accepted")).toBeVisible()
      await page.getByRole("button", { name: "Continue onboarding" }).click()
      await page.getByLabel("Email").fill(invitation.email)
      state.requestedAt = new Date()
      await page.getByRole("button", { name: "Continue with email" }).click()
      await expect(page.getByText("Verification code", { exact: true })).toBeVisible()
      return observed({ invitation: "accepted", channel: "mailpit" })
    },
    "auth.verify-local-otp": async () => {
      if (!state.email || !state.requestedAt) throw new Error("persona-otp-request-not-recorded")
      await consumeLocalOtp({
        mailpitUrl: env.mailpitUrl,
        recipient: state.email,
        requestedAfter: state.requestedAt,
        fill: async (otp) => {
          const inputs = page.locator('input[inputmode="numeric"]')
          for (let index = 0; index < otp.length; index += 1) await inputs.nth(index).fill(otp[index])
        },
      })
      await expect(page.getByText(/Signed in|A better start for new FundLoop members/).first()).toBeVisible()
      state.actorId = await resolveLocalAuthUserId(supabase, state.email)
      await fixtures.recordAuthUser(state.actorId)
      return observed({ session: "authenticated" })
    },
    "member.publish-profile": async () => {
      if (!state.actorId || !state.email || !state.inviteCode) throw new Error("persona-new-member-state-missing")
      await page.goto(`${env.baseURL}/en/workspace`, { waitUntil: "domcontentloaded" })
      await arrangeReviewReadyProfile(supabase, fixtures, { authUserId: state.actorId, email: state.email, inviteCode: state.inviteCode, relationshipChoice: "individual" })
      await openReview("user", /Review and complete your private profile/)
      await page.getByRole("button", { name: "Complete private profile" }).click({ timeout: 10_000 })
      await assertPublishedProfile("New Member")
      return observed({ profile: "private", invitation: "consumed" })
    },
    "founder.publish-personal-profile": async () => {
      if (!state.actorId || !state.email || !state.inviteCode) throw new Error("persona-new-founder-state-missing")
      await page.goto(`${env.baseURL}/en/workspace`, { waitUntil: "domcontentloaded" })
      await arrangeReviewReadyProfile(supabase, fixtures, { authUserId: state.actorId, email: state.email, inviteCode: state.inviteCode, relationshipChoice: "create_project" })
      await openReview("user", /Review and complete your private profile/)
      await page.getByRole("button", { name: "Complete private profile" }).click({ timeout: 10_000 })
      await assertPublishedProfile("New Founder")
      return observed({ profile: "private", invitation: "consumed" })
    },
    "profile.review-publication-choice": async () => {
      if (!state.actorId) throw new Error("persona-publication-actor-missing")
      await page.goto(`${env.baseURL}/en/workspace/account`, { waitUntil: "domcontentloaded" })
      await page.getByRole("tab", { name: "Profile" }).click()
      const consent = page.getByTestId("profile-publication-consent")
      const publicationLabel = consent.getByText(/Publish my display name, avatar, headline, bio, occupation, and location/)
      await expect(publicationLabel).toBeVisible()
      await expect(consent).toContainText("DRAFT - NOT APPROVED - NOT EFFECTIVE")
      const checkbox = consent.getByRole("checkbox")
      await expect(checkbox).not.toBeChecked()
      await expect(consent.getByRole("button", { name: "Publish profile in review preview" })).toBeDisabled()
      const initialChoice = await supabase.from("profile_publication_consents").select("action")
        .eq("user_id", state.actorId).order("recorded_at", { ascending: false }).limit(1).maybeSingle()
      if (initialChoice.error || initialChoice.data) throw new Error("persona-publication-preselected")
      return observed({ visibility: "withheld", publication: "explicit-unselected", preselected: false })
    },
    "auth.login-returning-member": async () => {
      const actor = await ensureStored("returning-member").catch(() => { throw new Error("returning-member-arrangement-failed") })
      await loginThroughE2EEndpoint(page.context(), { baseURL: env.baseURL, email: actor.email, password: actor.password, secret: process.env.FUNDLOOP_E2E_SECRET ?? "" })
        .catch(() => { throw new Error("returning-member-login-failed") })
      await page.goto(`${env.baseURL}/en/workspace`).catch(() => { throw new Error("returning-member-route-failed") })
      await expect(page).toHaveURL(/\/en\/workspace/).catch(() => { throw new Error("returning-member-authorization-failed") })
      return observed({ session: "authenticated" })
    },
    "auth.login-returning-founder": async () => {
      const actor = await ensureStored("returning-founder")
      await loginThroughE2EEndpoint(page.context(), { baseURL: env.baseURL, email: actor.email, password: actor.password, secret: process.env.FUNDLOOP_E2E_SECRET ?? "" })
      await ensureProject()
      await page.goto(`${env.baseURL}/en/founder/projects`)
      return observed({ session: "authenticated" })
    },
    "member.view-existing-profile": async () => {
      await page.goto(`${env.baseURL}/en/workspace/account`)
      await expect(page.getByText("Returning Member").first()).toBeVisible()
      return observed({ profile: "visible" })
    },
    "member.view-earnings-total": async () => {
      if (!state.actorId) throw new Error("persona-member-actor-missing")
      browserErrors.length = 0
      const project = await ensureProject()
      const cycleId = await ensureCycle()
      await arrangeMemberEarnings(supabase, fixtures, { actorUserId: state.actorId, projectId: project.id, cycleId, cycleKey })
      await page.goto(`${env.baseURL}/en/workspace/earnings`)
      await expect(page.getByText("$125").first()).toBeVisible()
      return observed({ credited: 125 })
    },
    "member.view-project-sources": async () => {
      await expect(page.getByText(/1 project/i).first()).toBeVisible()
      await expect(page.getByText(/not paid|not paid yet/i).first()).toBeVisible()
      return observed({ projects: 1, payment: "not-paid" })
    },
    "member.withdraw-earnings": async () => {
      if (!state.actorId) throw new Error("persona-member-actor-missing")
      const termsGate = page.getByTestId("terms-preview-gate-payout_preview")
      await expect(termsGate).toContainText("DRAFT - NOT APPROVED - NOT EFFECTIVE")
      await expect(termsGate.getByRole("checkbox")).not.toBeChecked()
      await expect(page.getByRole("button", { name: "Review acknowledgement required" })).toBeDisabled()
      await expect(page.getByLabel("Project-linked asset")).toContainText(/USD · project/)
      const requests = await supabase.from("user_withdrawal_requests").select("id").eq("user_id", state.actorId)
      if (requests.error || requests.data?.length) throw new Error("persona-withdrawal-request-unexpected")
      const credits = await supabase.from("monthly_cycle_bookkeeping_credits").select("payment_status")
        .eq("user_id", state.actorId)
      if (credits.error || credits.data?.length !== 1 || credits.data[0].payment_status !== "not_paid") {
        throw new Error("persona-withdrawal-marked-paid")
      }
      const withdrawalPanel = page.getByTestId("withdrawal-request-panel")
      await withdrawalPanel.scrollIntoViewIfNeeded()
      await page.evaluate(() => window.scrollBy(0, -120))
      await captureSuccess()
      return observed({ amount: 125, status: "eligible", terms: "unselected", payment: "not-paid", "payout-executed": false, capture: personaId })
    },
    "founder.publish-project-profile": async () => {
      if (!state.actorId) throw new Error("persona-founder-actor-missing")
      const draft = await arrangeReviewReadyProjectDraft(supabase, fixtures, state.actorId)
      await openReview("project", "Review and publish your project")
      const publishButton = page.getByRole("button", { name: "Publish project" })
      await expect(publishButton).toBeEnabled({ timeout: 60_000 })
      await publishButton.click({ timeout: 10_000 })
      const publishFailure = page.getByText("Could not publish project", { exact: true })
      const deadline = Date.now() + 20_000
      let publishedProjectId: number | null = null
      while (Date.now() < deadline) {
        const project = await supabase.from("projects").select("id").eq("slug", draft.slug).maybeSingle()
        if (project.error) throw new Error("persona-project-publish-persistence-query-failed")
        publishedProjectId = project.data?.id ?? null
        if (publishedProjectId) break
        if (await publishFailure.isVisible().catch(() => false)) {
          await page.waitForTimeout(100)
          throw new Error(`persona-project-publish-${commandFailureReason(commandErrors, "project-onboarding-publish", "command-failed")}`)
        }
        await page.waitForTimeout(250)
      }
      if (!publishedProjectId) {
        throw new Error(`persona-project-publish-${commandFailureReason(commandErrors, "project-onboarding-publish", "persistence-timeout")}`)
      }
      const project = await resolvePublishedProject(supabase, fixtures, { slug: draft.slug, actorUserId: state.actorId })
      state.project = { ...project, name: draft.name }
      await page.goto(`${env.baseURL}/en/founder/projects`)
      await expect(page.getByText(draft.name)).toBeVisible()
      return observed({ project: "published" })
    },
    "founder.view-existing-profile-and-project": async () => {
      const project = await ensureProject()
      await page.goto(`${env.baseURL}/en/founder/projects`)
      await expect(page.getByText(project.name)).toBeVisible()
      return observed({ project: "visible" })
    },
    "founder.create-project-invitation": async () => {
      if (!state.actorId) throw new Error("persona-founder-actor-missing")
      const project = await ensureProject()
      const invitee = await createStoredActorWithProfile(supabase, fixtures, "returning-member")
      await page.goto(`${env.baseURL}/en/founder/projects/${project.slug}`)
      await page.getByLabel("Invitee email").fill(invitee.email)
      await page.getByRole("button", { name: "Create invitation" }).click()
      await expect(page.getByText(`Pending invitation persisted for ${invitee.email}`)).toBeVisible()
      const invitationLink = await page.getByLabel("Invitation link").inputValue()
      const invitation = await supabase.from("project_invitations").select("id, organization_id")
        .eq("project_id", project.id).eq("invitee_email", invitee.email).single()
      if (invitation.error || !invitation.data) throw new Error("persona-project-invitation-persistence-failed")
      await fixtures.recordDatabaseRow({ table: "project_invitations", primaryKey: { id: invitation.data.id }, cleanupPhase: 130 })
      const [pendingParticipant, pendingMembership] = await Promise.all([
        supabase.from("participants").select("id").eq("project_id", project.id).eq("user_id", invitee.actor.authUserId).maybeSingle(),
        supabase.from("organization_members").select("id").eq("organization_id", invitation.data.organization_id).eq("user_id", invitee.actor.authUserId).maybeSingle(),
      ])
      if (pendingParticipant.data || pendingMembership.data) throw new Error("persona-pending-invitation-granted-access")

      const browser = page.context().browser()
      if (!browser) throw new Error("persona-invitation-browser-unavailable")
      const inviteeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      try {
        await loginThroughE2EEndpoint(inviteeContext, { baseURL: env.baseURL, email: invitee.email, password: invitee.password,
          secret: process.env.FUNDLOOP_E2E_SECRET ?? "" })
        const inviteePage = await inviteeContext.newPage()
        const inviteeErrors: string[] = []
        inviteePage.on("console", (message) => { if (message.type() === "error") inviteeErrors.push("console-error") })
        inviteePage.on("pageerror", () => inviteeErrors.push("page-error"))
        await inviteePage.goto(invitationLink)
        await expect(inviteePage.getByText("DRAFT - NOT APPROVED - NOT EFFECTIVE")).toBeVisible()
        await expect(inviteePage.getByText("Pending access remains private.")).toBeVisible()
        const acknowledgement = inviteePage.getByRole("checkbox")
        const acceptButton = inviteePage.getByRole("button", { name: "Acknowledge and accept" })
        await expect(acknowledgement).not.toBeChecked()
        await expect(acceptButton).toBeDisabled()
        await inviteePage.setViewportSize({ width: 1440, height: 900 })
        await captureInvitationReview(inviteePage, `${personaId}-invitation-review-desktop.png`, inviteeErrors)
        await inviteePage.setViewportSize({ width: 390, height: 844 })
        await captureInvitationReview(inviteePage, `${personaId}-invitation-review-mobile.png`, inviteeErrors)
        await inviteePage.setViewportSize({ width: 1440, height: 900 })
        await acknowledgement.check()
        const acceptResponsePromise = inviteePage.waitForResponse((response) =>
          response.url().endsWith("/functions/v1/project-invitation-accept") && response.request().method() === "POST",
        )
        await acceptButton.click()
        const acceptResponse = await acceptResponsePromise
        const acceptBody = await acceptResponse.json() as { ok?: boolean; error?: { code?: string } }
        if (acceptBody.ok !== true) {
          throw new Error(boundedPersonaFailureReason("persona-invitation-accept", acceptBody.error?.code?.replaceAll("_", "-"), "command-failed"))
        }
        await expect(inviteePage.getByTestId("project-invitation-accepted")).toContainText(`You joined ${project.name}.`)
          .catch(() => { throw new Error("persona-invitation-acceptance-ui-failed") })
        const participant = await supabase.from("participants").select("id, is_admin")
          .eq("project_id", project.id).eq("user_id", invitee.actor.authUserId).single()
        if (participant.error || !participant.data || participant.data.is_admin) throw new Error("persona-project-participant-acceptance-failed")
        await fixtures.recordDatabaseRow({ table: "participants", primaryKey: { id: participant.data.id }, cleanupPhase: 120 })
        const membership = await supabase.from("organization_members").select("id, role_id")
          .eq("organization_id", invitation.data.organization_id).eq("user_id", invitee.actor.authUserId).single()
        if (membership.error || !membership.data) throw new Error("persona-organization-membership-acceptance-failed")
        await fixtures.recordDatabaseRow({ table: "organization_members", primaryKey: { id: membership.data.id }, cleanupPhase: 110 })
        await capturePageSuccess(inviteePage, `${personaId}-invitation-success.png`, inviteeErrors)
        await inviteePage.getByRole("button", { name: "View project" }).click()
        await expect(inviteePage).toHaveURL(new RegExp(`/en/projects/${project.slug}$`))
        await expect(inviteePage.getByRole("heading", { name: "Returning Member" })).toBeVisible()
      } finally {
        await inviteeContext.close()
      }
      const revokeResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith("/functions/v1/project-invitation-revoke") && response.request().method() === "POST",
      )
      await page.getByRole("button", { name: "Revoke" }).click()
      const revokeResponse = await revokeResponsePromise
      const revokeBody = await revokeResponse.json() as { ok?: boolean; error?: { code?: string } }
      if (revokeBody.ok !== true) throw new Error(boundedPersonaFailureReason("persona-invitation-revoke", revokeBody.error?.code, "command-failed"))
      await expect(page.getByText("revoked", { exact: true }).first()).toBeVisible()
      const [participantResidue, membershipResidue, invitationResidue] = await Promise.all([
        supabase.from("participants").select("id").eq("project_id", project.id).eq("user_id", invitee.actor.authUserId).maybeSingle(),
        supabase.from("organization_members").select("id").eq("organization_id", invitation.data.organization_id).eq("user_id", invitee.actor.authUserId).maybeSingle(),
        supabase.from("project_invitations").select("status, accepted_by_user_id").eq("id", invitation.data.id).single(),
      ])
      if (participantResidue.data || membershipResidue.data || invitationResidue.error ||
        invitationResidue.data.status !== "revoked" || invitationResidue.data.accepted_by_user_id !== null) {
        throw new Error("persona-invitation-revoke-residue")
      }
      return observed({ invitation: "accepted-then-revoked", participant: "removed", membership: "removed", capture: `${personaId}-invitation` })
    },
    "founder.submit-monthly-contribution": async () => {
      browserErrors.length = 0
      return submitContribution(page, supabase, fixtures, env.baseURL, await ensureProject(), await ensureCycle(), commandErrors)
    },
    "founder.submit-next-month-contribution": async () => {
      browserErrors.length = 0
      if (state.stored) await loginThroughE2EEndpoint(page.context(), { baseURL: env.baseURL, email: state.stored.email,
        password: state.stored.password, secret: process.env.FUNDLOOP_E2E_SECRET ?? "" })
      return submitContribution(page, supabase, fixtures, env.baseURL, await ensureProject(), await ensureCycle(), commandErrors)
    },
    "founder.submit-active-user-attribution": async () => submitAttribution(page, supabase, fixtures, env.baseURL, await ensureProject(), await ensureCycle(), await ensureAttributionUser(), captureSuccess, personaId, commandErrors),
    "founder.submit-next-month-attribution": async () => {
      if (state.stored) await loginThroughE2EEndpoint(page.context(), { baseURL: env.baseURL, email: state.stored.email,
        password: state.stored.password, secret: process.env.FUNDLOOP_E2E_SECRET ?? "" })
      return submitAttribution(page, supabase, fixtures, env.baseURL, await ensureProject(), await ensureCycle(), await ensureAttributionUser(), captureSuccess, personaId, commandErrors)
    },
    "cadence.await-operator-distribution": async () => pending("founder-distribution-after-operator-cadence"),
  }

  return {
    actions,
    fixtures,
    outputRoot: process.env.PLAYWRIGHT_PERSONA_OUTPUT_ROOT ?? path.join(process.cwd(), "output", "persona-harness"),
    runId,
  }
}

async function submitContribution(page: Page, supabase: SupabaseClient<Database>, fixtures: MutableFixtureController, baseURL: string, project: PersonaProjectFixture, cycleId: number, commandErrors: ReadonlyMap<string, string>) {
  const cycle = await supabase.from("monthly_cycles").select("cycle_key").eq("id", cycleId).single()
  if (cycle.error || !cycle.data) throw new Error("persona-contribution-cycle-resolution-failed")
  await page.goto(`${baseURL}/en/founder/projects/${project.slug}/contributions`)
  await page.locator("#monthly-cycle").selectOption(cycle.data.cycle_key)
  await page.getByLabel(/Source amount/i).fill("1000")
  await page.getByLabel(/USD equivalent/i).fill("1000")
  await page.getByRole("button", { name: "Submit contribution data" }).click()
  const failure = page.getByText("Contribution submission failed", { exact: true })
  await expect.poll(async () => {
    if (await failure.isVisible()) throw new Error("persona-contribution-command-failed")
    const result = await supabase.from("project_monthly_contribution_submissions").select("id").eq("project_id", project.id).eq("monthly_cycle_id", cycleId).maybeSingle()
    return result.error ? null : result.data?.id ?? null
  }, { timeout: 30_000, message: "cycle-scoped contribution persistence" }).not.toBeNull().catch(() => {
    const code = commandErrors.get("project-monthly-contribution-submit")
    throw new Error(code ? `persona-contribution-${code}` : "persona-contribution-not-persisted")
  })
  const submission = await supabase.from("project_monthly_contribution_submissions").select("id").eq("project_id", project.id).eq("monthly_cycle_id", cycleId).single()
  if (submission.error || !submission.data) throw new Error("persona-contribution-resolution-failed")
  await expect(page.getByText(new RegExp(`^${cycle.data.cycle_key}:`)).first()).toBeVisible({ timeout: 20_000 })
  await fixtures.recordDatabaseRow({ table: "project_monthly_contribution_submissions", primaryKey: { id: submission.data.id }, cleanupPhase: 100 })
  return observed({ contribution: "submitted" })
}

async function submitAttribution(page: Page, supabase: SupabaseClient<Database>, fixtures: MutableFixtureController, baseURL: string, project: PersonaProjectFixture, cycleId: number, attributionUser: PersonaAttributionUserFixture, captureSuccess: () => Promise<void>, personaId: Exclude<PersonaId, "returning-operator">, commandErrors: ReadonlyMap<string, string>) {
  const cycle = await supabase.from("monthly_cycles").select("cycle_key").eq("id", cycleId).single()
  if (cycle.error || !cycle.data) throw new Error("persona-attribution-cycle-resolution-failed")
  await page.goto(`${baseURL}/en/founder/projects/${project.slug}/attribution`)
  await page.locator("#attribution-cycle").selectOption(cycle.data.cycle_key)
  await page.getByLabel(/Scoped CUBID/i).fill(attributionUser.scopedCubidId)
  await page.getByLabel(/Attribution points/i).fill("10")
  await page.getByRole("button", { name: "Submit attribution data" }).click()
  const failure = page.getByText("Attribution submission failed", { exact: true })
  await expect.poll(async () => {
    if (await failure.isVisible()) throw new Error("persona-attribution-command-failed")
    const result = await supabase.from("project_attribution_datasets").select("id").eq("project_id", project.id).eq("monthly_cycle_id", cycleId).maybeSingle()
    return result.error ? null : result.data?.id ?? null
  }, { timeout: 30_000, message: "cycle-scoped attribution persistence" }).not.toBeNull().catch(() => {
    const code = commandErrors.get("project-attribution-dataset-submit")
    throw new Error(boundedPersonaFailureReason("persona-attribution", code, "not-persisted"))
  })
  const dataset = await supabase.from("project_attribution_datasets").select("id").eq("project_id", project.id).eq("monthly_cycle_id", cycleId).single()
  if (dataset.error || !dataset.data) throw new Error("persona-attribution-resolution-failed")
  await expect.poll(async () => {
    const rows = await supabase.from("project_attribution_rows").select("id, scoped_cubid_id, user_id").eq("dataset_id", dataset.data.id)
    return rows.error ? 0 : rows.data?.length ?? 0
  }, { timeout: 10_000, message: "attribution row visibility" }).toBe(1).catch(() => {
    throw new Error("persona-attribution-rows-resolution-failed")
  })
  const resolvedRows = await supabase.from("project_attribution_rows").select("id, scoped_cubid_id, user_id").eq("dataset_id", dataset.data.id)
  const row = resolvedRows.data?.[0]
  if (resolvedRows.error || resolvedRows.data?.length !== 1 || !row) throw new Error("persona-attribution-rows-resolution-failed")
  if (row.scoped_cubid_id !== attributionUser.scopedCubidId || row.user_id !== attributionUser.userId) {
    throw new Error("persona-attribution-row-identity-mismatch")
  }
  await fixtures.recordDatabaseRow({ table: "project_attribution_rows", primaryKey: { id: row.id }, cleanupPhase: 110 })
  await fixtures.recordDatabaseRow({ table: "project_attribution_datasets", primaryKey: { id: dataset.data.id }, cleanupPhase: 100 })
  await expect(page.getByText(new RegExp(`^${cycle.data.cycle_key}:`)).first()).toBeVisible({ timeout: 20_000 })
  await page.getByLabel(/Scoped CUBID/i).fill("")
  await captureSuccess()
  return observed({ attribution: "submitted", users: 1, capture: personaId })
}
