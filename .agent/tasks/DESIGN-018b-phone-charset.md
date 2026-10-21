---
id: DESIGN-018b
title: BO-08's phone field refuses "/" (owner ruling on DESIGN-018 question 2)
category: ui
touches: []
depends_on: [DESIGN-018]
owns: [docs/design/**, docs/DESIGN.md]
status: complete
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

## Lead review and acceptance (2026-10-21)

Trivial review (11 changed lines under `docs/design/`, no `touches` flag), by the lead. The lead read `13f051d`
against the task: the charset, the two copy strings, the longest value and the new refusal vector are as written, and
no other phone `/` remains under `docs/design/` or in `docs/DESIGN.md`. **Red proof, repeated by the lead:** with the
slash put back into the charset in `settings.js`, `design018.cjs` stops at the `021 / 555` refusal vector ("Last
assertion: local detail refusal invalid-phone"), because the field accepts the value instead of refusing it; the lead
restored the file and the tree was clean. **Green, run by the lead:** `design018.cjs` 722/722, `design017.cjs` 347/347.
**Complete.** S2b copies the phone copy and guard from this Handoff, which supersedes DESIGN-018's phone row.

## Handoff

Implemented the owner's phone charset ruling in the BO-08 Frost fixture. The phone field now refuses `/` with
"Use only digits, spaces and + - . ( )." Its help is exactly "Up to 32 characters: digits, spaces and + - . ( )".
The longest stored phone is `+62 (021) 5550-1340 0812-3456-78`, exactly 32 characters. Both `longest` and
`edit-longest` retain their exact-limit property.

The phone guard S2a will copy is: trim surrounding whitespace before validating; require 1–32 characters; allow
only ASCII digits, ASCII spaces and `+ - . ( )`; allow no control character. The fixture's charset expression is
`/^[0-9 +\-.()]+$/`. The existing required-field, length, trimming and control-character handling is unchanged.
This ruling supersedes only DESIGN-018's phone slash allowance. NPWPD's separate rule is unchanged.

The changed-line inventory below uses the resulting line numbers from `git diff --unified=0`:

- In `docs/design/visual-directions/frost/back-office/settings.js`, line 17 removes `/` from the phone refusal,
  line 21 replaces only the longest phone value, and line 113 removes `/` from the accepted character class.
- In `docs/design/visual-directions/frost/back-office/settings.html`, line 61 removes `/` from the phone help;
  the rest of the phone row is unchanged.
- In `docs/design/checks/design018.cjs`, line 56 adds an explicit Save of the longest phone at both viewport
  sizes and checks the unchanged result, exact displayed value and single command. Line 64 checks the exact help
  copy. Line 84 updates the existing letter-refusal copy, and line 85 adds `021 / 555` as a refusal vector with
  the new copy. The existing loop also verifies focus on the phone field and zero commands for that refusal.
  No existing assertion was weakened or removed.
- In this task file, only the Handoff replaces the not-started placeholder with the implementation and evidence.

A search across `docs/design/` found no other phone rule, copy or accepted value requiring a change. The remaining
slash in the longest NPWPD belongs to that separate field. `docs/DESIGN.md` contains no phone charset rule and was
left unchanged. The merged DESIGN-018 task remains untouched, as instructed; builders must use the superseding
phone guard recorded here. No production file, shared rail, token or other artifact was changed.

The owner approved each check in this pane. Before changing the guard, a focused Node check extracted the actual
phone regular expression from `settings.js` and asserted that `021 / 555` was refused. It failed as expected:
the original guard accepted the value. That same value is the new browser refusal vector.

After the change, `design018.cjs` completed once: **722/722 assertions passed**, with **130 state/viewport
captures** and no page errors. An initial sandbox attempt failed to launch Chrome before any assertion ran;
the owner approved the retry outside the sandbox. Evidence is in `/tmp/design018b-evidence/settings`, including
`measurements.json` and screenshots. The generated `edit-longest-1440.png` and `invalid-phone-1440.png` were
visually inspected; the phone value, help and refusal fit the existing layout.

`design017.cjs` completed once outside the sandbox with owner approval: **347/347 assertions passed**, with
**74 state/viewport captures** and no page errors. Evidence is in `/tmp/design018b-evidence/tables`, including
`measurements.json` and screenshots. Both browser checks used `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright"`
and their respective `DESIGN_EVIDENCE_DIR` above.

The owner also approved `npm run verify`. It passed typechecking and **3,934 tests across 104 test files**.
No additional browser rerun or end-to-end suite was run. All evidence remains outside the repository. There are
no unresolved findings or missing inputs for this change.

DONE
