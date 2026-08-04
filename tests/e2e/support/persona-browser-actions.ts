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
import {
  arrangeFounderProject,
  arrangeMemberEarnings,
  arrangeOpenCycle,
  arrangeReviewReadyProfile,
  arrangeReviewReadyProjectDraft,
  createPersonaFixtureController,
  createPersonaServiceClient,
  createRunIdentity,
  createRunInvitation,
  createStoredActorWithProfile,
  resolveLocalAuthUserId,
  resolvePublishedProject,
  type MutableFixtureController,
  type PersonaProjectFixture,
  type StoredActorCredentials,
} from "./persona-fixtures"

const observed = (evidence: CheckpointObservation["evidence"] = {}): CheckpointObservation => ({ outcome: "observed", evidence })
const pending = (capabilityId: keyof typeof CAPABILITY_REGISTRY): CheckpointObservation => ({
  outcome: "capability-unavailable",
  evidence: { declared: true },
  reasonCode: CAPABILITY_REGISTRY[capabilityId].reasonCode,
})

export function createPersonaBrowserActions(personaId: Exclude<PersonaId, "returning-operator">, page: Page) {
  const env = readLocalPersonaEnv()
  const runId = process.env.PLAYWRIGHT_PERSONA_RUN_ID
  if (!runId) throw new Error("persona-run-id-missing")
  const run = createRunIdentity([personaId])
  Object.assign(run, { runId, startedAt: process.env.PLAYWRIGHT_PERSONA_STARTED_AT ?? run.startedAt })
  const supabase = createPersonaServiceClient(env) as SupabaseClient<Database>
  const fixtures = createPersonaFixtureController({ run, supabase, outputRoot: process.env.PLAYWRIGHT_PERSONA_OUTPUT_ROOT })
  const state: {
    email?: string
    requestedAt?: Date
    inviteCode?: string
    actorId?: string
    stored?: StoredActorCredentials
    project?: PersonaProjectFixture
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
        cycleKey: env.cycleBase,
        createdByUserId: state.actorId,
      })
      state.cycleId = cycle.id
    }
    if (!state.cycleId) throw new Error("persona-cycle-not-established")
    return state.cycleId
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
      return observed({ session: "authenticated" })
    },
    "member.publish-profile": async () => {
      if (!state.actorId || !state.email || !state.inviteCode) throw new Error("persona-new-member-state-missing")
      await arrangeReviewReadyProfile(supabase, fixtures, { authUserId: state.actorId, email: state.email, inviteCode: state.inviteCode, relationshipChoice: "individual" })
      await page.reload()
      const continueDraft = page.getByRole("button", { name: "Continue draft" })
      if (await continueDraft.isVisible()) await continueDraft.click()
      await page.getByRole("button", { name: "Publish profile" }).click()
      await expect(page.getByText("Profile published")).toBeVisible()
      return observed({ profile: "published" })
    },
    "founder.publish-personal-profile": async () => {
      if (!state.actorId || !state.email || !state.inviteCode) throw new Error("persona-new-founder-state-missing")
      await arrangeReviewReadyProfile(supabase, fixtures, { authUserId: state.actorId, email: state.email, inviteCode: state.inviteCode, relationshipChoice: "create_project" })
      await page.reload()
      const continueDraft = page.getByRole("button", { name: "Continue draft" })
      if (await continueDraft.isVisible()) await continueDraft.click()
      await page.getByRole("button", { name: "Publish profile" }).click()
      await expect(page.getByText("Profile published")).toBeVisible()
      return observed({ profile: "published" })
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
      const project = await ensureProject()
      const cycleId = await ensureCycle()
      await arrangeMemberEarnings(supabase, fixtures, { actorUserId: state.actorId, projectId: project.id, cycleId, cycleKey: env.cycleBase })
      await page.goto(`${env.baseURL}/en/workspace/earnings`)
      await expect(page.getByText("$125").first()).toBeVisible()
      return observed({ credited: 125 })
    },
    "member.view-project-sources": async () => {
      await expect(page.getByText(/1 project/i).first()).toBeVisible()
      await expect(page.getByText(/not paid|not paid yet/i).first()).toBeVisible()
      return observed({ projects: 1, payment: "not-paid" })
    },
    "member.withdraw-earnings": async () => pending("member-withdrawal"),
    "founder.publish-project-profile": async () => {
      if (!state.actorId) throw new Error("persona-founder-actor-missing")
      const draft = await arrangeReviewReadyProjectDraft(supabase, fixtures, state.actorId)
      await page.goto(`${env.baseURL}/en?onboarding=project`)
      const continueDraft = page.getByRole("button", { name: "Continue draft" })
      if (await continueDraft.isVisible()) await continueDraft.click()
      await page.getByRole("button", { name: "Publish project" }).click()
      await expect(page.getByText("Project published")).toBeVisible()
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
    "founder.create-project-invitation": async () => pending("project-invitation-persistence"),
    "founder.submit-monthly-contribution": async () => submitContribution(page, supabase, fixtures, env.baseURL, await ensureProject(), await ensureCycle()),
    "founder.submit-next-month-contribution": async () => submitContribution(page, supabase, fixtures, env.baseURL, await ensureProject(), await ensureCycle()),
    "founder.submit-active-user-attribution": async () => submitAttribution(page, supabase, fixtures, env.baseURL, await ensureProject(), await ensureCycle()),
    "founder.submit-next-month-attribution": async () => submitAttribution(page, supabase, fixtures, env.baseURL, await ensureProject(), await ensureCycle()),
    "cadence.await-operator-distribution": async () => pending("founder-distribution-after-operator-cadence"),
  }

  return {
    actions,
    fixtures,
    outputRoot: process.env.PLAYWRIGHT_PERSONA_OUTPUT_ROOT ?? path.join(process.cwd(), "output", "persona-harness"),
    runId,
  }
}

async function submitContribution(page: Page, supabase: SupabaseClient<Database>, fixtures: MutableFixtureController, baseURL: string, project: PersonaProjectFixture, cycleId: number) {
  await page.goto(`${baseURL}/en/founder/projects/${project.slug}/contributions`)
  await page.getByLabel(/Source amount/i).fill("1000")
  await page.getByLabel(/USD equivalent/i).fill("1000")
  await page.getByRole("button", { name: /Submit contribution/i }).click()
  await expect(page.getByText(/submitted|current submission/i).first()).toBeVisible()
  const submission = await supabase.from("project_monthly_contribution_submissions").select("id").eq("project_id", project.id).eq("monthly_cycle_id", cycleId).single()
  if (submission.error || !submission.data) throw new Error("persona-contribution-resolution-failed")
  await fixtures.recordDatabaseRow({ table: "project_monthly_contribution_submissions", primaryKey: { id: submission.data.id }, cleanupPhase: 100 })
  return observed({ contribution: "submitted" })
}

async function submitAttribution(page: Page, supabase: SupabaseClient<Database>, fixtures: MutableFixtureController, baseURL: string, project: PersonaProjectFixture, cycleId: number) {
  await page.goto(`${baseURL}/en/founder/projects/${project.slug}/attribution`)
  await page.getByLabel(/Scoped CUBID/i).fill("persona-scoped-active-user")
  await page.getByLabel(/Attribution points/i).fill("10")
  await page.getByRole("button", { name: /Submit/i }).last().click()
  await expect(page.getByText(/submitted|current dataset/i).first()).toBeVisible()
  const dataset = await supabase.from("project_attribution_datasets").select("id").eq("project_id", project.id).eq("monthly_cycle_id", cycleId).single()
  if (dataset.error || !dataset.data) throw new Error("persona-attribution-resolution-failed")
  const rows = await supabase.from("project_attribution_rows").select("id").eq("dataset_id", dataset.data.id)
  if (rows.error) throw new Error("persona-attribution-rows-resolution-failed")
  for (const row of rows.data ?? []) await fixtures.recordDatabaseRow({ table: "project_attribution_rows", primaryKey: { id: row.id }, cleanupPhase: 110 })
  await fixtures.recordDatabaseRow({ table: "project_attribution_datasets", primaryKey: { id: dataset.data.id }, cleanupPhase: 100 })
  return observed({ attribution: "submitted", users: 1 })
}
