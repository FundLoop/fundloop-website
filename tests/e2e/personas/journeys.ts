import type { ActorAlias, CheckpointObservation, PersonaCheckpoint, PersonaJourney } from "./contracts"

export type PersonaJourneyActions = Readonly<Record<string, () => Promise<CheckpointObservation>>>

type CheckpointDefinition = {
  id: string
  title: string
  actorAlias: ActorAlias
  surface: PersonaCheckpoint["surface"]
  capabilityId: string
  mode?: PersonaCheckpoint["mode"]
}

function buildJourney(
  input: Omit<PersonaJourney, "checkpoints"> & { checkpoints: readonly CheckpointDefinition[] },
  actions: PersonaJourneyActions,
): PersonaJourney {
  return {
    id: input.id,
    title: input.title,
    actorKind: input.actorKind,
    checkpoints: input.checkpoints.map((checkpoint) => {
      const execute = actions[checkpoint.id]
      if (!execute) throw new Error(`persona-action-missing:${checkpoint.id}`)
      return {
        ...checkpoint,
        mode: checkpoint.mode ?? "required",
        execute,
      } as PersonaCheckpoint
    }),
  }
}

const memberWithdrawal = (actorAlias: "new-member" | "returning-member"): CheckpointDefinition => ({
  id: "member.withdraw-earnings",
  title: "Reach the withdrawal checkpoint",
  actorAlias,
  surface: "browser",
  capabilityId: "member-withdrawal",
})

const founderInvitation = (actorAlias: "new-founder" | "returning-founder"): CheckpointDefinition => ({
  id: "founder.create-project-invitation",
  title: "Reach the persisted project invitation checkpoint",
  actorAlias,
  surface: "browser",
  capabilityId: "project-invitation-persistence",
})

const founderCadenceHandoff = (actorAlias: "new-founder" | "returning-founder"): CheckpointDefinition => ({
  id: "cadence.await-operator-distribution",
  title: "Hand the prepared cycle to the operator cadence",
  actorAlias,
  surface: "fixture-observation",
  mode: "expected-pending",
  capabilityId: "founder-distribution-after-operator-cadence",
})

export function newMemberJourney(actions: PersonaJourneyActions): PersonaJourney {
  return buildJourney({
    id: "new-member",
    title: "New member",
    actorKind: "new",
    checkpoints: [
      { id: "auth.request-local-otp", title: "Request local OTP from the public invitation flow", actorAlias: "new-member", surface: "browser", capabilityId: "public-local-otp" },
      { id: "auth.verify-local-otp", title: "Verify the Mailpit OTP in the browser", actorAlias: "new-member", surface: "browser", capabilityId: "public-local-otp" },
      { id: "member.publish-profile", title: "Publish a personal profile", actorAlias: "new-member", surface: "browser", capabilityId: "personal-profile" },
      { id: "member.view-earnings-total", title: "View accumulated credited earnings", actorAlias: "new-member", surface: "browser", capabilityId: "member-earnings" },
      { id: "member.view-project-sources", title: "View project earnings sources", actorAlias: "new-member", surface: "browser", capabilityId: "member-earnings-sources" },
      memberWithdrawal("new-member"),
    ],
  }, actions)
}

export function returningMemberJourney(actions: PersonaJourneyActions): PersonaJourney {
  return buildJourney({
    id: "returning-member",
    title: "Returning member",
    actorKind: "returning",
    checkpoints: [
      { id: "auth.login-returning-member", title: "Log in through the local internal E2E seam", actorAlias: "returning-member", surface: "browser", capabilityId: "local-e2e-login" },
      { id: "member.view-existing-profile", title: "View the existing published profile", actorAlias: "returning-member", surface: "browser", capabilityId: "personal-profile" },
      { id: "member.view-earnings-total", title: "View accumulated credited earnings", actorAlias: "returning-member", surface: "browser", capabilityId: "member-earnings" },
      { id: "member.view-project-sources", title: "View project earnings sources", actorAlias: "returning-member", surface: "browser", capabilityId: "member-earnings-sources" },
      memberWithdrawal("returning-member"),
    ],
  }, actions)
}

export function newFounderJourney(actions: PersonaJourneyActions): PersonaJourney {
  return buildJourney({
    id: "new-founder",
    title: "New founder",
    actorKind: "new",
    checkpoints: [
      { id: "auth.request-local-otp", title: "Request local OTP from the public invitation flow", actorAlias: "new-founder", surface: "browser", capabilityId: "public-local-otp" },
      { id: "auth.verify-local-otp", title: "Verify the Mailpit OTP in the browser", actorAlias: "new-founder", surface: "browser", capabilityId: "public-local-otp" },
      { id: "founder.publish-personal-profile", title: "Publish a founder personal profile", actorAlias: "new-founder", surface: "browser", capabilityId: "personal-profile" },
      { id: "founder.publish-project-profile", title: "Publish a project profile", actorAlias: "new-founder", surface: "browser", capabilityId: "project-profile" },
      founderInvitation("new-founder"),
      { id: "founder.submit-monthly-contribution", title: "Submit the monthly contribution", actorAlias: "new-founder", surface: "browser", capabilityId: "project-monthly-contribution" },
      { id: "founder.submit-active-user-attribution", title: "Submit active-user attribution", actorAlias: "new-founder", surface: "browser", capabilityId: "project-attribution" },
      founderCadenceHandoff("new-founder"),
    ],
  }, actions)
}

export function returningFounderJourney(actions: PersonaJourneyActions): PersonaJourney {
  return buildJourney({
    id: "returning-founder",
    title: "Returning founder",
    actorKind: "returning",
    checkpoints: [
      { id: "auth.login-returning-founder", title: "Log in through the local internal E2E seam", actorAlias: "returning-founder", surface: "browser", capabilityId: "local-e2e-login" },
      { id: "founder.view-existing-profile-and-project", title: "View the existing profile and managed project", actorAlias: "returning-founder", surface: "browser", capabilityId: "project-profile" },
      founderInvitation("returning-founder"),
      { id: "founder.submit-next-month-contribution", title: "Submit the next monthly contribution", actorAlias: "returning-founder", surface: "browser", capabilityId: "project-monthly-contribution" },
      { id: "founder.submit-next-month-attribution", title: "Submit the next active-user attribution", actorAlias: "returning-founder", surface: "browser", capabilityId: "project-attribution" },
      founderCadenceHandoff("returning-founder"),
    ],
  }, actions)
}

export function returningOperatorJourney(actions: PersonaJourneyActions): PersonaJourney {
  return buildJourney({
    id: "returning-operator",
    title: "Returning operator",
    actorKind: "operator",
    checkpoints: [
      { id: "auth.login-returning-operator", title: "Log in as the deterministic internal operator", actorAlias: "returning-operator", surface: "browser", capabilityId: "local-e2e-login" },
      { id: "operator.view-cycle-readiness", title: "Review cycle preparation and readiness", actorAlias: "returning-operator", surface: "browser", capabilityId: "monthly-cycle-prep" },
      { id: "operator.lock-cycle", title: "Lock the prepared monthly cycle", actorAlias: "returning-operator", surface: "browser", capabilityId: "monthly-cycle-lock" },
      { id: "operator.calculate-cycle", title: "Package and calculate deterministic allocations", actorAlias: "returning-operator", surface: "browser", capabilityId: "monthly-cycle-calculation" },
      { id: "operator.verify-cycle", title: "Verify the run and cycle allocation", actorAlias: "returning-operator", surface: "browser", capabilityId: "monthly-cycle-verification" },
      { id: "operator.approve-cycle", title: "Approve the cycle for bookkeeping credits", actorAlias: "returning-operator", surface: "browser", capabilityId: "monthly-cycle-approval" },
      { id: "operator.create-bookkeeping-credits", title: "Create credited-not-paid bookkeeping earnings", actorAlias: "returning-operator", surface: "controlled-command", capabilityId: "monthly-cycle-bookkeeping-credits" },
      { id: "operator.view-performance", title: "Review cycle audit and performance outcomes", actorAlias: "returning-operator", surface: "browser", capabilityId: "monthly-cycle-observability" },
      { id: "operator.view-allocation-breakdown", title: "Review who earned what and from which project", actorAlias: "returning-operator", surface: "browser", capabilityId: "monthly-cycle-allocation-reporting" },
    ],
  }, actions)
}
