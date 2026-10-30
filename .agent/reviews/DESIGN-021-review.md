# DESIGN-021 review

Reviewed at `0298f5e` on `agent/design-021`, against `development`. The reviewer is Claude Opus; the designer was Codex.

## 1. Verdict

**findings.** There are eleven: four that should be fixed before S7b is written from this design (F1 to F4), four that leave
S7b without a rule or a word it needs, or leave a claim unproved (F5 to F8), and three small ones (F9 to F11).

The contract work is largely sound. C4 and R1 are followed almost everywhere, and the arithmetic is right. The defects
cluster in one shape: a rule was reasoned through for the state the designer was looking at, and it does not hold in a
neighbouring state that uses the same control or region.

**One limit on this verdict matters.** No browser ran in this review (section 3). Every layout and focus finding below is
inferred from the source and the Handoff's recorded numbers, not observed. Section 3 lists the short probes that would
confirm or clear each one.

## 2. Findings

### F1. In a long sheet, the notice and the figures are out of sight, while Add stays on (should fix)

**Location:** `docs/design/visual-directions/frost-order-flow.js:203`, where `#served-sheet-notice` is the first child of
`.sheet__body` and `#served-unit` and the line total come after the option groups. The body is the scroll owner
(`frost-order-flow.css:6`).

**What is wrong:** The notice sits at the top of the region that scrolls, and a poll may not move scroll or focus. The
sheet is therefore silent to a sighted cashier who has scrolled. This matters most in the rows where Add stays **on**. In
the 86 and off-menu rows, `#served-add-reason` in the fixed footer still says why Add is off, so those rows are only
degraded. The figures have the opposite problem: they follow the option lists, so at the top of a long sheet they are out
of sight too.

**Authority:** C4 §4, the rows *Its price, an option's delta or a name changes* ("The figures update at once, so what is
shown is what Add adds. A notice says the item changed") and *A chosen modifier is removed* ("The same notice names what
was removed"). Part B item 1 draws the *many* state and keeps only Add and the keys in reach, so the Handoff's rule 8
meets the letter of the task but not C4's reason for the notice.

**Failing scenario:** An item has 56 options, the `served-item-many` shape. The Handoff records body client height 411,
scroll height 2439 and final scrollTop 2028 (task file `:858`). The cashier chooses *Fried egg* near the top of the
modifiers and scrolls down. The manager removes Fried egg. The choice and its delta leave the total and the notice names
it, roughly 2000 pixels above the visible area. Add is on and the footer says nothing. The cashier presses Add and gets a
line without the egg, at a lower price, having been told nothing they could see. No `served-item-*` picture combines a
scrolled body with a change, so `design021.cjs` cannot see this.

**Proposed fix:** Move the notice out of the scroll owner into a fixed band between the body and the footer. The body
shrinks and its scrollTop stays, so the options do not move (which also settles F2). Keep at least the line total in the
fixed area as well, so what Add will add is always visible. State this in `D`'s data-driven sheet rule and draw it as a
new picture: many options, scrolled, with a selected modifier removed.

### F2. An arriving notice pushes every option down under a finger; Add moves as well (should fix with F1)

**Location:** `frost-order-flow.js:203` for the notice, and `:184` and `:216` for `#served-add-reason`, which is inserted
inside the footer.

**What is wrong:** The sheet is a fixed height with a `flex: none` footer. Unhiding a notice at the top of the body moves
every option down by the notice's height plus its 20-pixel margin. A reason appearing or clearing changes the footer's
height, so Cancel, the stepper and Add all move vertically by one line. That includes the ordinary case of choosing a
variant, which clears *Choose a variant before adding this item.* The designer solved exactly this problem for the menu:
`D`'s addition puts the status at the bottom edge because "the position keeps an arriving status from moving the tiles".
The sheet did not get the same treatment.

**Authority:** This is the weakest citation in the report, so it is stated plainly. AC-12's no-reflow promise names the
grid, and C4 narrows it to the 86. For the sheet, C4 §4's "nothing is pulled from under a finger" is said about the sheet
staying open. No rule forbids this outright. It is raised because of what it does in the rows where Add is on.

**Failing scenario:** A cashier is reaching for *Small*, −10.000, as a poll changes the item's price. The notice arrives
and the row under the finger becomes the one above it, *Regular* or another variant. The tap selects a different priced
variant, Add is on, and one press later the line holds the wrong choice. It is recoverable, because a pending line is
freely removable (FR-H2), but it is the mis-tap the grid's rule exists to prevent.

**Proposed fix:** F1's band for the notice. Reserve one line for `#served-add-reason` in the footer at all times, so that
the footer's height never changes while the sheet is open.

### F3. A poll that disables the focused Add moves focus out of the sheet (should fix)

**Location:** `frost-order-flow.js:170` (`save.disabled=…`) and `:167` for the same native `disabled` on the keys. The Tab
trap and Escape are listeners on the drawer (`:152` and `:160`).

**What is wrong:** Add and the keys turn off through the native `disabled` attribute. Under the HTML specification's focus
fixup, a focused element that becomes disabled stops being the focused area, and the active element falls back to the
body. Key events then no longer reach the drawer's listeners. The grid already uses the opposite pattern: tiles use
`aria-disabled`, stay focusable and are guarded in the handler. The Handoff's own focus section says "A poll changing a
price, name, availability, selection value or preset value keeps focus where it was", and `D`'s addition says "Existing
controls otherwise retain focus". Neither holds for the one control most likely to hold focus.

**Authority:** Part D item 2: "Nothing a poll does may move focus unless the focused element disappears."

**Failing scenario:** A keyboard user has chosen a variant and is on *Add to order*. The item is 86'd. Add becomes
disabled, focus falls to the body, Escape no longer closes the sheet, and the first Tab starts from outside the sheet's
trap. `design021.cjs:71` tests the same transition but never reads the active element.

**Proposed fix:** In served mode, turn Add, Update and the keys off with `aria-disabled` and the `btn--off` class, as the
tiles and the empty order's actions already do. `save.onclick` already guards. Add a check that focuses Add, fires
`sheetRefresh('86')`, and asserts both the active element and that Escape still closes. `isDisabled()` in Playwright
honours `aria-disabled` on a button, so the existing assertions should survive.

### F4. The longest category name overflows its fixed 72-pixel row (should fix)

**Location:** `docs/design/visual-directions/frost-served-catalog.css:4` keeps `.cat`'s `height: 72px` from
`structure.css:135`, with `overflow-wrap: anywhere` added.

**What is wrong:** Thirty-two W at 15 pixels is about 14 pixels each, in a content width of about 139 pixels (171 less 32
of padding), so about nine to a line and four lines. The inherited line height is 1.45 (`structure.css:32`), which makes
about 87 pixels in a 72-pixel centred box, so about 7.5 pixels spill past each edge. In the first row the top is cut off
by the rail's `overflow-y: auto`; at the bottom it runs into the next row. The Handoff's own figure supports this: rail
scroll height 1728 is exactly 24 × 72 (task file `:861`), so the row did not grow. The check measures every category box
(`design021.cjs:32`) and asserts nothing about them, and the Handoff's row reports only width.

**Authority:** Acceptance criterion 5: "no horizontal overflow and no clipped control at the longest names and the largest
values". `D`'s addition also says "Category and option names wrap without shrinking their type"; drawn this way they wrap
out of the row.

**Failing scenario:** `served-categories`, the selected first row: the first line of the name is partly clipped and the
fourth line overlaps or is covered by *Category 2*. Unlike a tile, no heading elsewhere shows the category's full name.

**Proposed fix:** `.served-catalog .cat { height: auto; min-height: 72px; padding-block: … }` using registered tokens, so
that the row grows as the option buttons do. This needs a line in *DESIGN-021 additions*, because `D`'s *Category row* says
172×72; it should read as a minimum for a wrapped served name, without changing the rule for ordinary names. Assert
`scrollHeight <= clientHeight` for every `.cat` in the check.

### F5. *Menu availability updated.* has no lifetime, and clearing a menu status can move tiles (S7b needs a rule)

**Location:** `frost-served-catalog.js:163`, `:197-198` and `:210`; `frost-served-catalog.css:13` and `:43-44`; Handoff rule
5 at task file `:537-543`; the copy table at `:637`.

**What is wrong:** One element, `#served-status`, holds two different things. The stale notice has an entry and exit rule.
The availability status has neither: the Handoff says when it appears and never when it leaves. In the fixture only
`refresh('success')` clears it, yet an 86 can only arrive through a successful check, so the fixture has no answer either.
It may be that the next successful poll clears it, about two seconds later, or that it stays until the next change; S7b
cannot tell, and acceptance criterion 3 asks for a rule it can test. Three further problems sit in the same region:

- **Clearing moves tiles.** The Handoff's claim is about the status's *appearance*: "its appearance never moves a tile's
  top-left position". The grid is `flex: 1` beside a `flex: none` status, so when the status goes, the grid grows. If it
  is scrolled to the end, the browser clamps scrollTop and every tile shifts down by the status's height. For a status
  caused by an 86, that is the grid moving under a finger because of an 86, which AC-12 and ruling C-3 forbid. The same
  applies to the stale notice clearing.
- **The live region may not speak.** `.served-status:empty { display: none }` takes the `role="status"` element out of the
  accessibility tree until it has text. A live region that enters the tree together with its content is commonly not
  announced, and Part A item 1 asks specifically about announcement. The sheet's notice has the same shape: `hidden` is
  removed and the text is set in one step (`frost-order-flow.js`, `sheetRefresh`). The Handoff does say speech output was
  not tested.
- **An unreachable branch.** `if(!stale)status(…)` at `:210` suppresses the availability status during a stale period, but
  a change can only arrive by a successful check, which ends that period. Either the check is partial, and the Handoff
  should say so, or the branch should go.

**Authority:** Acceptance criterion 3, second and third bullets; Part A item 1; AC-12 and ruling C-3 for the shift.

**Failing scenario:** `served-overflow`, scrolled to the end, with a cashier's finger on a bottom-row tile. A manager 86's
another item. The status appears and the tile stays put. Two seconds later, under the likeliest reading, the status clears
and the whole grid drops by about 45 pixels, as the finger lands.

**Proposed fix:** State the lifetime in the Handoff and the copy table. Make the status region a fixed-height band reserved
at the menu's bottom edge, always present and always in the accessibility tree (visually empty when idle), so that neither
its appearance nor its clearing changes the grid's height. That also removes the need for the `:empty` rule.

### F6. The fire refusal now has three wordings, and the Handoff replaces two without saying so (S7b needs a ruling)

**Location:** the copy table at task file `:666-668`; `frost-served-catalog.js:110-111`; `apps/pos/src/fire.ts:98-99` and
`:109-120`; `frost-order-flow.js` at the `fireblocked` branch; `order.html:405-406`.

**What is wrong:** C4 §5 and §8 item 11 asked for the **plural of `fire.ts`'s refusal**. The three wordings are:

| Source | Title | Body | Recovery |
|---|---|---|---|
| `fire.ts`, and the static markup at `order.html:405` | Cannot send to the kitchen | 1 pending line is no longer available: **Steak**. Void that line or ask a manager to put the item back on. | none |
| The `fireblocked` picture as it renders (`frost-order-flow.js`, DESIGN-007) | Steak is 86’d · cannot send | Remove the pending line or ask a manager to restore the item. | Show Steak |
| This Handoff, singular and plural | Cannot send to the kitchen | {item name} is 86’d. Remove the pending line or ask a manager to restore the item. | Show unavailable lines |

The Handoff's row is headed *Fire refusal, singular*, and it matches neither source. It also changes `FireRefusal`'s shape,
which has a `lead`, bold `names` and a `resolution`, and the Handoff never mentions any of this. Part A item 2 said to draw
it "only if it differs from the Steak picture", and the Handoff's statement that "no other C4 difference remains" (`:972`)
is not true of this item. `Remove` is the better verb, since FR-H2 lets a pending line be removed and *void* is the
manager's word, so the outcome may well be right. The trouble is that nobody decided it.

The plural also has a loose end. `:667` says names are a list, "not a quantity claim", and `:684-685` tells S7b to
deduplicate. If two pending lines hold the same item, the fixture prints "Nasi Goreng, Nasi Goreng are 86’d"
(`frost-served-catalog.js:106-111` counts lines, not items). After deduplication S7b has one name and two lines, and
neither the verb nor *their pending lines* is defined for that case.

**Authority:** C4 §5 and §8 item 11; ADR-011 rule 24, as the task cites it (the builder copies the design's words and
invents none); the task's *existing pictures stay*.

**Failing scenario:** S7b's builder finds `fire.ts`, the picture and the table in disagreement. Keeping the reviewed
singular produces a plural from a different sentence; adopting the table changes the singular on a screen nobody marked as
changing, along with `fire.ts`'s `FireRefusal` shape and the wording `apps/pos/src/sheetFixtures.ts` also holds.

**Proposed fix:** The designer states that the table replaces both earlier singulars, or gives the plural in `fire.ts`'s
form instead. Either way, define the case of one item on several lines, and raise the choice for the lead to rule on.

### F7. Several checks cited as proof cannot fail, so R1 and acceptance criterion 5 are less proved than the Handoff says

**Location:** `docs/design/checks/design021.cjs:32`, `:35-37`, `:92`, `:96`.

**What is wrong:**

- **`:37`, "fixed tiles and complete price".** `.tile__p` has `white-space: nowrap` and no overflow setting, so its
  `scrollWidth` always equals its `clientWidth`. The check passes even if the price leaves the tile. It compares no price
  box against its tile, horizontally or vertically. This is the proof offered for R1 condition 1.
- **`:92`, order line "full".** `.line__n` has `overflow: visible` and auto height, so `scrollHeight <= clientHeight` holds
  whatever happens. `:32` records only the name box. R1 condition 4 asks for the quantity, price and trailing slot to be
  measured intact; only the slot is. The Handoff's "Quantity/amount remain separate" (`:864`) has no measurement behind it.
- **`:96`, "silently removes".** `#preset-change` is never shown by anything, so `isHidden()` is true by construction.
- **No assertion on `.cat`,** which is how F4 got through.
- **Earlier POS states.** Acceptance criterion 1 says every earlier POS-03 state "still renders as before". None of the
  earlier check scripts names `order.html` (I searched for `pos/order`, `order.html` and `frost-order-flow`), so the only
  guard is `:99`, which opens each state and collects page errors, plus `:100`'s twelve titles. The refactor of the
  shared runtime is therefore proved not to throw, not to render the same. I read the non-served paths by hand and found
  them unchanged (section 4), but that is reading, not a test.

**Authority:** Acceptance criteria 1 and 5; R1 conditions 1 and 4; this role's rule on green suites.

**What I infer about the claims themselves:** R1 condition 1 is probably true. A tile has 124 pixels of content width, and
`99.999.999` plus the 86 tag comes to at most about 118 even in a monospace numeral. R1 condition 4 is probably true, given
`.line__a { flex: none }`. Neither is proved.

**Proposed fix:** Compare the price's and the tag's boxes against the tile's, on an 86'd largest-price tile too, which no
picture currently draws. Record and assert the quantity and amount boxes on the long order line. Drop the `#preset-change`
assertion and the element. For the earlier states, add a before-and-after screenshot or DOM-text comparison against
`development`, run once.

### F8. The picker has no words for an unexpected read failure

**Location:** task file `:672`; `frost-served-catalog.js:160`.

**What is wrong:** The menu carries both failure sentences, and Handoff rule 3 tells S7b to keep the core's unavailable and
unexpected classification. C4 §7 says the presets "are read with the menu, so these are the same two facts". The picker has
only *The system is unavailable*. On an unexpected failure the menu says *Something went wrong* and S7b has no words for
the picker beside it.

**Authority:** C4 §7 and §8 item 10; ADR-011 rule 24.

**Failing scenario:** The projection read returns a 500 and the cashier opens Discount on an existing order. The builder
must either invent a sentence or claim the system is unavailable, which disagrees with the menu behind the sheet.

A related fixture weakness, with no production effect: the menu and picker read states are independent in the artifact. As
the source reads, `served-error-order` and `served-loading-order` open the picker with five fixture presets, because
`openPresets` tests only `endsWith('error')` and `endsWith('loading')` (`:159-160`), and `served-presets-error` draws a full
menu behind a failed read. A reviewer walking the pictures sees two facts that C4 says are one.

**Proposed fix:** Add the second row to the copy table, reusing the menu's words. Let `served-error-order` and
`served-loading-order` reach the picker's matching state.

### F9. Focus on a first-read failure is not decided for the case that actually happens

**Location:** Handoff, task file `:689-694`; `frost-served-catalog.js:185`, `:160`; `design021.cjs:52`.

**What is wrong:** The Handoff says the picture "starts on Try again" and that in a running workspace "a failed background
read must preserve focus in the live order panel". The first read happens as the screen mounts, when usually nothing has
focus; that is not decided. Nor is the failed retry: pressing *Try again* replaces the button with *Loading*, so the focused
element disappears, and if the read then fails, the Handoff says nothing about where focus goes. It covers only success. The
picture also focuses `#preset-retry` when the picker opens, which contradicts "Opening M-2 or M-3 focuses its heading".

**Authority:** Part D item 2, "where focus lands when the first read fails and when *Try again* succeeds".

**Failing scenario:** S7b copies `showRead`, which calls `.focus()` on every entry to failure. A cashier in the order panel
has focus taken by the read's failure, which the rule forbids. If S7b follows the sentence instead, a fresh mount leaves
focus on the body with no stated target.

**Proposed fix:** One rule: on failure, focus moves to *Try again* only if focus is on the body or on the control the read
just removed; otherwise it stays where it is. Mark the picture's `.focus()` as the fresh-mount case.

### F10. The empty catalog says *Add an item first.*, and gives no reason for keeping the controls

**Location:** `frost-served-catalog.js:59`; task file `:516-520`, `:634`.

**What is wrong:** Part A item 1 asked for the decision on Add-dependent controls "and why". Rule 2 gives the decision
without the reason. The reason exists: `fire.ts:55` records ruling C-1's *inert in place, never absent*, and `empty` draws
it. So the decision is defensible. But the sentence *Add an item first.* appears in `served-empty`, and in `served-error`
and `served-loading`, where no item can be added, directly beside "There is nothing to add yet." It tells the cashier to do
what the screen has just said cannot be done.

**Authority:** Part A item 1, "no control that cannot work", "Decide … and why".

**Proposed fix:** Cite C-1 in rule 2. Use a read-neutral reason when no menu is held, for example *No items on this order
yet.*, and keep *Add an item first.* for a held menu.

### F11. Housekeeping S7b could copy by mistake

- `frost-order-flow.js:141`: after Cancel with the opener gone, focus goes to the **first** category (`.cat:not([hidden])`),
  while the Handoff (`:698-703`) says the selected one. `archive()` in `frost-served-catalog.js:194` does it correctly.
- `frost-served-catalog.css:12` `.served-removed-slot` is the archive placeholder C4 rejected, and `:37`
  `.served-preset-cap` is the cap preview C4 rejected. The Handoff says neither is in the final drawing, and neither is
  used.
- `frost-served-catalog.js:132` `#preset-change` and `:146` `aboutToChoose` are leftovers of the provisional notice.
- `design021.cjs:58` says "archive leaves a hole", which is the opposite of the code below it.
- `frost-served-catalog.js:157-158`: `endsWith('removed')` and `endsWith('changed')` also match `served-item-removed` and
  `served-item-changed`, so opening Discount after cancelling those sheets would apply a preset mutation.

## 3. What I ran and what I did not

**Observed:**

- `npm run verify` at `0298f5e`: typecheck clean, **149 test files and 5453 tests passed**, in 138.92 seconds. Since nothing
  under `apps/`, `packages/`, `db/`, `e2e/` or `docs/design/tokens/` changed, this says little about the design, as
  acceptance criterion 6 anticipates.
- The tree did not move: `git status --short` and `git diff --stat` were empty before verify, after it, and immediately
  before this report was written.
- `git diff development...HEAD` read in full for every changed file, and the task file read in full.
- Registered-token check: every `--frost-*` name in `frost-served-catalog.css` exists in `docs/design/tokens/frost.css`, and
  that file has no raw colour, size or weight.

**Not run, and why:**

- **No browser ran, so no state was seen.** `design021.cjs` and every earlier check need `PLAYWRIGHT_MODULE` in the
  environment. Commands that set it, and a scratch probe in `/tmp`, were refused by this run's permissions; plain `node
  --version` was allowed. I did not look for another route round that. I could not read the lead's evidence either, because
  the directory is outside this session's allowed paths, so **I have not seen a screenshot or `measurements.json`.** Figures
  I cite from run 3 are the Handoff's and the lead's as written.
- **No mutation run was made.** The failing scenarios are reasoned, not reproduced.
- The lead's record (360/360 on `design021.cjs`) is not confirmed independently, though I have no reason to doubt it.

**Inferred from source, each awaiting a browser:** F1, F2, F3, F4, the tile shift and live-region points of F5, F8's related
fixture note and F11's last item. F3 also rests on the HTML specification's focus fixup as I recall it. I did not consult the
librarian, because that is a question a browser answers faster. **The owner's look at these states would not catch F3 or F5's
live region.**

**The probes that would settle them,** at 1280×800:

| Finding | Probe | Red if |
|---|---|---|
| F1 | `served-item-many`, set the body's scrollTop to its maximum, call `sheetRefresh('modifier-removed')` | The notice's box is outside the body's visible box |
| F2 | `served-item-both`, choose a variant, read the option and Add boxes, call `sheetRefresh('price')`, read again | Any y changed |
| F3 | `served-item-both`, choose a variant, focus `.flow-save`, call `sheetRefresh('86')`, wait a frame, press Escape | `activeElement` is the body, or the drawer is still there |
| F4 | `served-categories`, read the first `.cat`'s `scrollHeight` and `clientHeight` | `scrollHeight` is above `clientHeight` |
| F5 | `served-overflow`, set the grid to its maximum scrollTop, `refresh('86','menu-70')`, scroll to the end, read a tile's y, `refresh('success')`, read again | y changed |

## 4. Cleared

- **C4 §1 and §2:** the entry and exit rules for the four catalog states, the two-failure threshold, no flicker on retries,
  the empty catalog read as "no category" rather than "empty category", the rail's selection following the id, and no POS
  copy naming an archive (the gallery labels `archived` are review chrome only).
- **C4 §3:** two fixed labels, nothing preselected, a variant required, the figures before a choice as base plus modifiers
  floored at zero, single-select with no deselect, and an empty list drawing nothing. The floor is right in
  `served-item-floor`, including the `→ 0` arithmetic line.
- **C4 §4:** every row of the table has a picture and its Add state matches, including a removed last variant not leaving
  Add waiting, and reorder keeping selection by id. F1 and F2 are about where the notice sits, not what it says.
- **C4 D1, all three additions:** the ceiling is one function used by Add and Update, the order figure is after discount and
  service, a choice can trip it at quantity 1, and no computed excess is quoted. **C4 D2:** no timer, and no duration drawn.
- **C4 §7:** active-only, server order, zero shown, decimal comma with no trailing zeros (`12,3456%`, `12,5%`, `100%`, `0%`),
  stored fixed values, silent edits and removals, and no suggestion, ranking, schedule or approval (FR-F2, FR-F7, B-21).
- **The Handoff's arithmetic examples:** I recomputed all of them and they are right, including 103.949.999, 94.499.999 and
  61.425.
- **R1:** two-line clamp by lines, every tile opening M-2, the collision pair drawn with the full name in M-2's heading, and
  the BO-04 hint recorded as a known limit. Long names wrap in the order line by CSS (see F7 for what is not measured).
- **Boundaries:** B-8 and FR-D4 hold, since a line snapshots its unit and tile price changes do not touch it. No seed data
  (B-24): the fixtures stay in the review artifact, and the Handoff warns S7b not to copy them. B-17 and FR-E4: the fire
  block is per pending line and fired lines are excluded. No link to the back office, and every sentence mentioning it says
  the task is a manager's.
- **Non-served paths in `frost-order-flow.js`,** by reading: `served` is undefined outside served states, so `base`,
  `dismiss`, `shell`, the option order and `stepper` behave as before. The floor applied to `unit` is new but no fixture
  resolves below zero. Added `esc` calls change nothing for fixture names.
- **Registry:** 58 served states appear in `order.html` and `manifest.js`, and the gallery reads the manifest. The twelve
  `sheet-item-<id>` states and their aliases are kept. The stated scope is respected: no file under `apps/`, `packages/`,
  `db/`, `e2e/` or the tokens changed, no product document or ADR was edited, and `SCREEN-INVENTORY.md`, `SITEMAP.md` and
  `D` were only extended (one inventory sentence on the twelve sheets was reworded, and the Handoff shows it).
- **Part D item 3:** the additions add rules without changing an existing one, with F4's row height the one thing that would
  need a new sentence.
