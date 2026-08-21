import { describe, expect, it } from "vitest"
import {
  validateProjectOnboardingDraftUpsertInput,
  isProjectOnboardingDraftUpsertOutput,
} from "@/lib/edge-functions/project-onboarding-draft-upsert-contract"
import { validateProjectOnboardingPublishInput, isProjectOnboardingPublishOutput } from "@/lib/edge-functions/project-onboarding-publish-contract"
import {
  validateUserOnboardingDraftUpsertInput,
  isUserOnboardingDraftUpsertOutput,
} from "@/lib/edge-functions/user-onboarding-draft-upsert-contract"
import { validateUserOnboardingPublishInput, isUserOnboardingPublishOutput } from "@/lib/edge-functions/user-onboarding-publish-contract"
import {
  isUserCubidResolveEmailOutput,
  validateUserCubidResolveEmailInput,
} from "@/lib/edge-functions/user-cubid-resolve-email-contract"
import {
  isUserCubidSyncProfileOutput,
  validateUserCubidSyncProfileInput,
} from "@/lib/edge-functions/user-cubid-sync-profile-contract"

describe("onboarding edge function contracts", () => {
  it("accepts and sanitizes a valid user draft payload", () => {
    const result = validateUserOnboardingDraftUpsertInput({
      currentScreen: "extended_identity",
      payload: {
        fullName: "Maya Torres",
        profileHeadline: "Community builder",
        displayName: "Maya",
        avatarUrl: "https://example.com/maya.png",
        bio: "hello",
        occupationId: "1",
        locationId: "2",
        genderId: "3",
        interestIds: ["4"],
        inviteCode: "INVITE",
        privacyPreset: "public",
        visibility: { isPublic: true },
        relationshipChoice: "create_project",
        selectedProjectId: 12,
      },
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        currentScreen: "extended_identity",
        payload: expect.objectContaining({
          fullName: "Maya Torres",
          relationshipChoice: "create_project",
          interestIds: ["4"],
          selectedProjectId: 12,
          privacyPreset: "private",
          visibility: expect.objectContaining({
            isPublic: false,
            isNamePublic: false,
            isPfpPublic: false,
            isOccupationPublic: false,
            isLocationPublic: false,
          }),
        }),
      }),
    })
  })

  it("rejects invalid user onboarding screens", () => {
    const result = validateUserOnboardingDraftUpsertInput({
      currentScreen: "oops",
      payload: {},
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_payload",
        message: "currentScreen must be a valid user onboarding screen.",
      },
    })
  })

  it("accepts and sanitizes a valid project draft payload", () => {
    const result = validateProjectOnboardingDraftUpsertInput({
      currentScreen: "basics",
      payload: {
        name: "Civic Mesh",
        slug: "civic-mesh",
        categoryIds: ["2", "4"],
        cryptoPaymentMethods: [{ id: "1", chainId: "10", chainAssetId: "11", intakeContractId: "12", label: "Base USDC" }],
      },
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        currentScreen: "basics",
        payload: expect.objectContaining({
          name: "Civic Mesh",
          slug: "civic-mesh",
          categoryIds: ["2", "4"],
          cryptoPaymentMethods: [
            expect.objectContaining({
              chainId: "10",
              chainAssetId: "11",
              intakeContractId: "12",
            }),
          ],
        }),
      }),
    })
  })

  it("rejects invalid project onboarding screens", () => {
    const result = validateProjectOnboardingDraftUpsertInput({
      currentScreen: "welcome",
      payload: {},
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_payload",
        message: "currentScreen must be a valid project onboarding screen.",
      },
    })
  })

  it("validates publish outputs for both onboarding flows", () => {
    expect(isUserOnboardingPublishOutput({ nextFlow: "project", relationshipChoice: "create_project" })).toBe(true)
    expect(isProjectOnboardingPublishOutput({ projectSlug: "civic-mesh" })).toBe(true)
    expect(isUserOnboardingDraftUpsertOutput({
      id: 1,
      user_id: "user-1",
      current_screen: "identity",
      payload: {},
      started_at: "2026-04-15T00:00:00.000Z",
      updated_at: "2026-04-15T00:00:00.000Z",
      completed_at: null,
    })).toBe(true)
    expect(isProjectOnboardingDraftUpsertOutput({
      id: 2,
      user_id: "user-1",
      current_screen: "basics",
      payload: {},
      started_at: "2026-04-15T00:00:00.000Z",
      updated_at: "2026-04-15T00:00:00.000Z",
      completed_at: null,
    })).toBe(true)
  })

  it("accepts optional publish inputs and normalizes attempt ids", () => {
    expect(validateUserOnboardingPublishInput({ attemptId: " user-attempt " })).toEqual({
      ok: true,
      data: { attemptId: "user-attempt" },
    })
    expect(validateProjectOnboardingPublishInput(undefined)).toEqual({
      ok: true,
      data: {},
    })
  })

  it("validates the user CUBID resolve contract", () => {
    expect(validateUserCubidResolveEmailInput({ emailOverride: " Maya@example.com " })).toEqual({
      ok: true,
      data: { emailOverride: "maya@example.com" },
    })
    expect(
      isUserCubidResolveEmailOutput({
        cubidId: "cubid-user-1",
        primaryEmailIdentity: "auth-identity-1",
        cubidScore: 91,
        cubidIdentityStatus: "verified",
      }),
    ).toBe(true)
  })

  it("validates the user CUBID sync contract", () => {
    expect(validateUserCubidSyncProfileInput({ emailOverride: " Maya@example.com " })).toEqual({
      ok: true,
      data: { emailOverride: "maya@example.com" },
    })
    expect(
      isUserCubidSyncProfileOutput({
        cubidId: "cubid-user-1",
        primaryEmailIdentity: "auth-identity-1",
        cubidScore: 91,
        cubidIdentityStatus: "verified",
        cubidSnapshot: {
          primaryName: "Maya Torres",
          primaryEmail: "maya@example.com",
          primaryPhone: "+15555550123",
          cubidScore: 91,
          availableStampTypes: ["email", "phone"],
          verifiedStampTypes: ["email", "phone"],
          lastSyncedAt: "2026-04-15T12:00:00.000Z",
          lastSyncErrorCode: null,
          lastSyncErrorMessage: null,
        },
        missingRecommendedStamps: ["github"],
      }),
    ).toBe(true)
  })
})
