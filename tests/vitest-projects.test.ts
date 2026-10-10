import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Keeps the two-project split in vitest.config.ts honest.
//
// The node project runs every tests/**/*.test.ts without a DOM. If one of them starts using a
// browser API it would fail with a confusing ReferenceError, so this test names the condition
// instead.
//
// The remedy is always to rename the file to .test.tsx. Adding it to the dom project's include list
// would not remove it from the node project's glob, because the projects select by extension: the
// suite would run in both and fail in one.

const DOM_GLOBALS = ["document", "window", "localStorage", "sessionStorage", "matchMedia", "navigator"] as const

// Comments and string literals are not code. Matching them flagged a suite for the words "replay
// window." in a sentence, which teaches people to reword prose to satisfy a regex.
function stripCommentsAndStrings(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
}

// A local binding that happens to share a global's name is not a DOM dependency. A test that parses
// an OpenAPI document into `const metadata` is fine; one that reads the real `document` is not.
function usesDomGlobal(source: string, name: string) {
  const code = stripCommentsAndStrings(source)
  if (!new RegExp(`\\b${name}\\s*[.[]`).test(code)) return false
  const declared = new RegExp(`\\b(?:const|let|var|function|class)\\s+${name}\\b|\\b${name}\\s*(?::[^,)=]+)?\\s*[,)=]`).test(code)
  return !declared
}

// A module specifier *is* a string literal, so this one looks at the raw source — but only at
// import and require lines, so prose mentioning the library does not count.
const DOM_LIBRARY_IMPORT = /(?:^|\n)\s*(?:import[^\n]*from\s*|(?:const|let|var)[^\n]*=\s*require\s*\()\s*["'][^"']*(?:@testing-library|jsdom)[^"']*["']/

function domDependencies(source: string) {
  const offenders: string[] = DOM_GLOBALS.filter((name) => usesDomGlobal(source, name))
  if (DOM_LIBRARY_IMPORT.test(source)) offenders.push("testing-library/jsdom")
  return offenders
}

describe("vitest project split", () => {
  // This suite names the browser APIs it looks for, so it would always match itself.
  const nodeSuites = readdirSync("tests").filter((entry) => entry.endsWith(".test.ts") && entry !== "vitest-projects.test.ts")

  it("has suites in both projects", () => {
    expect(nodeSuites.length).toBeGreaterThan(100)
    expect(readdirSync("tests").filter((entry) => entry.endsWith(".test.tsx")).length).toBeGreaterThan(10)
  })

  it("keeps the DOM out of the node project", () => {
    const offenders = nodeSuites
      .map((suite) => ({ suite, found: domDependencies(readFileSync(`tests/${suite}`, "utf8")) }))
      .filter((entry) => entry.found.length > 0)
      .map((entry) => `${entry.suite} (${entry.found.join(", ")})`)
    // Rename any suite listed here to .test.tsx so it runs in the dom project. An include-list
    // exception does not work: the projects select by extension, so the file would run in both.
    expect(offenders).toEqual([])
  })

  it("runs this suite in the node environment", () => {
    expect(typeof globalThis.document).toBe("undefined")
  })

  it("does not flag prose, string literals or local bindings", () => {
    // These are the false positives that made the guard fire on #273's OAuth suites.
    expect(domDependencies('// closing the replay window.\nconst x = 1\n')).toEqual([])
    expect(domDependencies('const message = "see window.location for details"\n')).toEqual([])
    expect(domDependencies("const metadata = parse(body)\nexpect(metadata.issuer).toBe(1)\n")).toEqual([])
    expect(domDependencies("function render(document: string) { return document.length }\n")).toEqual([])

    // And still catches the real thing.
    expect(domDependencies("const node = document.querySelector('a')\n")).toEqual(["document"])
    expect(domDependencies("window.matchMedia('(min-width: 1px)')\n")).toContain("window")
    expect(domDependencies('import { render } from "@testing-library/react"\n')).toContain("testing-library/jsdom")
    // Prose that merely names the library is not a dependency on it.
    expect(domDependencies("// we deliberately avoid @testing-library here\nconst x = 1\n")).toEqual([])
  })

  it("keeps the component suites in jsdom", () => {
    const config = readFileSync("vitest.config.ts", "utf8")
    expect(config).toContain("environment: 'jsdom'")
    expect(config).toContain("include: ['tests/**/*.test.tsx']")
    expect(config).toContain("setupFiles: ['./tests/setup.ts']")
  })

  it("selects the two projects by extension alone, with no overlap", () => {
    // Overlapping globs would run a suite in both projects, which is why the DOM rule is a rename
    // rather than an include-list exception.
    const config = readFileSync("vitest.config.ts", "utf8")
    expect(config).toContain("include: ['tests/**/*.test.ts']")
    expect(config).not.toMatch(/include: \['tests\/\*\*\/\*\.test\.ts', *'tests/)
    const documentation = readFileSync("docs/engineering/env-and-testing.md", "utf8")
    expect(documentation).toContain("A suite that needs a DOM is a `.test.tsx` file")
  })
})
