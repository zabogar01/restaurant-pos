# DESIGN-005 — A7: the three states Frost does not contain

**Status:** Active
**Owner:** `designer` (claude, Fable 5.1)
**Depends on:** [DESIGN-003](DESIGN-003-frost-design-system.md), [DESIGN-004](DESIGN-004-frost-review-remediation.md)

## Why this task is different from every design task before it

Every previous one forbade inventing a value. **This one requires it.** Three
things the product needs are genuinely absent from the Frost artifacts, they
were correctly left absent rather than conjured inside a conversion task, and
they are now blocking. Designing them is the whole job.

That inversion comes with a condition: **a value designed here is marked as
designed, never disguised as sourced.** The 169-token registry records a file,
line, selector and property for every token precisely so that nobody has to
wonder where a number came from. A new token with a plausible-looking source
would poison that. Use a provenance shape that says what is true — designed
under DESIGN-005, dated, and reviewed — and say in your handoff how you
expressed it.

## The three gaps

### 1. Pressed / active state on touch

The POS is a touch device where **the finger covers the thing it is pressing**.
A cashier's confidence that a tap landed comes from what changes *outside* the
contact patch, and often from nothing else.

`builder3` established where this does and does not bite, and the reasoning is
worth inheriting rather than repeating: on the lock screen every key already
changes something visible — a digit fills a dot, delete empties one, Continue
empties all — so no pressed treatment was needed and none was invented. **On
the order and tender screens that does not hold.** Tapping a menu tile, a
method chip, or an Add control often changes something far from the finger, or
nothing immediate at all.

Constraints that make this harder than it looks:
- Frost's **selected** state is a solid ink fill (`#032125`). A pressed state
  that looks like selection teaches the wrong thing, because pressed is
  transient and selected persists.
- It has to read on **cream key surfaces, white tiles, and the spruce primary
  action** — three different grounds.
- It cannot rely on hover, which does not exist on a touch screen, and it
  cannot rely on colour alone.
- Frost is flat: 2px surfaces, pill actions, no shadow vocabulary. A pressed
  state that introduces elevation introduces a new material.

### 2. Field error / invalid state

Needed by Phase 0's login form and by every keyed amount. `AC-6` requires a
refused tender to **name the maximum**, so the treatment has to carry a message,
not merely turn a border red.

Distinguish three things that are not the same: a field that is **empty**, a
field holding a value that is **rejected** (over the balance), and a field whose
value is **fine but the action failed**. Frost has `--frost-destructive` and
`--frost-destructive-soft` already; whether they are the right tools here is
yours to decide, but `destructive` currently means *this action destroys
something*, and an invalid keystroke destroys nothing.

### 3. The 10px `MANAGER TO VOID` tag — `design-reviewer` finding 6

On a fired order line the trailing slot is deliberately empty under ruling
`I-12`, so a **10px** tag on the round header is the only visible statement that
the row opens the PIN-gated void path — against the system's own rule that
nothing a cashier must act on sits below 13px. Hover cannot rescue it.

**`I-12` is not up for revision.** Do not put a control in the trailing slot,
and do not make the row's affordance state-conditional. The statement has to
become legible without the row acquiring a second meaning. Your own candidate
was the tag at `--frost-text-13`; take it or beat it.

## Required inputs

| Input | Path |
|---|---|
| The design system | [docs/DESIGN.md](../../docs/DESIGN.md) — including its own open list, which this task shortens |
| The registry | `docs/design/tokens/frost.tokens.json`, `frost.css` |
| The screens | `docs/design/visual-directions/frost/` |
| The review that raised finding 6 | [DESIGN-004](DESIGN-004-frost-review-remediation.md) |
| Behavioral authority | [SCREEN-INVENTORY.md](../../docs/design/SCREEN-INVENTORY.md), [SITEMAP.md](../../docs/design/SITEMAP.md) |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) — `B-16`, `B-18`, `B-19` and the 86'd-in-place rule all touch these screens |
| What the first real screen taught | [FE-001](../../.agent/tasks/FE-001-pos-shell-and-lock-screen.md) in the main checkout — read its handoff, do not edit it |

**Branch:** `agent/design-direction`, in this worktree. The main checkout is on
`agent/phase-0-foundations` and is not yours.

## Constraints

- **Invent as little as possible, and justify what you invent.** Prefer a value
  already in the palette used in a new place over a new value; prefer one new
  value over three. Every addition gets a sentence saying what it buys.
- **Light only.** A dark palette is still an open owner decision and not part
  of this.
- **No motion.** The brief excluded it and nothing has changed. A pressed state
  expressed only as a transition is a pressed state that does not exist on a
  slow device.
- **Do not change behaviour, structure, copy, or any ruling.** `I-12` and
  `I-13` stand.
- **Do not edit** the contract documents, `.agent/MEMORY.md`, or
  `.agent/ROADMAP.md`. Handoff goes in this file.
- **Demonstrate each state in the Frost fixtures** — a value nobody can look at
  has not been designed, it has been declared.

## Acceptance criteria

1. All three states exist in `docs/DESIGN.md` with stated values, the rule for
   when each applies, and how each avoids being confused with the state it most
   resembles — pressed against selected, invalid against destructive.
2. Every new token is in the registry carrying **honest provenance**: designed
   under this task, with a date — never a fabricated file and line.
3. Each state is demonstrated in at least one Frost fixture, and your handoff
   says which and at what viewport you inspected it.
4. The pressed state is legible on all three grounds — cream key, white tile,
   spruce primary — and you say how you checked rather than that you did.
5. Finding 6 is closed: the fired row's gated path is stated at or above 13px,
   or by a means you argue is better, without a control entering the trailing
   slot.
6. `docs/DESIGN.md`'s open list shrinks by exactly these three, and the
   completeness note now says what is true for Phase 0's client shells.
7. Contrast ratios for anything carrying text are computed and stated.

## Out of scope

- A dark palette. Motion. The other open items in `docs/DESIGN.md`.
- Applying any of this to `apps/pos`. That is a separate small frontend task
  once this passes review.
- Re-opening `I-12`, `I-13`, or the tender-panel retype.

## Handoff

Written by `designer`. What you designed and why, what you invented and what
you reused, how each was checked, what you could not settle, and what the
frontend implementer needs in order to apply it. **Commit your work and verify
the branch actually moved** — last time the handoff said committed and the
worktree was still dirty.

**2026-09-14 — `designer` (claude, Fable 5.1).** All three states designed,
demonstrated, registered and stated in `docs/DESIGN.md`. Committed on
`agent/design-direction` in this worktree in five commits (`c2e0de5`,
`8bce6e0`, `81c8e4f`, `d9c6c73`, plus this handoff); `git log` and
`git status` confirmed after each. Nothing on the implementation branch or in
the main checkout touched; no contract document, `MEMORY.md` or `ROADMAP.md`
edited. Light only; no behaviour, structure or ruling changed; copy added is
listed below and is the whole of it.

### Where the design lives

| Artifact | Path |
|---|---|
| The rules, with the reasoning as comments | `docs/design/visual-directions/frost-states.css` (new; loaded by the three Frost fixtures **after** `visual.css`) |
| Registry, four designed tokens | `docs/design/tokens/frost.tokens.json` (168 → 172), `frost.css` regenerated |
| The system | `docs/DESIGN.md` — status block, Colors, Typography, Elevation & Depth, Components, Do/Don't, Open list |
| Fixtures | `frost/pos/order.html?state=pressed`, `frost/pos/settlement.html?state=pressed`, `?state=cardover`, `?state=ceiling`, `frost/back-office/menu.html?state=category-invalid`, and every round heading in `order.html` |

`visual.css` and `structure.css` are byte-identical to what was reviewed, so
every `source.line` in the registry still points where it did. A separate
sheet was the only way to add rules without either shifting those line
numbers or tempting a "source" claim for the new tokens.

### How designed values are marked, not disguised

Every existing token carries `source: {path, line, selector, property,
authoredValue}`. The four new ones carry **`source: null`** — explicit, not
absent — and a **`designed`** block: `task` (this file), `date`, `by`,
`status` ("designed under DESIGN-005; awaiting design-reviewer; not part of
the DESIGN-001 Frost review"), `stylesheet` (the rule in `frost-states.css`,
named as a rule, not cited as a line), `shown` (the fixture states), and
`why`. The registry's `maintenance` string now defines both shapes and says
they are never mixed; a check at conversion time asserts every token has
exactly one of them. `frost.css`'s header names the four. `docs/DESIGN.md`
says "designed" at every mention, and its status block explains the split.
The frontmatter carries `invalid`, `round-tag`, `field-message`,
`field-invalid`, `field-small-invalid` and `field-message`; it **cannot**
carry the pressed ring (no stroke/shadow field in the schema) and says so.

### What was designed, what was reused, what was invented

**1. Pressed — `--frost-pressed-ring: inset 0 0 0 2px currentColor`.**
Rule: *selection fills; pressing strokes.* While a finger is down, an enabled
control draws a 2px ring inside its own edge in its own text colour. Why this
and not the alternatives:
- *Not a fill.* Frost's selected state is the ink fill; a pressed fill of any
  darkness teaches that transient and persistent look alike. A stroke cannot
  be read as a fill.
- *Not an outer outline.* That is the keyboard-focus vocabulary (2px spruce
  outside, 6px green). Inset also never collides with it, never overlaps a
  neighbour in 0-gap stacks (category rail, order lines), and moves no layout.
- *Not elevation, not motion.* Nothing lifts; nothing transitions.
- *Not colour alone.* The ring is a geometry change — a 2px stroke where the
  rest state has a 1px border or none.
- *`currentColor`, so one rule reads on every ground.* Ink on cream keys,
  white tiles, white buttons and the white rail; white on spruce primary, the
  ink selected fill and brick final; brick on the outlined destructive. The
  ring's contrast is the text's contrast, already in the table. Zero new
  colour values.
- *Lineage.* The keyed amount field's 1px→2px spruce thickening already
  means "a hand touched this" in Frost. The ring is that idiom applied to a
  press.
- *Order lines.* The ring goes on the tap target only (quantity, name,
  amount), pushed 8px out from the text with an equal negative margin and
  padding so nothing moves, and stops 4px short of the trailing slot, which
  is a sibling. The ring draws exactly what was pressed — `I-12` visible.
- *Disabled and 86'd controls get none*: nothing happened.
- *Hover rule for the implementer:* touch browsers synthesise `:hover` on
  tap and Frost's tile hover is the ink fill. Every hover rule must be scoped
  to `@media (hover: hover)`. Stated in `docs/DESIGN.md`; the fixture
  stylesheets are left as reviewed.
- *Lock screen:* the rule applies to PIN keys too. FE-001 was right not to
  block on it — the dots already report every key — so applying it there is
  a follow-up, not a fix.

**2. Field invalid — `--frost-invalid` (#83611c), `--frost-invalid-border`
(2px solid #83611c), plus `field-message`.** The field keeps its white fill,
its border thickens to 2px in amber, left padding pulls to 13px (reusing
`--frost-amount-keyed-padding-left`) so the figure does not shift, and one
line in the same amber sits 4px (`--frost-space-1`) under the field naming
the rule and the limit: *Card maximum 155.925*, *Cash maximum 10.055.924*,
*Enter a name*. 14px 500 on the POS (the notice size), 13px in a back-office
modal (that modal's body size).
- *Why amber, under its own name.* `--frost-invalid` is the same hex as
  `--frost-warning`. Warning is Frost's existing "attend to this, nothing is
  lost" hue, which is what a refused keystroke is. It gets its own name so an
  implementation never writes "warning" — a receipt-print matter — on a
  field, and so the two can diverge later without a hunt. Zero new colour
  values.
- *Why not brick.* `--frost-destructive` means "this action destroys
  something"; a 2px brick border on a white field is exactly the outlined
  destructive button. A refused value destroys nothing.
- *Why not red.* Emergency is the kitchen's.
- *Why it is not a warning chip.* The field never takes the pale amber fill;
  the message is text, not a chip; the border is 2px, not 1px. The Two Alarms
  Rule (solid red vs dark-on-pale) is untouched.
- *The three cases* (`docs/DESIGN.md`, Numeric field): empty-required-on-
  submit → invalid + "what is missing"; rejected value → invalid + the limit;
  fine value, action failed → **not invalid**, a `notice` beside an unchanged
  field. A field at rest that happens to be empty is at rest.
- *AC-6* is now met at the field (the limit is named under it) as well as in
  the existing notice, which is kept.

**3. Round-heading tag — `--frost-round-tag-size: 13px`.** Took the
candidate and applied it to *every* tag in a round heading, not only
`MANAGER TO VOID`: the tag in that band is always the one statement of what a
tap on the rows below will do (*REMOVE FREELY*, *FINISH PAYMENT FIRST*,
*ANOTHER CLIENT*), so one rule, no special case. 13px is the value of
`--frost-text-13`, an existing size in a new place. Weight, padding, tracking,
colour and the absent border are unchanged; the tag is 23px tall in the 32px
band and no heading overflows. The heading stays 11px, so the tag now
outweighs the heading it sits in — the right order. `I-12` is untouched: no
control in the slot, the row affordance not state-conditional. Closes
DESIGN-004 finding 6. **Could I beat it?** The only stronger statement would
be per-row, which the system forbids ("never as per-line badges") and which
would be a second meaning on the row; the tag at 13px is the least change
that satisfies the 13px floor.

### Fixture changes (all additive; no existing state altered except as named)

- `order.html`: new state `pressed` (Fries tile, Sides rail row, Round 2 Soda
  row body, Void order, Settle). Round tags render at 13px in every state via
  the sheet.
- `settlement.html`: new state `pressed` (key 5, Add cash, the selected Cash
  chip); `cardover` and `ceiling` fields carry `field--invalid` with a
  message. The 200.000 field was split so `cashover` is unchanged.
- `menu.html` (office): new state `category-invalid`, an empty `field--sm`
  invalid with *Enter a name*.
- **Copy added:** `Card maximum 155.925`, `Cash maximum 10.055.924` (figures
  taken from the existing notices), `Enter a name`, and three state-chip
  labels. Nothing removed or reworded.
- `source-fingerprints.json` records the DESIGN-001 bytes and was already
  stale for `settlement.html` after DESIGN-004; it is not updated here, since
  it is the record of what was reviewed.

### How it was checked

Rendered in Chrome (Claude in Chrome) over `python3 -m http.server` at the
worktree root, window 1400×1000, device frame **1280×800 at actual size**,
DPR 1, measured with `getComputedStyle` and `getBoundingClientRect`:
- `order.html?state=pressed`: five pressed controls, each
  `box-shadow: rgb(…) 0 0 0 2px inset` in its own text colour — ink on the
  tile (white), the rail row (white) and the line body; brick on Void order;
  white on Settle. Line body ring 375×52 inside a 459×77 row, 4px short of
  the 56×56 slot; both fired rows 77px, quantity column at the same x, so the
  ring moved nothing. Screenshot and zoom inspected by eye.
- `settlement.html?state=pressed`: white ring on the ink Cash chip (164×56),
  ink ring on Add cash (170×56, white) and on key 5 (88×72, cream #fffcf6).
- `?state=cardover`: field `2px rgb(131,97,28)` border, white fill,
  `padding-left 13px`, 56px, 26px figure; message 14px 500 amber, 4px below.
  `?state=ceiling`: same, zoomed and read.
- `menu.html?state=category-invalid`: 40px field, 2px amber, 13px padding;
  message 13px amber.
- Round tags: `default`, `lock-draft`, `linecontrols` — every visible tag
  13px, 23px tall, `scrollWidth == clientWidth` on every band (no overflow),
  muted on grouping blue, ink on pending green.
- Mechanical: registry JSON parses, 172 tokens, `frost.css` regenerated by a
  generator that reproduced the previous file byte-for-byte before the
  additions; JSON and CSS token sets and order identical; every token has
  exactly one provenance shape; every `--frost-*` in `docs/DESIGN.md` is in
  the registry and every registry token is mentioned; frontmatter parsed by
  Ruby's YAML with every `{ref}` resolved.
- Contrast, computed from the hex values (WCAG relative luminance): invalid
  amber 5.69 on white, 5.45 on canvas, 5.55 on cream; ring ink 16.83 on
  white, 16.43 on cream, 14.92 on grouping; ring white 13.08 on spruce, 16.83
  on ink, 7.14 on brick; ring brick 7.14 on white; round tag muted 7.98 on
  grouping, ink 15.79 on pending. All in `docs/DESIGN.md`'s table.
- **Not checked:** a real touch device, a real finger, a dim floor. Whether
  2px inside the edge is enough under a fingertip is a device-test question
  and is listed as such in the open list.

### Not settled — for the lead

1. **Review.** All three states are *designed and unreviewed*. `A7` closes
   when `design-reviewer` passes them, not now.
2. **The message copy** (*Card maximum 155.925* etc.) is mine. It restates
   figures already in the notices, but the word "maximum" and the form are a
   copy decision; SCREEN-INVENTORY was not edited. If the lead prefers the
   notice's own phrasing ("The most you can take on card is 155.925") it is
   three strings.
3. **Whether the lock screen adopts the ring now.** I state the rule as
   universal; FE-001's reasoning for not blocking on it still holds.
4. `.agent/ROADMAP.md` A7 also lists "login form controls"; only the
   invalid state of `field-small` is covered here (shown in the office
   modal). The resting login field is still the inherited `.field` rule
   (open item 2).

### What the frontend implementer needs

- Apply `--frost-pressed-ring` on `:active` of every enabled control;
  `box-shadow: none` on disabled; on an order line, on the tap target with
  `margin: calc(-1 * var(--frost-space-2)); padding: var(--frost-space-2);
  border-radius: var(--frost-radius-surface)`.
- Scope every `:hover` rule to `@media (hover: hover)`.
- Invalid field: `border: var(--frost-invalid-border); padding-left:
  var(--frost-amount-keyed-padding-left); background: var(--frost-elevated)`;
  message `color: var(--frost-invalid); font-size: var(--frost-text-14)`
  (`--frost-text-13` in an office modal); `font-weight:
  var(--frost-weight-medium); margin-top: var(--frost-space-1)`.
- Round tag: `font-size: var(--frost-round-tag-size)`.
- Every value above is a `var(--frost-*)` that exists in `frost.css`, so
  `no-invented-values.test.ts` passes as written; `currentColor` is not a
  literal colour under its regex.

---

## Second pass — `design-reviewer` findings, 2026-09-14

Eight findings. The lead verified the first two in the source before writing
them here. Fix all eight or answer one with `file:line` evidence; "disagree" is
not an answer.

**1 — HIGH. On a real touch screen, pressed still collapses into selected.
CONFIRMED BY LEAD.** `visual.css:77` applies the ink selected fill on
`a.tile:hover`, unconditionally. `frost-states.css:44` only *comments* that an
implementation should scope hover to `@media (hover: hover)`. A comment changes
nothing: touch browsers synthesise and hold `:hover` after a tap, so the tile
is left looking selected once the ring goes — **the precise confusion this
state was designed to prevent.** The fixture hides it by putting `.is-pressed`
on an inert `<div>` (`frost/pos/order.html:109`) while the real target is an
anchor (`:100`).

`frost-states.css` loads *after* `visual.css` and is yours, so neutralise it
there — a `(hover: none)` / `(pointer: coarse)` guard that puts the tile back
to its rest appearance — rather than deferring it to an implementer who will
inherit the bug. `visual.css` stays byte-identical; that is why the separate
sheet exists.

**2 — MEDIUM. The two-name discipline does not exist in the delivered rules.
CONFIRMED BY LEAD.** `--frost-invalid` is declared in the registry, and
`docs/DESIGN.md:625` says the split lets warning and invalid diverge — but
`frost-states.css:64` and `:71` both consume `var(--warning)`. Changing warning
would silently change every invalid field. Consume the invalid token.

**3 — MEDIUM. "Every enabled touch control" is broader than the selector.**
The allow-list at `frost-states.css:25` misses ordinary anchors — Back
(`settlement.html:27`), the tender-line Remove (`:104`) — while
`docs/DESIGN.md:855` and `:1145` state the rule universally, and the open list
still says inline touch links are uncertified. Either the selector grows to
match the claim or the claim narrows to match the selector. Say which and why.

**4 — MEDIUM. The invalid demonstration invented a behavioral state.** This
task forbade behaviour, structure and copy changes, and
`frost/back-office/menu.html:6` adds a state, `:143` adds "Enter a name" copy
absent from BO-03 in `SCREEN-INVENTORY.md:510`, `:75` drops the table behind
the modal, and `:149`'s live Create exits the invalid state — so the fixture
does not even show the submission being refused. Demonstrate the invalid field
inside an existing state, or tell me what structural change you think is
warranted and let me rule on it. Do not quietly keep it.

**5 — MEDIUM. The document still tells a reader nothing was invented.**
`docs/DESIGN.md:3` (machine-facing), `:458` and `:512` all claim every value
traces to a Frost artifact, which four honestly designed tokens at `:477`
contradict. A consumer reading the frontmatter gets the wrong provenance
contract — the exact failure the `source: null` shape was built to avoid.

**6 — MEDIUM. The open list shrank by two, not three.** Criterion 6 asked for
exactly three. The round-tag entry was prose outside the numbered list, and
`:1178` now says it "left this list". Make the accounting true, whichever way
is honest.

**7 — LOW. Selected-plus-pressed is claimed but not inspectable.** The ring on
an ink-filled selected tile or rail item (`docs/DESIGN.md:962`) is the single
hardest case for "selection fills, pressing strokes", and no fixture shows it.
Show it.

**8 — LOW. The disabled exclusion has a hole.** `frost-states.css:35`
suppresses `.bobtn--off:active` but not `.bobtn--off.is-pressed`, so the
generic rule would ring a frozen disabled back-office button.

### Acceptance for this pass

1. Findings 1 and 2 fixed in `frost-states.css`, with `visual.css` and
   `structure.css` still byte-identical to what was reviewed.
2. Finding 4 either fixed inside existing states or raised to the lead as a
   structural question. Not left as it is.
3. Every other finding fixed or answered with `file:line`.
4. Commit as you go on `agent/design-direction` in this worktree, and confirm
   with `git log` that the branch moved before reporting.
