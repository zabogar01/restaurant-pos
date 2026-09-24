# FE-024 — POS: every off action stays reachable and says why

**Status:** Written 2026-09-24 by `lead`. Unassigned. **Starts after FE-023
lands**, because both touch `MenuRegion.tsx`.
**Source:** POS-03 question 7. The owner delegated it to the lead on
2026-09-24, and the lead's ruling below generalises DESIGN-006's rule for
Close (`restaurant-pos-design/.agent/tasks/DESIGN-006-settlement-corrections.md:231–233`):
*"inert Close with its own name and `aria-describedby="pending-notice"`;
focusable button role lets a keyboard/screen-reader user reach the
description."* MEMORY's F2h note flagged the gap: *"`aria-describedby` on a
`<span aria-disabled>` is browse-mode only, not Tab-reachable … a question
about every `action--off`."*
**Branch:** `agent/phase-0-foundations`.

---

## The rule

An action that is off right now is still an action:

1. It is a `<button type="button">` with **`aria-disabled="true"`**.
2. It is **never** a `<span>` or `<div>`, and it **never** carries the
   `disabled` attribute. Either of those removes it from the tab order, so a
   keyboard or screen-reader user never learns it exists.
3. **Activation does nothing.** A click, Enter or Space leaves the URL, the
   history, the store and focus unchanged. Guard the handler, not only the
   styling.
4. **If a visible reason exists, `aria-describedby` points at it.** Examples:
   - the 86 tag;
   - the pending notice;
   - the fire refusal;
   - the stepper's bound copy (*Minimum 1…*, *Maximum 99…*).

   **Where the screen draws no reason, add none.** Do not invent copy.
5. It keeps its off styling and gains a visible focus ring. Use registry
   tokens only.

## Where (from `grep`, 2026-09-24; re-run it, and cover anything missed)

- `Sheets.tsx`:
  - stepper − and + (`:110`, `:123`), which use `disabled`;
  - *Update to n* (`:330`), which uses `disabled`;
  - the 86'd sheet's *Add to order* (`:190`), a span.
- `OrderPanel.tsx:828`: the close bar's off action, *Send to kitchen* in its
  off states.
- `VoidSheets.tsx:120`: a span.
- `MenuRegion.tsx:180`: the 86'd tile, a `div`. It becomes a button that
  describes itself by its 86 tag.
- `SettlementScreen.tsx`:
  - `:912`, the off *Add* tender;
  - `:947` and `:956`, the off Close.

  Check each against the DESIGN-006 pattern already in use there. It may
  already be half-built.
- `PinPad.tsx:120`: *Continue*. Check that it matches the rule.

**Out of scope:** the lock and loading states, where the rail and grid are
*absent*, not off (AC-21, AC-29). An absent control stays absent.

## Acceptance criteria

1. **A table test over every off action above**, in the state where it is off,
   checks four things: it is a `button`; `aria-disabled="true"`; no `disabled`
   attribute; `tabIndex` is not `-1`.
2. **Activation does nothing**, for each one. Click it, then press Enter and
   Space on it. The URL, the history length, the store's order and the
   pressed-state are all unchanged. **Red case:** remove one handler guard and
   watch that row fail.
3. **`aria-describedby` resolves** to an element that exists and whose text is
   the visible reason. Checked wherever a reason is drawn.
4. **Walk every `ORDER_STATES` id, and the settlement states.** No element
   anywhere carries `disabled` or has `aria-disabled` on a non-button. That is
   the generalised rule, so the next off action cannot slip past it.
5. The existing tests pass. Tests that assert *"a span, not a control"*, or the
   `disabled` attribute, may change. Name each one. The tab order is now
   larger, so any test counting tab stops changes too. Name those as well.
6. `npm run verify` is green, with the counts stated.

## Do NOT

- Change which actions are off, or when. This task changes only what an off
  action *is*.
- Invent reason copy.
- Make an absent control present.

## Reporting

Commit nothing. Append a handoff below, then run
`herdr agent prompt lead "<your name>: FE-024 done — <tests> tests, <one line>"`.
If you are blocked, run
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

### builder26 — 2026-09-24 — done

`npm run verify` green: typecheck clean, **2070 tests in 27 files** (baseline
1921 in 26; +149 from the new `apps/pos/test/off-actions.test.tsx`). Nothing
committed. Did not touch MEMORY.md, ROADMAP.md or docs/.

**Red first.** New file run before any source change: 80 of 147 failed. Red case
for criterion 2: deleted the `if (!changed) return;` guard on *Update to n*;
the `does nothing on click, Enter or Space` row for it failed (the press
navigated back); guard restored.

**Every off action is now a `<button type="button" aria-disabled="true">`, no
`disabled`, a guarded no-op `onClick`:**
- `Sheets.tsx`: stepper − / + (guarded; describe `#sheet-bound`, the *Minimum 1…* /
  *Maximum 99…* copy, only while at that bound); *Update to n* (guarded, no
  reason drawn → none added); 86'd *Add to order* (describes the sheet's
  `#sheet-unavailable` notice).
- `OrderPanel.tsx`: close-bar off actions (locked, empty, fire refused). The fire
  refusal keeps `aria-describedby` → `#fire-refusal`.
- `VoidSheets.tsx`: off Continue (no reason drawn → none).
- `MenuRegion.tsx`: 86'd tile div → button; describes itself by its 86 tag
  (`#tag-86-<item>`). Inner divs became spans (phrasing content in a button).
- `SettlementScreen.tsx`: off *Add* tender; off Close (*Closing…* and
  balance-outstanding) — the pending Close was already pointing at
  `#close-pending-notice`. Add now describes whichever of
  `#tender-field-message`, `#tender-refusal-notice`, `#tender-help` is drawn
  (ids added to those elements; only present ones are listed).
- `PinPad.tsx`: was already a guarded aria-disabled button; gained optional
  `continueDescribedBy`, wired to the cooldown notice in `App.tsx`
  (`#lock-notice`) and `Approval.tsx` (`#approval-notice`) — both notices are
  drawn, so both now resolve.
- `SettlementScreen.tsx`: `SETTLEMENT_STATES` now `export`ed (test walk only).

**CSS (`pos.css`), tokens unchanged.** Off buttons must not pick up pressed ring,
hover fill or pointer cursor: the element-qualified rules for `button.menu-tile`,
`button.action`, `button.action--primary`, `button.tender-add`,
`button.settlement-close__action` gained `:not([aria-disabled="true"])`. Focus
ring is the existing global `:focus-visible`; off styling classes untouched.

**Criterion 4 (derived, not a hand list).** Walks every `ORDER_STATES` id, every
`SETTLEMENT_STATES` entry and every `LOCK_STATES` id; per state it fails on any
`[disabled]`, any `[aria-disabled]` on a non-button, and any element whose class
matches `--off` / `-disabled` that is not a button with `aria-disabled="true"`
and `tabIndex !== -1`. A new off action with a new `--off` class is caught.

**Criteria 1–3 table** (16 rows × 3 assertions): stepper − at 1 (item + line
sheet), + at 99, Update to n, 86'd Add, 86'd tile, Send (fire refused, locked),
void Continue, Add tender (nothing left), Close (pending, balance outstanding,
closing), both cooldown Continues. Activation compared by snapshot of URL,
history length, full drawn DOM (store + pressed state), and focus.

**Existing tests changed (criterion 5), all because an off action is now a button:**
- `SPAN`→`BUTTON` tagName expectations: fire.test.tsx (7: :211 :246 :304 :389 :611
  :651 :666), one-press-fire.test.tsx (:107 :134 :177 :232 :257 :329 :483 :508
  :537), void.test.tsx (:378 :730), own-items.test.tsx (:379 :383 :388 :439),
  sheets.test.tsx (:468), settlement.test.tsx (:162 :263 :292 :340 :411 :434
  :445 :495 :512 :595 :635 :675 :707 :756 :773 :843), order-store.test.tsx (:272).
- one-press-fire.test.tsx :99 — asserted `live ? BUTTON : SPAN`; now BUTTON plus
  `aria-disabled === 'true'` equals `!live`. :244 — "live Send" now means
  not aria-disabled (it used tagName).
- settlement.test.tsx table (:185–:189) — fourth column was a tag, now a boolean
  "close is off"; asserts BUTTON + aria-disabled.
- `disabled` attribute → `aria-disabled` + no `disabled`: own-items.test.tsx
  (:215, :217-area `update().disabled`, :235, :250, :263).
- "no tab stop / not a control" → inert but focusable button: menu-region.test.tsx
  :166 (Steak), :193 (grid never reflows, now also asserts aria-disabled on every
  off tile), menu-categories.test.tsx :189, sheets.test.tsx :466 (86'd Add).
- Tab-stop / live-control counts (the off actions now count as tab stops, so
  they are excluded by `:not([aria-disabled="true"])`): fire.test.tsx :213 :427
  :598, order-panel.test.tsx :330 :385, settlement.test.tsx :844,
  menu-region.test.tsx :298 (lock route-out), sheets.test.tsx `liveControls`.
- CSS pins: menu-region.test.tsx :395 and sheets.test.tsx :589–591 expect the
  new `:not([aria-disabled="true"])` selectors.

**Not changed / for the lead.**
- No reason copy invented; where the screen draws none (Update to n, void
  Continue, Add tender "nothing left", Close balance-outstanding / closing),
  `aria-describedby` is absent and the table asserts absence.
- Stale prose remains in a few source comments/test titles saying an off Add /
  86'd tile is "a span/div" (`Sheets.tsx:143`, `pos.css` pressed-rule comments,
  `MenuRegion` tests' describe names). Behaviour is right; comment sweep is a
  follow-up if wanted.
- Not run in a real browser: focus-ring visibility on off buttons rests on the
  global `:focus-visible` rule and jsdom cannot show it.

### Round 2 — builder26 — done

`npm run verify` green: typecheck clean, **2085 tests in 27 files** (round 1: 2070). Nothing committed.

1. **`liveControls` split** in `sheets.test.tsx`: `tabStops()` keeps aria-disabled buttons (modality test, `type="button"` check); `pressable()` excludes them (`destinations()`, the 86'd-Add check). New unit test pins the difference. Red case: replaced `inert` with `{}` in `OrderPanel.tsx`; modality, destinations and the inert-behind-the-scrim tests all fail. **Caveat:** no fixture state has only off controls outside the sheet (live tiles are always there), so that mutation is also caught by live controls; the exact case is pinned by the unit test, not by a state.
2. **Enter/Space** row retitled: "does nothing on click, and no key handler acts on Enter or Space" (comment says native activation is the click). **Lock Continue** row now keys `1` first. Mutation: removed `if (continueDisabled) return;` in `PinPad.tsx`; the lock row and the approval row both failed. Guard restored.
3. Walk comment now says off states reached only by pressing are the table's job.
4. **Off Add** describes itself only by `#tender-field-message` / `#tender-refusal-notice`. `TENDER_HELP_ID` and the caption's id removed. Test per settlement state: `aria-describedby` equals exactly the drawn subset, never the help; plus a non-vacuity check that some state has a reason.
5. **`reason: ''` rows** replaced with real text (`Sign-in locked`, `Manager approvals locked`). New rows (each with all three checks): Send off in empty, `lock-lease`, `fireblocked-overflow`; Settle off in `lock-draft` and empty. **Deviation:** the `overflow` fixture's Send is *live* (it has pending lines), so a row there is wrong; I used `fireblocked-overflow`, the overflow state where Send is off. Not changing which actions are off.
6. Stale span/div comments fixed in `Sheets.tsx`, `pos.css` (3), `menu-region.test.tsx`; `SettlementScreen.tsx` caption indent fixed.
