import "server-only"

import type { NavigationContext } from "@/lib/navigation-context"

export type PublicUserCtaState = "signed_out" | "continue_onboarding" | "workspace"

export function getPublicUserCtaState(navigationContext: NavigationContext): PublicUserCtaState {
  if (!navigationContext.isAuthenticated) {
    return "signed_out"
  }

  if (navigationContext.user?.status === "active") {
    return "workspace"
  }

  return "continue_onboarding"
}

export function getPublicUserPrimaryHref(navigationContext: NavigationContext) {
  const state = getPublicUserCtaState(navigationContext)

  if (state === "workspace") {
    return "/workspace"
  }

  return "/?onboarding=user"
}
