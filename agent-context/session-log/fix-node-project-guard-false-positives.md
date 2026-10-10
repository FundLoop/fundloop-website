# Session Log: fix/node-project-guard-false-positives

### session v1: The node-project guard flagged prose and local variables

- **Timestamp:** 2026-10-10T02:40:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/node-project-guard-false-positives`
- **Head before commit:** `5ab4c20`

---

#### Objective

The guard added in #274 fired on #273's OAuth suites as soon as #274 reached `dev`, because CI runs
a PR merged with its base. Both matches were false positives of my own making, and the shape of the
mistake matters more than the two files: the guard grepped source text, so it could not tell code
from prose.

---

#### What it was flagging

- `tests/cross-app-id-jag.test.ts` — a comment ending "the replay window."
- `tests/oauth-metadata-and-revoke.test.ts` — a local `const document` holding a parsed metadata
  document.

Neither touches a DOM. A guard that fails on those teaches people to reword sentences and rename
reasonable variables to satisfy a regex, which is worse than not having it.

---

#### Actions Taken

- Comments and string literals are stripped before matching, so prose and message text no longer
  count.
- A DOM global is only flagged when it is **not** locally declared in the file, so a test that parses
  a document into a local binding is fine while one that reads the real `document` is not.
- The testing-library and jsdom check now matches **import and require lines in the raw source**,
  because a module specifier is itself a string literal and stripping strings had hidden it. Prose
  mentioning the library no longer counts either.
- The failure message now names which global each offending suite used, rather than only the file.
- Tests for the guard itself: the four false positives above, and the three real cases it must still
  catch.

---

#### Validation Notes

- Full node project: 172 files, 1132 tests. Typecheck and lint clean.
- Verified against the two suites that triggered this: both are clean under the new rule, without
  the edits I made on `#273` to work around it.

---

#### Reflections

I wrote the guard and the bug in it within the same hour, and the bug was the predictable one for a
text-matching check. Worth remembering that a guard's false positives are paid by everyone who
touches the repo afterwards, so the bar for one is higher than "it catches the case I had in mind".

---

#### Suggested Next Steps

- None. Independent of the other open PRs.
