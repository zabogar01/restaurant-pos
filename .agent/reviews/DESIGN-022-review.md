# DESIGN-022 review — BO-07 Discount presets in Frost

**Reviewer:** Claude Opus 5.5 (`DESIGN-022-review`), 2026-10-29.
**Branch:** `agent/design-022` at `bf38ea9`, against `development`.
**Task file:** `.agent/tasks/DESIGN-022-discount-presets.md`.

## 1. Verdict

**findings** — one substantive finding and two minor ones.

The artifact is thorough and almost every rule it claims holds up when traced
through the code. One case is wrong. After any answered command, the list
treats the answered catalog version as the version its rows stand at. An
editor opened afterwards then carries a version newer than the rows it was
filled from. If another tab changed a different preset in the meantime, that
save is not refused and silently puts the old value back. This is the
last-write-wins case that ADR-012 rule 13 exists to prevent. The Handoff's
testable rules for S6b do not close it, so S6b would build it as drawn.

## 2. Findings

### F1 (high). An editor opened after a command answer carries the answered version, not the version its rows were read at

**Location.**
- `docs/design/visual-directions/frost/back-office/presets.js:105`:
  `applyAnswer` sets `facts=answer.version` unconditionally, for every
  answered create, edit, deactivate and reactivate.
- `presets.js:79`: `openEditor` sets the new draft's `base:facts`.
- The Handoff's *Command versions* row (task file line 321) tells S6b that
  "Edit carries the version read when the form opened". It gives no rule for
  what the list's version becomes after an answer. Its *Known/unknown results*
  row says success replaces only the answered row, without a reread (line 326).

**What is wrong.** One value, `facts`, does two jobs. It is the facts line's
"version most recently read or answered" (`D:1663-1666`), which is correct
for display. It is also the version every newly opened editor builds on. The
answered version vouches only for the answered row. Every other row on the
screen still holds what the last full read returned. ADR-012 rules 9 and 10
make one catalog version, shared by every preset and every menu row, which
every committed write advances. So a version
that skipped (the answer is more than the standing version plus one) means
another writer changed something this page has not read, and that may be
another preset.

**Authority.**
- ADR-012 rule 13, first bullet: "An edit carries the catalog version its form
  was read at". The form for any other row was filled from the last full read,
  not from the answer.
- ADR-012 rule 13's rationale (ARCHITECTURE §17.9 rejects blind
  last-write-wins for catalog-sensitive state; "a form opened before another
  tab changed the same item, and saved afterwards, would silently put the old
  price back").
- `D:1818-1823` (DESIGN-019, *Catalog changed during a list edit*). For a list
  with inline editors it already rules that a command answer advances the
  list's standing version "only when that version is exactly the standing
  version plus one, or equal to it for an unchanged answer. Otherwise the list
  keeps its standing version, so the next edit opened from it is refused
  `CATALOG_CHANGED` and rereads. An editor carries the list's standing version
  at the moment it opens." The lead's DESIGN-020 clarification scopes that
  sentence to BO-03's inline editors, as opposed to BO-04's own read. BO-07 has
  BO-03's shape (one list read, inline editors, shared catalog version), not
  BO-04's. `menu.js:17-18` and `menu.js:149` implement the rule as a separate
  `listVersion`. `presets.js` has no equivalent.

**Failing scenario.** This is traced through the code, not executed (see §3).
It can be reproduced in the artifact's console, at `presets.html` (state
`default`, list read at version 12):
1. Another tab changes *Regular customer* from 5% to 20%:
   `PresetFixture.other(s=>{s.find(r=>r.presetId==='regular').value.ratePpm='200000'})`.
   The server is now at version 13. This tab still shows Regular customer at 5%.
2. This tab deactivates *Staff meal* and confirms. In `finish`, `apply`
   advances the server to 14 and answers `{row: staff, version: 14}`.
   `applyAnswer` sets `facts=14`. The facts line reads "Catalog version 14".
   Regular customer still shows 5%, the value read at 12.
3. This tab opens *Edit Regular customer*. `openEditor` sets `base=14`, and
   the draft shows 5%. The manager changes only the name, for example to
   "Regular guest", and presses Save.
4. In `finish`, `cmd.expected (14) === version (14)`, so the edit is not
   refused. `apply` writes the whole value, `ratePpm '50000'`. The other tab's
   20% is silently reverted to 5%, with no `CATALOG_CHANGED` and no comparison.
   Because Edit sends the whole preset (*Server facts*), even a rename carries
   the stale value.

The same path follows an answered create or edit, and the `partial` state.
There the list read had failed and the answered version is the only version
the page knows, so every other row's editor carries a version the page never
read. No `design022.cjs` walk covers it. Its other-tab simulations
(`other-saves` at line 59, `PresetFixture.other()` at line 71) all advance
the version while an editor is already open with base 12, which is the
correctly refused case.

**Proposed fix.**
- Adopt DESIGN-019's standing-version rule for BO-07, and state it in the
  Handoff's *Command versions* row as a rule S6b can test. The list keeps a
  standing version. A full read sets it. A command answer advances it only
  when the answered version is exactly the standing version plus one, or
  equal for an unchanged answer. Otherwise it stays, and the next edit opened
  from the list is refused `CATALOG_CHANGED` and rereads. An editor carries
  the standing version when it opens.
- In `presets.js`, keep a separate standing version beside `facts`, as
  `menu.js` does. Decide which of the two the facts line shows. `D:1665` says
  the most recently answered one, and `menu.js` is the precedent to align
  with.
- Either add one sentence to *DESIGN-022 additions* in `D`, saying that
  BO-07's list follows `D:1818-1823`, or have the lead widen the DESIGN-020
  clarification to cover every list-hosted editor.
- Add a `design022.cjs` walk: other tab changes a preset, this tab deactivates
  a different one, opens the changed preset, saves. Expect `CATALOG_CHANGED`,
  the current value shown beside the draft, and no write.

### F2 (low). The inventory's BO-07 *Must not invent* list drops FR-M5's negative-total invariant

**Location.** `docs/design/SCREEN-INVENTORY.md:873-875` (the second
*Must not invent* bullet, rewritten in `531b09d`).

**What is wrong.** The old bullet read "Discounts are 0–100%; a fixed
discount is capped at the subtotal; no order reaches a negative total
(FR-M5)." The new one rewords the cap so that it applies at application time,
as the task's FR-M5 ruling asks. It also drops "no order reaches a negative
total", which nothing in the task asked to remove.

**Authority.** PRD FR-M5 (`docs/PRD.md:411-412`): "a fixed discount is capped
at the subtotal; no order may reach a negative total." Task Part C item 3 asks
for changes to `I` BO-07's *States*, and the rulings ask for the cap to be
placed at application time. Neither grants removing an invariant from a
*Must not invent* list.

**Failing scenario.** A later reader of `I` BO-07 (S6b, or DESIGN-021 looking
up what a preset may do at application) no longer finds the invariant on this
screen's page. The PRD still carries it, so the risk is that it gets missed,
not that the contract is lost.

**Proposed fix.** Append the clause to the new bullet: "…not when the preset
is stored; no order reaches a negative total (FR-M5)."

### F3 (low). The fixed-amount form's installation facts have no stated source, and stay shown when the read fails

**Location.** `presets.html:30` (the static `dl.preset-money`: "IDR ·
Indonesian rupiah", "0 · amounts are whole rupiah"). The Handoff copy row
*Fixed / Installation facts* (task file line 385).

**What is wrong.** `D:1721-1726` says a read-only installation fact "comes
from the read, like any other value: it is withheld while the read is loading
or failed." The *Server facts* say the preset list read answers presets and
the catalog version, not currency or precision. ADR-012 rule 5 makes currency
and precision shared-code constants that both clients read. The drawing shows
the facts unconditionally. A walk reaches a form with a failed read and the
facts visible: edit *Service recovery* with the *Unknown; read fails*
response. The version facts are withheld there, but the currency facts are
still shown. The Handoff tells S6b neither the source nor whether `D:1725`'s
withholding applies. `item-editor.html` has the same static pattern, so this
is inherited, not introduced.

**Authority.** `D:1721-1726`, ADR-012 rule 5, ADR-011 rule 24 (the builder
copies the design and invents nothing, so the source has to be stated).

**Proposed fix.** Add one sentence to the Handoff and to *DESIGN-022
additions*. BO-07 takes the currency and precision from the shared constants
(ADR-012 rule 5), not from the preset read, so they are not withheld when
that read fails. Alternatively, withhold them with the version facts. Either
is defensible; the lead should pick one so S6b does not have to.

## 3. What I ran and what I did not

**Observed.**
- `npm run verify` at `bf38ea9`: exit 0, **142 test files, 5226 tests
  passed**. This agrees with the lead's final run.
- Tree stability: `HEAD` was `bf38ea97a82d869b548d9c9f5267e1bdc3eee675` and
  `git status --porcelain` was empty before the verify run. Both were the
  same after it and after my last read of the branch. The tree did not move
  during the review.
- `git diff --stat development...HEAD`: 16 files, all inside the task's `owns`
  (`docs/design/**`, `docs/DESIGN.md`) plus the task file. Nothing under
  `apps/`, `packages/`, `db/` or `e2e/`.
- `grep -c "prototype/"` on every changed artifact: `report-detail.html` 4,
  `office.js` 1, and 0 for `presets.html`, `presets.js`, `presets-states.js`,
  `manifest.js`, `index.html` and `P/presets.html`. These match the Handoff's
  ledger. `grep -rln "prototype/back-office/presets.html"` under
  `visual-directions/` finds only two Paper artifacts and no Frost one.
- All 15 custom properties that `presets.css` uses are defined in
  `docs/design/tokens/frost.css`. `presets.css` has no raw colour, size or
  weight.

**Read, not executed.** I read `presets.js` (whole), `presets.html`,
`presets.css`, the head of `presets-states.js`, `design022.cjs` (whole), and
the diffs of `D`, `office.js`, `report-detail.html`, `design014.cjs`,
`design019.cjs`, `index.html`, `I` and `S`. I also read the cited rules in `D`
(`D:1486-2083`), ADR-012 rules 3, 5, 10 and 13, C1 §0 and §4, PRD FR-B5,
FR-F1 to FR-F8 and FR-M5, BOUNDARIES B-21, B-22 and B-24, and DESIGN-011's
BO-07 section and its `:404` row.

**Inferred, not observed.** F1's failing scenario comes from tracing
`presets.js`. I did not run it in a browser. I made no mutation run. I did
not run `design022.cjs`, the earlier check scripts or the Impeccable detector.
The task reserves those to the lead, and the lead's note says the reviewer
cannot reach the browser. For the browser measurements, the
acceptance-criterion-4 walks and the detector ledger, I relied on the lead's
evidence (runs r1 to r3) as recorded in the task file, and checked that each
named check exists in `design022.cjs` and asserts what the Handoff says it
does.

## 4. Cleared

- **States (AC 1).** All 58 states in the Handoff are reachable through
  `presets.js`'s state branch. Every state Part A item 1 asks for is among
  them, including the three stale variants, inactive edit, partial success,
  and the session-gate and departure states. `design022.cjs:19` asserts that
  the artifact's and manifest's lists are identical.
- **Server facts.** The record shape, whole-preset edit, create and state
  commands without a version, edit with a version, and `DUPLICATE` only for
  create, active edit and reactivation all match. An inactive edit into a held
  name succeeds (`presets.js:127`). There is no `CATALOG_CHANGED` on create,
  and no audit claim.
- **Name rules.** Trim, then empty, more than 32 code points, then `\p{Cc}`.
  This covers C1 controls such as U+009B, which C1 §0 asks the database check
  to refuse. No maxlength. Case-insensitive uniqueness among active presets.
- **Percentage and money parsers.** They match `D:1700-1719` and
  `D:1887-1914` in acceptance, refusal order and exact BigInt conversion, with
  no float. Zero is accepted silently for both kinds, with a reason, as the
  lead recommended and C1 §4.1 permits. Bounds are 1,000,000 ppm and
  99.999.999. Display uses the decimal comma and dot grouping. The amount
  hint's reason (the cap applies at application time) satisfies the FR-M5
  ruling.
- **Kind switch.** Each kind keeps its own buffer, there is no conversion,
  focus goes to the newly visible field, only the selected kind is validated
  and sent, and dirty compares only the selected value. Use current clears the
  unused buffer. The rule is written as behaviour in `D` with no existing rule
  changed. One consequence follows from the rule as written: switching kind on
  an otherwise empty create form counts as dirty.
- **List order and grouping.** Active first, then inactive, with server
  (creation) order inside each group. There is no reorder control or sort by
  name. The caption states the rule, and the walk is testable.
- **Stale draft.** Save is held with a visible reason. Keep rebases without
  sending and focuses Save. Use current replaces the draft and focuses the
  name. A reread alone never rebases (`design022.cjs:57-60`). The menu-only
  case shows "The current preset has the same values as your draft." The copy
  is the same after M-6. Unknown with a newer version shows the comparison
  and says the version "may include" the save.
- **Deactivation.** It has a named confirmation, starts on Keep active, and
  Escape keeps the preset active. The copy explains the picker and existing
  orders (FR-F5) and reactivation (Q10). The final action is destructive, as
  DESIGN-011 `:404` asks. Reactivation has no confirmation. A refused
  reactivation opens the inactive preset's editor on its name, and saving
  does not reactivate it, as in the payment-method precedent. There is no
  approval gate or PIN wording anywhere (FR-F2).
- **Snapshots (FR-F4, B-8).** Standing editor copy says only discounts chosen
  afterwards change. There is no "apply to open orders" control.
- **Status commands, departure, two forms on one screen, M-6 and BO-01.**
  These follow `D:1518-1582` and `D:1728-1739`. Pending makes every opener
  inert. A late answer after Discard applies silently. A held answer is never
  taken as the departure decision. M-6 keeps the work visible and inert, and
  BO-01 closes and restores working dialogs for the same manager. A different
  manager destroys the draft. There is no `beforeunload` handler.
- **Boundaries.** There is no date, time, schedule, automatic, stacking,
  scope, approval or reorder control (B-21, B-22, FR-F7), and
  `design022.cjs:30` checks this in every state. Empty is a first-run state
  with no seed (B-24). Every person shown is named (B-13).
- **Part C.** `office.js` resolves `presets` to Frost and inserts the entry
  on Phase 1 authored rails. The `design019.cjs` rail change is the lead's
  ruling 1 and weakens nothing. The `design014.cjs` count change 5 → 4 follows
  from the report-detail link migration. Removing *permission-denied (n/a)*
  from `I` is reasoned. The sitemap's removal of `C8` from the BO-07 line
  drops a reference to FR-C8, which is about tables and has nothing to do with
  presets, so removing it is correct.
- **Accessible names.** Row actions carry the status suffix, as in the
  `tables.js` and `settings.js` precedent, which separates the fixture's
  active and inactive *Service recovery*. Two inactive presets with the same
  name would still share names. That is inherited from the precedent, so I do
  not raise it as a BO-07 finding.
