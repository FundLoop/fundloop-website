export type ProjectCryptoRouteState = {
  id: number
  is_enabled: boolean
  is_default: boolean | null
  sort_order: number
}

export type RouteMoveDirection = "up" | "down"

export function sortProjectCryptoRouteStates(states: ProjectCryptoRouteState[]) {
  return [...states].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }

    return left.id - right.id
  })
}

export function renumberProjectCryptoRouteStates(states: ProjectCryptoRouteState[]) {
  return sortProjectCryptoRouteStates(states).map((state, index) => ({
    ...state,
    sort_order: index + 1,
  }))
}

function renumberCurrentProjectCryptoRouteOrder(states: ProjectCryptoRouteState[]) {
  return states.map((state, index) => ({
    ...state,
    sort_order: index + 1,
  }))
}

export function moveProjectCryptoRouteState(
  states: ProjectCryptoRouteState[],
  routeId: number,
  direction: RouteMoveDirection,
) {
  const orderedStates = sortProjectCryptoRouteStates(states)
  const routeIndex = orderedStates.findIndex((state) => state.id === routeId)

  if (routeIndex === -1) {
    return orderedStates
  }

  const targetRoute = orderedStates[routeIndex]
  const peerIndexes = orderedStates
    .map((state, index) => ({ index, isEnabled: state.is_enabled }))
    .filter((entry) => entry.isEnabled === targetRoute.is_enabled)
    .map((entry) => entry.index)

  const peerPosition = peerIndexes.indexOf(routeIndex)
  const swapIndex =
    direction === "up" ? peerIndexes[peerPosition - 1] ?? -1 : peerIndexes[peerPosition + 1] ?? -1

  if (swapIndex < 0) {
    return orderedStates
  }

  const nextStates = [...orderedStates]
  ;[nextStates[routeIndex], nextStates[swapIndex]] = [nextStates[swapIndex], nextStates[routeIndex]]

  return renumberCurrentProjectCryptoRouteOrder(nextStates)
}

export function getPromotedDefaultRouteId(states: ProjectCryptoRouteState[], disabledRouteId: number) {
  return (
    sortProjectCryptoRouteStates(states).find((state) => state.id !== disabledRouteId && state.is_enabled)?.id ?? null
  )
}
