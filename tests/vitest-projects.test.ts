import { readFileSync, readdirSync } from "node:fs"
import ts from "typescript"
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

const DOM_GLOBALS = new Set(["document", "window", "localStorage", "sessionStorage", "matchMedia", "navigator"])
const DOM_LIBRARIES = /@testing-library|^jsdom$|\/jsdom/

// Parsed, not grepped.
//
// The first version of this guard matched source text, and every round of review found another hole:
// a comment saying "the replay window.", a local binding called `document`, a string containing
// "//", a template literal hiding `${document.title}`, a dynamic `await import("jsdom")`. Each was
// patchable with a cleverer regex and the next one would not have been. The compiler already knows
// what is an identifier, what is a comment, what is a string and what is an import, so this asks it.
//
// There are deliberately no shadowing exemptions. A suite that names a local binding `document` is
// flagged, and the remedy is to rename it — which is better code regardless, and is exactly what
// #273 did when this guard caught it there. Exempting shadowed names is what let a real
// `document.querySelector` hide behind an unrelated parameter of the same name.
function domDependencies(source: string): string[] {
  const file = ts.createSourceFile("suite.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found = new Set<string>()

  const moduleSpecifier = (node: ts.Node): string | null => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      return node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(callee) && callee.text === "require"
      const first = node.arguments[0]
      if ((isDynamicImport || isRequire) && first && ts.isStringLiteral(first)) return first.text
    }
    return null
  }

  const visit = (node: ts.Node) => {
    const specifier = moduleSpecifier(node)
    if (specifier && DOM_LIBRARIES.test(specifier)) found.add("testing-library/jsdom")

    if (ts.isIdentifier(node) && DOM_GLOBALS.has(node.text)) {
      const parent = node.parent
      // `foo.document` is a property, not the global; `{ document: 1 }` is a key.
      const isPropertyName = (ts.isPropertyAccessExpression(parent) && parent.name === node)
        || (ts.isPropertyAssignment(parent) && parent.name === node)
        || (ts.isPropertySignature(parent) && parent.name === node)
        || ts.isQualifiedName(parent)
      if (!isPropertyName) found.add(node.text)
    }

    ts.forEachChild(node, visit)
  }

  ts.forEachChild(file, visit)
  return [...found]
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

  it("reads code, not text", () => {
    // Each of these fooled a regex-based version of this guard.
    expect(domDependencies('// closing the replay window.\nconst x = 1\n')).toEqual([])
    expect(domDependencies('const message = "see window.location for details"\n')).toEqual([])
    expect(domDependencies('const re = /[//]/\nconst y = 2\n')).toEqual([])
    expect(domDependencies("// we deliberately avoid @testing-library here\nconst x = 1\n")).toEqual([])
    expect(domDependencies("const parsed = parse(body)\nexpect(parsed.document.issuer).toBe(1)\n")).toEqual([])

    // And each of these is real, including the forms that slipped past it.
    expect(domDependencies("const node = document.querySelector('a')\n")).toEqual(["document"])
    expect(domDependencies("const title = `page: ${document.title}`\n")).toEqual(["document"])
    expect(domDependencies('await import("jsdom")\n')).toEqual(["testing-library/jsdom"])
    expect(domDependencies('import "@testing-library/jest-dom"\n')).toEqual(["testing-library/jsdom"])
    expect(domDependencies('import {\n  render,\n} from "@testing-library/react"\n')).toEqual(["testing-library/jsdom"])
    expect(domDependencies('const { JSDOM } = require("jsdom")\n')).toEqual(["testing-library/jsdom"])
  })

  it("flags a shadowed DOM name rather than exempting the file", () => {
    // No shadowing exemptions: a file-wide exemption is how a real document.querySelector hid
    // behind an unrelated parameter of the same name. The remedy is to rename the binding.
    expect(domDependencies("function f(document: string) { return document.length }\n")).toEqual(["document"])
    expect(domDependencies("const document = parse(body)\nexpect(document.issuer).toBe(1)\n")).toEqual(["document"])
    expect(domDependencies("function f(document: string) {}\nconst node = document.querySelector('a')\n")).toEqual(["document"])
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
