# DESIGN-003 — Convert Frost into a design system

**Status:** Active
**Owner:** `designer` (claude, Fable 5.1) — reassigned 2026-09-14 after
`designer2` was cut off by a usage limit
**Depends on:** the owner's choice of Frost, made 2026-09-14
**Supersedes for this purpose:** Track A item `A4` in [ROADMAP.md](../ROADMAP.md)

## The decision this task rests on

**The owner chose Frost on 2026-09-14.** Paper is not chosen and is not being
developed further. It stays on disk as the rejected alternative and as evidence
of what the comparison was; it is not deleted, not restyled, and not maintained.

Frost is now the product's visual direction. It is not yet a design system,
because nothing states its values in a form an implementation can consume
without eyedropping a screenshot or reading a prototype's stylesheet. Producing
that statement is this task.

## Objective

Write `docs/DESIGN.md` at the repository root level of authority, plus a token
set, from the Frost direction as built. Both must be complete enough that Phase
0 and every phase after it can style a screen without inventing a value and
without opening the mockups to guess one.

## Required inputs

| Input | Path | What it gives you |
|---|---|---|
| The chosen direction, built | [docs/design/visual-directions/frost/](../../docs/design/visual-directions/frost/) | Six screens: POS order, settlement, lock/PIN, print incidents, back-office menu, back-office report detail |
| Direction tokens as drafted | [docs/design/visual-directions/DESIGN.md](../../docs/design/visual-directions/DESIGN.md) | Frontmatter carrying colours, type, spacing, radius, and component treatments for **both** directions |
| Frost's actual styling | `visual-directions/visual.css`, `structure.css` | Frost is scoped as `html[data-direction="frost"]`. Where the frontmatter and the stylesheet disagree, **the stylesheet is what was reviewed** |
| The direction contract | [docs/design/VISUAL-DIRECTION-BRIEF.md](../../docs/design/VISUAL-DIRECTION-BRIEF.md) | The thesis, the pinned geometry, and the adaptations already accepted |
| The finish review | [docs/design/visual-directions/REVIEW.md](../../docs/design/visual-directions/REVIEW.md) | The verdict, two corrected findings, accepted tradeoffs, and the limits of what was certified |
| The original brief | [DESIGN-001](DESIGN-001-external-visual-direction.md) | Its "expected outputs" list is the shape of what `docs/DESIGN.md` must carry, and its acceptance criteria are still the bar |
| Behavioral authority | [docs/design/SCREEN-INVENTORY.md](../../docs/design/SCREEN-INVENTORY.md), [SITEMAP.md](../../docs/design/SITEMAP.md), [prototype/](../../docs/design/prototype/) | What the interface does. Styling never overrules it |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) | A visual choice that breaks one is wrong however good it looks |

Device targets, unchanged: **POS 1280×800 landscape**, **back office 1440 wide**.

## Deliverables

1. **`docs/DESIGN.md`** — the visual authority for the product. It must state,
   as values rather than as description:
   - **Colour with roles**, not swatches: ground, elevated surface, text, muted
     text, border, control border, primary action, destructive action,
     selection, grouping, unavailable — and **emergency separately from
     warning**, because those two must be distinguishable across a room.
   - **Type scale** — family, the permitted fallback chain, weights, sizes,
     line heights, and the POS-versus-back-office distinction where they differ.
   - **Spacing scale and radius scale**, including the flat/surface/pill split.
   - **Touch-target sizing for the POS, stated numerically**, no smaller than
     the wireframe's.
   - **Component treatments** for at least: primary and destructive buttons,
     the menu tile in available / selected / 86'd states, the order line
     including the trailing slot in all three of its signatures, the modal, the
     PIN pad key, the data table row, and the incident banner in both
     urgencies.
   - **Tabular figures and IDR rendering** — whole rupiah, precision 0,
     grouped, aligned in columns a manager reconciles down.
2. **A token set** — `docs/design/tokens/frost.css` as CSS custom properties,
   with a `docs/design/tokens/frost.tokens.json` mirror. CSS because both
   clients are React and Vite (PRD §9) and custom properties survive a
   component-library choice that has not been made; JSON because a token that
   only exists inside a stylesheet cannot be checked by a test. If you conclude
   one of the two files earns nothing, say so and ship one — do not ship two
   that can drift without a stated reason why drift is acceptable.
3. **A short conversion note** appended to this file: what you took from where,
   every disagreement you found between the frontmatter and the stylesheet and
   how you resolved it, and every value you could not source.

## Constraints

- **Source every value. Invent none.** A value that is not in the Frost
  frontmatter, the Frost stylesheet, or the Frost screens does not go in. If
  something the deliverable needs is genuinely absent, record it as open in
  `docs/DESIGN.md` under a heading that says so. An invented value is worse
  than a gap, because a gap gets asked about and an invention gets built on.
- **Do not change behavior, structure, or copy.** No route, modal, sheet, or
  `[INLINE]` node is added, removed, or retyped. The count stands at 7 POS
  screens, 13 back-office screens, 6 modals — with one open question about a
  7th modal, recorded in [MEMORY.md](../MEMORY.md), which is the lead's to
  settle and not yours.
- **Do not edit `docs/PRODUCT.md`, `docs/PRD.md`, `docs/ROADMAP.md`, or
  `docs/BOUNDARIES.md`.** They are the contract. A finding against one is
  raised, never applied.
- **Do not edit `.agent/MEMORY.md` or `.agent/ROADMAP.md`.** Those are the
  lead's. Write your handoff in this file.
- **Light only.** A dark palette was deliberately not delivered and is an open
  product decision. Do not invent one. State it as open in `docs/DESIGN.md`.
- **Helvetica Neue is the permitted fallback.** Saans was not provided. Make no
  claim to use a font the repository does not have, and download nothing.
- **No application code.** This produces the design system, not an
  implementation of it.
- **Do not commit.** The owner merges; the lead asks.

## Acceptance criteria

1. Every value in `docs/DESIGN.md` traces to a Frost artifact, and the
   conversion note says which one for anything not obvious.
2. The eight DESIGN-001 acceptance criteria are walked explicitly against the
   Frost delivery, and each is marked met, met-with-a-limit, or open. Criterion
   8 is the one that matters most here: a token set written without inventing
   values is exactly what this task tests.
3. Emergency and warning are distinguishable without reading the text, and
   `docs/DESIGN.md` states how — not merely that they differ.
4. POS touch targets are numeric and no smaller than the wireframe's.
5. Money renders as whole rupiah everywhere the document shows a figure.
6. No boundary in `docs/BOUNDARIES.md` is broken. Check `B-16`, `B-18`, `B-19`,
   and the emergency/receipt distinction specifically — those are the ones a
   visual decision can quietly break.
7. The token file(s) parse, and every token named in `docs/DESIGN.md` exists in
   them under the same name.

## Out of scope

- Choosing or changing the visual direction. Frost is chosen.
- Any further work on Paper.
- A dark palette.
- Motion. The brief excludes it and nothing has changed.
- Restyling the greyscale wireframes under `docs/design/prototype/`. They stay
  greyscale; they are the behavioral record.
- Application code, and any Phase 0 work.

## Handoff

**2026-09-14 — `lead`.** Task opened the moment the owner chose Frost. Assigned
to `designer2`, a fresh codex agent on gpt-6-astra at pane `w2:pA`, equipped
with the Impeccable skill at
`/Users/fajars/.claude/skills/impeccable/SKILL.md`.

The previous designer and the reviewer are both still live and idle
(`designer` at `w2:p3`, `design-reviewer` at `w2:p9`). `design-reviewer` wrote
`REVIEW.md` and is the obvious agent to review this conversion when it lands.

**2026-09-14 — `designer` (claude, Fable 5.1). Conversion note and handoff.**

Delivered: `docs/DESIGN.md` (new), `docs/design/tokens/frost.tokens.json` and
`frost.css` (inherited from `designer2`, verified, corrected and extended), and
this note. Nothing committed. No contract document, `MEMORY.md`, `ROADMAP.md`,
wireframe, or Paper file touched. `.impeccable/design.json` sidecar not written:
the owner ruled `.impeccable/` build residue and ignored it. The Impeccable
"document" playbook's qualitative interview was not run — the north star and
voice in `docs/DESIGN.md` come from the comparison document and the sidecar
`designer` left on 2026-09-10 ("Spruce ink on paper"), not from a new prompt.
The mechanical detector was not run: it inspects UI files and this task
produced none.

*What was taken from where.* Colour, type, strokes, focus, scrim, and every
Frost-specific override: `visual-directions/visual.css`. All geometry, padding,
and touch sizes: `visual-directions/structure.css`, which is byte-identical to
`prototype/wireframe.css` (checked with `diff`), so every size in `docs/DESIGN.md`
is the wireframe's size. Seven values authored inline in the Frost screens:
the 560px settlement summary panel, 56px tender actions, 72px tender and
approval keys, the `repeat(3,72px)` approval keypad, the 200px and 180px reprint
actions, and the 17/22/32px figure sizes. Icon stroke 1.8 and the currency
labels (`Total · Rp`, `Price · Rp`, `· IDR`): `mockup.js`. The comparison
document's frontmatter and prose were used as a map, never as the source of a
value.

*Verification of designer2's tokens.* A script read all 158 `source` claims and
checked, for each, that the named line in the named file contains the named
property and the `authoredValue`. All 158 pass. The `selector` field was
checked by hand for the 38 the script could not match verbatim (multi-line
`:root` block, inline HTML styles); all are correct. JSON→CSS: 158 declarations,
same order, zero drift. Two semantic errors found and fixed: (1)
`--frost-tender-panel-width: 560px` named the wrong panel — `settlement.html`
line 39 is the *left summary* panel, the tender panel is the remainder;
renamed to `--frost-settlement-summary-width`. (2) Nothing else was wrong, but
eleven values `docs/DESIGN.md` needs were absent and are now added, each with a
source: `--frost-unavailable-tag-surface`, `--frost-table-head-case`,
`--frost-totals-padding`, `--frost-actions-padding`, `--frost-actions-gap`,
`--frost-grand-total-bleed`, `--frost-nav-item-padding`,
`--frost-nav-section-padding`, `--frost-card-padding`,
`--frost-idle-chip-padding`, `--frost-icon-stroke`. Registry is now 169 tokens;
`frost.css` regenerated from it in insertion order and re-verified (169/169,
zero drift). **Taken on trust:** that `visual.css` on disk is the file the
finish review reviewed. `source-fingerprints.json` hashes only the six HTML
files and the wireframe sheets, not `visual.css`, so I cannot prove it was not
edited after `REVIEW.md`. Its mtime (2026-09-10 17:52) is after the review's
(17:45), which is consistent with the two documented post-review corrections
and nothing else.

*Disagreements between the comparison document and the stylesheet, and how
each was resolved (stylesheet wins in every case).*
1. Brief and prose call Frost's ground "white". Stylesheet: canvas `#fafafa`;
   header, category rail, action band, navigation and top bar are white.
   Recorded as canvas plus white chrome.
2. Prose calls the selected fill "spruce". Value is `#032125`, the text colour,
   not primary `#0b363b`. Recorded as "Ink", a distinct role from Spruce.
3. Prose: "flat surfaces use 1px rules". The settlement fixture carries three
   inline 2px ink rules that no stylesheet rule overrides (summary panel right
   edge, below the balance, above the close action). Recorded as the exception.
4. Prose does not say table column headers are uppercase; `structure.css` sets
   `text-transform: uppercase` on `.dtable th` and `visual.css` never
   overrides it, while `.figs .h` is explicitly set to none. Recorded: table
   headers uppercase, report figure headers and round headings sentence case.
5. Prose: "overlay headings 18px". The 640px back-office modal is 13px body
   with a 16px heading (`structure.css` 254–255, not overridden). Both recorded.
6. Frontmatter `button-destructive` omits padding; stylesheet applies `0 16px`
   to every POS button. Recorded.
7. Prose: "no rendered text uses 700". True only because `visual.css` line 67
   coerces the fixtures' inline 700 to 600. The balance, change-due and
   incident titles are therefore 600 and recorded as 600.
8. Lock headline: `lock.html` inline 22px, `visual.css` 30px `!important`.
   Recorded 30px.
9. Frontmatter carries none of `primary-hover`, `destructive-hover`,
   `unavailable-border`, `disabled-border`, the 86 tag fill, or the cream
   key/lock surfaces; prose has some. All are in the stylesheet and now in the
   registry and frontmatter.
10. `--frost-office-min-height: 900px` is the gallery device frame, not a
    product limit. Kept, labelled as the review window.

*Values not sourceable.* Listed in `docs/DESIGN.md` under "Open — not present in
the Frost artifacts": dark palette; pressed/active state on touch; field
error/invalid state; form controls beyond the numeric field (including the
Phase 0 login form); success/informational colour; icons beyond the four;
the fourteen unstyled screens (rendered through the `visual.css` variable
remap, sourced but unreviewed); loading/skeleton treatment; printed output;
inline text links as touch targets; assistive/dim-floor/device checks. None
was filled in.

*Contrast.* Ratios in `docs/DESIGN.md` are arithmetic on the token values,
computed during conversion and labelled as such. Lowest text pair: unavailable
text on the unavailable tile, 4.7:1.

*DESIGN-001 acceptance criteria, walked against the Frost delivery.*
1. Six screens at device targets — **met.** `frost/pos/{order,settlement,lock,
   incidents}.html`, `frost/back-office/{menu,report-detail}.html`; 1280×800
   and 1440 wide per `REVIEW.md`.
2. Behavioral constraints hold — **met-with-a-limit.** `REVIEW.md` records the
   86'd tile in place and no fire control on the quick sale; `structure.css`
   is the wireframe's unchanged. Limit: certified from screenshots and fixture
   states, not from a behavioral walk of every state in this task.
3. Emergency vs warning distinguishable without text — **met.** Solid red
   field vs pale amber outline; 80px/18px/72px vs chip/48px; red 7.2:1 on
   canvas vs amber 5.2:1 on its field. Stated as *how* in `docs/DESIGN.md`.
4. Colour, type, spacing, radius as values — **met.** 169 tokens, each with a
   file, line, selector and property.
5. POS touch targets numeric, no smaller than the wireframe — **met.**
   Identical, because the stylesheet is the wireframe's (`diff` empty).
6. Money as whole rupiah — **met.** Every figure in the fixtures and in
   `docs/DESIGN.md` is precision 0, period grouped.
7. No boundary broken — **met.** B-16: the fired slot is empty and void is
   PIN-gated elsewhere; B-18: the tender amount prefills to the balance and the
   close action is gated on zero balance; B-19: void and refund share no
   control or screen in the six; emergency/receipt (PRODUCT principle 1, B-15):
   unequal treatment throughout. Nothing visual gates a state transition on a
   print.
8. Complete enough to write `docs/DESIGN.md` and tokens without inventing —
   **met-with-a-limit.** Everything needed for the six screens was sourced.
   The eleven items under "Open" are genuine absences, and two of them
   (pressed state, login form) will be needed before Phase 0's client shells
   are styled.

*Task acceptance criteria.* 1 met (each non-obvious value is traced above or
in the registry). 2 met (walk above). 3 met. 4 met. 5 met. 6 met. 7 met: JSON
parses; every one of the 169 `--frost-*` names in `docs/DESIGN.md` exists in
the registry and every registry token is referenced; the YAML frontmatter
parses and every `{ref}` resolves.

*Raised to the lead — decisions, not mine to make.*
- The Phase 0 plan's `packages/tokens/src/index.ts` carries placeholder values
  (`#faf9f7`, `#1f6feb`, `6px`/`10px` radii) that contradict Frost. Not a
  contract document, but not mine either. Suggest the plan point at
  `docs/design/tokens/frost.css` or copy its values before task 12 runs.
- Whether a pressed/active touch treatment is a design decision I may source
  from nothing, or an addition that goes back through review. I did not
  invent one.
- Dark palette: still A5, still the owner's.

`design-reviewer` remains the obvious reviewer for this conversion.
