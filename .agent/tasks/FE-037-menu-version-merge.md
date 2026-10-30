---
id: FE-037
title: BO-03 merges a list read and a command answer by catalog version, not by arrival order (PHASE1-S6b review F1, applied to the menu)
category: feature
touches: []
depends_on: [PHASE1-S6b]
owns: [apps/back-office/src/menu/model.ts, apps/back-office/test/menu-versions.test.tsx, apps/back-office/test/menu-support.tsx]
status: review
cycles: 0
---
# FE-037 — BO-03 merges by catalog version, not by arrival order

**Written** 2026-10-30 by the lead. Source: Codex's review of PHASE1-S6b, finding F1
(`.agent/reviews/PHASE1-S6b-review.md`), and the fix the lead ruled for BO-07 in S6b's round 3
(`.agent/tasks/PHASE1-S6b-presets-screen.md`, *Round 3 (lead rulings, 2026-10-30)*, and the Handoff's *Round 3*
paragraph). The merged code it copies is `apps/back-office/src/presets/model.ts` (`rowVersion`, `readList()`,
`apply()`).

## Objective

BO-03's model (`apps/back-office/src/menu/model.ts`) keeps every category and item row consistent with the catalog
version it came from. Today `readList()` (`:379-380`) overlays every record a command answered after the read began,
whatever that answer's version, and `apply()` (`:431-445`) replaces a row whatever version the row came from. A read
that began before a command was answered can still take its snapshot after that command, and after another tab's edit,
so arrival order does not say which is newer. Either arrival order can leave a row holding an older value beside a newer
standing version. An editor opened from that row then carries a current `expectedVersion` with stale values, which
ADR-012 rule 13 (`docs/decisions/ADR-012-versioned-configuration.md:334`) forbids. After this task, the version decides,
as it already does on BO-07.

## Required inputs

1. This file, whole.
2. PHASE1-S6b's *Round 3* rulings and Handoff paragraph, and its review's F1 (paths above).
3. `apps/back-office/src/presets/model.ts`: the merged fix, to copy.
4. `apps/back-office/src/menu/model.ts`: `readList()`, `apply()`, `adopt()`, `host()`, `receiveItem()`,
   `releaseFromSave()`, and the comments above them; and `apps/back-office/test/menu-versions.test.tsx` with
   `menu-support.tsx`, for how version cases are driven today.
5. PHASE1-S4c1's Handoff (`.agent/tasks/PHASE1-S4c1-menu-screen.md`, near `:515-524`): the standing version, the
   applied-record merge, and the hosted category.

## Lead rulings (2026-10-30)

1. **Provenance, per record kind.** Keep, for every category row and every item row, the catalog version it was taken
   from: the snapshot's version for a row from a full read, the answer's version for a row from a command answer
   (including an item BO-04 hands back through `receiveItem` or `releaseFromSave`, which already go through `apply`).
   The applied entries carry their answer's version. A **hosted** category (`host()`) is not an answered record: it gets
   no provenance and stays replaceable by the next read, as today.
2. **A full read at version V** starts from the snapshot's rows, then overlays an applied record (applied after the read
   began) **only when its answer's version is greater than V**. At V or older the snapshot's row stands. The standing
   version keeps its current rule (`ahead`).
3. **A command answer at version A** replaces or inserts each of its records **only when that row's provenance version
   is less than A**, or the row is new to the list. A row a newer read already established keeps the read's values. An
   answer carrying several records (a reorder) applies the rule to each. The answer is still announced, with its sentence
   and focus, as today. `adopt()` is unchanged.
4. **Nothing else changes.** No change to `adopt()`, the partial state, the hosted rule, the one-command slot, the
   gates, the copy or the view. BO-03 has no version line in its view, so S6b's `latest` rule has no counterpart here.
   Do not touch `presets/`, `item/` or any other file outside `owns`.

## Acceptance criteria, each with its red proof

Drive each overlap with deferred configuration responses, as `menu-versions.test.tsx` does. Use a row command the
screen sends while a read can be outstanding (for example archive, restore, or an item's 86 toggle) and start the read
the way the screen allows (a revisit through the rail, *Try again*, or a reread after an unknown outcome). Say in the
Handoff which you used. In every case the answered record and the snapshot's record must differ in a field the row shows.

1. **(a) Answer first, category.** The list reads 12; a category command answers 13; then a read answers 14, in which
   another tab changed that category. The row shows the read's (14) values, and a rename opened from it carries
   `expectedVersion: 14`.
2. **(b) Read first, category.** The same, but the read (14) arrives before the answer (13). The row still shows the
   read's values, and the rename carries 14.
3. **(c) The inverse.** The read's snapshot is older (12) and arrives after the answer (13). The row shows the answered
   record, the standing version is 13, and a rename carries 13.
4. **(d) Items.** Case (b) for an item row, with an item command (the 86 toggle, for example) and another tab's change
   to that item in the read at 14: the row shows the read's values.
5. *Red:* restore the unconditional overlay in `readList()`: (a) fails. Restore the unconditional replacement in
   `apply()`: (b) and (d) fail. Record each, reverted.
6. Every existing test passes unchanged. `npm run verify` green.

## Tests expected to change

- `apps/back-office/test/menu-versions.test.tsx`: new cases only.
- `apps/back-office/test/menu-support.tsx`: additions only, if the new cases need a helper.
- **Nothing else.** An existing assertion that fails is a finding: stop and write `BLOCKED: <question>`; do not edit it.

## Rules

- Touch only the paths in `owns`. Red first: write the four cases, run them against the unchanged model, record the
  failures, then fix.
- Format by hand, matching the file; there is no formatter config. One simple command per shell call; use the file
  tools, not `sed -i`, for edits.

## Baseline

`development` at `b258bfa` (S6b #157 and the lead's #158 merged). The lead's runs of S6b's final tree: `npm run verify`
149 files, 5448 tests; `npm run test:e2e:all` 108 passed. Confirm the baseline before you start; state the new counts.
Run `npm run test:e2e:all` before you finish (the change is in a back-office client).

## Out of scope

- BO-04's own read and save (`item/model.ts`). If you see the same arrival-order merge there, report it with its line;
  do not fix it.
- BO-05 and BO-08's methods, which carry no catalog version.
- The frame's focus after a different manager signs in (queued separately).

## Commit and report

Commit on `agent/fe-037` only, after verify is green, with path-scoped `git add`, and never push. Check that `git
status` is clean before you end. Write the Handoff below in full prose: what was done, how each ruling is met, the four
cases and the reds (mutation, failure read, reverted), any finding in `item/model.ts`, and the real `verify` and
`test:e2e:all` output. End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md
says.

## Round 2 (lead ruling, 2026-10-30), on the builder's BLOCKED question

**Ruling 3 is amended: `apply()` replaces a row when its provenance version is less than or equal to the answer's
(`<=`).** Two records at one catalog version describe one committed state, so replacing on equality never shows an
older value. The F1 cases still hold: an answer older than the row (cases b and d read-first) is refused by `<=` exactly
as by `<`. `readList()` keeps the strict `>` of ruling 2. This keeps `menu-availability.test.tsx:168`, which pins S5's
no-op 86 announcement, green and unedited. (Its fixture answers another tab's 86 at the unchanged version 5, which a
real server would answer at 6; the expectation stands either way, and rewriting it is not this task's.)

`presets/model.ts` keeps its strict `<`: on BO-07 an equal-version answer is an unchanged edit, whose record already
equals the row. Do not touch it.

In this round:
1. Apply `<=` on the category and item lines in `apply()`, and make the comment say "lower or equal" and why.
2. Rerun the mutation for `apply()`. It must still fail case (b) and case (d) read-first.
3. Run `npm run verify` and `npm run test:e2e:all`.
4. Update the Handoff in place, with a *Round 2* paragraph at its end.
5. Commit `model.ts` and `menu-versions.test.tsx` with path-scoped `git add`.
6. Confirm that `git status` shows nothing but the task file, then end with `DONE`.

## Lead verify (2026-10-30)

The lead ran these in this worktree, on `3dd51d5`:
- `npm run verify`: 149 files, 5453 tests passed;
- `npm run test:e2e:all`: 108 passed, both engines.

The diff against `development` touches only `menu/model.ts`, `menu-versions.test.tsx` and this file, all inside `owns`.
No existing test changed. The lead read the model diff against both rulings:
- `readList()` overlays an applied record only when its answer is newer than the snapshot (strict `>`);
- `apply()` replaces a row only when the row is not newer than the answer (`<=`, round 2);
- a hosted category carries no provenance.

Reviewer: the browser and the e2e harness are out of your reach. This note is the evidence for them.

## Handoff

**Status: DONE after Round 2.** Round 1 below is kept as written: it was blocked on ruling 3's strict `<`, which the lead amended to `<=` (see *Round 2* at the end).

### What I did

- `apps/back-office/src/menu/model.ts`: added `categoryVersion` and `itemVersion` maps (the catalog version each row on screen was taken from) and a `version` on each `appliedCategories` / `appliedItems` entry. `readList()` fills the maps from the snapshot's version, then overlays an applied record only when `at > startedAt && version > snapshot.version` (ruling 2). `apply()` replaces or inserts a record only when the row has no provenance or `have < applied.version` (ruling 3), and records the applied entry unless a newer answer already holds it (`kept.version <= applied.version`, copied from `presets/model.ts`). `host()` writes no provenance (ruling 1), `adopt()` and the standing-version rule are untouched, and the answer is still announced because `present()` is untouched. The comment above `load()` was rewritten to describe the version rule.
- `apps/back-office/test/menu-versions.test.tsx`: new `describe('AC 8 (FE-037)…')` with five cases, driven by deferred responses (`h.hold`) as BO-07's round-3 cases are. I used a revisit through the real rail (Tables, then Menu) while a row command is outstanding. Commands: archive of the Drinks category (a, b, c) and the 86 toggle on Burger (d). The list reads at 12 first. In every case the answered and the snapshot record differ in a shown field: (a, b) the answer archives Drinks, the version-14 read has Drinks renamed *Beverages* and active; (d) the answer marks Burger 86, the 14 read has it renamed *Big burger* and available. Cases: (a) answer 13 then read 14: heading is Beverages, a rename carries `expectedVersion: 14`. (b) read 14 then answer 13: same, and the page still says "Drinks archived." (c) read 12 after answer 13: Drinks stays archived, rename carries 13. (d) the item row shows the read's record, in both orders (the answer-first item case is mine, added because it is the only one that exercises the item overlay in `readList()`).
- `menu-support.tsx` was not changed. No formatter was run.

### Red proofs (each reverted afterwards)

Against the unchanged model, before the fix: (a), (b), (d)-read-first and (d)-answer-first failed (for example `expected [ 'Mains', …(2) ] to include 'Beverages'`, and the Burger row read `86 · Unavailable` with no `Big burger`); (c) passed, since it guards behaviour that already held. With the fix: all 33 tests in the file passed. Mutations on the fixed model: dropping `&& version > snapshot.version` from the category overlay failed (a); dropping it from the item overlay failed (d) answer-first; making the `apply()` replacement unconditional (both maps) failed (b) and (d) read-first. Each was reverted and the file re-run.

### The block

`npm run verify`: typecheck clean; vitest 148 files passed, 1 failed; 5452 tests passed, 1 failed (5453). The failure is an existing test, which I did not edit:

`apps/back-office/test/menu-availability.test.tsx:168`, *a no-op answer (the version unchanged) announces the same sentence*: the list reads at 5, 86 on Burger is answered at version 5 (the server wrote nothing; it returns the record at the standing version), and the test expects the row to show `86 · Unavailable`. Ruling 3 replaces a row only when the row's version is *less than* the answer's, and the row came from the snapshot at 5, so the strict `<` leaves the row available.

Proposed resolution (needs your ruling, since it changes ruling 3's wording): in `apply()` replace when `have <= answer.version` (two characters, `<` to `<=`, on the category and item lines). An answer at the row's own version is authoritative for that version (a no-op command returns the current record), and a snapshot at the same version holds the same data in practice, so equal versions need no tie to the read. `readList()` keeps the strict `>` for the overlay (ruling 2), so a late snapshot at the answer's version still stands. I tried exactly this: `npx vitest run apps/back-office` gave 54 files, 1612 tests, all passing, including the new five and the existing no-op test; then I reverted to the strict `<` so the tree is as ruled. Note `presets/model.ts` `apply()` has the same strict `<`; I did not check whether BO-07 has a no-op case that would hit it and did not touch it.

### Not done, and why

`npm run test:e2e:all` was not run: verify is red, and I will not commit. Nothing was found in `item/model.ts` (I did not read it beyond what the task named).

### Next agent needs

The lead's ruling on `<` vs `<=`. If `<=`: change the two lines in `apply()`, update the comment (it says "lower"), re-run `npm run verify` and `npm run test:e2e:all`, and commit `apps/back-office/src/menu/model.ts` and `apps/back-office/test/menu-versions.test.tsx` with path-scoped `git add`.

### Round 2

The lead ruled `<=` in `apply()`. I changed both lines (category and item) from `have < applied.version` to `have <= applied.version`, and rewrote the comment above `load()` to say a command answer replaces a row when the row's version is "lower or equal", with the reason: two records at one version describe one committed state, and a no-op command answers the standing version with the current record. `readList()` keeps the strict `>`; `presets/model.ts` was not touched.

Mutation rerun on the `<=` model: replacing both `apply()` conditions with `if (true)` failed exactly (b) (`expected [ 'Mains', …(2) ] to include 'Beverages'`) and (d) read-first (the Burger row read `86 · Unavailable` with no `Big burger`); 2 failed, 31 passed. Reverted to `<=` afterwards.

Final runs on the committed tree. `npm run verify`: typecheck clean; 149 files passed, 5453 tests passed (baseline 5448 plus my five new cases). `npm run test:e2e:all`: 108 passed (chromium and webkit). No existing test was edited. `item/model.ts`: no finding, as I did not read it beyond what the task named. Committed `apps/back-office/src/menu/model.ts` and `apps/back-office/test/menu-versions.test.tsx` on `agent/fe-037`; this task file is the only other change and is left for the lead.

DONE
