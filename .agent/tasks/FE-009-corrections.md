# FE-009 — Four corrections to committed work (F2e)

**Status:** Done 2026-09-18, lead-verified.
**Roadmap item:** F2e
**Branch:** `agent/phase-0-foundations`
**Assigned:** `builder11`

---

## What this slice is, and why it is one job

Four corrections to work that is already committed and reviewed. They are one
task because **the fourth needs the first**.

This is the only slice so far that changes existing behaviour rather than adding
a screen. **The 753 existing tests are your safety net**, and several of them
exist precisely to catch what a careless refactor here would break.

### 1. The panel offers to void the wrong line — the reason this is urgent

**Every fired row body links to `?state=sheet-voidline`, which is one fixture's
sheet. Tapping Soda offers to void the Burger.** *Void order* always links to
`?state=sheet-voidorder`, so from a state holding fired work it lands on a
different order and the panel changes under the cashier.

Behind a real command, that is **a cancellation ticket for work nobody asked to
cancel.** `B-16` exists because paper cannot be un-printed. The Frost artifact
does the same thing, so this was inherited rather than introduced — and it is
still wrong.

**The fix:** the row body and *Void order* open the void sheet **as component
state, over the current line and the current order**. `VoidSheets.tsx` and
`void.ts` already take a target; they were built that way in F2j.

### 2. Acting controls become `<button>`

**Ruled 2026-09-17.** Anything that acts on the order is a `<button>`; an anchor
is for leaving the screen. F2a and F2b built acting controls as anchors because
the Frost fixtures are static HTML that moves by URL — **fixture plumbing must
not set the app's semantics**.

In scope: menu tiles, categories, order-line bodies, the remove control, the
close-bar actions (Discount, Void order, Send to kitchen, Settle).

**Stays an anchor:** the lock notices' route out (*Back to payment*, *Manager:
take over payment*). Those genuinely leave for another screen.

This is also what makes correction 1 possible, and what makes
focused-and-pressed verifiable — Space activates a button, and F2i proved the
check works once a control is one.

### 3. `role="alert"` on both PIN pads' failure notices

`builder8` left it out because neither pad had one and the two should agree.
Right reasoning; the lead ruled the other way. **A wrong PIN that is never
announced is a real defect** for a screen-reader user. Both pads, same
treatment.

### 4. F2c's sheets replace history rather than pushing it

SITEMAP §1's table gives `[SHEET]` **Route: No, Back-stackable: No**. F2c's
sheets push; F2i's and F2j's replace. **The lead accepted the pushing version
and was wrong.** Make F2c's match: Back must never re-open a sheet.

---

## What must not change

**Everything else.** This slice fixes four things and preserves the rest exactly.
In particular:

- **`I-12` still holds.** The trailing slot stays a sibling of the tap target,
  a FIRED row's slot stays empty, a PENDING row keeps its remove control, and
  under either settlement lock no row is a control and every slot is empty. The
  guard test with its detector self-tests is already there — **do not weaken it
  to accommodate a `<button>`.** If it needs to recognise a new element type,
  that is a change to what it *looks for*, never to what it *asserts*.
- **The pressed ring still draws, and still clears the trailing slot.**
  `order-line-ring.test.ts` reads the rule for `a.order-line__target:active`
  out of `pos.css`. **Converting the element means that selector changes, and
  the test must follow it** — update the test to read the new selector, never to
  stop checking. The offset must still be inside the row padding and short of
  the gap.
- **The reachability guard still passes.** No ungated state may reach a gated
  one, and the guard's own detector self-tests must still prove it can see a
  live control and ignore an inert one.
- **`B-12` still holds on both pads**, byte-identical output for different PINs.
- **No hover outside `@media (hover: hover)`.** No invented values. No
  `Number()` on money. No console, storage or fetch.
- **The lock states stay inert**, and the route out stays the only control on
  the frame.

---

## Required inputs

1. **`.agent/tasks/FE-008-void-family.md`** — read the handoff's findings A and
   B and the lead's rulings. Finding B is correction 1.
2. **`.agent/tasks/FE-003-order-panel.md`** and
   **`FE-004-menu-region.md`** — what you are changing, and why it was built
   that way.
3. **`docs/design/SITEMAP.md` §1**, in the worktree at
   `../restaurant-pos-design` — the node-type table behind correction 4.
4. **`apps/pos/src/`** and all of `apps/pos/test/`.

---

## Acceptance criteria

1. **Tapping a fired row opens the void sheet for *that* line**, and *Void
   order* opens it for the order on screen. Tested — including that two
   different fired rows open two different targets, which is the defect.
2. Every acting control named above is a `<button type="button">`; the lock
   notices' route out is still an `<a>`. Tested.
3. Both PIN pads' failure notices carry `role="alert"`. Tested.
4. Back never re-opens a sheet, in any family. Tested.
5. **All 753 existing tests still pass**, with no test deleted or weakened. If a
   test must change to follow a renamed selector or element, say exactly which
   and why in your handoff.
6. **Verify focused-and-pressed in a browser** on a converted control — Tab to
   it, hold Space, confirm both the focus ring and the pressed ring draw. This
   is the check two slices could not do and one could; it should now work
   everywhere.
7. `npm run verify` passes. FE-008 left 753 tests across 17 files; state the new
   count. Typecheck clean.

---

## Out of scope

- `error`, `fireerror`, `fireblocked`, the 86'd line in the panel — F2h.
- `quick`, `quick-line` — F2d.
- **Focus trapping and the stacked scrims.** Both are carried findings from
  FE-005, FE-007 and FE-008. They are real and they are not this slice —
  mention them in your handoff if you touch anything near them.
- Any new screen, state, or fixture.

---

## Handoff

Name the command, the URL, and what you changed in each of the four
corrections. **List every test you modified and why** — this slice touches
reviewed work, so a weakened test is the thing most worth catching.

**Raise judgement calls rather than taking them.** Seven consecutive slices have
found this lead's task files wrong where a reviewed document was right. Where
this file disagrees with the PRD, BOUNDARIES.md or SITEMAP, **those win and this
file is the defect**.

The lead verifies with `git log`, a browser, and by injecting the defect your
tests claim to catch — including, this time, by checking that the tests which
already existed still fail when they should.

### 2026-09-18 — implementer (claude, Opus 5)

**All four corrections are done.** **`npm run verify`: 17 files, 853 tests
passed**, up from 17 and 753. Typecheck is clean. No test was deleted. One test
was **replaced by stronger ones**, and it is named under *Tests modified*. Every
changed assertion is listed there with its reason.

**Nothing is committed.** The working tree is on `agent/phase-0-foundations`.
Eleven source files and seven test files are modified; none are new.
`.agent/MEMORY.md`, `.agent/ROADMAP.md`, the contract documents, the registry
and `frost-states.css` are untouched.

#### What the owner opens

```
npm run dev -w apps/pos     # http://127.0.0.1:5173/pos/order?state=default
```

- **Tap Soda.** The void sheet shows the card *Soda 30.000*, and the URL stays
  `?state=default`. Tap Burger and the card shows *Burger 135.000*.
- **Open `?state=overflow` and tap Chicken Wings, then Void order.** Each sheet
  opens over *that* order. Void order shows 1.244.250 and "6 lines have already
  been sent to the kitchen". Keep order leaves you on `overflow`.
- **Open any sheet, close it, then press the browser's Back.** You leave the
  screen, and no sheet comes back.
- **Open `/pos/?state=error` or `/pos/order?state=approval-error`.** The notice
  is now `role="alert"`.

The Vite server on 5173 was already running (pid 31567, not mine). I used it
and left it running.

#### Correction 1 — the void paths carry the actual line and order

- `OrderScreen` holds a new piece of component state, `voidOpened`. It is the
  target the panel was tapped for: `{kind:'line', lineId}` or `{kind:'order'}`.
- `panelVoid(target, view)` in `voidFixtures.ts` builds the sheet's fixture from
  that target and the view on screen. Its opener is that exact row
  (`lineBody(id)`) or Void order.
- `VoidSheet`, `void.ts` and `subjectOf` are **unchanged**. They already took a
  target and the order beside them.
- Opening writes no URL and no history entry. The background goes inert, as it
  does for every sheet.
- The `?state=sheet-void*` fixture states still work for review, exactly as
  before.
- Rows now carry `data-line-id`, and close-bar buttons carry `data-action`.
  Openers are selectors, so they needed a stable hook that is not an `href`.
- `VOID_LINE_HREF` is gone. `EDIT_LINE_HREF` became `EDIT_LINE_SEARCH`, and
  `ITEM_HREF` / `categoryHref` became `ITEM_SEARCH` / `categorySearch`: none of
  them is an `href` any more.

#### Correction 2 — acting controls are `<button type="button">`

- **Converted:** tiles, categories, order-line bodies, the remove control, and
  all four close-bar actions.
- **Still an `<a>`:** the lock notices' *Back to payment* and *Manager: take
  over payment*. The one test that asserts this runs over all 24 states: every
  anchor on the frame is a route out.
- **Markup:** content inside a button is now `<span>`, not `<div>`, because a
  button takes phrasing content only. `.order-line__name` and `__detail` gained
  `display: block`.
- **CSS:** button resets live in element-qualified rules (`button.order-line__target`,
  `button.menu-tile`), so the 86'd tile and the locked row div gain nothing.
  Every `a.X:active`, `:focus-visible:active` and `:hover` rule became
  `button.X`. `a.action` is kept, because the route out still uses it. The
  close bar picks up F2c's existing `button.action` rules.
- **Measured in Chrome, not assumed:** I read every element's box, colour, font
  size and weight, alignment and cursor on the frame, in 8 states, before
  (stash) and after. **Every position and size is identical.** The only diffs
  are the tag name (DIV→SPAN) and `text-align` on the icon-only remove button.

#### Correction 3 — `role="alert"`

- `Notice` gains `failure?: true`, and both pads render
  `role={failure ? 'alert' : undefined}`. Same treatment, one mechanism.
- **Lock screen:** `error`, `permission-denied`, `throttled`.
- **Approval:** `approval-error`, `approval-throttled`, `approval-denied`.
- `invalidated` and `draft` are **not** alerts. See call 5.
- The B-12 byte-identical tests still pass on both pads.

#### Correction 4 — Back never re-opens a sheet

`OrderScreen.navigate` **replaces** the history entry when a sheet or prompt is
open *or* about to open, and pushes otherwise. That is SITEMAP §1: `[SHEET]` and
`[MODAL]` are Route No, Back-stackable No. It covers every family, not only
F2c. See the first task-file defect below.

#### Acceptance criteria

1. **Tested.**
   - `void.test.tsx`: in 5 states, every fired row opens its own line's card,
     name and amount read from the row.
   - The Burger opens *Burger 135.000* and Soda opens *Soda 30.000*, and the two
     differ.
   - End to end on `overflow`: the prompt reads *"Void a fired line — Chicken
     Wings 270.000 — reason: kitchen cannot make it"*, and approving lands on
     `overflow`.
   - Void order reads the panel's own total on `default` (382.725), on
     `default&gone=steak` (155.925) and on `overflow` (1.244.250, 6 fired). It
     does not change the panel.
   - Opening is component state: `search` and `history.length` are unchanged.
   - Cancel and Escape return focus to the row that was tapped.
   - `order-panel.test.tsx` checks the same at unit level: each fired row
     reports its own `lineId`, and the ids are distinct.
2. **Tested.**
   - `menu-region.test.tsx`: a whole-frame check over all 24 states. Every
     button is `type="button"`, and every anchor is a lock notice's route out.
   - Every live tile, category, row body, remove control and close-bar action
     is a `BUTTON`. Under a lock, a row body is a `DIV`.
   - Plus per-control tests, each pressing the control and reading where it
     led.
3. **Tested.** `pin-pad.test.tsx` covers the 6 failure notices, the 2 that are
   not failures, and the prompt at rest (no alert).
4. **Tested.** `sheets.test.tsx` does it two ways:
   - Five families opened from the order: the item sheet, the line editor, the
     discount picker, a fired line's void and the order's void. For each,
     `history.length` is unchanged across open and close, and **a real
     `history.back()`** lands on the entry before, with no dialog.
   - Seven sheets reached by URL: closing one replaces its entry, and Back
     cannot return to it.
5. **753 existing tests: all pass.** Every modification is listed below.
6. **Verified in Chrome.** Method: headless Chrome over CDP, 1400×1000, DPR 2.
   On a fresh load, press Tab until the control is focused, then hold Space
   for 150ms and read the page. Every one of the 11 converted controls (list
   below) reported, while held:
   - `:active` true and `:focus-visible` true;
   - box-shadow = **focus ring + pressed ring**, for example
     `rgb(171,255,174) 0 0 0 6px, rgb(3,33,37) 0 0 0 2px inset`;
   - white inset on the ink Mains row and on Settle, destructive inset on ×.

   Releasing Space activated each control. The 11 controls:
   - Mains
   - Burger tile
   - Soda body — opened *Soda*'s sheet
   - Burger body — opened *Burger*'s sheet
   - Steak body — opened the line editor
   - × — landed on `gone=steak`
   - Discount
   - Void order — 382.725
   - Void order on overflow — 1.244.250
   - Send to kitchen
   - Settle
   - Chicken Wings body on overflow — opened *Chicken Wings*

   Opening a sheet left `history.length` unchanged; category, ×, Send and
   Settle pushed one entry. I looked at the held-Soda screenshot: both rings
   draw, and the ring stops short of the slot column. The evidence is in this
   session's scratchpad (`press.mjs`, `geom.mjs`, `shots/`), not in the repo.
7. **`npm run verify`: 17 files, 853 tests, typecheck clean.**

#### Defects injected, each one caught (source restored, then verify re-run)

| Injected | Failed |
|---|---|
| Finding B restored: every fired row opens the Burger's line | 12 |
| Fired row body navigates to `?state=sheet-voidline` (the old href, as a button) | 14 |
| Void order navigates to `?state=sheet-voidorder` | 7 |
| Closing a sheet pushes (the old `go`) | 17 |
| Opening a sheet pushes | 6 |
| A panel void lands on `default` instead of the order on screen | 2 |
| Lock notice loses `role="alert"` / approval notice loses it | 3 / 3 |
| Every lock notice is an alert, `draft` and `invalidated` included | 2 |
| **I-12: the slot inside the button row body** (the extended guard alone fails 21) | 21 |
| A remove control on fired rows too | 23 |
| A row body stays a control under a lock | 6 |
| A tile back to an `<a>` | 48 |
| The route out becomes a button | 4 |
| Ring offset widened to `--frost-space-4` (the existing ring test) | 2 |
| `.menu-tile.is-pressed` not element-qualified | 2 |
| Background not inert under a sheet (the existing reachability guard) | 46 |
| An unscoped `:hover` on a tile | 1 |

#### Tests modified — every one, and why

**Everything here follows a renamed element or selector. No assertion was
loosened, and several are stronger.**

- **`order-line-ring.test.ts`**
  - The ring selector `a.order-line__target:active` became
    `button.order-line__target:active`. The rule it reads was renamed.
  - It still asserts one token, an equal negative margin and padding, the
    surface radius, and clearance inside the padding and short of the gap.
    Injected, it still fails.
- **`order-panel.test.tsx`**
  - **The I-12 guard.** `slotsInsideAnchors` (`closest('a')`) became
    `slotsInsideControls` (`closest('a, button')`). The test is renamed to *"no
    trailing slot has an anchor or button ancestor"*. What it looks for grew;
    what it asserts (always empty) did not change.
    - Both original self-tests are kept.
    - Three self-tests are added: a button that swallows the slot, a row
      wrapped in a button, and a correct sibling row that passes.
  - PENDING remove: `a.order-line__remove` became
    `button.order-line__remove[type="button"]`. The aria-label check is kept.
  - *"a FIRED row body is the link to the void sheet"* (`href ===
    VOID_LINE_HREF`) became *"…the button that opens the void sheet for that
    line"*. It asserts `BUTTON`/`type`, presses every fired row, and checks each
    reports its own `lineId`, with the ids distinct. **This is stronger**: the
    old test would have passed on the defect.
  - Remove: it read the `href` and rendered it. Now it presses the button with
    recording actions and renders the search it asked for. The figure
    assertions are identical.
  - Under a lock, and on `empty`: `.order-actions a` became
    `.order-actions a, .order-actions button`. It now catches a button too.
  - `pressed`: `a.order-line__target` became `button.order-line__target`.
  - The render helper gains optional actions.
  - Added: a pending row body opens the line editor; the close bar is four
    typed buttons that ask for the right thing.
- **`menu-region.test.tsx`**
  - The render helper mounts fresh with a key and sets the URL, and `afterEach`
    resets the URL. Pressing needs a fresh mount; `sheets.test.tsx` already
    does the same.
  - Tiles: *"each a link to the item sheet"* (`A`, `href`) became *"each a
    button that opens the item sheet"*. It presses all 12, and each lands on
    `ITEM_SEARCH` with Burger's sheet open.
  - *"working link"* became *"working button"*, matching the button selector,
    and presses all 11.
  - Grid states: the selector gains `button.menu-tile--off,
    .menu-tile--off button` (widened).
  - `pressed`: `'A'` became `'BUTTON'`.
  - **The ring detector.** `^a\.menu-…` became `^(a|button)\.menu-…`, which is
    the form `sheets.test.tsx` already uses for `.action`.
    - Self-tests are added: button-qualified is accepted, and `div.menu-tile`
      is flagged.
    - The stylesheet list became `button.` selectors. The test name now says
      "the control's element".
  - Added: categories, and the 24-state criterion-2 check.
- **`sheets.test.tsx`**
  - **The reachability detector.** `destinations` now reports a void sheet
    opened in place (`voidSheetOpen()`) before falling back to the URL. Without
    this the guard would be blind: a panel void now writes no URL.
    - A self-test is added: it sees Soda's and Void order's sheets while the
      URL stays `default`.
    - The existing self-test, *"finds the panel's void paths once the
      background is no longer inert"*, still asserts `sheet-voidline` and
      `sheet-voidorder`, unchanged.
  - *"void paths still drawn behind it, and inert"*: the selector changed from
    anchors-by-href to the fired row buttons plus `[data-action="void-order"]`.
  - Openers: `'A'` became `'BUTTON'`.
  - Added: the criterion-4 history tests.
- **`void.test.tsx`**
  - I-12: `href` matches `gone=` became `button[type="button"]`. A new test
    lifts the inert, presses the control, and checks `?gone=`. The same fact is
    now checked by behaviour.
  - **Replaced:** *"the fired row body still leads to the line's void sheet"*,
    which read the first row's `href`. It is superseded by the criterion-1
    describe block above, which checks every fired row in 5 states. That test
    asserted the defect: every row led to one state.
  - Openers: `href` became `button[type="button"]`. The test now also presses
    each and checks that it opens the Burger's sheet or the order's sheet.
- **`discount.test.tsx`**: `zero`'s remove read `href`. Now it presses the
  button and asserts the same string, `?state=zero&gone=steak`.
- **`pin-pad.test.tsx`**: additions only.
- **`approval.test.tsx`**: untouched.

#### Where this task file disagrees with the code

1. **"F2c's sheets push; F2i's and F2j's replace" is half wrong.** F2i and F2j
   move *within* their family as component state. But **closing** any sheet in
   any family went through `OrderScreen.go`, which pushed, and FE-008's call 12
   says so. So all three families pushed on close. I fixed it in one place for
   all of them, and criterion 4 is tested per family.
2. **"`order-line-ring.test.ts` reads `a.order-line__target:active`"** is right.
   Worth knowing, though: it was not the only element-qualified guard. The menu
   ring detector (`^a\.`) and the I-12 slot guard (`closest('a')`) were both
   anchor-only. The slot guard **kept passing while blind** after the
   conversion. It would not have caught a button that swallowed the slot, which
   is why I extended it before relying on it.

#### Judgement calls — each is a lead ruling

1. **Opening a sheet replaces, as well as closing one.** SITEMAP §1 says not
   back-stackable. Before this change, anchors pushed on open. Now the whole
   life of a sheet sits inside one history entry.
2. **Non-overlay moves still push:** category, ×, Send to kitchen and Settle.
   That preserves what the anchors did. But **Back after a × puts the Steak
   back** on the panel, and it did before too. SITEMAP §1 gives `[INLINE]`
   Back-stackable: No, which arguably covers the category and the removal.
   Changing it is one condition in `navigate`. **Please rule.**
3. **Settle is a button, as the task file says.** But Settle leaves for
   settlement exactly as *Back to payment* does, and that one stays an anchor.
   *Manager: take over payment* is arguably an action (FR-G14's gated lease
   takeover), not only a way out. I followed the task file for all three, and
   the ruling "an anchor is for leaving" reads two ways here. **Please rule.**
4. **A void opened from the panel cancels to, and lands on, the view on
   screen**, not on `default`. From `default` the two are identical. From
   `overflow`, landing on `default` would change the panel under the cashier,
   which is the defect this slice fixes. The `?state=sheet-void*` fixtures keep
   FE-008's ruled `default`.
5. **Which notices are failures.** The alerts are the answers to a PIN that did
   not succeed: wrong PIN, deactivated, cooldown, and not-a-manager.
   *Session invalidated* and *Payment in progress* are not alerts. Neither
   answers an entry, and alerting on arrival at the lock screen seemed wrong.
   **Please rule on `invalidated`.**
6. **`data-line-id` and `data-action` were added** as stable opener hooks.
   `VOID_FIXTURES['sheet-voidline'].opener` still names the first fired row. It
   is the Burger either way, so I left it.

#### Found, not fixed — the same defect shape, on ungated paths

- **Discount opens a fixture order.** On `zero` (Comp 100%) or `overflow`,
  Discount moves to `?state=sheet-discount`. The panel then changes to the
  table order with *Staff meal*. The picker's *applied* discount, which is what
  `needsManager` reads for FR-F8, is the fixture's and not the one on screen.
  That is finding B's shape inside a **gated** family. I found it by reading the
  code, not in the browser. The fix is the void's: open the family as component
  state over the order on screen. That is a new opener for F2i, which is out of
  this slice.
- **Every pending row body opens *Steak — pending*.** On `overflow`, tapping
  Coffee edits the Steak. Ungated, so no B-16 risk, but it is the wrong line.
- **Every tile opens Burger's sheet.** FE-004 accepted this as an artifact
  limitation. Noted only.

#### Still carried — touched nearby, not fixed

- **Focus is not trapped** in any sheet or the prompt. A panel-opened void
  behaves exactly like the fixture ones: Tab can leave the dialog for the dev
  fixture links below the frame.
- **Two scrims stack** when the prompt opens over a void or discount sheet.
- The selected category's pressed ring is white on ink, and nearly invisible.
  This is FE-004's finding, unchanged.

#### Not checked

- **Screen-reader announcement of `role="alert"`.** Also, in these fixtures the
  notice is present at mount. A live region present at load may not be
  announced; for real it appears after Continue, which is the case alerts are
  for.
- A real touch device, hover suppression on touch, and `vite preview`.
- A mouse press released away from a converted control. Only the keyboard
  method was run this time.

---

### Lead verification and rulings, 2026-09-18

**`npm run verify`: 17 files, 853 tests passed**, typecheck clean, up from 753.
**No test deleted; one replaced by stronger ones.**

**Three injections, because this slice changes reviewed work and the risk is a
silently weakened guard:**

1. **The defect itself, reintroduced.** Pointing every fired row back at a fixed
   line id — the old behaviour — **failed 12 tests**. The wrong-work
   cancellation is now guarded, not merely absent.
2. **`B-12`, re-leaked.** A digit in a dot attribute **failed 22 tests**, up
   from 13 before this slice. The guarantee got *stronger* through the
   refactor, not weaker.
3. **`I-12`, re-violated.** Nesting the trailing slot inside the interactive
   target failed across every state. The guard now reads *"no trailing slot has
   an anchor **or button** ancestor"* — **widened to follow the element, exactly
   as required, and not loosened.** A first attempt of the lead's injected into
   the non-interactive branch and passed; that proved nothing, and the correct
   injection caught it.

#### Rulings

**Accepted:**

- **A sheet's whole life sits in one history entry** — replace on open as well
  as on close. SITEMAP §1.
- **A void opened from the panel cancels to, and lands on, the view on screen**,
  not `default`. Landing on `default` from `overflow` would change the panel
  under the cashier, which is the defect this slice fixes.
- **`invalidated` and `payment in progress` are not alerts.** Neither answers an
  entry; they are the state you arrive in, and alerting on arrival is wrong.
  The four that are alerts are the four answers to a PIN that did not succeed.
- **`data-line-id` / `data-action` as stable opener hooks.**

**Ruled against the task file, which was loose:**

- **Settle stays a `<button>`, and *Manager: take over payment* becomes one.**
  `builder11` is right that "an anchor is for leaving" reads two ways here. The
  sharper rule: **an anchor goes to a screen that already exists; a button makes
  something happen and only incidentally arrives somewhere.** Settle transitions
  the order. Lease takeover is `FR-G14`, a *gated action* — it takes an approval
  — so it is a button. *Back to payment* is pure navigation and stays an anchor.
- **Category and × should replace, not push.** SITEMAP §1 gives `[INLINE]`
  Back-stackable: **No**, and both are inline state changes of POS-03. Today
  Back after a × puts the Steak back, which is a removal being undone by a
  browser control. **The general rule: a change that stays on POS-03 replaces;
  only leaving POS-03 pushes.** Scheduled below, not done here.

#### The defect has three more homes — F2k

`builder11` went looking and found finding B's shape on three further openers:

- **Discount opens a fixture order.** From `zero` or `overflow`, the panel
  changes to the table order and — worse — **the picker's *applied* discount is
  the fixture's, which is exactly what `needsManager` reads for `FR-F8`.** The
  gate then decides from the wrong fact. That is the defect *inside a gated
  family*, and it is more than cosmetic.
- **Every pending row body opens *Steak — pending*.** Tapping Coffee edits the
  Steak. Ungated, so no `B-16` exposure, but the wrong line.
- **Every tile opens the Burger's sheet.** FE-004 accepted this as an artifact
  limitation; it is the same disease.

**Ruled: F2k finishes the job** — every sheet opened from the panel or the menu
opens as component state over the *current* order and line, and the inline
replace/push rule above lands with it. F2e fixed the path where getting it wrong
prints paper; F2k fixes the rest, including the one where it feeds a gate.

**Carried still:** focus trapping and the stacked scrims, now four slices
running. Neither is acceptable at ship.
