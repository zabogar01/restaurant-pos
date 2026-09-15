# DESIGN-004 — Frost review remediation

**Status:** Active
**Owner:** `designer` (claude, Fable 5.1)
**Depends on:** [DESIGN-003](DESIGN-003-frost-design-system.md), delivered 2026-09-14

## Where these findings came from

`design-reviewer` (codex) reviewed the Frost conversion on 2026-09-14 for
*judgement*, not completeness — the lead had already verified provenance
(169/169/169, twelve sampled source claims, geometry sheet byte-identical to
the wireframe's). It returned ten findings and wrote no file, because the lead's
prompt asked for findings only. They are recorded here in full, because a
finding that lives in a pane scrollback is not a finding anybody will act on.

**Branch:** `agent/design-direction`, in the worktree at
`../restaurant-pos-design`. Implementation runs in parallel on
`agent/phase-0-foundations` in the main checkout; do not touch it.

Two findings were independently verified by the lead before this task was
written. They are marked **CONFIRMED BY LEAD**. The rest are the reviewer's
and are to be checked as you go — a finding is a claim, not a verdict.

---

## 1 — CRITICAL. The rejected-close state offers a live close on a stale balance

**CONFIRMED BY LEAD. Fix it first, and fix it in the wireframe as well as in
Frost.**

`error` means the close was rejected because *the order changed while payment
was being collected* — the fixture says so in its own words. Yet that state
renders balance `0`, tags the draft `FULLY ALLOCATED`, and exposes a live
**Close order & print receipt**:

- `docs/design/visual-directions/frost/pos/settlement.html:78`, `:189`, `:239`
- and the same live close in the wireframe:
  `docs/design/prototype/pos/settlement.html:247` carries `error` in its
  `data-when` list.

`B-18` closes an order **only on exact settlement**, and exactness has not been
re-established: the copy tells the cashier to *check the total and try again*
while the screen asserts there is nothing left to pay. That is the reflex
problem `I-12` was written about, one screen over and with money on it.

This came in through DESIGN-002 pass 1, which corrected four states showing a
15.59 balance under a fully-allocated draft by setting the balance to 0.00 —
correct for `reauth`, `cancel` and `loading`, wrong for `error`, because
`error` is the one state where the order's total may have moved.

**What it must become:** on `error` the balance is whatever the changed order
now says, the draft is *not* tagged fully allocated, and the close control is
refused until the balance is zero again. `B-20` still holds — the drafted
lines survive for correction, nothing was recorded. Do not invent a new node;
this is state content inside POS-04.

## 2 — HIGH. The tender pads are still typed `[SHEET]` in the behavioral documents

**CONFIRMED BY LEAD.** `docs/DESIGN.md:669` says the tender UI is a persistent
panel and never a sheet. `docs/design/SITEMAP.md:144, :146, :148` and
`docs/design/SCREEN-INVENTORY.md:856` (heading `M-4 — Tender pads [SHEET]`)
still type all three pads as `[SHEET]`.

**This is not a decision you need to make — it was already made.** The owner
ruled on 2026-09-10 that the tender pads are a persistent panel, not an
edge-entering sheet, and that the prototype was right and the documents lagged.
`.agent/MEMORY.md` records the ruling in the present progressive — "are being
retyped to match" — and the retyping never happened. Four days later the
design system asserted the panel, and the repository now contradicts itself in
three places.

**Apply the owner's ruling.** Retype in `SITEMAP.md`, in `SCREEN-INVENTORY.md`'s
`M-4` heading and body, and in `docs/design/EXTERNAL-HANDOFF.md`'s overlay list,
with dismissal behaviour stated explicitly. Overlay semantics change; the screen
count does not. DESIGN-003's "do not retype nodes" constraint does not bind
here, and this paragraph is your authority to override it.

## 3 — HIGH. The completeness claim is stronger than the artifact

The reviewer's point: `docs/DESIGN.md`'s objective is a system Phase 0 and
every phase after it can build from without inventing a value, and the handoff
marks every task criterion met — while a pressed/active touch state and an
invalid-field state are absent and Phase 0 needs both.

**Lead's ruling: the absences stay absent, the claim gets corrected.** You were
right not to invent them; ruling recorded in MEMORY.md and tracked as `A7`. What
is wrong is the accounting. Restate the completeness claim in `docs/DESIGN.md`
and in DESIGN-003's walk so it says what is true: **complete for the six
reviewed screens; not yet sufficient for Phase 0's two client shells, which
need a pressed state and a field error state that Frost does not contain.**

## 4 — HIGH. The B-16 verdict was not earned

`B-16` is about a cancellation ticket being unmistakable from new kitchen work.
The walk answered with empty fired slots and PIN gating, which is `FR-H4`, not
`B-16` — and `docs/DESIGN.md:1028` declares printed output out of scope
entirely. A boundary cannot be *met* by a document that does not cover the
artifact the boundary is about.

Change the verdict to **open**, state that printed output is undesigned, and
note that it must be designed before Phase 3 prints anything. Check the same
walk for any other verdict resting on an artifact the system does not cover.

## 5 — MEDIUM. The portable schema does not carry the same values it claims

Three fidelity defects, each to be verified then fixed:
- order-line and emergency-banner turn sourced **minimum** heights into fixed
  heights (`docs/DESIGN.md:213`, `:349` against `:660`, `:919`). A fixed height
  where the source says minimum will clip a long item name, and it shrinks the
  emergency banner's coverage — which is the one thing that has to read across
  a room.
- data-table-header points at the zero-tracking primary-text group label; the
  rendered header is muted, uppercase, tracked `0.06em`
  (`structure.css:300`).
- the 16px/13px office-modal exception exists in prose only; `modal-office`
  carries neither typography association.

## 6 — MEDIUM. A 10px tag is the only thing telling a cashier the row is gated

On a fired row the trailing slot is deliberately empty (`I-12`), so
`MANAGER TO VOID` at 10px on the round header is the only visible statement
that the row opens the PIN-gated path — while `docs/DESIGN.md:631` says nothing
a cashier must act on sits below 13px. Hover cannot rescue it on a touch
screen.

**Raise it rather than explain it away**, and say in your handoff what you
changed it to and what that is sourced from. If the only honest answer is a new
value, say so and raise it to me instead of quietly minting one — this is the
second thing on the pile that may need the owner.

## 7 — MEDIUM. Disagreement 3 promoted a fixture accident into a product rule

The three 2px ink rules are anonymous inline leftovers shared by Paper *and*
Frost, while Frost normalises its named boundaries to 1px. Absence of an
override is not intent. I agree with the reviewer, and I flagged this shape
when commissioning the review.

Demote it: the system is 1px, those three are fixture residue. Also correct the
mislabelling — the close rule is on the tender panel, not the summary panel.

## 8 — MEDIUM. "Spruce for what commits" contradicts the screens it describes

Send to kitchen, Add card, Add cash and the reprint commands all change state
and are all outlined secondary controls in the reviewed screens. The rule as
written would make an implementer restyle a hierarchy that was reviewed and
shipped. Rewrite it to describe what Frost actually does.

## 9 — MEDIUM. A review-frame value ships as product geometry

`--frost-office-min-height: 900px` is in the shipped registry while
`docs/DESIGN.md:700` says it is not a product limit. Either drop it or name it
so no implementer can mistake it for one. A token that has to be explained in
prose to avoid being used wrongly is named wrongly.

## 10 — LOW. The absence list contains entries that are not absent

The quick-sale line editor is in the Frost order screen; a small text-field
treatment is in the Frost category modal; loading/skeleton styling renders
through the mapped variables. Those are *inherited or unreviewed*, which is a
different claim from *absent* and a weaker one — say which.

Also: `docs/DESIGN.md:576` says the other fourteen screens render in Frost.
They load `wireframe.css`, not `visual.css` (`prototype/pos/floor.html:5`).
Correct the claim.

---

## Constraints

- **Do not edit the contract documents** — `PRODUCT.md`, `PRD.md`,
  `docs/ROADMAP.md`, `BOUNDARIES.md`. Finding 1 is a wireframe and fixture
  defect, not a requirements defect: `B-18` is right and the drawing is wrong.
- **Do not edit `.agent/MEMORY.md` or `.agent/ROADMAP.md`.** Mine.
- **Do not touch the main checkout or `agent/phase-0-foundations`.** An
  implementer is working there.
- **Still no invented values.** Where a fix needs one, raise it.
- Structural work here is limited to finding 2, and only because the owner
  already ruled it.

## Acceptance criteria

1. Finding 1 is fixed in **both** `prototype/pos/settlement.html` and
   `visual-directions/frost/pos/settlement.html`, and no state offers a close
   control while its own copy says the total may have moved.
2. Finding 2 is applied in all three documents — SITEMAP, SCREEN-INVENTORY,
   EXTERNAL-HANDOFF — or in none. Two of three is how this defect was created.
3. Every finding above is either fixed, or answered in the handoff with
   evidence for why the reviewer is wrong. "Disagree" is not an answer;
   `file:line` is.
4. The completeness and boundary claims in `docs/DESIGN.md` and DESIGN-003's
   walk say what is true, including where it is weaker than first claimed.
5. `npm`-free verification: state what you rendered and inspected, at which
   viewport, and what you checked mechanically rather than by eye.

## Out of scope

- A dark palette, a pressed state, or a field error state invented to close
  finding 3. Those are `A7` and they go through review.
- Anything on the implementation branch.
- Re-running the whole finish review. Fix these ten.

## Handoff

Written by `designer`.

**2026-09-14 — `designer` (claude, Fable 5.1).** All ten findings acted on:
eight fixed, one fixed with a derived fixture figure the lead should confirm
(1), one raised rather than fixed because the only honest fix is an unsourced
value (6). Committed on `agent/design-direction` in this worktree. Nothing on
the implementation branch or in the main checkout touched. No contract
document, `MEMORY.md` or `ROADMAP.md` edited.

*Finding 1 — fixed in both fixtures.* `frost/pos/settlement.html` and
`prototype/pos/settlement.html`. On `error` the totals block now shows the
changed order, the balance is the changed order's remainder, the amount field
is prefilled with that remainder under `ALREADY FILLED IN — WHOLE BALANCE`
(not `FULLY ALLOCATED`), *Add cash* is live, the drafted Card line is still
listed, and the close band shows the refused `Close order — balance
outstanding`; `error` is removed from the live close's `data-when`. The
notice copy now states the moved total and what is owing. **The figures are
derived, not sourced from any existing state:** the story is one existing
tile — Fries, 40.000 in Frost, 4.00 in the wireframe — added to the order
under the draft. Everything else follows the fixture's own arithmetic (10%
discount, 5% service on the net, tax = net ÷ 11, half-up): Frost 205.000 /
−20.500 / 9.225 / **193.725** / tax 16.773 / balance **37.800**; wireframe
20.50 / −2.05 / 0.92 / **19.37** / GST 1.68 / balance **3.78**. The script
that produced them reproduces the existing 155.925 and 15.59 states exactly.
If the lead prefers a different changed-order story the numbers are five
strings in each file. A structural comment in the wireframe records the rule
(B-18, B-20). DESIGN-002's pass-1 entry (its lines 275–277) still describes
the old correction; that file is the lead's and is not edited here.

*Finding 2 — applied in all three documents.* `SITEMAP.md`: the three POS-04
tender nodes are `[INLINE]` with the persistent-panel wording on the node,
and a dated paragraph in the header records the owner's ruling and that the
screen and modal counts do not change (M-4 keeps its number as a retyped
node). `SCREEN-INVENTORY.md`: `M-4` heading retyped to `[INLINE]` with a
paragraph stating dismissal behaviour (never dismissed; method choice swaps
content in place; the only ways off are Cancel payment or a successful
close), a sentence under POS-04's *empty* state, and a sentence appended to
"what the drawing exposed" item 2. `EXTERNAL-HANDOFF.md`: "the tender pad"
removed from the overlay list, a paragraph added saying it is not an overlay
and must not be drawn as a sheet, drawer or dialog, and the "no overlays
changed" sentence amended to name the retype. `grep` for a `[SHEET]`-typed
tender pad across the three now returns only the sentence saying it is not.

*Finding 3 — claim corrected, absences kept absent.* `docs/DESIGN.md` now
carries a "Completeness, stated honestly" paragraph in the Status block:
complete for the six reviewed screens; not yet sufficient for Phase 0's two
client shells, which need a pressed state and a field error state Frost does
not contain, tracked as `A7`. DESIGN-003's criterion 8 restated to match.
Nothing invented.

*Finding 4 — B-16 verdict changed to open.* DESIGN-003 criterion 7 rewritten
per boundary. B-16 open: printed output undesigned, must be designed before
Phase 3 prints (Open item 9 in `docs/DESIGN.md` now says so and names B-16).
The walk was also checked for other verdicts resting on artifacts the system
does not cover: **B-19** was claimed for "the six" but POS-06 (refund) is not
among them — now "met for the six only"; **B-15 / principle 1** cannot be
proven by a static fixture — now "consistent, not proven"; and **B-18 was in
fact broken** by the delivery (finding 1) — now recorded as broken-and-fixed,
with task criterion 6 marked not met as delivered.

*Finding 5 — verified, all three real, fixed.* `order-line`, `order-line-void`
and `emergency-banner` no longer carry `height` in the frontmatter, because
the schema has no minimum and the sources (`structure.css:167`, `:119` via
`visual.css:150`) are minimums; a note in the Status block says why, and the
minimums stay in Layout, Components and the registry. `data-table-header` now
points at `{colors.muted}` (`structure.css:300` `color: var(--ink3)`, which
`visual.css:26` maps to muted; `visual.css:180` sets no colour) and at a new
`table-header` typography role (11px 500, 0.06em); uppercase cannot be
expressed in the schema and stays in prose. `modal` carries
`{typography.body-pos}`; `modal-office` carries a new `body-office-modal`
role (13px, `structure.css:254`), and `overlay-heading-office` (16px,
`structure.css:255`) is added and named in the Components prose. YAML
re-parsed: 14 typography roles, 53 components, every `{ref}` resolves.

*Finding 6 — raised, not fixed.* The reviewer is right and no sourced value
fixes it. The round-heading tag is 10px by `visual.css:89`; the round heading
itself is 11px; the smallest size Frost uses for anything a cashier acts on
is 13px (`--frost-text-13`, compact actions). A 13px tag exists nowhere in
the Frost artifacts, and moving the statement into the row would be a new
composition. **Nothing was changed in the fixtures.** `docs/DESIGN.md`'s
Supplement Rule now names this as the one known exception the screens carry
and the document does not endorse. **Needs a ruling.** The candidate that
invents least: set the round-heading tag at 13px (`--frost-text-13`, an
existing size) — but that is still an unsourced treatment for the tag
component and should go through review with `A7`.

*Finding 7 — demoted.* Shapes prose now says the system is 1px, the keyed
amount field's 2px spruce border is the one designed exception, and the three
inline `2px solid var(--ink)` rules in the settlement fixture are wireframe
residue shared by Paper (`paper/pos/settlement.html:39, :50, :238`) and Frost,
to be drawn at 1px control border. Mislabel corrected: the close rule
(`:238`) is on the tender panel. DESIGN-003's disagreement 3 amended the same
way.

*Finding 8 — rewritten from the screens.* The Do bullet now describes what
Frost does: spruce fills only the one terminal action of a surface (Close
order & print receipt, Settle, Add to order, Apply, Remove line in the line
editor, Continue, Sign in, Create — `frost/pos/order.html:373, :415, :441,
:506`, `settlement.html:239–241, :292, :333`, `menu.html:59, :148`);
everything else that changes state is outlined (Send to kitchen `:370`, Add
card/Add cash `settlement.html:200–204`, Discount and Void order on the band
`:362, :364`, both Reprint commands `incidents.html:54, :94`); ink fills what
is selected.

*Finding 9 — dropped.* `--frost-office-min-height` removed from the registry;
`frost.css` regenerated (168 tokens, zero drift, insertion order); Layout
prose says the back office has no fixed height and no token carries the
gallery's 900px. `--frost-pos-width/height` and `--frost-office-width` stay:
they are the brief's device targets, not the gallery's.

*Finding 10 — reclassified.* Open item 7: the fourteen unstyled screens are
absent (they load `wireframe.css`, `prototype/pos/floor.html:5`; no Frost
file styles them) and the quick-sale line editor is removed from the list —
it is rendered in Frost (`frost/pos/order.html:9`, state `quick-line`) and
was among the 146 verified fixture states. Item 4: the 40px text field in
the Frost category modal (`menu.html:142`) is inherited, not absent. Item 8:
skeleton and loading label are inherited through the remap, not absent. The
"Inherited mapping" section now says the remap applies inside the six Frost
files only, and what it produces there. The intro to the Open list defines
absent / inherited / unreviewed as three claims.

*Verification.* Mechanical, both settlement fixtures, all 20 states each: a
script mirroring `mockup.js`/`wireframe.js`'s `data-when`/`data-unless` logic
confirms exactly one close-band control per state, exactly one balance, one
amount field and one amount tag per state (zero-total excepted by design),
and that the only states with a live close have a zero balance. Registry:
JSON parses, 168 tokens, CSS regenerated and diffed clean; every `--frost-*`
in `docs/DESIGN.md` exists in the registry and every token is referenced;
frontmatter YAML parsed by a second parser with every `{ref}` resolved.
Rendered in Chrome over a local static server at actual size (1280×800
device frame inside a 1400×950 window): Frost `settlement.html?state=error`
and the wireframe's `settlement.html?state=error`, inspected by eye for the
six things finding 1 names. Not rendered: the other 19 states (covered by the
sweep), the three behavioral documents (prose), and nothing on hardware.

*For the lead or owner.*
- Confirm or replace the derived changed-order figures in finding 1.
- Rule on finding 6 (a 13px round-heading tag is the least-inventing
  candidate; still unsourced).
- DESIGN-002 pass 1's record of the balance-0 correction now describes a
  defect; a one-line note there is the lead's to add.
