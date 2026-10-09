import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Keeps the two-project split in vitest.config.ts honest.
//
// The node project runs every tests/**/*.test.ts without a DOM. If one of them starts using a
// browser API it would fail with a confusing ReferenceError, so this test names the condition
// instead: a suite that needs a DOM is a .test.tsx file, or it moves to the dom project's include
// list deliberately.

const DOM_APIS = /\b(document|window|localStorage|sessionStorage|matchMedia|navigator)\s*\.|@testing-library|jsdom/

describe("vitest project split", () => {
  // This suite names the browser APIs it looks for, so it would always match itself.
  const nodeSuites = readdirSync("tests").filter((entry) => entry.endsWith(".test.ts") && entry !== "vitest-projects.test.ts")

  it("has suites in both projects", () => {
    expect(nodeSuites.length).toBeGreaterThan(100)
    expect(readdirSync("tests").filter((entry) => entry.endsWith(".test.tsx")).length).toBeGreaterThan(10)
  })

  it("keeps the DOM out of the node project", () => {
    const offenders = nodeSuites.filter((suite) => DOM_APIS.test(readFileSync(`tests/${suite}`, "utf8")))
    // A suite that genuinely needs a DOM belongs in a .test.tsx file, or in the dom project's
    // include list with a comment saying why.
    expect(offenders).toEqual([])
  })

  it("runs this suite in the node environment", () => {
    expect(typeof globalThis.document).toBe("undefined")
  })

  it("keeps the component suites in jsdom", () => {
    const config = readFileSync("vitest.config.ts", "utf8")
    expect(config).toContain("environment: 'jsdom'")
    expect(config).toContain("include: ['tests/**/*.test.tsx']")
    expect(config).toContain("setupFiles: ['./tests/setup.ts']")
  })
})
