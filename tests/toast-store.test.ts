import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// One toast store, and a renderer mounted for it.
//
// `components/ui/use-toast.ts` and `hooks/use-toast.ts` were byte-identical copies of the same
// reducer, so they were two separate in-memory stores. 27 components dispatched into the first and
// 11 into the second, and `components/ui/toaster.tsx` — the only renderer — subscribes to the
// second and was mounted nowhere. Every toast in the application was therefore discarded.

const uiModule = readFileSync("components/ui/use-toast.ts", "utf8")
const hooksModule = readFileSync("hooks/use-toast.ts", "utf8")
const toaster = readFileSync("components/ui/toaster.tsx", "utf8")
const layout = readFileSync("app/[locale]/layout.tsx", "utf8")

describe("the toast store", () => {
  it("has one implementation, not two", () => {
    // The duplicate is a re-export now. Two copies of a reducer are two stores, and nothing makes
    // them agree.
    expect(uiModule).toContain('export { reducer, toast, useToast } from "@/hooks/use-toast"')
    expect(uiModule).not.toContain("const reducer")
    expect(uiModule.split("\n").length).toBeLessThan(hooksModule.split("\n").length / 4)
  })

  it("keeps both import paths working, so no call site had to change", () => {
    for (const name of ["toast", "useToast", "reducer"]) {
      expect(uiModule).toContain(name)
    }
  })

  it("renders from the store both paths now reach", () => {
    expect(toaster).toContain('from "@/hooks/use-toast"')
  })
})

describe("the renderer", () => {
  it("is mounted, so a dispatched toast reaches a person", () => {
    expect(layout).toContain('import { Toaster } from "@/components/ui/toaster"')
    expect(layout).toContain("<Toaster />")
  })

  it("is inside the providers, where the rest of the tree lives", () => {
    const at = layout.indexOf("<Toaster />")
    const children = layout.indexOf("{children}")
    expect(at).toBeGreaterThan(children)
    expect(layout.indexOf("</ThemeProvider>")).toBeGreaterThan(at)
  })
})
