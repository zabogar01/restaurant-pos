# FE-028 — POS-07: clear a kitchen incident, dismiss a receipt, and say only what is known

**Status:** Written 2026-09-25 by `lead`. This is **F4d**. The owner asked for
it on 2026-09-25.
**Source:** DESIGN-008 Part B, accepted and committed (`016a669`). The artifact
is `../restaurant-pos-design/docs/design/visual-directions/frost/pos/incidents.html`,
and the DESIGN-008 handoff is its rationale. It builds on FE-025
(`IncidentsScreen.tsx`, `incidentFixtures.ts`).
**Owner ruling, 2026-09-25:** clearing a kitchen incident is **not audited**,
and neither is dismissing a receipt. `FR-J3` does not list either, so there is
no audit event.
**Branch:** `agent/phase-0-foundations`.

---

## What changes

1. **Clearing a kitchen incident** (kitchen work and cancellation cards). Put
   a recovery row below each card's reprint row, as the artifact draws it:
   - a checkbox with the artifact's label, *I checked: the kitchen has this
     ticket.* (a cancellation card says *this cancellation.*);
   - a ***Clear incident*** button.

   Clear is **off until that card's box is checked**, following FE-024's rule:
   a `<button type="button" aria-disabled="true">`, never `disabled`, with
   activation doing nothing, and `aria-describedby` pointing at that card's
   own checkbox label (the artifact's `clear-reason-*`). Once checked, Clear
   removes **that card only**. **Reprint alone never clears** (`FR-E3`:
   persistent until acted on).
2. **Dismissing a receipt:** a smaller ***Dismiss*** beside each receipt's
   Reprint. It is always live, needs no check, and removes that receipt card.
   This is the lower urgency class (`FR-E6`, `AC-23`), and the difference is
   the point.
3. **Clearing is screen-local state**, keyed by incident id, like FE-025's
   reprinted set: no URL, no history, no audit. When every incident is gone,
   the screen draws `empty`'s composition.
4. **Copy, verbatim from the artifact:**
   - the kitchen group heading note becomes **"Check delivery with the
     kitchen"**, because an UNKNOWN delivery cannot truthfully claim the
     kitchen has not seen the work;
   - `empty`'s line becomes **"No unresolved print incidents."**, because
     clearing is not proof of printing;
   - the Counter UNKNOWN receipt gains **"Delivery is UNKNOWN. Check the
     printer before reprinting."**
5. **Fixture states follow the artifact.**
   - `reprint` now draws the dispatch-only result, *Reprint sent* plus the
     kitchen line, **with no time**.
   - A new **`reprint-printed`** is the one state that pictures a server's
     answer: **"Server confirmed: printed at 20:03"**.
   - Add `reprint-cancel`, `reprint-receipt`, `reprint-table9` and
     `reprint-counter`. Each draws its result on **its own card**, following
     the artifact's `result` map.
6. **Tokens:** the artifact settled the token question. The emergency card
   uses the `--frost-space-1` border and a `semibold` title, which FE-025
   already uses. There are no new tokens. Map the artifact's new classes
   (`incident-recovery`, `receipt-actions`, `incident-dismiss`,
   `incident-status`) into `pos.css` with registry tokens only.

**Unchanged:** the POS-03 emergency banner's *"The kitchen has not seen this
work."* It is a FAILED banner, and DESIGN-008 did not change it.

## Existing tests expected to change (named in advance)

These pin the copy or the fixture this task replaces. **Change only these; any
other change, stop and ask.**
- `apps/pos/test/incidents.test.tsx:106`, *Every ticket and receipt has
  printed.*
- `:125`, the `reprint` result *Reprint sent — printed at 20:03…*
- `:155`, the heading *The kitchen has not seen this work*
- `:198`, `reprint` contains *printed at 20:03*. Move this assertion to
  `reprint-printed`.

Also re-run FE-025's *"no live press produces printed at"* test unmodified. It
must still pass.

## Acceptance criteria

1. **Per-card clear:** in `overflow`, check Table 9's box. Only Table 9's Clear
   goes live, and pressing it removes only Table 9. **Red case:** key the
   checked state by one shared boolean, and the test fails.
2. **Off Clear follows the rule:** a focusable button with
   `aria-disabled="true"`, no `disabled` attribute, and click, Enter and Space
   doing nothing, described by its own label.
3. **Reprint never clears.** Reprint, and the card is still listed.
4. **Dismiss removes one receipt**, needs no check, and leaves the kitchen
   cards untouched.
5. **Clearing everything reaches the empty composition**, with the new copy.
6. **B-16 still holds** on the cancellation card, recovery row included.
   Re-run FE-025's wording test.
7. **The fixture table:** every state, old and new, draws what the artifact
   draws. Each `reprint-*` result is on its own card, and only
   `reprint-printed` says *printed at*.
8. Only the four named tests change. `npm run verify` is green, with counts
   stated.
9. At 1280×800, `overflow` with every recovery row still lets the list scroll
   to the last receipt. State how you measured.

## Do NOT

- Add an audit event or any audit copy.
- Change the POS-03 banner, or any screen other than POS-07.
- Touch `docs/`, `.agent/MEMORY.md` or `.agent/ROADMAP.md`.

## Reporting

Commit nothing. Append a handoff below. Then run
`herdr agent prompt lead "<your name>: FE-028 done — <tests> tests, <one line>"`.
If you are blocked, run
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

### builder30 — 2026-09-25

**Counts:** `npm run verify` green: **2253 tests / 32 files** (baseline 2224 / 32; +29, all in `apps/pos/test/incidents.test.tsx`). Typecheck clean. Nothing committed.

**Built:** per-card Clear (checkbox + `aria-disabled` button, described by its own `clear-reason-<id>` label, off until that card's box is checked); Dismiss beside each receipt's Reprint (always live); screen-local `checked`/`cleared` sets keyed by incident id; empty composition once every incident is gone (loading/error excluded); the `incident-status` live line; copy: *Check delivery with the kitchen*, *No unresolved print incidents.*, Counter *Delivery is UNKNOWN. Check the printer before reprinting.*; twelve fixture states in the artifact's order, each `reprint-*` result on its own card, only `reprint-printed` says *Server confirmed: printed at 20:03*; `pos.css` classes `incident-recovery`, `incident-clear`, `receipt-actions`, `incident-dismiss`, `incident-status`, registry tokens only (no new tokens). POS-03 banner untouched.

**Red cases run (mutation made, tests failed, restored):** (1) one shared checked flag → per-card + empty-path tests fail; (2) `disabled` instead of `aria-disabled` → 12 fail; (3) Reprint also clears → 5 fail; (4) Clear ignores the check → 2 fail; (5) empty drawn on loading/error → 1 fails; (6) Dismiss does nothing → 2 fail.

**Existing tests changed (`apps/pos/test/incidents.test.tsx`):**
- The four named: empty copy (*Every ticket…* → *No unresolved print incidents.*); `reprint` result (now *Reprint sent* + kitchen line, no time); group heading note (*Check delivery with the kitchen*); the `reprint` leak test (`printed at 20:03` assertion → `not.toContain('printed at')`, moved to `reprint-printed` in the new fixture-table tests).
- Lead-approved (a)–(d): the `it.each` fixture table (Reprint selector narrowed to `.incident__reprint`, plus an exact per-card control set: kitchen/cancellation = [Reprint, checkbox, Clear incident], receipt = [Reprint, Dismiss]); the live-press test (`.incident__reprint` count); the overflow accessible-names test (`.incident__reprint`); the state-list test (exactly the artifact's twelve ids, in order). Also: TABLE gained the five new states, and the `reprintButton` helper targets `.incident__reprint`.
- FE-025's *"no live press produces printed at"* and B-16 wording tests: unmodified, still pass.

**Overflow scroll (Chrome, window 1280×800, `?state=overflow`, all five recovery rows):** `.incidents` `overflow-y:auto`, clientHeight 736, scrollHeight 922, so it scrolls 186px; after scrolling to the end the last Reprint's bottom is at y=725 of a 800 list bottom, fully visible. Measured by `getBoundingClientRect` in the live page. (Viewport was 1920×929 outside the device frame; the frame itself is 800 tall.)

**Notes / design questions:**
1. The artifact's `incident-status` line is drawn (*Kitchen incident cleared.* / *Receipt warning dismissed.* / *Nothing outstanding — no unresolved print incidents.*); the task did not list its copy, only the class. Drop it if unwanted.
2. Dismiss carries `aria-describedby` to the receipt title so seven identical names stay distinguishable.
3. `.agent/MEMORY.md` and `ROADMAP.md` were already modified before I started; untouched by me.
