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
