# DESIGN-020 review — BO-04 Item editor in Frost

**Reviewer:** Claude Opus 5.5 (`DESIGN-020-review`), 2026-10-22.
**Reviewed:** branch `agent/design-020` at `a33e73a`, against `development`
(`git diff development...agent/design-020`), the task file
`.agent/tasks/DESIGN-020-item-editor.md` with its handover rulings and Handoff,
and the documents it cites. Parts A and C were drawn by a Codex designer, Part D
is Codex's, and a Claude Opus designer finished the draft under the owner's
exception, so this review covers both families' work. Because the finishing pass
was Claude, part of this review is same-family; the lead may want to weigh that.

## 1. Verdict

**findings** — seven findings. One is medium: *Keep my changes* can add back an
option the manager never touched, which breaks the lead's ruling 4(a). Two more
are about Keep doing things that `D` Part B does not describe, one is a stale
local refusal that holds Save, one is a status slot that hides a fact, and two
are low-severity points about documents and drawings. None of them blocks the
design review that follows. Each can be fixed inside `docs/design/**` and `D`.

## 2. Findings

### F1 (medium) — Keep my changes adds back an option the draft never touched, when the draft removed an earlier option

**Location.** `docs/design/visual-directions/frost/back-office/item-editor.js:136`
(the `moved` test in `keepChildren`) and `:113` (the same test in
`removedChanged`, which writes the notice).

**What is wrong.** A row counts as "moved by the draft" when its absolute index
among active rows differs between the opening value and the draft, and the
draft's order list is non-empty. Removing an option (pending removal) shifts the
index of every option after it, so every later option counts as "moved" even
though the manager never pressed Move on it. If another manager removed one of
those later options in the meantime, the code treats it as "changed by the draft
and removed meanwhile" (ruling 4(b)). Keep then adds it back as a new, unsaved
option, and the notice says beforehand that the draft changes it.

**Authority.** The lead's handover ruling 4(a) (task file, *Handover*, ruling 4;
restated in the Handoff's *Lead rulings recorded*, item 4, and in `D`'s
DESIGN-020 additions, *Keep my changes* (a)): "An option the draft did not change
follows the current item: if it was removed meanwhile it leaves the draft under
either choice."

**Failing scenario (traced by hand from the code, not run).** Burger opens with
variants Regular, Large, Small (`variant-1..3`). The manager presses *Remove
variant 1* (Regular) and changes nothing else. Another manager removes Small.
The manager presses Save, which is refused `CATALOG_CHANGED`. In
`removedChanged`, Small has original index 2 and draft-active index 1, and the
order list is non-empty, so the notice reads: "The current item no longer has
variant Small, which your draft changes. Keep my changes adds it back as a new
variant; Use current item leaves it out." That is untrue, because the draft did
not change Small. In `keepChildren`, `old` is Small, `live` is undefined,
`edit` is undefined and `moved` is true, so the branch at `:139` gives Small a
new id and `new: true`. After Keep the draft shows Large, "Small · New · not
saved yet", and Regular pending removal. The next Save sends Small as an
*added* variant, restoring something another manager deliberately removed. The
same happens when the manager moves an earlier row past a later one, or removes
a modifier ahead of one removed meanwhile.

**Why the suite is green.** The only 4(a) walk (`design020.cjs:64`) types the
changed row back to its saved values on `stale-removed`, so no index shifts. No
walk combines a draft removal with an option removed meanwhile.

**Proposed fix.** Decide "position changed" by relative order, not absolute
index. Take the draft's order of the saved options that are still active in both
the draft and the opening value, and compare it with the opening order of the
same options; an option counts as moved only if its predecessor or successor
among those options changed. (Simpler alternative: count an option as moved only
if the manager pressed Move on it, tracked as a flag on the draft row.) Use the
one helper in both `keepChildren` and `removedChanged`. Add a walk: remove
variant 1, remove variant 3 meanwhile, then assert the notice has no
removed-option sentence and that variant 3 is absent after Keep and after Use
current.

### F2 (low–medium) — Keep imposes the draft's whole order when the draft only added or removed, and puts pending removals last; `D` says otherwise

**Location.** `item-editor.js:141` (sort by the draft's order whenever
`delta.order.length` is non-zero), `:55` (`order` is non-empty after any add or
removal), and `:143` (pending-removal rows appended after the sort).

**What is wrong.** `D`'s DESIGN-020 additions, *Keep my changes* (b), say "the
draft's order applies where it moved rows, and rows the current record added go
last". The code applies the draft's order to every row whenever the draft added
or removed any option, because any add or removal makes `order` non-empty (the
Handoff's *What one save carries* states that on purpose for the wire). Another
manager's reorder of rows this draft never moved is therefore undone on Keep,
and the next Save sends the reverted order. Separately, a row pending removal is
re-appended at the end of its list after Keep, so *Undo* no longer "returns it
to its place", which `D` Part B *Remove* promises. The undone row then also
counts as a reorder in the next Save.

**Authority.** `D`, *Configuration forms — DESIGN-020 additions*, *Keep my
changes* (b) and *Remove*. The drawing and the rule it publishes for every later
form disagree, and S4c is told to copy both.

**Failing scenario (traced by hand).** Burger opens with Regular, Large, Small.
The manager adds a variant "Kids". Another manager reorders to Small, Regular,
Large. Save is refused `CATALOG_CHANGED`; the comparison shows "Variants ·
current order" as Small, Regular, Large. After Keep the draft reads Regular,
Large, Small, Kids, and Save sends that order, so the other manager's reorder is
lost even though the draft moved nothing.

**Proposed fix.** Either make `keepChildren` keep the current order for rows the
draft did not move (using F1's relative-order test) and re-insert a
pending-removal row at its current position, or change `D`'s sentence to say
what the code does. Whichever is chosen, put it in Question 3 so the lead rules
on it alongside the item-field asymmetry.

### F3 (low–medium) — Within an option the draft edited, Keep merges field by field; this is undisclosed and contrary to DESIGN-018's wording

**Location.** `item-editor.js:138` (`Object.assign(live, edit)`, where `edit`
holds only the fields the draft changed).

**What is wrong.** For an option the draft edited that still exists, Keep takes
the current row and overlays only the draft's changed fields. If another manager
changed the option's other field, their change survives and the manager's draft
silently gains a value they never typed. At the item level the opposite holds:
Keep keeps every field as the draft has it, so another manager's change to an
untouched field is reverted (the Handoff's Question 3). So the item level never
merges but the option level merges field by field. Question 3 discloses only
the untouched-option versus untouched-field asymmetry, not this within-row
merge, and `D` Part B's "a saved row the draft changed that still exists keeps
the draft's change" does not say whether the row's other fields follow the draft
or the current record.

**Authority.** `D`:1651 (DESIGN-018, binding for every form): "Nothing is
resent, merged field by field or chosen for the manager." Ruling 4 covers
untouched options and changed options removed meanwhile; it does not cover a
changed option that still exists.

**Failing scenario (traced by hand).** The draft changes Large's price change to
25.000. Another manager renames Large to Grande. After the refusal and Keep, the
draft row reads "Grande · 25.000". The manager typed neither "Grande" nor chose
it. The comparison did show "Grande · 20.000", but nothing says Keep would
combine the two.

**Proposed fix.** Raise it with Question 3 as a lead ruling: either an edited
option keeps all its draft values (consistent with the item fields and
DESIGN-018), or the within-row merge is an explicit, ruled exception that `D`
states in words S4c can test.

### F4 (low–medium) — A local duplicate-name refusal outlives its cause and holds Save

**Location.** `item-editor.js:218` (`editEvent` clears only the edited field's
error), `:232` (Remove deletes only the removed row's errors), and `:101` and
`:221` (Save disabled while any error is recorded).

**What is wrong.** A duplicate refusal depends on two rows, but it is stored and
cleared as if it belonged to one field. If the manager resolves the conflict
through the *other* row, by renaming the earlier row or removing it (a
pending-removal name is free, per the Handoff's names table), the later row keeps
"Another variant uses this name. Choose another name." Save stays disabled, and
the footer says "Correct the marked fields before saving." although no field is
now wrong. The refusal is now false, and the only way out is to type something
into the field that was already valid.

**Authority.** `D`:1508 (DESIGN-017, *Validation and refusal*): "Clear a field's
obsolete error and reference when edited"; `D`:1867–1868 (DESIGN-019): "editing
clears the obsolete error and enables Create for a fresh validation"; the
Handoff's names rule that a pending-removal option's name is free in the same
save.

**Failing scenario (traced by hand).** Open `?state=invalid-variant-duplicate`.
Variant 2 ("REGULAR") is refused. Rename Variant 1 to "Standard", or press
*Remove variant 1*. Variant 2 still shows the duplicate refusal (after the
removal it is now labelled "Variant 1" and still says another variant uses its
name), and Save stays disabled. The same applies in `stale-duplicate` if the
manager removes the current item's "House size" instead of renaming the re-added
row. The recovery walk (`design020.cjs:51`) only ever edits the marked field, so
it does not reach this case.

**Proposed fix.** Treat a duplicate refusal as belonging to its list: any name
edit, removal or undo in a list clears that list's duplicate refusals (or
re-runs the duplicate check over the list's active rows), so Save is enabled
again for a fresh validation. Add a walk for each of the three resolutions
(rename the holder, remove the holder, remove the current item's holder after
Keep).

### F5 (low) — BO-04's status slot hides availability on an archived item

**Location.** `item-editor.js:92` (`#item-status`), with `:93` (`#item-context`).

**What is wrong.** The status is one slot with three exclusive values:
"Archived item", "Available" or "86 · Unavailable". An item that is archived
*and* 86'd shows only "Archived item", so the availability fact is hidden. That
combination is real: BO-03 keeps availability actions on archived items, and
status and availability are independent (`D`:1830–1833). The comparison panel
(`:109`) prints both facts ("Archived item · 86 · Unavailable"), so the heading
and the comparison disagree for the same record. No fixture is both archived and
86'd, so no state shows the gap. A smaller instance of the same shape: an active
item in an archived category (Apple Pie) reads "Available" on BO-04 with no
counterpart to BO-03's "Hidden from the POS · category archived". Only the
Category field's "Seasonal · Archived" hints at it.

**Authority.** The task's ruling *State commands stay on BO-03*: "BO-04 shows
the item's availability and archived status as facts"; `D`:1830–1833
(DESIGN-019) on status and availability being kept independently.

**Failing scenario.** On BO-03, press 86 on Winter Stew (archived; the action is
present), then Edit. BO-04 reads "Archived item" and "Archived item. Saving does
not restore it." Nothing says it is 86'd, so a manager who restores it on BO-03
expecting it to sell finds it unavailable.

**Proposed fix.** Show both facts when archived ("Archived item · 86 ·
Unavailable"), as the comparison already does, and draw one archived-and-86'd
state. Consider a plain fact for an item whose category is archived. Update the
copy table's status row.

### F6 (low) — `D` Part B states two things as settled, and says it changes no rule, where the Handoff says the lead has still to rule

**Location.** `docs/DESIGN.md`, *Configuration forms — DESIGN-020 additions*:
the opening paragraph ("No rule above is changed"), *BO-04 copy and layout* ("It
reads the item and the catalog version itself when it opens, and its draft builds
on that read"), and *The stale-draft refusal over a form with child rows*.

**What is wrong.** (a) `D`:1822–1823 (DESIGN-019) says "An editor carries the
list's standing version at the moment it opens", and DESIGN-019's Handoff
(F1 row) puts the same sentence in its rules table without limiting it to BO-03's
inline editors. The Handoff's Question 4 rightly raises BO-04's own read as
unruled, but `D` already states it as behaviour. (b) Ruling 4's row-by-row
rebuild on Keep (untouched rows follow the current record) is a merge, and
`D`:1651 says nothing is "merged field by field". The ruling authorises the
child-row case, but `D` presents it as an addition that changes nothing, not as
a ruled exception.

**Authority.** The task, Part B: "Change no existing rule"; `CLAUDE.md` and
`AGENTS.md` on decided versus discussed.

**Failing scenario.** S4c reads `D`, implements BO-04 on its own read, and the
lead later rules Question 4 the other way. Or a later form's designer reads "No
rule above is changed" and assumes DESIGN-018's no-merge sentence still holds
for child rows.

**Proposed fix.** Mark the BO-04-read sentence "pending the lead's ruling on
DESIGN-020 Question 4", and introduce the child-row Keep rules as "a lead-ruled
exception to DESIGN-018's no-merge sentence, for child rows only". Neither
change alters behaviour.

### F7 (low) — The "not a whole number" invalid states draw letters, not a decimal

**Location.** `item-editor.js:276` (`format` uses `'twelve'`); states
`invalid-base-format`, `invalid-variant-delta-format` and
`invalid-modifier-delta-format`.

**What is wrong.** Part A item 1 asks for local invalid input that is "not a
whole number". The drawn states show the word "twelve". The decimal case
(`1000.5`, `10.00`), which is the one a manager will actually type and the
reason the dot-as-grouping rule exists, is proven only by the check's money
cases and the `1000.5` walk, never drawn. The copy is the same rule-3 sentence
either way, so this is about what a design reviewer can see, not about
behaviour.

**Authority.** The task, *What to draw*, Part A item 1.

**Proposed fix.** Use a decimal (`10.000,5` or `1000.5`) in the base-price
format state, or add one decimal state per amount kind.

## 3. What I ran and what I did not

**Observed:**

- `git rev-parse HEAD` → `a33e73a474ad9bdc492a71ba75a359b93edcf4b7` and
  `git status --porcelain` → empty, both before and after my verify run. The
  tree did not move.
- `npm run verify` → typecheck clean; `vitest run`: **114 test files passed,
  4331 tests passed**. Nothing under `docs/design/tokens/` or `packages/`
  changed on this branch, so verify was not strictly required. It was run
  because the role asks for it.
- `git diff --stat development...agent/design-020`: 15 files, only the task
  file, `docs/DESIGN.md` and paths under `docs/design/**`. Nothing under
  `apps/`, `packages/`, `db/`, `e2e/` or `docs/design/tokens/`;
  `P/item-editor.html` untouched. `git diff --stat 47963f1 a33e73a` shows only
  the task file, so the lead's check runs at `47963f1` cover the design files
  at HEAD.
- Every `var(--…)` in `item-editor.css` (21 distinct tokens) has a definition
  under `docs/design`; I found no raw colour, size or weight in the file.
- `.agent/bin/ask.sh librarian` on zod length counting, then
  `node_modules/zod/package.json` (4.6.5) and
  `node_modules/zod/v4/core/checks.js:271-322`: the installed zod counts code
  points (`util.codePointLength` once UTF-16 units exceed the limit). `D` Part
  B's "as zod and PostgreSQL count them" is correct for the pinned version.

**Not run:**

- No design check script and no browser. The lead's verify note (task file,
  *Lead verify*) is the evidence for `design012`–`design020` (all green, no
  page errors), and I rely on it for the measurements and state geometry.
- No mutation run. I tried to reproduce F1–F3 in memory by lifting the pure
  functions out of `item-editor.js` into `node -e`, but the sandbox refused the
  command, and writing a scratch script outside the repository was refused too.
  **F1, F2, F3 and F4 are therefore hand traces of the code**, given line by
  line above; I am confident of F1's and F2's traces, but they have not been
  executed.

**Inferred, not observed:** the user-visible copy in each failing scenario is
read from the code paths, not from a rendered page.

## 4. Cleared

- **Scope and ownership:** only `docs/design/**`, `docs/DESIGN.md` and the task
  file changed; the four product documents, ADR-012, C1 and C2 are untouched; no
  token added.
- **Money input (B-1, FR-M2, FR-M5 bounds, C1 §0):** `parseMoney` follows the
  published order (empty, leading `-` where no sign is allowed, pattern, bounds)
  on strings with a pattern and `BigInt`. ASCII-only `\d`, grouping exactly as
  displayed, `-0` → `0`, canonical integer strings in the command. A refused
  value stays as typed. The variant preview floors with `BigInt` and states the
  floor (FR-C2, AC-26) without implying a negative price can be sold. The
  float-ban regex was not weakened; the `long-N` index moved to its own line.
- **Names:** trimmed, empty → length (code points, `[...s].length`) → `\p{Cc}`;
  64 and 32 as ruled; case-insensitive local uniqueness among active options,
  with pending-removal names free; `DUPLICATE` only ever on the item name, and
  the archived-category holder copy is shown. Archived items are exempt, as C1
  §2.2 allows. BO-03's 80-unit stress row opens as a refusal, not as a valid
  item.
- **One Save, one command; version only on edits (ADR-012 rule 13, C1 §2.3):**
  creates carry `expected: null`, edits carry the base; `changes` holds only
  changed fields, adds, edits, removals and order. An unchanged save is answered
  "unchanged" with the version, never "saved".
- **`CATALOG_CHANGED`:** the stale state follows `D`'s DESIGN-018 rule (nothing
  written, one reread, comparison marked where values differ, Save held, focus
  on the notice, Keep rebases without sending, Use current replaces). Create
  into an archived category keeps the draft and focuses Category; a move to an
  archived category goes through the stale comparison and stays refused after
  Keep. Ruling 4(b) and (c) are drawn (`stale-removed`, `stale-duplicate`),
  apart from F1's case.
- **Unknown outcome:** same version, newer version ("may include this save"),
  and reread failed (facts withheld, Try again reads only); never resends.
- **State commands:** no Archive, Restore, 86 or Make available control in any
  form state; a new item shows "Not saved yet" and nothing implying a saved
  record.
- **Drafts and sessions:** the departure decision from Cancel, Escape, the rail,
  browser Back and Log out with pending and unknown copy; M-6 visible and inert;
  BO-01 closes working dialogs and restores the draft and decision for the same
  manager; a different manager destroys the draft and starts with no pending
  command.
- **Return plumbing (ruling 1):** `menu.js` applies only the returned item,
  inserts the host category only when absent, changes no other row, and marks
  the snapshot as review plumbing that S4c replaces. `design019.cjs` changes only
  the expected Edit suffix; `design014.cjs` is unchanged.
- **Part C, `I` and `S`:** Q5's fixed currency context replaces the stale
  "locked after the first order" line. The *Archive item* modal leaves BO-04's
  sitemap node, consistent with the lead's ruling, and B-8's snapshot fact moves
  into BO-04's standing context.
- **Part D:** `settings.js` shows currency and decimal places as plain
  term-and-value rows above the empty state, with no rate and no input, as
  FR-B1 and `D`'s installation-fact rule require.
- **Handoff:** the state map, copy table, rules tables, focus table, measurements
  and four questions are present. Questions 1 (swap uniqueness under a partial
  unique index) and 2 (a unit price above the largest line total) are real
  issues, correctly raised rather than decided.
