# FE-011 — Fire refusal, fire failure, and command rejection (F2h)

**Status:** Ready, unassigned. Written 2026-09-22 by `lead`.
**Roadmap item:** F2h
**Branch:** `agent/phase-0-foundations`
**Baseline:** `12e9ca6`, 897 tests across 17 files, typecheck clean (lead-verified
2026-09-21). **Re-run it before you start** and state what you got; the suite
includes seven PostgreSQL migration tests, so run `npm run db:up` first if
`restaurant-pos-db-1` is not up.

---

## What this slice is

Three POS-03 states the panel and the menu region have never drawn, and two
corrections that were deferred out of F2b because panel markup was out of that
slice's bounds.

| State | What it is | Requirement |
|---|---|---|
| `fireblocked` | Fire is refused because a PENDING line holds an 86'd item | `FR-E4`, `B-17` |
| `error` | A command was rejected; the order is exactly as it was | `B-20` |
| `fireerror` | A fired round's kitchen ticket did not print | `FR-E3` |

Plus:

- **The `86` tag on a PENDING line** whose item has gone unavailable — in
  `eightysix`, `fireblocked` and `sheet-item86`. Deferred out of F2b and again
  out of F2c; the artifact draws it and `apps/pos` does not.
- **The panel's loading skeleton.** The artifact replaces the lines and the
  totals with skeleton bars in `loading`; `apps/pos` draws the full table order
  behind a loading menu.

**One of these three is a rule, not a picture.** Firing is refused as a function
of what the order holds, so `fireblocked` is a gate in the same sense `FR-F8`
and `FR-H3` are — and F2i and F2j both built theirs as a pure module the
components ask (`discount.ts`, `void.ts`). **Follow that pattern.** A component
that decides for itself whether fire is blocked is a rule that is correct only in
the state the artifact happens to draw.

---

## Read the artifact from the design worktree, not from this branch

`docs/design/visual-directions/` **exists on this branch and is out of date.** It
predates both DESIGN-004's remediation and A7. For `order.html` the two copies
differ only by A7's `pressed` additions, so the four states above are identical
either side — the lead diffed them. **`settlement.html` on this branch still
carries DESIGN-004's critical defect** (a zero balance and a live close in its
own rejected-close state). None of that is yours to fix, and you should not read
this branch's copy as reviewed. Read
`../restaurant-pos-design/docs/design/visual-directions/frost/pos/order.html`.

---

## 1. `fireblocked` — the refusal, and the rule behind it

`FR-E4`: *Firing is blocked while any `PENDING` line holds an item that is 86'd,
until that line is voided or the item is restored.* `B-17`: *An 86'd item cannot
be added to an order, and a pending line holding one blocks the fire.*

What the artifact draws (`order.html:100-102, 223-236, 280-284, 295-301,
361-371`):

- **The Steak tile is 86'd in place** — greyed, keeping its slot, carrying the
  `86` tag. This already works (F2b, ruling C-3).
- **The panel holds the three-item table order**, its PENDING Steak line tagged
  `86`, the pending group's header still reading `REMOVE FREELY`.
- **A notice sits inside the panel, between the lines and the totals:** *"Cannot
  send to the kitchen / 1 pending line is no longer available: **Steak**. Void
  that line or ask a manager to put the item back on."*
- **Only *Send to kitchen* is unavailable.** Discount, Void order and Settle stay
  live. The panel's totals are the 405.000 set.

### Build it as a rule the close bar asks

A pure module — `fire.ts`, beside `discount.ts` and `void.ts` — that takes the
order on screen and the unavailable items and answers which PENDING lines block
the fire. The notice's count and the item it names are **derived from that
answer**, not written per state: *"1 pending line is no longer available:
Steak"* is one line's worth of the artifact's own copy and the module knows the
line.

**The resolution path must actually resolve.** The notice tells the cashier to
void that line, and the line's `×` in its trailing slot is that void (`AC-3`:
removing an unfired line *is* voiding an unfired line; `FR-H2`: no approval,
nothing written). The panel already honours `?gone=` where the fixture has
figures, and `totalsWithout.steak` exists. So `?state=fireblocked&gone=steak`
must drop the notice and make *Send to kitchen* available again. **That is the
test with teeth**, and it is why the module must read the order rather than a
per-state flag.

### The line needs to know its item

`OrderLine` has no item identity, and the unavailability fact lives on the menu
fixture (`MENU_FIXTURES[state].eightySixed`). Give the line the item it is for.
The identification is the artifact's own — its grid prices Steak at 240.000 and
its pending line is a Steak at 240.000 — so this invents nothing. Not every line
has a tile (`overflow` holds a Cheesecake the grid does not sell), so the field
is optional and a line without one can never block a fire.

### Only *Send to kitchen* goes off

`OrderActions` today takes a single `off` flag and draws all four controls
unavailable together (`OrderPanel.tsx:391`). `fireblocked` needs one control off
while three stay live. Keep the existing behaviour exactly where it already
holds: **under either lock and on an empty order all four are off.**

### The refusal must be discoverable at the control — lead's ruling

The notice explains the refusal; the disabled control is what the cashier
presses. Point one at the other (`aria-describedby` from the unavailable *Send to
kitchen* to the notice). **Reasoning:** F2e established that a failure a
screen-reader user is never told about is a real defect, which is why both PIN
pads gained `role="alert"`. A control that is inert with no announced reason is
the same shape. If you think a different mechanism is right, say which and why.

**`role` on the notices:** `fireblocked`'s is `role="status"` — a standing
condition of the order, drawn before anyone presses anything, the same as
`CATALOG_NOTICE`. `error`'s is `role="alert"` — the result of an action that
failed, the same as F2e's ruling for the PIN failures.

---

## 2. The `86` tag on a PENDING line

The artifact tags the pending Steak's **name** with the `86` tag in `eightysix`,
`fireblocked` and `sheet-item86` (`order.html:229-231`). `apps/pos` tags the
tile only. `orderFixtures.ts:297-311` records both of these as owed to this
slice, in its own comments.

Derive it from the same unavailability fact as the fire block, not from a
per-state flag: a PENDING line whose item is 86'd carries the tag. `tag-86` is
already in `pos.css` (`:739`) and the tile already uses it. `sheet-item86` is a
state whose menu fixture already 86s Steak, so the tag must appear there too —
which is what makes this a correction to committed work rather than a new state.

**A FIRED line never takes the tag.** The item's availability has nothing to do
with work already in the kitchen, and the round header's slot already carries
`MANAGER TO VOID` (`I-7`, `I-12`).

---

## 3. `error` — a rejected command changed nothing

`B-20`: *An approval that is cancelled, a tender that is rejected, or a fire that
is blocked leaves the order exactly as it was.*

The artifact (`order.html:68-71`) puts a notice in the menu region, above the
live grid: *"Could not add that line / The order is exactly as it was. Nothing
was half-applied."* with a **Try again** control. The panel draws the artifact's
default order; the grid stays live, because adding the line again is the whole
point.

Two things to get right:

- **Try again acts on the screen it is on.** It clears the notice and leaves the
  order as it is — which is all `B-20` claims, and all this app can truthfully
  do with no server. So it is a `<button>` (ruling of 2026-09-17: an anchor goes
  to a screen that already exists), and it **replaces** the history entry
  (`[INLINE]`, SITEMAP §1). The artifact draws it as an anchor to `order.html`;
  that is fixture plumbing, and fixture plumbing does not dictate semantics.
- **It must not hardcode a destination.** Landing on `?state=default` from a
  rejection drawn over another order is the exact defect F2k spent a slice
  removing, in a fifth place. The view it returns to belongs to the state's own
  fixture — as `sheetFixtures`' `remove: { state, gone }` already does — not to a
  constant in a component. With one composition that resolves to the table
  order, and the test that matters is that the order either side of the press is
  the same order.

**This adds no node.** SCREEN-INVENTORY lists *error* as a POS-03 state (`command
rejected by the server; order left exactly as it was (B-20)`); SITEMAP enumerates
no `[INLINE]` node for it, as it enumerates none for *loading* either. A state on
an existing screen is not a node — DESIGN-002's precedent, and A7's
`category-invalid`.

---

## 4. `fireerror` — the emergency banner, and an artifact contradiction

`FR-E3`: a fire's delivery may become `PRINTED`, `FAILED` or `UNKNOWN`; `FAILED`
and `UNKNOWN` kitchen work are **persistent emergency incidents on both
clients**, application-wide, never actor-scoped. Printing never blocks or rolls
back the sale.

The artifact (`order.html:28-35`) puts the banner above the screen: *"Kitchen
ticket did not print — Table 1, round 2 / The order is unaffected. The kitchen
has not seen this work."*, with **Open incidents** at the end. The panel draws
the two fired rounds and the default totals; there is no pending line.

- **The banner already exists in this app.** FE-001 built `.emergency-banner`
  with its mark, title, detail and action for POS-01's `incident` state
  (`pos.css:76-127`, `App.tsx`). This is the signed-in variant of the same
  component: `FR-E3b` withholds *detail* before sign-in, and POS-03 is behind the
  PIN, so here it names the table and the round. Reuse the component; do not
  restyle it.
- **Open incidents is a placeholder anchor.** It goes to **POS-07, Print
  incidents** (SITEMAP; the artifact's `incidents.html`), which is not built —
  F4. F2b set the precedent with three `?state=settle*` placeholders in
  `LOCK_NOTICE`; follow it and record the name so F4 reconciles it. It genuinely
  leaves the screen, so it is an anchor, and it is the one anchor this slice adds.

### RULED — round 2 is drawn *not printed*, and the artifact is wrong here

The artifact's round header reads `Round 2 · fired 19:58 · printed` **in
`fireerror` as well**, because one round group serves every state in a
`data-unless` list. So the panel tells the cashier the round printed while the
banner above it says the ticket did not. **Draw it `not printed`.**

Three reasons this is a correction and not an invention:

- **`OrderFixture` already models it.** `RoundGroup.printed` is a boolean and
  `OrderPanel` already renders `printed ? 'printed' : 'not printed'`
  (`OrderPanel.tsx:230`). No fixture has yet used `false`. No new copy, no new
  composition, no new value.
- **`I-7` is the round header's whole purpose**: the cashier can answer *"did
  this go to the kitchen?"* without asking anyone. In `fireerror` the honest
  answer is no, and `FR-E3`'s banner says so a few pixels higher.
- **This is the fourth instance of one heuristic**, and the lead found it writing
  the task rather than building it. DESIGN-004: a live close on a stale balance.
  F2g: a live confirm during the approval lockout. F2j: *"Nothing has been sent
  to the kitchen"* beside two fired rounds. **A control or a string shared across
  states is where to look, because the sharing is what hides the one state in
  which it is wrong.**

Say so in your handoff as a deviation from the artifact, with the reasoning, so
it reaches the design branch as a finding rather than as a silent difference.

---

## 5. *Send to kitchen* stops navigating — the fifth home of the opener defect

`ACTIONS`' fire entry is `{ id: 'fire', label: 'Send to kitchen', search:
'?state=fireerror' }` (`OrderPanel.tsx:387`). `fireerror` is not a state today,
so `orderViewFrom` falls back to `default` — and `order-panel.test.tsx:144`
asserts exactly that fallback.

**This slice is where that becomes dangerous.** Once `fireerror` is a real state,
pressing *Send to kitchen* from `overflow`, `other-discount` or `zero` swaps the
cashier's order for the fire-error fixture's. That is F2k's defect in a fifth
place, and building `fireerror` without touching the control would create it.

**Ruled: firing opens nothing, and moves nothing.** Pressing *Send to kitchen*
must leave the order, the URL and `history.length` exactly as they were.
`?state=fireerror` stays reachable from the fixture-state nav, as every reviewed
composition is.

**Why the control does not produce a result** — this is the reasoning, and it
should go in the code as a comment:

The result of firing *this* order is a new fired round holding the lines that
were pending, with a time, and a delivery outcome. **The artifact draws no such
composition and the app has no clock**: every round header's time is a literal of
the artifact's (`19:42`, `19:58`), and minting a time for a round nobody fired
invents data. The artifact's own *Send to kitchen* link is inconsistent with its
own default state for the same reason — it lands on an order whose pending Steak
has vanished rather than been fired.

So this is A7's shape again, and the precedent is FE-001's PIN, which *"is
compared against nothing and goes nowhere"*: a fixture control with no reviewed
result and no server does nothing, visibly and deliberately, rather than lying
about where it went. **What firing shows on POS-03 is owed to a designer** — the
lead will carry it.

---

## 6. The panel's loading skeleton

`order.html:274-276` and `:358` replace the panel's lines and its totals with
skeleton bars while the menu loads; `apps/pos` draws the whole table order
behind a loading menu region. Recorded as owed in `orderFixtures.ts:297-300`.

The bars already exist as `.menu-loading__bar` in the `--80/--60/--40` widths
the artifact uses (`pos.css`). The artifact's panel skeleton is `w80 w60 w80` in
the lines area and `w60 w40` in the totals. Reuse the existing class or factor it;
**write no new lengths** — `no-invented-values.test.ts` will refuse them and it
is right to.

The header's count in `loading` is the artifact's own; do not change what the
header says while you are in there.

---

## HELD, deliberately — do not build these

- **`PRINTED` and `UNKNOWN` fire results.** SITEMAP gives POS-03 one `[INLINE]`
  node covering all three (`Fire result — ticket printed / FAILED / UNKNOWN`),
  and the artifact draws **FAILED only**. `PRINTED` arguably needs nothing — the
  round header already says `printed` — and `UNKNOWN` is a distinct urgency the
  artifact never draws. Name them in your handoff; invent neither.
- **The fire transition itself**, for the reason in section 5.
- **The menu tile's opener.** Still every tile opening Burger's sheet, still
  `A7`-shaped, still on the lead's list. You are in `MenuRegion.tsx` for the 86
  tag's source of truth at most; leave the tile's opener alone.

---

## What must not change

**Everything else.** In particular:

- **`I-12` still holds**, and its guard still reads *"no trailing slot has an
  anchor or button ancestor"* with all its detector self-tests. The 86'd PENDING
  line keeps its remove control — the tag goes on the **name**, inside the row
  body, never in the trailing slot. A gated action never occupies the position an
  ungated one has taught.
- **`B-12` still holds on both PIN pads.** You should not be near them.
- **The reachability guard still passes, including its self-tests.** `error` and
  `fireblocked` add notices to a live screen and `fireerror` adds a banner: every
  control they add must lead somewhere ungated. The banner's *Open incidents*
  leaves for POS-07, which is not built — say how you satisfied the guard rather
  than adjusting it.
- **The lock states stay inert**, the route out stays the only control on the
  frame, and nothing this slice adds is reachable under either lock (`FR-G12`,
  `FR-G13`, `AC-21`, `AC-29`). A locked order can hold a PENDING line
  (`FR-G10`), so an 86'd pending line under a lock must draw **no** remove
  control and **no** live fire control.
- **`<button>` for acting, `<a>` for going.**
- **Only *Settle* pushes a history entry.** Everything that stays on POS-03
  replaces (SITEMAP §1). Corrected once already, after review — do not undo it.
- **No invented values. No `Number()` on money. No hover outside
  `@media (hover: hover)`. No console, storage, cookie or fetch.**
- **The `?state=` fixture states keep working for review.**
- **`order-panel.test.tsx:144` is testing the unknown-state fallback, not
  `fireerror`.** Point it at a string that is genuinely not a state. Do not
  delete it.

---

## Required inputs

1. **`../restaurant-pos-design/docs/design/visual-directions/frost/pos/order.html`**
   — states `error`, `fireerror`, `fireblocked`, `eightysix`, `loading`,
   `sheet-item86`. Not this branch's copy; see above.
2. **`docs/PRD.md`, `FR-E1`–`FR-E5`, `FR-C6`, `FR-C7`**, and
   **`docs/BOUNDARIES.md` `B-16`, `B-17`, `B-20`** — in their own words.
   `AC-12` and `AC-31` are the acceptance criteria that name this behaviour.
3. **`docs/design/SCREEN-INVENTORY.md`, POS-03** — the states list and *Must not
   invent*. **`FR-E5`/ruling C-2 is in there and is F2d's, not yours**: a quick
   sale has no fire control at all.
4. **`docs/design/SITEMAP.md` §1 and POS-03's node list**, in the design
   worktree — `[INLINE]` is neither a route nor back-stackable, and the fire
   result is an `[INLINE]` node of POS-03.
5. **`apps/pos/src/` and all of `apps/pos/test/`.** Particularly `void.ts` and
   `discount.ts` as the shape to copy, `OrderPanel.tsx` (`OrderActions`,
   `RoundGroupView`, `navigate`), `menuFixtures.ts` (`eightySixed`) and
   `orderFixtures.ts` (its comments name both corrections).
6. **`.agent/tasks/FE-010-opener-fix.md`** — the opener defect's shape and the
   in-place pattern, and **`.agent/reviews/FE-010-review.md`**, whose worst
   finding was an acceptance criterion of this lead's.

---

## Acceptance criteria

1. **`fireblocked` draws the artifact's composition**: the 86'd tile in place,
   the PENDING Steak line tagged `86`, the panel notice naming that line, the
   405.000 totals, and *Send to kitchen* unavailable while Discount, Void order
   and Settle stay live.
2. **Fire refusal is a rule read off the order, not a per-state flag.** A pure
   module answers which PENDING lines block the fire, and the notice's count and
   named item come from that answer. Tested.
3. **The refusal resolves.** From `?state=fireblocked&gone=steak` the notice is
   gone and *Send to kitchen* is available. **Prove the module red**: make the
   block ignore the order's lines, or point it at a per-state flag, and say how
   many tests fail.
4. **A PENDING line whose item is 86'd carries the tag, in every state where
   that is true** — `eightysix`, `fireblocked`, `sheet-item86` — and a FIRED line
   never does. Tested over all states.
5. **`error` draws the rejection over a live screen**: the notice with the
   artifact's copy, the grid still live, the order unchanged. **Try again is a
   button, returns to the order the notice was drawn over, and replaces the
   history entry.** Tested: `history.length` unchanged, and the order either side
   of the press is the same order.
6. **`fireerror` draws the emergency banner** with the artifact's copy over the
   order it draws, reusing FE-001's component, with *Open incidents* as the one
   anchor and a placeholder destination recorded for F4.
7. **Round 2 reads *not printed* in `fireerror`**, and no other state changes its
   print wording. Tested.
8. **Pressing *Send to kitchen* moves nothing.** From `default`, `overflow` and
   `other-discount`: the order, the URL and `history.length` are unchanged, and
   no sheet or prompt opens. **Prove it red** by restoring
   `search: '?state=fireerror'` and showing what fails.
9. **The panel draws the skeleton in `loading`** — lines and totals both —
   using existing width classes and no new lengths.
10. **All 897 existing tests still pass**, none deleted or weakened. Every test
    you changed is listed with its reason; `order-panel.test.tsx:144` is
    repointed, not removed.
11. **Verify in a browser and say what you did.** At minimum: press *Send to
    kitchen* on `fireblocked` and confirm nothing happens; remove the 86'd line
    and confirm the notice clears and the control returns; read the round header
    in `fireerror` against the banner above it; press *Try again* on `error`.
12. **`npm run verify` passes.** State the new test and file counts. Typecheck
    clean.

**Prove at least one guard red by injecting the defect it claims to catch**, and
say which and what failed. The lead will do the same independently, and an
independent reviewer will read this slice — it encodes a rule (`FR-E4`), which is
the class of slice where an implementer following a wrong task file faithfully
cannot catch it.

---

## Out of scope

- `quick`, `quick-line` — **F2d**, the next slice, which changes the order's
  identity and the panel header. `FR-E5`/C-2's "no fire control at all on a quick
  sale" is F2d's, not yours: leave the control's presence alone.
- **Settlement.** `?state=settle*` stay placeholders; `settlement.html` on this
  branch is not reviewed (see above). F3.
- **POS-07, print incidents.** A placeholder destination only. F4.
- **Recomputing totals.** No total is computed and none is invented; a removal
  the fixtures cannot draw does nothing, exactly as today.
- **Focus trapping and the stacked scrims.** Six slices running. Real, not
  acceptable at ship, not this slice. Mention them if you touch anything near
  them.
- Any new visual state, token or CSS value beyond reusing what exists.

---

## Handoff

Name the command and the URL the owner opens, and what to press to see each
state. List every test you modified and why. List anything you held and why.

**Raise judgement calls rather than taking them.** Eight slices, eight task-file
errors of this lead's — and FE-010's was found by an independent reviewer rather
than by the implementer, because the file was confidently specific about a
document the slice never otherwise opened. **Where this file disagrees with
`docs/BOUNDARIES.md`, the PRD, `SITEMAP.md` or `SCREEN-INVENTORY.md`, those win
and this file is the defect.** Two of this file's rulings are the lead's own
judgement rather than a reviewed fact — the *not printed* round header and the
inert fire control — and both are stated with their reasoning so you can argue
with them.

Do not commit, and do not touch `.agent/MEMORY.md` or `.agent/ROADMAP.md`. The
lead verifies with `git log`, a browser, and by injecting the defects your tests
claim to catch.

---

# HANDOFF — `builder13`, 2026-09-22

**Done.** All twelve acceptance criteria met. Not committed, as instructed.
`.agent/MEMORY.md`, `.agent/ROADMAP.md` and every contract document untouched.

**Baseline re-run before starting:** `npm run verify` → **897 tests across 17
files, typecheck clean**, matching the task file. `restaurant-pos-db-1` was
already up (5 days, healthy), so the seven PostgreSQL migration tests ran.

**Now:** `npm run verify` → **1020 tests across 18 files, typecheck clean.**
No test deleted, none weakened.

## Open it

```
npm run dev -w apps/pos
```

Then **http://127.0.0.1:5173/pos/order** — the fixture-state nav sits under the
1280×800 frame; the three new rows are at the end.

| To see | Press / open |
|---|---|
| The refusal | `?state=fireblocked`. **Scroll the order list down** — the panel notice is `flex: none`, so on a three-line order the named Steak row starts below the fold. The artifact's `.lines` is `flex:1; overflow-y:auto` too, so this is its layout, not a change |
| The refusal resolving | On `fireblocked`, press the `×` on the Steak row. Notice goes, *Send to kitchen* comes back, totals drop to 155.925. Same by URL: `?state=fireblocked&gone=steak` |
| Firing moving nothing | Press *Send to kitchen* on any live state. URL, order and Back history are unchanged and nothing opens |
| The rejection | `?state=error`, then press *Try again* |
| The banner | `?state=fireerror` — read **Round 2 · fired 19:58 · not printed** against the banner above it |
| The panel skeleton | `?state=loading` |
| The 86 tag on a line | `?state=eightysix`, `?state=fireblocked`, `?state=sheet-item86` |

**Verified in a browser, all of the above**, at 1280×800. Console clean: no
errors, no React warnings, only Vite's own connect lines.

## Two judgement calls I am raising rather than taking

### 1. The refusal fires in three states, not one — and I believe the artifact is wrong

This is the one thing the task file did not anticipate, and it follows directly
from what it asked for.

`eightysix`, `sheet-item86` and `fireblocked` all draw **the same order with a
PENDING Steak** and all three **86 Steak**. So in all three, "a pending line
holds an item that is 86'd" is true. `B-17` is a boundary — *"an 86'd item
cannot be added to an order, and a pending line holding one blocks the fire"* —
so the fire is blocked in all three, and a rule that reads the order says so in
all three.

**The artifact draws the notice in `fireblocked` only**, and leaves *Send to
kitchen* live in the other two (`order.html:379-382`: its `data-unless` list
excludes `fireblocked` alone). That lets a cashier fire an 86'd Steak from
`eightysix`, off the same order.

I built the rule. Scoping the notice back to `fireblocked` would be exactly the
per-state flag acceptance criterion 2 forbids, and `B-17` is not mine to weigh.
So `eightysix` and `fireblocked` now render identically — which is the finding:
for *this* order and *this* 86'd item they are one product state that the
artifact drew as two steps of a story. `test/fire.test.tsx` pins it deliberately
with a comment saying why, so nobody "tidies" it later.

**This is the fifth instance of the lead's own heuristic** — a control or a
string shared across states hides the one state in which it is wrong — and here
the sharing runs the other way: the *notice* was scoped when the *control* was
not.

### 2. `fireerror` holds no PENDING line, and that is a requirement

The task file says so and I followed it, but the reason is stronger than
"the artifact draws it that way": `FR-E1` has a fire collect **every** `PENDING`
line, so an order whose round 2 has just been fired cannot still hold one from
before it. A `fireerror` drawing the pending Steak would contradict `FR-E1` on
screen. Its figures are the artifact's own default set (165.000 / 155.925),
which this app already had as `tableTotalsWithout.steak`.

**Round 2 reads `not printed`** — the task file's ruling, built as ruled. Say it
to the design branch as a deviation: `RoundGroup.printed` was already a boolean
and `OrderPanel` already rendered both words, so no new copy, composition or
value; the artifact serves `fireerror` from a round group shared with every
unlocked state, which is why its header says `printed` a few pixels under a
banner saying the ticket did not.

## What I built

**`src/fire.ts` — new, the rule.** Pure, beside `discount.ts` and `void.ts`.
`holdsUnavailable` answers for one line, `blockingLines` for an order,
`fireRefusal` turns the answer into the artifact's sentence. The panel asks it;
nothing decides a block for itself.

**`src/EmergencyBanner.tsx` — new.** FE-001's banner, factored out of `App.tsx`
unchanged, with the action as either an anchor (leaving, POS-03 → POS-07) or a
button (acting, POS-01's *Sign in to view*). Not restyled: `pos.css`'s
`.emergency-banner*` rules are untouched.

**`OrderLine.itemId`, optional.** The identification is the artifact's own
(its grid prices Steak at 240.000, its pending line is a Steak at 240.000), so
it invents nothing. `overflow`'s Cheesecake deliberately has none — the grid
does not sell it — and a line without one can never block or be tagged.

**The three states**, their menu fixtures, the 86 tag on the line's *name*
(inside the row body, never the slot — `I-12` holds), the panel skeleton, and
the close bar taking one control off while three stay live, with
`aria-describedby` from the dead control to the notice as ruled.

**`.menu-loading__bar` → `.skel-bar`**, so the panel and the menu share one
class. Same declarations, same three widths, no new length.

## Held, as instructed, plus one I am adding

- **`PRINTED` and `UNKNOWN` fire results.** Neither built. `PRINTED` needs
  nothing the round header does not already say. **`UNKNOWN` is the gap worth
  naming**: `FR-E3` makes it an emergency of equal standing to `FAILED`, and
  `AC-23`/`AC-33` turn on kitchen-vs-receipt urgency, not on which of the two
  kitchen outcomes it is. The artifact draws `FAILED` only, so `UNKNOWN` has no
  reviewed copy — and "the kitchen has not seen this work" is precisely the
  sentence `UNKNOWN` cannot say. A designer's.
- **The fire transition itself** — no reviewed composition, no clock.
- **The menu tile's opener** — still `A7`-shaped, still the lead's. I was in
  `MenuRegion.tsx` only for the rejection notice and the bar rename.
- **NEW, mine:** the **plural of the refusal copy** is provisional. No reviewed
  state has two blocking lines, so *"2 pending lines are no longer available"*,
  the comma joining names, and *"Void those lines … put the items back on"* are
  mine — the artifact's sentence with only what English forces changed. Marked
  `PROVISIONAL COPY` in `fire.ts`, following `discount.ts`'s precedent. A
  designer owns the real wording.
- **NEW, mine:** `aria-describedby` on a `<span aria-disabled="true">` is
  reachable in a screen reader's browse mode but **not by Tab**, because the
  span is not focusable. The refusal is announced anyway — it is `role="status"`
  and appears with the state — so nothing is silent, but if the intent was that
  a cashier tabbing the close bar hears the reason, the unavailable action needs
  to be a `disabled`-but-focusable control, which is a design question about
  every `action--off` on the screen, not just this one.

## Reachability, without adjusting the guard

The guard in `test/sheets.test.tsx` is unchanged, self-tests included. It runs
over sheet states, and these three are not sheet states, so it is untouched —
adding them to it would fail for a reason that has nothing to do with this
slice, because on any live POS-03 state the panel's own void paths are
reachable by design (`FR-H4`).

Instead `test/fire.test.tsx` checks the claim that applies: **every control
these three states add leads somewhere ungated.** `error`'s *Try again* lands on
an ungated state and opens no prompt; `fireblocked`'s notice carries no control
at all (the resolution is the line's own `×`); `fireerror`'s *Open incidents* is
an anchor to POS-07, which is not a gated state of this screen.

**`?state=incidents` is a placeholder destination for POS-07**, named after the
artifact's `incidents.html`, following F2b's two `?state=settle*`. It resolves
to the default state today. **F4 reconciles it.** It is the one anchor this
slice adds, and `test/menu-region.test.tsx`'s anchor guard now names both it and
the lock notices.

## Every test I changed, and why

| File | Change | Why |
|---|---|---|
| `order-panel.test.tsx` | Fixture-state list gains `fireblocked`, `error`, `fireerror`; title extended | Three states added |
| `order-panel.test.tsx` | Unknown-state fallback **repointed, not removed** | It guards the fallback, and `fireerror` is a real state now. Points at `?state=settle-pending`, `?state=incidents` (the two placeholder names) and `?state=nothing-of-the-sort` — strictly more than the one case it had |
| `order-panel.test.tsx` | Close bar expects three asks, not four | *Send to kitchen* asks for nothing now. This is the assertion that proves criterion 8 red |
| `menu-region.test.tsx` | `.menu-loading__bar` → `.menu-area .skel-bar` | Class renamed so the panel can share it. Same count, same assertion |
| `menu-region.test.tsx` | Anchor guard admits the banner's route to POS-07 | Retitled *"every anchor on the frame **leaves POS-03**"*, which is the rule it was always testing; both anchors are still matched against an explicit selector |
| `sheets.test.tsx` | Panel-legibility reads the line's own name, not the name plus its tag | `sheet-item86` now tags its pending Steak — the correction F2c deferred. **Strengthened:** a new test asserts the tag appears in `sheet-item86` and in no other sheet state |

`test/fire.test.tsx` is new: 82 tests.

## Guards proven red by injecting the defect each claims to catch

| Injected | Failed |
|---|---|
| The block reads the state's 86 list instead of the order's lines (the per-state flag) | **19 tests**, including *"voiding the offending line clears the notice and brings Send to kitchen back"* — the half of `FR-E4` a flag cannot draw |
| `search: '?state=fireerror'` restored on the fire action | **5 tests**, across all three orders named in criterion 8 plus the close-bar contract |
| `fireerror`'s round 2 back to `printed`, as the artifact draws it | **1 test** — the `I-7` ruling |
| The 86 tag moved into the trailing slot | **6 tests**, `I-12` among them |

Tree restored and re-verified green after each.

## Untouched, confirmed

`I-12` and its detector self-tests; `B-12` on both PIN pads (never went near
them); the lock states inert, with the route out the only control on the frame
and an 86'd pending line under a lock drawing **no** remove control and **no**
live fire control (tested); only *Settle* pushes a history entry; `<button>` to
act, `<a>` to go; no invented value, no `Number()` on money, no hover outside
`@media (hover: hover)`, no console, storage, cookie or fetch; every `?state=`
still reachable for review.

**Focus trapping and the stacked scrims** — not touched, still owed.

---

# HANDOFF 2 — `builder13`, 2026-09-22, the lead's two additions

Both built, nothing else touched. Not committed.

**Before:** 1020 tests / 18 files. **After:** **1056 tests / 18 files, typecheck
clean.** No test deleted; three of mine rewritten, listed below with why.

## 1. Fire is unavailable when the order holds no PENDING line

`sendableLines(lines)` in `fire.ts`, beside the block, with the reasoning in its
doc comment: `FR-E1` collects every PENDING line, `FR-E2`/`B-16` send only lines
not previously fired, SCREEN-INVENTORY forbids a reprint-the-order control
outright, and the real reprint is POS-07's per `FR-E3`.

`OrderPanel` now asks two questions of the same module and draws the control
unavailable on either answer:

```
refusal      = fireRefusal(blockingLines(lines, unavailable))   → notice + aria-describedby
nothingToSend = sendableLines(lines).length === 0               → silent
```

**Inert in place, never absent** — `C-1`'s distinction, since adding a line
makes the order fireable again. Tested in every state that it is never absent.

**The two are kept apart deliberately.** A block is a refusal and owes the
cashier a reason; an order with nothing pending is not refusing anything, so it
draws no notice and `aria-describedby` is left unset rather than pointing at a
notice that is not there.

Seen in the browser at `?state=fireerror` (greyed under the banner, with
Discount / Void order / Settle live) and at `?state=fireblocked&gone=steak`.
`?state=default` is unchanged — fire still live.

### Three tests of mine rewritten, and what changed about them

The lead's ruling retires half of the task file's **acceptance criterion 3**:
*"From `?state=fireblocked&gone=steak` the notice is gone and Send to kitchen is
available."* The notice still goes — that is `FR-E4` resolving, and it is what
the criterion was really buying — but the control now stays off, because voiding
the Steak also removed the last PENDING line. **There is no fixture where the
block resolves and pending work remains**, so the two conditions cannot be
separated on screen; they are separated in the assertions instead.

| Test | Was | Now |
|---|---|---|
| *"voiding the offending line clears the notice and brings Send to kitchen back"* | Asserted the control became a `BUTTON` | Renamed *"…clears the refusal"*. Asserts no notice, no `aria-describedby`, and `blockingLines` empty on what is left — the refusal resolving, proved at the rule |
| *"the line's own remove control is that void"* | Ended on a `BUTTON` assertion | Drops it; the void and the cleared notice are the point |
| *"keeps the fire control live (B-15)"* | Asserted the fire control live | Split. `B-15` is now *"never gates or rolls back the sale"* — Discount, Void order and Settle live, which is what the boundary actually protects. A second test asserts the fire is off, silently, because every line is FIRED |

**A new test covers the rule generally**: over every `?state=` plus the two
`?gone=` views that take the last pending line away, the control is live exactly
when there is a PENDING line and nothing blocks it — computed from the fixtures,
not listed.

## 2. A guard on the provisional plural

`test/fire.test.tsx`: over `ORDER_STATES`, at most one blocking line per state.
It asserts `{ state, blocking }` rather than a bare number, so a failure names
the state instead of saying `2 is not 1`.

The comment says what it is for and, importantly, **what to do when it fails**:
not raise the number, but get the plural copy reviewed on the design branch and
then delete the test. A9's ring-offset pattern — an invisible coupling made a
checked one.

## Proven red

| Injected | Failed |
|---|---|
| `nothingToSend` dropped (fire live on a fully FIRED order) | **7** — `fireerror`, `default&gone=steak` and `fireblocked&gone=steak` each caught by the general rule, plus the three named tests |
| `overflow` 86s Coffee and House Wine, both of which it holds pending | **7**, the guard among them, reporting `expected { state: 'overflow', blocking: 2 } to deeply equal { state: 'overflow', blocking: 1 }` |

Tree restored after each; `npm run verify` green at 1056.

## One thing the second injection showed, for the record

86'ing two of `overflow`'s items failed **seven** tests, not one: the guard, the
86-tag inventory, the refusal-in-every-86'd-state test, and three older tests in
`order-panel.test.tsx` and `sheets.test.tsx` that assume `overflow`'s pending
rows are ordinary. That is the coupling working as intended — a fixture change
that would ship unreviewed copy cannot now do so quietly.

---

# HANDOFF 3 — `builder13`, 2026-09-22, `fireblocked-overflow`

Built as ruled. Nothing else changed. Not committed.

**Before:** 1056 tests / 18 files. **After:** **1077 tests / 18 files, typecheck
clean.**

## The state

`fireblocked-overflow` — *"Fire blocked — one of three pending lines"*, last in
`ORDER_STATES`. The long order with **Coffee** 86'd: one of its three PENDING
lines (Coffee 2 × 35.000, Cheesecake, House Wine) holds an unavailable item, so
`FR-E4` refuses the fire and names Coffee in the artifact's singular copy.

`?state=fireblocked-overflow&gone=of-coffee` is the case that was missing.
**The block clears while Cheesecake and House Wine are still pending**, so
*Send to kitchen* comes back for `FR-E4`'s own reason — *"until that line is
voided"* — and not because the order ran out of work to send. Verified in the
browser: notice gone, two pending rows still there with their remove controls,
the control live, totals on F2a's `1.115.000 / 1.170.750`, count 8 items, and
the Coffee tile still greyed in the grid because the *item* is still 86'd.

Nothing invented, and the test asserts it by identity rather than by eye:
`ORDER_FIXTURES['fireblocked-overflow'].groups`, `.totals` and `.totalsWithout`
are **the same objects** `overflow` uses. To make that true I lifted
`overflow`'s order, totals and `totalsWithout` into three consts above
`ORDER_FIXTURES` — a move, not a rewrite; `overflow` itself is byte-identical in
behaviour and has its own test asserting it is still untouched (nothing 86'd,
nothing tagged, fire live).

The menu side is one line: `'fireblocked-overflow': { eightySixed: ['coffee'] }`.
Coffee because the grid sells one at 35.000 against a 2 × 35.000 line — the same
kind of identification every other `itemId` rests on.

**The plural guard still passes at one blocking line.** 86'ing Coffee alone was
the point; 86'ing Coffee *and* House Wine would have produced two and tripped it.

## Three existing tests generalised, none weakened

Adding a fourth 86'd state broke three assertions that named Steak literally.
All three now derive the expected names from the state's own fixtures via a
`blockedIn(state)` helper, so they cover four states instead of three and would
cover a fifth without being touched:

| Test | Change |
|---|---|
| *"is exactly the **three** states whose menu fixture 86s something"* | Now four, and lists them |
| *"the pending Steak carries it"* | Now *"the line holding the 86'd item carries it, and it alone"* — expected names computed, asserted non-empty |
| *"the fire is refused wherever the order holds one"* | Asserts every blocking line's name appears in the notice, instead of the string `Steak` |

`order-panel.test.tsx`'s fixture-state list gains the id; its title now reads
*"…and the four of F2h"*. The general *"live exactly when there is a PENDING line
and nothing blocks it"* rule gained the new `&gone=` view, making it three
resolution views over every state.

## Proven red

| Injected | Failed |
|---|---|
| The block reads the state's 86 list instead of the order's lines | **22**, four of them `fireblocked-overflow`'s — it now catches the per-state flag in a state where Cheesecake and House Wine would wrongly be tagged and named too |
| The refusal reads the fixture's lines and ignores `?gone=`, so a block never resolves | **5**, including ***"voiding Coffee brings Send to kitchen back WHILE two lines are still pending"*** |

That second injection is the one worth reading. Before this state it failed only
on the *notice* still being drawn — the control stayed unavailable either way,
because on `fireblocked` the Steak was the last pending line. Now the same defect
also fails on the control never coming back, which is the half of `FR-E4` the
suite could not previously see.

Tree restored after each; `npm run verify` green at 1077.

## One thing I have to report about my own work

While extracting `overflow`'s fixture I ran `npx prettier --write` on
`orderFixtures.ts`. **The repository has no Prettier config and does not depend
on Prettier**, so it reformatted the whole file to its defaults — double quotes,
different wrapping — a 541-line diff over a hand-formatted file. Prettier does
not round-trip this file at any print width I tried, so there was no formatting
fix; I restored the file from `HEAD` and re-applied every F2h change to it as a
single scripted pass.

The file is now what it should have been: `git diff --stat` reads
**274 changed lines** on `orderFixtures.ts` (the extraction accounts for most of
the deletions), and the only double quotes in it are inside prose comments I
wrote. The suite and typecheck were green before and after the restore, at the
same counts. Flagging it because nothing in the diff would have shown you it
happened, and because **this repository would benefit from either a Prettier
config or nobody running Prettier** — right now the two are indistinguishable
until someone does what I did.
