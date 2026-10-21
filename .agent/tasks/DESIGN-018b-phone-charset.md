---
id: DESIGN-018b
title: BO-08's phone field refuses "/" (owner ruling on DESIGN-018 question 2)
category: ui
touches: []
depends_on: [DESIGN-018]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-018b — the phone field refuses "/"

**Written** 2026-10-21 by the lead. A follow-up to DESIGN-018 (BO-08 Settings, merged as PR #125).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design018b`).
**Branch and place:** `agent/design-018b`, cut from `development` at `0006932`, in the worktree
`../restaurant-pos-wt/DESIGN-018b`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`.

## Objective

The owner overturned one rule DESIGN-018 added (DECISIONS 2026-10-21, DESIGN-018 question 2): **the phone field does
not accept `/`.** The phone charset is consult C1's (`.agent/reviews/ARCH-018-c1-configuration-schema.md` §1.1):
**digits, spaces and `+ - . ( )`**, 1 to 32 characters. Bring the BO-08 artifact, its copy and its check into line.
Nothing else in DESIGN-018 changes.

## Required inputs

1. `.agent/tasks/DESIGN-018-settings-and-tenders.md`: the Handoff's *Rules S2a, S2b and S3 can test* (the lengths and
   charsets table and the paragraph under it, "Where I differ from C1"), the copy table rows for the phone help and
   refusal, and *Questions* 2.
2. `docs/design/visual-directions/frost/back-office/settings.js`, `settings.html`, and
   `docs/design/checks/design018.cjs`. Known places, which may not be all of them: `settings.js:17` (the refusal
   text), `:21` (the longest phone value, which holds a `/`), `:113` (the charset test); `settings.html:61` (the help
   text); `design018.cjs:82` (the refusal vector). Search for any other `/` in a phone value, an accept vector, or copy.

## What to change

1. **Charset:** the phone field accepts only digits, spaces and `+ - . ( )`. A `/` is refused with the phone refusal.
2. **Copy, exactly:** help "Up to 32 characters: digits, spaces and + - . ( )"; refusal "Use only digits, spaces and +
   - . ( )." Everything else in the phone row stays as drawn.
3. **The longest phone value** in the fixture becomes a 32-character value without `/` (for example
   `+62 (021) 5550-1340 0812-3456-78`, which the lead checked: 32 characters, and it passes the charset). The `longest` and
   `edit-longest` states keep their exact-limit property.
4. **The check:** `design018.cjs` asserts the new copy, refuses a value containing `/` (add it as a refusal vector),
   and still accepts the new longest value. No other assertion is weakened.
5. **`docs/DESIGN.md`:** if any rule there names the phone charset or `/`, bring it into line; if none does, change
   nothing there.

## Constraints

- Change nothing else in BO-08 or any other artifact. Light only, desktop only, no new token.
- Run `design018.cjs` once after the change, and `design017.cjs` once (the rail is shared); ask the owner in the pane
  before each run. `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/designNNN.cjs`. Evidence
  stays outside the repository.
- The DESIGN-018 task file is a merged record: do not edit it.

## Tests expected to change

`docs/design/checks/design018.cjs` only, as item 4 says.

## Acceptance criteria

1. No phone value, rule, copy or check in `docs/design/` accepts or mentions `/` as allowed; a `/` is refused with the
   new refusal copy (red before the change, shown by the new vector).
2. `design018.cjs` and `design017.cjs` pass; counts quoted in the Handoff.
3. The Handoff lists each changed line (`git diff`), and states the phone guard S2a will copy: 1–32 characters, digits,
   spaces and `+ - . ( )`, trimmed, no control character.

## Reporting

Commit on `agent/design-018b` only, and never push. Write the Handoff below in full prose, ending with `DONE` or
`BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design018b: DESIGN-018b done — <one line>"
    herdr agent prompt lead "design018b: BLOCKED — <question>"

## Handoff

_Not started._
