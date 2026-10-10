import { readFileSync } from "node:fs"
import { expect } from "vitest"

// Reading a migration's SQL for assertions, without the two ways those assertions silently stop
// asserting anything.
//
// Both have happened in this repository, one PR apart:
//
//   * an assertion that there is no `SECURITY DEFINER` in a file matched the *comment* saying there
//     is none, so it passed no matter what the SQL did;
//   * a slice anchored on `create or replace function …` came back empty when the statement became
//     `create function …` after a drop, and every `toContain` on the empty string then failed in a
//     way that looked like the SQL had changed rather than the anchor.
//
// So: `statementsOnly` strips the commentary before matching, and `sqlSlice` refuses to hand back
// something too small to be a function body. A guard that cannot fail for the right reason is
// worse than no guard, because it reads as coverage.

/** A migration's text, for assertions that want the comments too (they are part of the record). */
export function readMigration(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * The statements with whole-line comments removed. Use this for every assertion of the form "the
 * SQL does not do X": prose explaining why it does not would otherwise satisfy it.
 */
export function statementsOnly(text: string) {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
}

/**
 * The text between two anchors, asserting it was actually found. `end` may be omitted to slice to
 * the end of the file. The minimum length is deliberately crude: it only has to be large enough
 * that an empty or one-line result fails here, where the message names the anchor, rather than
 * further down where it looks like a change in the SQL.
 */
export function sqlSlice(text: string, start: string, end?: string, { minLength = 120 } = {}) {
  const from = text.indexOf(start)
  expect(from, `SQL slice anchor not found: ${JSON.stringify(start)}`).toBeGreaterThanOrEqual(0)
  const to = end === undefined ? text.length : text.indexOf(end, from + start.length)
  if (end !== undefined) {
    expect(to, `SQL slice end anchor not found after the start: ${JSON.stringify(end)}`).toBeGreaterThan(from)
  }
  const slice = text.slice(from, to)
  expect(
    slice.length,
    `SQL slice from ${JSON.stringify(start)} is only ${slice.length} characters; the anchor is probably stale`,
  ).toBeGreaterThan(minLength)
  return slice
}

/** A function body by name, however it is created: `create function` or `create or replace`. */
export function sqlFunctionBody(text: string, qualifiedName: string, end?: string) {
  const replaced = `create or replace function ${qualifiedName}`
  const created = `create function ${qualifiedName}`
  const start = text.includes(replaced) ? replaced : created
  return sqlSlice(text, start, end)
}

/**
 * Asserts `first` appears before `second`, and that both appear at all.
 *
 * The naive form of this is `expect(text.indexOf(a)).toBeLessThan(text.indexOf(b))`, which passes
 * whenever `a` is absent — `indexOf` returns -1, and -1 is less than everything. An ordering
 * assertion that is satisfied by the absence of the thing being ordered is the third way these
 * tests stop testing anything.
 */
export function expectSqlOrder(text: string, first: string, second: string) {
  const firstAt = text.indexOf(first)
  const secondAt = text.indexOf(second, firstAt < 0 ? 0 : firstAt + first.length)
  expect(firstAt, `not found in the SQL: ${JSON.stringify(first)}`).toBeGreaterThanOrEqual(0)
  expect(secondAt, `not found in the SQL after ${JSON.stringify(first)}: ${JSON.stringify(second)}`).toBeGreaterThan(
    firstAt,
  )
  return { first: firstAt, second: secondAt }
}
