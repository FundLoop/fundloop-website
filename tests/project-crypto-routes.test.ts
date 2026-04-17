import { describe, expect, it } from "vitest"
import {
  getPromotedDefaultRouteId,
  moveProjectCryptoRouteState,
  renumberProjectCryptoRouteStates,
  sortProjectCryptoRouteStates,
  type ProjectCryptoRouteState,
} from "@/lib/project-crypto-routes"

const baseStates: ProjectCryptoRouteState[] = [
  { id: 11, is_enabled: true, is_default: true, sort_order: 1 },
  { id: 12, is_enabled: false, is_default: false, sort_order: 2 },
  { id: 13, is_enabled: true, is_default: false, sort_order: 3 },
  { id: 14, is_enabled: true, is_default: false, sort_order: 4 },
]

describe("project crypto route helpers", () => {
  it("sorts by sort_order and id", () => {
    expect(
      sortProjectCryptoRouteStates([
        { id: 2, is_enabled: true, is_default: false, sort_order: 2 },
        { id: 1, is_enabled: true, is_default: false, sort_order: 2 },
      ]).map((state) => state.id),
    ).toEqual([1, 2])
  })

  it("renumbers route order sequentially", () => {
    expect(
      renumberProjectCryptoRouteStates([
        { id: 14, is_enabled: true, is_default: false, sort_order: 9 },
        { id: 11, is_enabled: true, is_default: true, sort_order: 4 },
      ]).map((state) => ({ id: state.id, sort_order: state.sort_order })),
    ).toEqual([
      { id: 11, sort_order: 1 },
      { id: 14, sort_order: 2 },
    ])
  })

  it("moves an enabled route relative to other enabled routes while preserving disabled positions", () => {
    expect(moveProjectCryptoRouteState(baseStates, 13, "up").map((state) => state.id)).toEqual([13, 12, 11, 14])
  })

  it("does not move past the edge of its enabled group", () => {
    expect(moveProjectCryptoRouteState(baseStates, 11, "up")).toEqual(sortProjectCryptoRouteStates(baseStates))
  })

  it("promotes the next enabled route when disabling the default", () => {
    expect(getPromotedDefaultRouteId(baseStates, 11)).toBe(13)
  })
})
