# FE-025 — POS-07: print incidents, the screen the banner has always pointed at

**Status:** Written 2026-09-25 by `lead`. This is **F4a**, the first slice of
F4. The owner asked for the F4 task and a builder on 2026-09-25.
**Source:** SCREEN-INVENTORY POS-07 (`docs/design/SCREEN-INVENTORY.md:407–445`);
SITEMAP POS-07 (`docs/design/SITEMAP.md:170–174`); the reviewed Frost artifact
`../restaurant-pos-design/docs/design/visual-directions/frost/pos/incidents.html`
(109 lines, seven states).
**Branch:** `agent/phase-0-foundations`.

**Why this screen first:** of the four POS screens still unbuilt (POS-02,
POS-05, POS-06 and POS-07), **only POS-07 has a Frost artifact.** The other
three have wireframes only, and wireframes are behavioural structure, not a
visual system. They wait for a design task. POS-07 is also the one screen the
code already routes to without building it. Three `Open incidents` banners
(`orderFixtures.ts:114`, `:125`, `:131`) point at `?state=incidents`, which
today quietly resolves to POS-03's `default`. **This slice makes that link
true.**

---

## What exists and what you build

- **Routing:** `PosRoutes.tsx` routes on the path, with no router dependency.
  `/pos/order`, `/pos/settlement` and `/pos/floor` exist, and `/pos/floor` is
  an empty-frame placeholder. The order store and the payment session live in
  `PosRoutes`, so they outlive a route change **only if the change is
  client-side**. See how Settle does it: `OrderPanel.tsx:235` and
  `SettlementScreen.tsx:673–693`.
- **The banner:** `EmergencyBanner.tsx` already exists. Its `href` action is
  an anchor, which today means a full document load and the loss of the order.
- **Incidents have no live source.** FE-022's live send yields `queued` and
  never `FAILED`, and there is no server. **Every incident on this screen is a
  fixture.** A live incident source arrives with the backend. Do not invent
  one.

## The lead's rulings

1. **POS-07 is a `[SCREEN]` at `/pos/incidents`**, routed in `PosRoutes`. Its
   fixture state is read from `?state=`: `default`, `cancel`, `empty`,
   `reprint`, `overflow`, `loading` or `error`. An unknown or missing state
   resolves to `default`. Put the fixtures in a new `incidentFixtures.ts`, with
   the artifact's copy and data verbatim.
2. **Every `Open incidents` goes to `/pos/incidents`**, replacing
   `?state=incidents`, **and navigates client-side** with a `pushState` and a
   location re-read, on Settle's pattern. It stays an `<a href>` (ruling of
   2026-09-17: it leaves the screen), and a plain click is intercepted.
   **Criterion:** from `/pos/order`, add a Fries, then open the incidents
   screen and press browser Back. The Fries is still on the order. Today it
   would be lost to the reload.
3. **The back control is the artifact's `← Floor`, to `/pos/floor`,** also
   client-side. POS-02 is still the empty frame. **Until POS-02 exists, the way
   back to a live order is browser Back.** That is honest and temporary, and
   F4 closes it. Do not add a *Back to order* control; the artifact draws
   none.
4. **Two urgency classes, never identical** (`FR-E6`, `AC-23`). The emergency
   group (kitchen work and cancellation tickets) always renders **above** the
   receipt group, in every state, whatever the fixture order. Sort in code,
   not by fixture position. The visual difference is the artifact's: a 3px ink
   border and 17px bold title, against a 1px line on `bg2`, plus the two group
   headings and their marks.
5. **A cancellation ticket is never a fire** (`B-16`, `FR-H4`). Its card, its
   button (*Reprint cancellation*) and its result wording never say *send*,
   *kitchen again* or *order*, except in the artifact's own sentence *"it is a
   cancellation, never a new order"*. Add a test that reads the card's text
   for those words.
6. **Reprint is per incident, never shared.** The artifact makes every Reprint
   an anchor to `?state=reprint`, which draws its result on **Table 1 round
   2's** card. So *Reprint receipt* would show a kitchen-ticket result. That is
   the shared-control defect this project keeps paying for (FE-021's lesson).
   Therefore:
   - `?state=reprint` is a fixture state. It draws exactly what the artifact
     draws, including *"Reprint sent — printed at 20:03"*, because it pictures
     a server's answer.
   - **A live Reprint press is a `<button>`** that marks **that incident only**
     as reprinted, in screen-local state (no URL change, no history entry).
     The pressed card shows the notice title **`Reprint sent`**, and nothing
     after it. With no printer, *"printed at …"* would be a false claim, which
     is ARCH-002's rule (a live round is `queued`, never `printed`). Kitchen
     and cancellation cards also show the artifact's second line, *"Check the
     kitchen has the paper before clearing this."* A receipt card shows the
     title only. **No other copy.**
   - The incident **stays listed** after a reprint (`FR-E3`: persistent until
     acted on). The artifact draws no *clear* control. **Do not add one**, and
     list it in the handoff as a design question.
7. **Printing never blocks** (`B-15`). Nothing on this screen is modal or
   locks navigation. The back control is live in every state, including
   `loading` and `error`.
8. **`error`'s *Retry*** is a button that returns to `default`, using
   `replaceState`, not a push. It is a fixture: there is nothing to retry
   against.
9. **The scroll.** The artifact's body is `overflow:hidden`. In `overflow` at
   1280×800 that would clip incidents. **The list scrolls**, and every Reprint
   in `overflow` must be reachable. Measure it in a browser and report the
   numbers.
10. **Styling:** port the artifact's look into `pos.css` with registry tokens
    only, as previous slices did. Replace the artifact's inline styles with
    classes. Reuse the POS bar (actor and idle) that the other screens draw.
    Do not build a second one.

## Acceptance criteria

1. **Seven states render as the artifact draws them,** at `/pos/incidents?state=<id>`,
   checked by a table test that covers each state's cards, titles, status
   words and buttons. Unknown state resolves to `default`.
2. **Class order:** every state that has both classes draws the emergency
   group first in the DOM. **Red case:** reverse the fixture array, and the
   test still passes because the code sorts. Remove the sort, and it fails.
3. **Per-incident reprint:** in `overflow`, press *Reprint receipt* on the
   Counter receipt. Only that card shows `Reprint sent`, with no kitchen
   sentence. Then press the Table 9 kitchen card, and it shows both lines. The
   URL and history length are unchanged, and every incident is still listed.
   **Red case:** key the reprinted state by something shared (a single
   boolean), and the test fails.
4. **No false print claim:** no live press produces the text *printed at*.
5. **B-16 wording test** on the cancellation card and its result (ruling 5).
6. **Client-side navigation** (ruling 2): `Open incidents` from `fireerror`
   pushes `/pos/incidents` without a document load, the order store survives
   it and a `popstate` back, and the old `?state=incidents` href is gone
   everywhere.
7. **Nothing blocks** (ruling 7): `← Floor` is a live link in all seven
   states.
8. **Accessibility:** each card's Reprint button has an accessible name that
   says which incident it reprints, for example with `aria-describedby` on the
   card's title line. Seven identical *Reprint ticket* names in `overflow`
   would be unusable. Use existing text only; do not add visible copy. There is
   no `disabled` attribute anywhere (FE-024's rule).
9. **Existing tests:** only these are expected to change, because they pin the
   placeholder. Name each change in the handoff:
   - `apps/pos/test/order-panel.test.tsx:179`, `?state=incidents` resolving to
     `default`;
   - `apps/pos/test/fire.test.tsx:554`, the href;
   - `apps/pos/test/fire.test.tsx:827`, if its assertion is the href.
   Anything else that changes, stop and ask.
10. `npm run verify` is green, with counts stated. The handoff names the
    command and URL for the owner's browser review (`npm run dev` or the
    project's equivalent, and `/pos/incidents?state=overflow`).

## Do NOT

- Build POS-02, POS-05 or POS-06, or give `/pos/floor` any content. An agent
  that starts a second screen has ended its task.
- Invent an incident source, a *clear* control, or any copy beyond the rulings
  above.
- Add the emergency banner to this screen. The artifact does not draw it here.
- Touch `docs/`, `.agent/MEMORY.md` or `.agent/ROADMAP.md`.

## Reporting

Commit nothing. Append a handoff below, covering: the counts, the red cases
run, the tests changed, the overflow scroll measurement, and any design
questions. Then run
`herdr agent prompt lead "<your name>: FE-025 done — <tests> tests, <one line>"`.
If you are blocked, run
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

### builder27 — 2026-09-25

**Counts:** `npm run verify` green: **2135 tests / 28 files** (baseline 2085 / 27; +50, all in new `apps/pos/test/incidents.test.tsx`). Nothing committed.

**Built:** `/pos/incidents` (POS-07) in `PosRoutes`; `incidentFixtures.ts` (artifact copy verbatim), `IncidentsScreen.tsx`, `navigation.ts` (`followClientSide`, plain click → pushState + popstate); `EmergencyBanner` anchors follow client-side; the three `Open incidents` hrefs are `/pos/incidents`; POS-07 CSS in `pos.css`, registry tokens only. POS bar reuses `settlement-bar/-actor/-idle/-back`. Emergency group sorted in code (`groupIncidents`). Per-incident reprint is a `Set` of ids in screen state. Retry `replaceState`s to default. Dev fixture-state links sit outside the frame, as other screens do.

**Red cases run (each mutation made, test failed, restored):** (1) no sort/grouping → 4 class-order tests fail; (2) shared "any reprinted" flag → per-incident test fails; (3) live title `… printed at 20:03` → 4 fail (per-incident, fixture leak, no-false-print, B-16); (4) cancellation note "Send it to the kitchen again" → B-16 test fails; (5) banner href reverted to `?state=incidents` → 2 navigation tests fail.

**Existing tests changed:**
- `fire.test.tsx:554` → href `/pos/incidents`.
- `fire.test.tsx:827` → asserts the href is `/pos/incidents`.
- `order-panel.test.tsx:179` → assertion unchanged (still resolves to `default`, still true); only the stale comment edited.

**Overflow scroll (Chrome, 1280×800 device, `?state=overflow`):** `.incidents` is `overflow-y:auto`, clientHeight 736, scrollHeight 736 — five incidents **fit without scrolling**; last Reprint bottom at y=731 of 800, all five reachable (bottoms 214/362/511/649/731). Scroll is the safety net for a sixth.

**Owner's review:** `npm run dev -w apps/pos` (or `cd apps/pos && npx vite`), then `/pos/incidents?state=overflow`; also `/pos/order?state=fireerror` → *Open incidents* → browser Back.

**Design questions / notes:**
1. No *clear* control (FR-E3): incidents stay after reprint; the artifact draws none.
2. Registry has no 3px border or 700 weight: emergency card uses `--frost-space-1` (4px) ink border and `semibold`. Needs tokens or a ruling.
3. B-16 test reads "send" as the verb: the mandated title `Reprint sent` and the artifact's own "work already sent" contain "sent"; they are allowed.
4. Reprint button accessible description = title + meta ids (`aria-describedby`); receipts have the title only, since their one line names the table.
5. `role="status"` added on the reprint result notice (no new copy).
6. Until POS-02 exists, `← Floor` lands on the empty frame; way back to an order is browser Back.
7. `.agent/MEMORY.md` and `ROADMAP.md` showed as modified before I started; untouched by me.
