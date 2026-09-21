# FE-004 — POS menu region (F2b)

**Status:** Done 2026-09-17, lead-verified. Awaiting the owner's look.
**Roadmap item:** F2b
**Branch:** `agent/phase-0-foundations`
**Assigned:** `builder6`

---

## What this slice is, and the one thing it must not leave undone

F2a built the order panel and held the menu region empty — `OrderPanel.tsx`
renders `<div className="order-screen__menu" aria-hidden="true" />` so the panel
sits at its real geometry. **You fill that region.**

**The hard requirement first, because it is a user stranded, not a feature
missing.** Under either settlement lock the order panel renders correctly inert
— every trailing slot empty, no row a control, the reason on every header. But
the artifact puts the *route out* of a lock in the menu region:

- `lock-draft` → *Back to payment*
- `lock-lease` → *Manager: take over payment*

So today `?state=lock-draft` and `?state=lock-lease` show a cashier a frozen
order and **no way out of it**. F2a's implementer found this and correctly
refused to invent a button in the panel. That call is only right if this slice
closes it. **Closing it is acceptance criterion 1.**

---

## Objective

The menu region renders at 1280×800 on the Frost tokens in seven fixture
states: the category rail, the tile grid, an 86'd tile disabled in place, the
loading skeleton, the menu-changed notice, and both lock notices with their
route out.

---

## Required inputs

1. **`docs/design/visual-directions/frost/pos/order.html`** — the Frost fixture,
   on `agent/design-direction`, in the worktree at `../restaurant-pos-design`.
   The menu region is roughly lines 55–125: `.catrail`, `.menuarea`, `.menugrid`
   and the notices. The order panel below it is already built; leave it alone
   except where this task says otherwise.
2. **`docs/design/SCREEN-INVENTORY.md` §POS-03**, same worktree — the states and
   what each one means.
3. **`.agent/tasks/FE-003-order-panel.md`** on this branch. Read the handoff
   **and the lead's rulings under it**. It is the standard for your own handoff,
   and its "departures" section shows the level at which a judgement call gets
   raised rather than taken.
4. **`apps/pos/src/OrderPanel.tsx`**, `apps/pos/src/pos.css`, and the six tests
   under `apps/pos/test/`.
5. **`docs/design/visual-directions/frost-states.css`** on this branch — the
   pressed-ring rules for `.tile` and `.cat`, and the disabled exclusions.

---

## What to build

### The seven states

`?state=` on `/pos/order`, alongside the six F2a already serves.

| State | What it shows |
|---|---|
| `default` | Category rail with Mains selected, the full tile grid |
| `pressed` | A category and a tile held down — the A7 ring, statically |
| `eightysix` | Steak 86'd: **disabled in place**, same grid position, an `86` tag |
| `loading` | The menu skeleton. Rail and grid both absent |
| `catalog` | The menu-changed notice above the grid |
| `lock-draft` | **No rail, no grid.** The "Finish this payment first" notice with *Back to payment* |
| `lock-lease` | **No rail, no grid.** The "Another client is settling this order" notice with *Manager: take over payment* |

The last two must keep working with F2a's panel: the panel is already correct in
those states, so check the whole screen, not just your half.

### 86'd is disabled in place — this is the point of it

An 86'd item **stays exactly where it was in the grid**, greyed, carrying an
`86` tag, and is not a control. It is not removed, not moved to the end, not
hidden. A cashier's hand knows where Steak is; moving it teaches the wrong map
and invites a tap on whatever slid into its place.

`frost-states.css` states that `.tile--off` gets **no pressed ring** — nothing
happened, so nothing says it did. The same exclusion already exists for the
disabled Continue on the lock screen.

### The lock notices carry the route out

Copy the artifact's wording exactly; it is reviewed text and it is careful. Both
notices spell out that removing an unsent line is blocked too, and both end by
saying reading is still fine — which is `FR-G13` showing up in copy.

Each notice carries one action. The artifact links them to
`settlement.html?state=pending` and `settlement.html?state=takeover`; F3 has not
been built, so point them at the placeholder route and **say so in your handoff**
the way F2a did for `?state=settle`.

**The artifact sets `width` and `margin-top` on both actions as inline styles.**
Do not copy an inline style into the app — give it a class, as F2a did for the
round tag.

### Hover — the trap this slice was warned about

`hover-scoped.test.ts` will fail you for any `:hover` outside
`@media (hover: hover)`, and **this is the screen it was written for.** Frost's
tile hover is the ink selected fill. Touch browsers synthesise `:hover` on tap
and hold it after the finger lifts, so an unscoped tile hover leaves a tapped
tile looking *selected* once the pressed ring goes — the exact confusion the
pressed ring exists to prevent. A8 caught this in the design; the test is here so
it cannot come back in the code.

### Values

The registry carries the grid: `--frost-menu-columns` (4 × 150px),
`--frost-menu-gap`, `--frost-menu-padding`, `--frost-tile-height` (96px),
`--frost-tile-padding`.

**It appears to carry nothing for the category rail or the `86` tag.** Check.
If a value you need is genuinely absent:

- **Do not invent it**, and do not approximate it with a token that happens to
  have the same number for a different reason.
- Omit it, comment the omission in `pos.css`, and name it in your handoff.

That is what F2a did with five totals-block literals, and the lead accepted it:
omitting beats inventing, and a named gap gets a token later. `no-invented-values.test.ts`
enforces this anyway — it rejects any colour, any length but `1px`, and any
numeric font size, weight, line height or tracking in `apps/pos/src`.

---

## Constraints

- **Do not edit `OrderPanel.tsx`'s panel markup**, beyond removing the empty
  region placeholder and its `aria-hidden`. The panel is reviewed and committed.
- **Do not edit `frost-states.css`, the fixture, the registry, or any contract
  document.** If a rule cannot be applied as written, raise it.
- **Nothing behind this is real.** No fetch, no storage, no console —
  `console-free.test.ts` enforces it.
- **Money stays a `bigint`.** Tile prices are money. `money-display.test.ts`
  bans `Number(` across `src` and it will catch you.
- **Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.**
- **Stop at the menu region.** No sheets, no PIN flow, no quick-sale mode. An
  implementer that starts F2c has ended its task and should say so.

---

## Acceptance criteria

1. **`lock-draft` and `lock-lease` each show their notice and a working route
   out.** Neither state strands the cashier. Check the whole screen with F2a's
   panel, not the region alone.
2. All seven states render at 1280×800 and are reachable by `?state=`.
3. An 86'd tile holds its grid position, is not a control, and takes no pressed
   ring.
4. A pressed tile and a pressed category draw the ring. **Verified in a browser
   with the press held** — FE-002 and FE-003 both describe the DevTools Protocol
   method; reuse it rather than reinventing it.
5. Every hover rule sits inside `@media (hover: hover)`, and you have seen
   `hover-scoped.test.ts` fail on one that does not.
6. `npm run verify` passes. FE-003 left 213 tests across 12 files; state the new
   count.
7. Typecheck clean.
8. Any value absent from the registry is omitted and named, never invented.

---

## Out of scope

- **Quick-sale / counter mode** (`quick`, `quick-line`). It changes the order's
  identity and the panel header, not just the menu, so it is **F2d** rather than
  a state smuggled in here.
- Every sheet, the approval PIN flow, `error`, `fireerror`, `fireblocked` — F2c.
  This slice builds the 86'd *tile*; F2c wires the states that also use it.
- Real data, server calls, persistence, merging.

---

## Handoff

Write your handoff here when the work is done. Name the command, the URL, and
the `?state=` values. Say what you found and did not fix, and raise judgement
calls rather than taking them — FE-003 raised eleven and every one was worth
having. If a check was skipped, say which and why; the lead verifies with
`git log`, a browser, and by injecting the defect your tests claim to catch.

### 2026-09-17 — implementer (claude, Opus 5)

**Not committed.** Nothing committed, per instruction. Working tree on
`agent/phase-0-foundations`:

- new: `apps/pos/src/MenuRegion.tsx`, `apps/pos/src/menuFixtures.ts`,
  `apps/pos/test/menu-region.test.tsx`
- modified: `apps/pos/src/pos.css` (new F2b section, `.order-screen__menu`
  becomes a flex row), `apps/pos/src/orderFixtures.ts` (three states added),
  `apps/pos/src/OrderPanel.tsx` (import, the placeholder `div` replaced by
  `<MenuRegion>`, header comment reworded — **panel markup untouched**),
  `apps/pos/test/order-panel.test.tsx` (the "exactly six states" assertion now
  lists nine)

`.agent/MEMORY.md` and `.agent/ROADMAP.md` were clean when I started. During
the session they became modified. **I did not touch them.** Someone else is
writing them. `frost-states.css`, the fixture, the registry and every contract
document are unedited.

#### What the owner opens

```
npm run dev -w apps/pos        # http://127.0.0.1:5173/pos/order
```

`?state=` values: `default`, `empty`, `overflow`, `pressed`, `lock-draft`,
`lock-lease`, `eightysix`, `loading`, `catalog`. The last three are new. The
menu region also renders in F2a's four unlocked states. Dev links to all nine
sit under the frame. The Vite server on 5173 was **already running** (pid
31567, not mine, the same one FE-002 and FE-003 found). I used it and left it
running.

#### Against the acceptance criteria

1. **Neither lock strands the cashier.** Checked on the whole screen in
   Chrome.
   - `lock-draft`: no rail, no grid. The soft "Finish this payment first"
     notice sits in the menu region with *Back to payment*.
   - `lock-lease`: no rail, no grid. The grouping-blue "Another client is
     settling this order" notice sits there with *Manager: take over payment*.
   - In both, the panel beside it still has 3 legible rows, 0 controls in the
     lines, the lock tag on every header, and all four close-bar actions off.
   - **The route out is the only control on the 1280×800 frame.** Chrome listed
     every `a`/`button` inside `.pos-device`: exactly `["Back to payment"]` and
     `["Manager: take over payment"]`.
   - Clicking each one navigated, to `?state=settle-pending` and
     `?state=settle-takeover`. **Both are placeholders.** Settlement (F3) does
     not exist, so they fall back to `default` today. See call 5.
   - The notice copy and all twelve names and prices were checked against
     `order.html`, with whitespace and entities normalised, by a throwaway test
     that I deleted afterwards. All match.
2. **Nine states at 1280×800, reachable by `?state=`.** In every state Chrome
   measured the device at 1280×800 with no overflow, and the panel at x 820,
   460×736.
3. **86'd Steak holds its slot and is not a control.**
   - `default` and `eightysix` give the same box: `[500, 76, 150, 96]`, third
     in row one.
   - It is a `div` with `aria-disabled="true"` (docs/DESIGN.md, Menu tile). It
     has no href, no tabindex, and nothing interactive inside.
   - While held: `:active` true, `box-shadow: none`. The URL did not change on
     release. Hovering it by mouse leaves it grey and dashed, with no selected
     fill.
   - The tag computes 10px, 2px 5px padding, `rgb(96,105,107)` fill, white
     text.
4. **Pressed ring, verified with the press held.** Details in the table below.
5. **Hover.** One hover lives in this slice: the tile's selected fill, plus
   its price inheriting white. Both sit inside `@media (hover: hover)`.
   **Seen red:** I moved them to the top level and `hover-scoped` failed with
   `["a.menu-tile:hover", "a.menu-tile:hover .menu-tile__price"]`,
   `1 failed | 5 passed`. Restored from a byte copy (`cmp` clean), then green.
6. **`npm run verify`: 13 files, 273 tests passed**, up from 12 and 213. The
   60 new tests:
   - 38 in `menu-region.test.tsx`
   - 12 in `order-panel.test.tsx`: the I-12 structure block now runs over the
     three new states
   - 8 in `no-invented-values`: two new `src` files
   - 2 in `money-display`: the `Number(` detector covers the two new files
7. **Typecheck clean** over server, money and pos (part of `verify`).
   `npm run build -w apps/pos` also succeeds.
8. **Values.** See call 1. Nothing is invented. Omissions are commented in
   `pos.css` and listed there.

**Guards proven red by injecting the defect** (`menu-region.test.tsx`; each
restored byte-identical and re-run green, 192 pos tests):

| Injected | Failed |
|---|---|
| `a.menu-tile.is-pressed` → `.menu-tile.is-pressed` (a ring a div could take) | 2: the ring-qualification checks |
| 86'd tile sorted to the end of the grid | 2: slot order in `eightysix`; never-reflows |
| 86'd tile filtered out | 4 |
| 86'd tile drawn as `<a href>` | 2: not-a-control; never-a-link |
| Route-out link deleted from both lock notices | 4: one action; the whole-screen "only way out" check, per lock |

#### How the press was held

The method from FE-002 and FE-003, reused. I ran installed Google Chrome
(`--headless=new`) over the DevTools Protocol against the dev server:
1400×1000 viewport, DPR 2, `Input.dispatchMouseEvent mousePressed` held for
150ms. While held I read computed style, `:active` and a screenshot, then
released away from the target. I looked at the screenshots myself.

| Held | `:active` | box-shadow while held |
|---|---|---|
| Burger tile | true | `rgb(255,255,255) 0 0 0 2px inset`. White, because the mouse also hovers, so the tile shows the ink selected fill. |
| Fish & Chips, beside the 86'd Steak | true | white inset (same reason) |
| Mains (selected category) | true | white inset on ink |
| Drinks | true | `rgb(3,33,37) … inset`, ink on white |
| **Steak, 86'd** | true | **`none`** |
| *Back to payment* | true | ink inset |
| *Manager: take over payment* | true | ink inset |

At rest, every one of these is `none`. The static `?state=pressed` fixture
computes the same rings on Mains (white), Sides (ink) and Fries (ink, no hover
fill), and its screenshot shows them.

Evidence (`press-menu.mjs`, `shots/*.png`, `shots/results.json`) is in this
session's scratchpad, `/private/tmp/claude-501/…/30c975e1-…/scratchpad/`. It
is temporary and **not in the repo**.

#### Not checked

- **Hover suppressed on a touch device.** I tried
  `Emulation.setEmulatedMedia` with `hover: none` / `pointer: coarse`, but
  `matchMedia('(hover: hover)')` stayed true, so the emulation did not apply.
  That check is void. The media query is guarded only by the test, which I did
  see fail.
- **Focused and pressed together.** Tab reaches the Burger tile and the focus
  ring computes (`rgb(171,255,174) 0 0 0 6px`), but I did not hold a press
  while it was focused. A mouse press drops `:focus-visible`, and Space does
  not activate a link. This is the same gap FE-003 reported. The combined rule
  exists for tiles and categories.
- **The Drinks held screenshot is mis-clipped.** It shows the top of the rail.
  The computed style while held is the evidence for that row. The `pressed`
  fixture screenshot shows the ink ring on Sides.
- A real touch device, and `vite preview`.

#### Judgement calls — each is a lead ruling, not mine

1. **The registry does carry the rail and the 86 tag.** The task's premise was
   wrong. All of these are sourced from `structure.css` or `visual.css`:
   - rail: `--frost-category-width` (172) and `--frost-category-height` (72)
   - tile: `--frost-unavailable-border` (the dashed `.tile--off` border)
   - 86 tag: `--frost-unavailable-tag-surface`, `--frost-tag-padding`,
     `--frost-text-10`, `--frost-tracking-tag`, `--frost-leading-tag`
   - The 86 tag's white text is `--frost-primary-text`. That is docs/DESIGN.md's
     own mapping (frontmatter `tag-86: textColor: "{colors.primary-text}"`), not
     a number match.

   **Genuinely absent, and omitted:**
   - the lock actions' inline widths, 220px and 260px. Each action is sized by
     its padding.
   - their 10px top margin. The action now sits directly under the text, and
     the screenshots show it tight.
   - the loading label's `.1em` tracking.

   **Mapped onto the scale, and flagged in case the lead counts this as
   approximating:**
   - rail row padding `0 16px` → `0 var(--frost-space-4)`, as F2a did for the
     panel head
   - menu notice margin `12px 16px` → `space-3 space-4`
   - loading block padding 24px → `space-6`
   - skeleton bar height and margin → `space-3` and `space-2`. This copies
     FE-001's verifying bar, which is inherited styling (DESIGN.md Open item 8)
     and PROVISIONAL.
2. **`loading` keeps the category rail.** The task table says "Rail and grid
   both absent". The artifact's `.catrail` is `data-unless="lock-draft
   lock-lease"`, so the rail stays while loading, and I followed the artifact.
   Only the grid gives way to the skeleton. Reversing this is one condition in
   `MenuRegion.tsx` plus one test.
3. **Every enabled tile is a link to `?state=sheet-item`.** In the artifact,
   only Burger is an `<a>` (and Fries in `pressed`); the rest are `div`s, which
   `frost-states.css` gives no ring and no hover. I read that as fixture
   shorthand. Available tiles are touch controls. M-2, the item sheet, is F2c,
   so the link falls back to `default`.
4. **Categories are links to `?state=default&category=<id>`.** The artifact's
   rows are `div`s. `frost-states.css` rings `.cat:active` on any element, so
   they are meant to be pressable. The artifact has a grid for Mains only, and
   that grid includes sides and drinks. So `category` is ignored, and every tap
   lands on Mains.
5. **Route-out hrefs are my names**: `?state=settle-pending` and
   `?state=settle-takeover`, after the artifact's
   `settlement.html?state=pending|takeover`. This mirrors F2a's `?state=settle`.
   Both fall back to `default`, which shows an unlocked order. That is fine for
   a fixture, but **F3 must replace them**.
6. **The panel in `eightysix` and `loading` is not the artifact's.**
   - In `eightysix`, the artifact tags the pending Steak *line* with `86`.
   - In `loading`, it replaces the lines and totals with a skeleton.
   - Both are panel markup, which this task forbids editing. The panel draws
     the table order instead, which is exactly the artifact's `catalog` panel.
   - Worth knowing: a pending line holding an 86'd item is the setup for
     `fireblocked`, which is F2c.
7. **`pressed` holds two categories**, Mains and Sides, plus Fries. The task
   says "a category". The artifact holds two so both ring colours show.
8. **Semantics the artifact does not carry:**
   - `aria-current="true"` on Mains
   - `role="status"` on the catalog and lock notices
   - `aria-busy` on the skeleton, with the bars `aria-hidden`
   - `aria-disabled` on the 86'd tile, from DESIGN.md
9. **Shared class.** The route out is `.action .action--compact`: 48px at 13px,
   per DESIGN.md Buttons. It inherits F2a's `a.action` pressed, focus and hover
   rules rather than duplicating them.

#### Found, not fixed

1. **The pressed ring on the selected category is effectively invisible.** A
   white 2px inset ring on an ink fill, beside a white rail, only makes the
   fill look 2px smaller. The `pressed` screenshot shows Mains unchanged to
   the eye. The same happens on a held tile under a mouse, whose hover fill is
   ink. On touch, with no hover, a tile gets the ink ring and reads clearly.
   This is the A7 rule working as written. It belongs on the design branch.
2. **The catalog notice pushes the whole grid down about 95px.** In `catalog`,
   Steak sits at y 170.6 instead of 76, and every tile moves under the
   cashier's hand. That is the move C-3 forbids for one 86'd tile, applied to
   all twelve. The artifact does the same. It is a design question, not
   something to fix silently.
3. **Notices sit 4px out of line with the grid.** The notice margin is 16px
   and the grid padding is 12px. The artifact is the same.
4. **The 86 tag is 10px**, below the 13px floor for what a cashier acts on.
   The Supplement Rule arguably covers it: the dashed grey tile says the same
   thing at 15px. Noted only.
5. **The header bar is still empty.** The artifact's header has *← Floor* and
   *Release*, and no F2 slice lists it. Under a lock, those would be the only
   other controls on the frame.

---

### Lead verification and rulings, 2026-09-17

**Run and read, not taken from the handoff.**

- **`npm run verify`: 13 files, 273 tests passed**, typecheck clean. Up from 213.
- **Acceptance criterion 1 proven by deleting it.** Removing both route-out
  actions from `menuFixtures.ts` failed exactly four tests, and the names are
  the point: *"carries exactly one action, a link that goes somewhere"* and
  *"whole screen: the panel stays inert and readable, and the notice's action is
  the only way out"*, once per lock. **The cross-slice check is encoded as a
  test**, not left to a reviewer remembering to look. That is better than what
  the task asked for.
- **The panel edit stayed in bounds.** `git diff` on `OrderPanel.tsx` is the
  placeholder swap and a comment. Panel markup untouched, as required.
- **Two screenshots opened and looked at.** `lock-draft` shows the notice with
  *Back to payment* as the only control on the frame, the panel beside it fully
  legible with every slot empty and all four close-bar actions off. `eightysix`
  shows Steak greyed and dashed in **slot three of row one**, the grid not
  reflowed, Fish & Chips live beside it.

#### The task file's premise was wrong, and the implementer checked

**This task asserted the registry carries nothing for the category rail or the
`86` tag. It carries all of it** — `--frost-category-width`,
`--frost-category-height`, `--frost-unavailable-border`,
`--frost-unavailable-tag-surface`, `--frost-tag-padding`, `--frost-text-10`,
`--frost-tracking-tag`. The lead's grep was too narrow (`cat-` misses
`category-`; `86` misses `unavailable-`) and the conclusion was stated far too
confidently. `builder6` checked rather than following the premise into omitting
values that did not need omitting.

**Second wrong premise in this file:** the state table says `loading` shows
neither rail nor grid. The artifact's `.catrail` is
`data-unless="lock-draft lock-lease"`, so the rail stays while loading.
`builder6` followed the artifact. Correct — and this is now the third time a
task file has been wrong where the artifact or inventory was right. **The
standing rule stands: a task file is derived; where it disagrees with a
reviewed artifact, raise it and follow the artifact.**

#### Rulings

**Accepted as right:**

- **Genuinely absent values omitted**: the lock actions' 220px/260px widths,
  their 10px top margin, the loading label's `.1em` tracking. Each commented.
- **Spacing mapped onto the spacing scale** — rail padding, notice margin,
  loading padding, skeleton bar. Flagged in case the lead counted it as
  approximating; it is not. These are spacing facts and **should** track the
  spacing scale, which is the same reasoning as the ring-offset ruling. The
  warning was against a token that shares a number for an unrelated reason.
- **Enabled tiles and categories are links.** The artifact draws most as `div`s
  with only Burger as an `<a>`; that is fixture shorthand, and a menu tile is a
  touch control. `frost-states.css` rings `.cat:active` on any element, which
  confirms they are meant to be pressable.
- **`pressed` holds two categories**, so both ring colours show. Better than the
  task's "a category".
- **Semantics the artifact does not carry** — `aria-current`, `role="status"`,
  `aria-busy`, `aria-disabled` on the 86'd tile. Added correctly.

**Accepted with the debt named:**

- **Three placeholder route names now exist** — `?state=settle`,
  `?state=settle-pending`, `?state=settle-takeover`. Fine for fixtures.
  **F3 reconciles all three**; it is the first thing F3's task file says.
- **The panel in `eightysix` and `loading` is not the artifact's.** The artifact
  tags the pending Steak *line* with `86`, and replaces the panel with a
  skeleton while loading. Both are panel markup, which this task forbade
  editing, so the panel draws the table order instead. Real gaps, correctly
  deferred rather than smuggled. **The 86'd line in the panel is F2c's** — it is
  the setup for `fireblocked`.

#### Carried forward — and this is now twice

**Focused-and-pressed has gone unverified in two consecutive slices.** FE-003
reported it; FE-004 reports it again, for the same reason: a mouse press drops
`:focus-visible`, and Space does not activate a link, so FE-002's keyboard
method does not carry to link-shaped controls.

That repetition is a signal, not an accident. The underlying question is
whether a menu tile, a category and an order-line body should be `<button>`
rather than `<a>` — which is a semantics decision with real consequences for
keyboard operation, and **not an implementer's to take mid-task**. It is now the
lead's, and it must be settled before F2c adds more link-shaped controls.

Also not checked: hover suppression on touch. `Emulation.setEmulatedMedia` did
not take — `matchMedia('(hover: hover)')` stayed true — so `builder6` declared
the check **void** rather than reporting a pass it had not earned. The media
query is guarded by the test, which was seen to fail.
