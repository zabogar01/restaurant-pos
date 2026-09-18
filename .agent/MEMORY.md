# Agent Memory

Central coordination state for this repository. Owned by the Claude product
lead. No other agent writes to this file.

Last updated: 2026-09-17, from repository evidence on
`agent/phase-0-foundations` and the live Herdr roster. That edit recorded F2a
(FE-003) as done and lead-verified, and ruled the eleven departures its
implementer raised. The 2026-09-16 edit recorded A9 and ruled the order-line
ring offset; the 2026-09-15 edit corrected the branch head and an Active agents
table that listed seven agents that no longer existed.

**A9 is committed.** Two commits on `agent/phase-0-foundations`: `0625be9`
carries the implementation — the 172-token registry, `frost-states.css`,
`pos.css` and the hover test — and `c80bb87` carries FE-002, this file and
`.agent/ROADMAP.md`. **F2a followed in `89a100e`, F2b in `eca409c`.** A fresh clone has all of it.
Still not merged to `main`; that is the owner's.

The 2026-09-10 revision of this file was written at 11:50 and went stale the
same afternoon: DESIGN-002 ran two further passes, and an entire visual
direction track ran between 17:30 and 17:52 that this file never recorded. Both
are recorded below. The lesson is the one WORKFLOW.md already states — a lead
who stops writing while other agents keep working leaves the next agent
orienting from a file that is confidently wrong.

Everything below is derived from files on disk and `git` state. Where a
decision was reached in conversation but never written into a document, it is
recorded here as unresolved, because a decision that lives only in a
transcript is not available to the next agent.

**The durability problem is fixed.** For four days everything this project
decided lived only in an uncommitted working tree. On 2026-09-14 the owner
authorised committing it, and six commits on `agent/design-direction` now carry
the lot: this file and `.agent/` entirely, `CLAUDE.md`, `AGENTS.md`,
`.gitignore`, the PRD closures, the standing architecture and its seven
accepted ADRs, three passes of wireframe remediation, both visual directions,
and the Frost design system. A fresh clone has all of it. Nothing is merged to
`main`; that is the owner's.

---

## START HERE — resume point, 2026-09-17

Every agent from the 2026-09-14 session was shut down deliberately to free
memory. **Nothing was lost:** both working trees were clean and every handoff
is committed in `.agent/tasks/`. An agent's scrollback was never the record;
the task files are.

**Two branches, neither merged. Only the owner merges.**

| Branch | Where | Holds |
|---|---|---|
| `agent/phase-0-foundations` | the main checkout | All code: scaffold, PostgreSQL, migrations, `packages/money`, `packages/tokens`, `apps/pos` with the lock screen, the A7 pressed state, the order panel, the menu region, the item and line sheets, and the approval prompt. Head `6180c56` |
| `agent/design-direction` | worktree at `../restaurant-pos-design` | All design: Frost, the 172-token registry, `docs/DESIGN.md`, the three A7 states. Head `b18a356` |

The design branch is **behind** the code branch on `.agent/` files, because the
lead writes memory on whichever branch it is standing on. Expect a conflict
there when the owner merges, and resolve it in favour of the newer file rather
than by hand-merging prose.

**What is done:** the implementation gate is open and all five conditions are
in git history. Phase 0 tasks 1 and 2 (scaffold, money) are done and
lead-verified. FE-001 (POS bundle, Frost tokens, lock screen) is done and
**the owner approved it**. A7 is done — the three states Frost lacked, reviewed
and remediated over three passes.

**What is next, in order:**

1. **A9 — [FE-002](tasks/FE-002-apply-a7-states.md). DONE 2026-09-16,
   lead-verified.** Full account under *A9 landed* below. Written after checking
   what `apps/pos` actually contains, which changed the task: **only the pressed
   ring had a control to land on.**
   The lock screen has twelve keys, Continue and the emergency action — and no
   text field and no round-group heading, so the invalid state and the 13px tag
   have no surface and are deferred to F3 and F2 rather than given an invented
   home. A7's own precedent: its designer needed a state to demonstrate the
   invalid field, invented one, **then reverted it and asked.**

   Three things the lead found while writing it, none of them in the roadmap
   line:

   - **The code branch's registry is the 169-token pre-A7 version.** The four
     A7 tokens live only on `agent/design-direction`. This branch has never
     modified `docs/design/tokens/`, so `git checkout agent/design-direction --`
     on three paths is clean and loses nothing. Only those three paths cross;
     `docs/DESIGN.md` and the rest are the owner's merge.
   - **The pressed ring collides with the focus ring**, and only in the
     rendering, not the geometry. `pos.css` sets `box-shadow` for
     `:focus-visible`; `box-shadow` is one property, so a naive `:active` rule
     erases the focus ring at the moment of the press. Both must go in one
     declaration.
   - **`pos.css` has no `:hover` rule at all today**, so the hover scoping has
     nothing to scope — which is exactly why FE-002 makes it a *test* rather
     than a rule. A8 caught A7's designer writing a comment saying an
     implementation should gate hover; a comment fixes nothing and hands the
     bug to whoever writes the code. F2 builds the menu grid, which is where it
     bites.
2. **F2 — split into three, 2026-09-16.** The roadmap line called it one task.
   The Frost fixture for POS-03 is **664 lines carrying about twenty-six
   states**, and FE-001 was one screen with eight states that produced 114
   tests. F2 as written was three sessions pretending to be one, and the owner's
   own rule is that a task needing two sessions is two tasks. Counting the
   screen before assigning it is now the second time that changed a task — the
   first was A9, which shrank.

   - **F2a — [FE-003](tasks/FE-003-order-panel.md). DONE 2026-09-17,
     lead-verified.** The running order panel. 213 tests, up from 120. Account
     under *F2a landed* below.
   - **F2b — [FE-004](tasks/FE-004-menu-region.md). DONE 2026-09-17,
     lead-verified.** The menu region. 273 tests, up from 213. **The locked
     order now has a route out**, and the check spans both slices — see below.
   - **F2c — [FE-005](tasks/FE-005-ungated-sheets.md). DONE 2026-09-18 for
     three of its seven states; four were correctly refused.** Account under
     *F2c: three built, four refused* below.**
   - **F2g — [FE-006](tasks/FE-006-approval-prompt.md). DONE 2026-09-18,
     lead-verified.** M-1, the approval prompt. 472 tests, up from 356.
     Account under *F2g landed* below. `approval`, `approval-error`,
     `approval-throttled`, `approval-denied`. `B-13`, `B-14`, and §19's ruling
     that a manager may re-enter their own PIN as approver. **Built first
     because both gated families lead here**, so it is built once rather than
     twice.
   - **F2i — [FE-007](tasks/FE-007-discount-family.md), in flight with
     `builder9` from 2026-09-18.** The discount family. Unblocked by F2g.
   - **F2j — the void family**: `sheet-voidline`, `sheet-voidorder`,
     `sheet-voidorder-fired`. Depends on F2g.
   - **F2h** — `error`, `fireerror`, `fireblocked`, and the 86'd line in the
     panel, which is `fireblocked`'s setup and was deferred out of F2b.
   - **F2d — quick-sale / counter mode**, split out of F2b on 2026-09-17. It
     changes the order's identity (`T1` becomes `counter`) and the panel header,
     not just the menu, so it is its own slice rather than a state smuggled into
     the grid.

**How this session works** — the owner's two standing instructions:

- **Frontend first.** Backend tasks 3–12 are paused until the owner has seen
  enough of the frontend. The Phase 0 plan is suspended, not discarded.
- **One reviewable slice per task, owner reviews between.** Every handoff names
  the command and URL that shows the work. An agent that starts a second screen
  has ended its task.

**To see the work:** `npm run dev -w apps/pos`, then `http://127.0.0.1:5173/pos/`
for the lock screen and `/pos/order` for the order panel — six states on
`?state=`: `default`, `empty`, `overflow`, `pressed`, `lock-draft`, `lock-lease`.
For the design fixtures, for the design fixtures, serve
`../restaurant-pos-design/docs/design/visual-directions/` and open
`index.html`.

**Waiting on the owner, none of it blocking:** the dark palette; `FR-M3`'s
"half-up" wording, where the code rounds half away from zero so a refund is the
exact negation of its sale; ruling I-8; the restaurant time zone; receipt
content; the permitted rate range.

**Two lessons this project paid for:**

- **`git log` is the check, not the handoff.** One agent reported committing
  work that was never committed; another reported `done` having never read its
  assignment. Both looked identical to success from the outside.
- **Idle is not done, and 2026-09-18 proved it a third way.** `builder7` went
  idle on F2c with source files on disk and `npm run verify` passing at 298
  tests — and **no handoff and no test file**, because the machine slept
  mid-response one step before it wrote them. A passing suite said nothing,
  because the tests that would have failed had not been written yet. **The
  check that caught it was reading the handoff section and finding it still the
  empty template.** An empty handoff is the cheapest possible signal; look for
  it before looking at anything else.
- **Never `git add -A` while an implementer is live.** The lead swept a
  mid-mutation-run working tree into a docs commit. It happened to be clean.

---

## Current phase

**Phase 0, started 2026-09-14. Backend tasks 1 and 2 of twelve are done and
lead-verified; tasks 3–12 are paused behind the owner's frontend-first
instruction.** The frontend track has delivered FE-001 (lock screen, owner
approved) and FE-002 (A9). The implementation gate opened 2026-09-14 with every
condition met and in git history.

**The repository has code now.** `package.json`, npm workspaces,
`tsconfig.base.json`, `docker-compose.yml` running PostgreSQL 16 on
`127.0.0.1:5433`, `apps/server/src/db/{pool,migrate}.ts`, one migration, and
seven passing tests. Run order: `npm run db:up` → `npm run db:migrate` →
`npm run verify`.

**The lead ran `npm run verify` rather than believing the handoff:** 7 tests
passed in `apps/server/test/migrate.test.ts`, typecheck clean. `builder1` had
also verified from a fresh clone into a path containing a space, which is how
it found the next item.

**Branch: `agent/phase-0-foundations`**, cut 2026-09-14 from
`agent/design-direction` at `92359a2`. Implementation work goes there.
`agent/design-direction` holds everything up to and including the design
system; neither is merged, and only the owner merges.

Everything before this: the product contract, a standing architecture with
seven accepted ADRs, confirmed UX structure, a remediated behavioral wireframe,
two light visual directions with Frost chosen, a design system stating Frost as
169 sourced tokens, and twelve planned Phase 0 tasks.

The gate in [ROADMAP.md](ROADMAP.md) is **open** — all five conditions met and
all five in git history. What remains open are product decisions, not gate
conditions, and each names the phase it must be settled before.

---

## Approved and confirmed

Confirmed by the product owner in session and written into the repository:

- **The product contract.** [docs/PRODUCT.md](../docs/PRODUCT.md),
  [docs/PRD.md](../docs/PRD.md), [docs/ROADMAP.md](../docs/ROADMAP.md), and
  [docs/BOUNDARIES.md](../docs/BOUNDARIES.md) are authoritative. BOUNDARIES.md
  states 24 inviolable rules; a change that breaks one is a defect regardless
  of what else it achieves.
- **MVP scope reduction.** Single local development machine, two
  authenticating roles (cashier and manager), kitchen as a non-authenticating
  classification, waiter deferred, tip capture excluded.
- **Two-client split.** A touch-first POS and a desktop back office as
  separate frontend bundles against one server, one database, one transaction
  boundary.
- **UX behavioral structure.** [docs/design/SITEMAP.md](../docs/design/SITEMAP.md)
  and [docs/design/SCREEN-INVENTORY.md](../docs/design/SCREEN-INVENTORY.md)
  are confirmed as *structure*: 7 POS screens, 13 back-office screens, and 6
  modals, with node types distinguishing routes from overlays. This is
  behavior, **not an approved visual system**. No palette, typography, spacing
  scale, or component library has been chosen or approved.
- **Seven PRD conflict rulings**, committed as `78153ab`, found by drawing the
  interface rather than by reading the requirements. Eleven implied-item
  rulings accompany them; ten are closed, I-8 is not — see below.
- **Architecture approved 2026-09-10.** The owner approved
  `docs/ARCHITECTURE_PROPOSAL.md` as reconciled. Approval carries §19's
  interpretation with it: **a manager who initiated a POS action may re-enter
  their own PIN as its approver.** No second manager is required. This
  satisfies B-13 (identified actor) and B-14 (approval at the moment of the
  action); it does not weaken either.
- **Three wireframe rulings, 2026-09-10**, from the owner's review under
  [DESIGN-002](tasks/DESIGN-002-wireframe-review.md). None changes navigable or
  overlay topology; the screen count is still 7 POS, 13 back office, 6 modals.
  - **I-12 — an order line's trailing slot carries exactly one meaning.** A
    PENDING line gets a remove control that acts with no prompt and writes
    nothing (`FR-H2`, `AC-3`). A FIRED line's slot is reserved and empty, and
    its void is reached elsewhere, because `FR-H4` gates it behind a manager
    PIN, a reason, and a cancellation ticket. A gated action is never reachable
    from the position an ungated one has already taught — `B-16` means the
    wrong reflex cannot be undone, since paper cannot be un-printed.
  - **I-13 — every tender amount prefills to the remaining balance and stays
    editable in place.** An explicit split mode or tab was declined: keying a
    lower amount already *is* the split, and `B-18` is enforced against the
    balance rather than against a mode, so there is no mode for a cashier to
    forget. For card the prefilled value is simultaneously the default and the
    ceiling (`B-5`, `FR-G3`); for cash it is a default that may be exceeded.
  - **Tender pads are a persistent panel, not an edge-entering `[SHEET]`.**
    Owner ruling. The prototype was right and the documents lagged:
    SCREEN-INVENTORY's "what the drawing exposed" item 2 already recorded that
    sheets pushed the drafted payment lines under the close bar at 1280×800.
    `SITEMAP.md`, `M-4`, and `EXTERNAL-HANDOFF.md` are being retyped to match.
    This changes overlay semantics, not screen count.
- **DESIGN-002 remediation, three passes, finished 2026-09-10.** The rulings
  above came out of pass 1. Passes 2 and 3 fixed defects that the rulings
  themselves created or exposed, all recorded in
  [DESIGN-002](tasks/DESIGN-002-wireframe-review.md) with verification:
  - **Pass 2.** Making the void sheet reachable made void reachable under both
    settlement locks, which `AC-21` and `AC-29` forbid. Also established that
    **removing a PENDING line is itself a void** (`FR-H1`, `AC-3`), so `FR-G12`
    and `FR-G13` block it too. Both lock states now render a read-only order
    panel: no row is a control, every trailing slot empty, the lock reason on
    the group header. Inert rather than absent, because a lock is temporary and
    `FR-G13` blocks no reads — which is why this does not contradict ruling
    `C-1`.
  - **Pass 3.** An external reviewer (`design-reviewer`, codex) returned eight
    findings; all eight fixed, plus five more the verification walks turned up.
    The worst: the menu grid stayed live under both locks, so add-line was
    reachable; and `I-12` was violated by its own markup, the fired row being
    one anchor that included the reserved slot. Every row is now a `div.line`
    with the trailing slot as a sibling, guarded by a check asserting no
    trailing slot has an anchor ancestor.
  - **Structural verdict, corrected.** No navigable or overlay topology
    changed — still **7 POS screens, 13 back-office screens, 6 modals** — but
    **seven `[INLINE]` nodes were added** (five under POS-03, two under
    POS-04). `[INLINE]` is a node type in SITEMAP §1, so the earlier "nothing
    structural changed" was too broad and is corrected in place.
- **Tax model: nett**, confirmed 2026-09-10. Tax-inclusive prices, untaxed
  service charge, tax line derived from the total. Indonesian "++" billing was
  considered and deliberately not chosen. This is what the PRD already
  specified, so no figure changes; it is now settled rather than assumed.
- **Currency: IDR at minor-unit precision 0.**
- **Implementation stack:** TypeScript, Node, Fastify, React, Vite,
  PostgreSQL. Written into PRD §9 so the contract and the Phase 0 plan agree.
- **Four owner rulings, 2026-09-14.**
  - **Visual direction: Frost.** Paper rejected, left untouched on disk.
  - **Phase 0 runs subagent-driven.** A fresh implementer per task or small
    group, each with a clean context and a written handoff, with the lead
    reviewing between tasks and holding the gate. This **clears gate condition
    4**, the last condition that needed the owner. The reason given: it matches
    how this project already works, and it stops one long session drifting
    across twelve tasks.
  - **Commit once the two in-flight jobs land.** The owner authorised committing
    the documentation state, but deliberately after `architect` returns the
    architecture conversion and `designer2` returns `docs/DESIGN.md`, so the
    tree is coherent in one go rather than committed mid-flight. Still
    `agent/design-direction`; still no merge to `main` — that is the owner's.
  - **`.impeccable/` is ignored entirely.** Build residue, not repository
    evidence. Added to `.gitignore` 2026-09-14. **Consequence worth knowing:**
    `visual-directions/REVIEW.md` cites the 43 captures, `layout-scan.json` and
    `verification.json` as its evidence, and none of it will exist in a clone.
    The review's findings survive as prose; the artifacts behind them do not.

The last three are recorded in the PRD, committed as `4c59cdc`.

---

## The visual direction: FROST, chosen 2026-09-14

**The owner chose Frost on 2026-09-14.** Paper is rejected. It stays on disk
untouched as the record of what the comparison was; it is not deleted, not
developed further, and not maintained. Frost is the product's visual direction
from this date.

Frost is a *direction*, not yet a design system: `docs/DESIGN.md` does not exist
and no token set has been transcribed. Producing both is
[DESIGN-003](tasks/DESIGN-003-frost-design-system.md), open and assigned.

The rest of this section records what was built, and ran on the afternoon of
2026-09-10 with no coordination file recording it until 2026-09-14.

**DESIGN-001 changed shape.** The task as written sends
`docs/design/EXTERNAL-HANDOFF.md` plus the owner's own reference out to an
external tool — Lovable was the expectation. What actually happened is that the
owner supplied a Customer.io style reference and the visual work was built
**inside this repository** against the confirmed structure. The handoff package
is still written and still valid; it was not the route taken.

**What exists**, under [docs/design/visual-directions/](../docs/design/visual-directions/):

- **Two light directions, `paper` and `frost`**, each covering the six
  representative screens named in DESIGN-001 — POS order, settlement, lock/PIN,
  print incidents, back-office menu, back-office report detail. POS at
  1280×800, back office at 1440 wide. Existing query-string fixture states are
  preserved, so the stress states are walkable.
- **`DESIGN.md`** — the token set, as stated values rather than a picture:
  colour roles including emergency versus warning separately, a type scale,
  spacing, radius, and component treatments with POS control heights at 72px
  and menu tiles at 150×96. Its own first line calls it "two proposals for
  comparison, not an approved production design system".
- **`index.html`** — a comparison gallery that switches direction and screen.
- **`REVIEW.md`** — a finish review by `design-reviewer`. Verdict: **ship for
  visual comparison**. Two material findings were found and corrected: Frost's
  selected back-office navigation lost contrast on hover, and the lock-screen
  incident fixture bypassed the PIN step it depicts. Both rechecked in a
  browser, because resting screenshots cannot prove a hover state.
- **`docs/design/VISUAL-DIRECTION-BRIEF.md`** — the direction contract the
  build ran under.
- **`.impeccable/review/pos-light/`** — 43 PNG captures, four contact sheets, a
  layout scan, and a verification record over 146 fixture states. 4.9 MB of
  tool working state, currently **not** ignored by `.gitignore`.

**What the choice does and does not settle.** Frost is the direction. It is not
yet binding on an implementation, because no document states its values in a
form an implementation can consume — that is DESIGN-003's output, not this
delivery's. Light only was delivered; **a dark palette is still an open product
decision**, so DESIGN-001's "both light and dark, or an explicit decision that
only one ships" is answered for this delivery and not for the product.

---

## Proposed, unresolved, or recorded only in conversation

Nothing in this section may be treated as decided.

- **Remaining PRD open questions:** receipt content and fiscal requirements
  (blocks Phase 4), post-close corrections (blocks Phase 5), and maximum
  permitted tax and service-charge rates (the proposal places this before
  Phase 2, earlier than the PRD implies).
- **PRD §9 does not name a restaurant time zone.** Raised by the architect and
  verified: the string does not appear in the PRD at all. Receipt timestamps
  and business-day boundaries both need one. This is a contract document, so
  the wording is the owner's to approve, not an agent's to add.
- **Ruling I-8 is still open** and was previously missing from this file.
  Back-office reprint of a kitchen ticket: `FR-E3` grants the action, `FR-J3`
  does not audit it. Drawn ungated and unaudited on BO-13, matching the
  requirements as written. The designer explicitly did not settle it.
- **The Phase 0 plan's closing paragraph is stale.** It still says "the
  tax-inclusive versus '++' question is still open and belongs to Phase 2".
  The tax model was settled the same day. The architect proposed replacement
  wording; nobody has applied it. The plan is not a contract document, so the
  lead may edit it, but it has not been edited.
- **Wireframe review — done as a task, still owed a close.** The owner's review
  ran, three remediation passes followed, and every finding raised was applied
  or explicitly declined. [DESIGN-002](tasks/DESIGN-002-wireframe-review.md) is
  still marked `Active` and carries standing items the designer flagged rather
  than fixed: the table line editor's Back control returns to a fixed state
  instead of the state it was opened from; `Meal voucher` and `Staff account`
  are drawn inert; POS-03's `default` copy defect; and screens other than
  POS-03 and POS-04 were never audited for the arithmetic incoherence that was
  found and fixed in those two.
- **Pressed / active touch state — absent from Frost, and deliberately not
  invented.** `designer` raised it rather than filling the gap. **Lead's
  ruling, 2026-09-14:** it stays absent. A POS key's pressed state is a real
  design decision on a touch device where the finger hides the target, and it
  is not the kind of thing to conjure while writing a token file. When Phase 0
  styles the PIN pad it goes to a designer as a small scoped piece and through
  `design-reviewer`, not into `packages/tokens` by invention. Recorded in
  `docs/DESIGN.md` under its open list. Same treatment for the field
  error/invalid state and the login form's controls, which are the other two
  absences Phase 0 will actually hit.
- **Fourteen screens were never styled.** The six representative screens carry
  the direction; the rest render through `visual.css`'s variable remap —
  sourced, but never reviewed. Nobody has decided whether that matters before
  implementation or during it.
- **Dark palette.** Not delivered, deliberately. DESIGN-001 asks for light and
  dark or a stated decision that only one ships. A POS on a floor and a back
  office at a desk are different lighting situations, and the question is still
  open for the product even though this delivery is light only.
- **The quick-sale line editor's node count.** The designer recorded it as a
  second *form* of the existing line-editor sheet, not a new node, and flagged
  that if the lead would rather count it as a distinct sheet the modal count
  becomes **7**. One line in SITEMAP.md either way. Flagged rather than decided,
  because it changes a published count.

---

## Git state

- **Branch:** `agent/design-direction`. Never merged to `main`; only the owner
  merges.
- **Working tree clean** as of 2026-09-14.
- **Six commits on top of `c5a2807`**, in the order they were made:

| Commit | What it carries |
|---|---|
| `e6120f0` | Agent coordination memory, `CLAUDE.md`, `AGENTS.md`, `.gitignore`, `.DS_Store` out of the index |
| `4c59cdc` | PRD closures: stack, currency, tax model |
| `10bcb4c` | `docs/ARCHITECTURE.md` and seven accepted ADRs; the proposal superseded |
| `65b697a` | Three passes of wireframe remediation |
| `5d339c5` | Paper and Frost, the brief, the finish review, the external handoff |
| `12294a7` | `docs/DESIGN.md`, the 169-token Frost registry, the Phase 0 plan's corrections |

Repository hygiene: a `.gitignore` exists at the root, `docs/design/.DS_Store`
is out of the index (the file remains on disk, now ignored), and `.impeccable/`
is ignored entirely by the owner's 2026-09-14 ruling.

The only thing still uncommitted at any moment is this file, which goes stale
the instant it is committed and is updated again after. That is expected; the
warning worth keeping is the older one — **work that lives only in a pane
scrollback is not durable**, and two of this project's agents have now lost
their closing reports to a usage limit.

`docs/design/` is **tracked**: all 26 files under it, including the whole
prototype, were committed in `c5a2807`. Any instruction premised on that
directory being untracked no longer applies.

`docs/decisions/` and `docs/tasks/` exist on disk but are empty, so git does
not track them. They are not evidence of any recorded decision.

The single biggest durability risk in this repository right now is that
`.agent/` — the coordination memory every agent reads to orient — has never
been committed.

---

## Active agents

Coordinated through Herdr in workspace `w2`. Herdr routes messages between
panes; it stores nothing durable. Anything that must survive the session
belongs in this file.

Roster verified against `herdr agent list` on 2026-09-15.

**One agent is live. The eight-agent roster this section carried is gone.**

| Name | Kind | Pane | State | Role |
|---|---|---|---|---|
| `lead` | claude, Opus 5 | `w2:p1` | live | Product lead and coordinator. Sole writer of this file and `.agent/ROADMAP.md`. A fresh session took this pane on 2026-09-15 and renamed it `lead` |
| `builder9` | claude | `w2:pM` | live, working | Started 2026-09-18 on [FE-007](tasks/FE-007-discount-family.md), F2i — the discount family |

`architect`, `designer`, `design-reviewer`, `designer2`, `builder1`, `builder2`
and `builder3` were all shut down on 2026-09-14 to free memory. Their panes no
longer exist. Nothing was lost: both working trees were clean and every handoff
is committed under `.agent/tasks/`. Any future work needs a fresh agent started
into a fresh pane — no scrollback survives.

**Eight implementers have been closed, not kept.** `builder1`–`builder3` on
2026-09-14; **`builder4`–`builder8` on 2026-09-18 at the owner's instruction**,
once each had delivered and the tree was clean.

**The policy, settled 2026-09-18:** close an implementer once its slice is
delivered and committed. Its context is spent on that slice, the owner's ruling
is a fresh implementer per task anyway, and the durable record is the committed
handoff — not the pane. **Keep an agent alive only when its scrollback holds
something that was never written down.** That has happened exactly once:
`designer2`, whose pane was the only record of how the token registry had been
extracted. Every builder here wrote a full handoff, so none qualified.

What the dead roster is still worth knowing for:

- **The two codex agents shared one account quota and both exhausted it at
  15:11 on 2026-09-14**, mid-task in `designer2`'s case. Running two hard jobs
  concurrently on one account spends the budget twice as fast and stops both at
  once. `architect` finished first and lost only its closing report; `designer2`
  lost the second half of its task.
- **Fable 5.1 hit a monthly spend limit** the same afternoon and never processed
  the A7 prompt at all. The owner's Fable preference is overridden by
  availability, not by choice.

Twice now this section has been confidently wrong about who is alive — the
2026-09-10 revision recorded `designer` as gone while it did the bulk of that
afternoon's work, and the 2026-09-14 revision listed seven agents that had
already been shut down. **Verify the roster against `herdr agent list` before
trusting this table, and rewrite it when it disagrees.**

A third git worktree exists at `.claude/worktrees/keen-chebyshev-ccf255`,
detached at `78153ab`. It is leftover tooling state, not a work location.

There is no task file for the architecture work. `B2` was carried out against
the proposal document itself, and the architect's account of it exists only in
its pane scrollback — which is why the material parts of it are copied into
this file. The same is true of the visual direction build: `REVIEW.md` and the
brief are its only durable record, and neither is a task file.

---

## A7 is done — the three missing states exist, reviewed and demonstrated

[DESIGN-005](tasks/DESIGN-005-a7-three-missing-states.md) closed 2026-09-14
after three passes and one review, on `agent/design-direction` in the design
worktree. **This was the one design task that required invention**, and the
condition was that invented values be marked as designed rather than disguised
as sourced.

**What exists now:** 172 tokens, of which **four are designed** and carry
`source: null` — explicit, not missing — plus a `designed` block naming the
task, date, the rule in `frost-states.css`, the fixture states that show it,
and why. A check asserts every token has exactly one provenance shape.
`visual.css` and `structure.css` are still byte-identical to what
`design-reviewer` reviewed, which is why all 168 sourced line numbers still
point where they did. The new rules live in a separate sheet for exactly that
reason — a sharper instinct than the task asked for.

- **`--frost-pressed-ring: inset 0 0 0 2px currentColor`.** The rule is
  *selection fills; pressing strokes*. `currentColor` means one rule reads on
  every ground — ink on cream keys and white tiles, white on spruce, brick on
  the outlined destructive — with **zero new colour values**. Inset, so it
  never collides with the outer focus ring, never overlaps a neighbour in a
  zero-gap stack, and moves no layout. On an order line it rings the tap target
  only and stops short of the trailing slot: `I-12` made visible.
- **`--frost-invalid` (#83611c)** — the warning hex under its own name, so an
  implementation never writes "warning" on a form field and the two can diverge
  later. Plus `--frost-invalid-border` and `--frost-round-tag-size: 13px`, which
  closes `design-reviewer` finding 6.

### What the review caught, and why it mattered

The first pass looked right in a screenshot and was wrong on a touch device.
`visual.css:77` applies the ink selected fill on `a.tile:hover`, and touch
browsers synthesise and hold `:hover` after a tap — so once the ring went, the
tile was left looking selected, **the exact confusion the state was designed to
prevent**. The designer had seen it and written a *comment* saying an
implementation should gate hover. A comment fixes nothing and hands the bug to
whoever writes the code. It is now a real `(hover: none), (pointer: coarse)`
block of thirteen rules. Second of the same shape: `--frost-invalid` existed as
a name while both rules consumed `var(--warning)`, so the separation was
documentation rather than fact.

**The proof methods are the standard to hold others to.** It cloned the
media-block rules into the live page to prove the cascade actually wins, and
set `--warning` to magenta at runtime to prove the invalid token is genuinely
independent. Claims checked by construction, not by assertion.

### A ruling worth remembering how it was reached

The designer specified a 40px invalid field, could not demonstrate it in any
reviewed state, **invented a BO-03 state to show it, then reverted it and
asked.** That is the behaviour to want when a constraint and a need collide.
Granted: BO-03 now has *category-invalid* — Create tapped with an empty name,
the field invalid with "Enter a name", Create disabled until a name is entered,
nothing written. It adds a **state to an existing screen, not a node**, so the
count stands at **7 POS / 13 back office / 6 modals** and DESIGN-002's
precedent covers it.

**Lead-verified on the branch, not from the handoff:** 172 tokens with four
designed and none ambiguous, CSS matching the registry exactly, no token named
in `docs/DESIGN.md` that is absent from it, the frontmatter's all-sourced claim
gone, `menu.html` byte-identical to its pre-A7 bytes before the ruled state was
added back deliberately, and the reviewed stylesheets untouched.

**F2 is unblocked.** The order workspace is the screen where a tap often
changes nothing near the finger, which is why it waited for this.

---

## F2g landed — one PIN guarantee for both pads, and the artifact was wrong

[FE-006](tasks/FE-006-approval-prompt.md), `builder8`, committed `6180c56`.
**Lead-verified: 472 tests across 15 files, up from 356.**

**`B-12` proven by leaking a digit.** The lead added `data-d={entry[i]}` to one
PIN dot — an attribute on an element that already exists, the subtlest leak
available — and **all thirteen tests in `pin-pad.test.tsx` failed**. The suite is
parameterised over *both* pads and checks byte-identical markup at **every
partial length**, no digit in any attribute, and nothing reaching console,
storage, cookies, the title or the URL.

**The keypad was reused with its geometry as a class**, and that is what makes
one test cover both pads. Worth more than either pad's independence, and the
right answer to a question the task file left genuinely open.

**`B-14` is enforced by absence** — no approve-all, no caching, no re-use, no
remaining-time indicator on the approval itself, no path by which a back-office
session skips the prompt.

### The artifact is wrong in the throttled state, and this is the second of its kind

The Frost artifact **and the wireframe** share one keypad across all four
approval states, with a live confirm key. Read literally that **draws an
approval succeeding during the `MANAGER_APPROVAL` cooldown**, which `FR-A5` and
`AC-19` forbid — and M-1 names `FR-A5` as a requirement of the throttled state.
`builder8` drew the confirm inert using POS-01's **reviewed** LOGIN-cooldown
treatment and asked. Accepted: reusing a reviewed treatment is not invention,
and the alternative was drawing a forbidden state.

**Both defects implementation has found in reviewed design artifacts have the
same shape.** DESIGN-004's critical finding was a live close offered on a stale
balance; this is a live confirm offered during a lockout. **A control shared
across states is where to look** — the sharing is precisely what hides the one
state in which it is wrong. This belongs on the design branch as a review
heuristic, not just as a fix.

### A `B-20` question found by building, not by reading

`loading` looked like a reuse and is not. The lock screen's verifying treatment
exists and `PinPad` already has the prop — but the approval modal adds something
the lock screen never had: **Cancel sits in the footer while the PIN is in
flight.**

If Cancel stays live during verification, the footer's *"Cancelling changes
nothing on the order"* **may be false**, because the server can approve and
execute after it is pressed. If Cancel is withdrawn, that is a new decision.
**Owed to a designer**, with `docs/DESIGN.md` open item 6 noted: the lock
screen's verifying style is itself unreviewed.

`no manager available` (PRD §6) is drawn by nothing. Named, not filled, A7's
shape, goes to a designer.

### Binding on F2i and F2j

**`?state=approval` is a review harness, not a route.** SITEMAP §1 says a
`[MODAL]` is neither a route nor back-stackable, so the prompt replaces history
rather than pushing it and Back never reopens an approval. **Those slices open
the prompt as component state from their sheets** — writing an approval URL is
exactly what SITEMAP forbids.

### Ruled and scheduled: `role="alert"` on both pads, in F2e

`builder8` left the failure notices without an ARIA role because neither pad has
one and the two should agree. Right reasoning, wrong outcome to leave standing:
**a wrong PIN that is never announced is a real defect** for a screen-reader
user. **F2e adds it to both pads**, since that slice already opens both files
for the button conversion. Batching stops a third slice reaching into reviewed
work for one attribute.

**Still carried:** focus is not trapped in the dialog — Tab reaches the dev
fixture links below the frame, never the inert order. Acceptable in a harness
whose leak is dev-only; **not acceptable at ship.** Same finding as FE-005's,
so it is now twice.

---

## F2c: three built, four refused — and the lesson is how to slice

[FE-005](tasks/FE-005-ungated-sheets.md), `builder7`, committed `5edd874`.
**Lead-verified: 356 tests across 14 files, up from 273.** Criterion 1 proven by
pointing the item sheet's *Add to order* at `sheet-voidline` and watching
*"every live control on the frame leads somewhere ungated"* fail.

**The guard proves both halves of its own detector** — that it finds the panel's
void paths once the background stops being inert, and that it ignores a control
inside an inert subtree. A reachability check without the second half passes by
failing to look. This is the sharpest test written on this project so far.

**Looked at:** `sheet-item86` keeps Large and Extra cheese filled and the line
total at 135.000, says why the item went, and renders *Add to order* greyed and
dashed while Cancel stays live.

### The refusal is the valuable part

FE-005 put all three M-3 discount nodes on the ungated side.
SCREEN-INVENTORY says the opposite in one sentence: *preset picker (ungated,
FR-F2), free-form entry (**gated**, FR-F3), remove/replace (**gated by the whole
transition**, FR-F8).*

`builder7` was therefore handed a contradiction. Hiding the gated entries would
have satisfied criterion 1 and broken the inventory's rule that denial is
*"never a hidden control"*. Leaving them in would have failed criterion 1. **It
built the three states that were genuinely ungated, held four, and asked** —
with a proposed ruling and a test file already wired so any held state is
checked the moment it is added.

### CORRECTION, 2026-09-18 — the lead over-read the inventory on `FR-F8`

FE-005's verification ruled that remove/replace of a discount is *wholly*
gated, calling it "stricter even than the handoff put it". **That was wrong.**
It was taken from SCREEN-INVENTORY's compressed summary — *"remove/replace
(gated by the whole transition, FR-F8)"* — rather than from `FR-F8` itself.

The PRD is more precise, and the PRD is the contract:

> The approval gate covers the **whole transition**: removing or replacing a
> **free-form** discount requires manager approval **even if its replacement is
> a preset**; removing or replacing a **preset is ungated unless the replacement
> is free-form**.

"Whole transition" means the gate inspects **both ends** — what is removed and
what replaces it — not that every path through the sheet is gated. **The
artifact draws this correctly**, which is why three of its controls are ungated
in the one case it shows.

**What the error changed:** nothing built. F2c still correctly held those
sheets, because two of the three paths do reach the prompt. **What it changed is
F2i**, which is now a richer slice: the gate is *data-driven* and needs a
fixture for a free-form discount applied, where all three controls are gated.

**The lesson generalises the existing one.** "Slice by authority" was right;
this adds: **the inventory is derived from the PRD, and a compressed summary
loses precision in exactly the direction that sounds safer.** Go to the
requirement.

### RULED — slice by authority, not by component

**Four consecutive slices have now had a task file of the lead's be wrong where
a reviewed document was right.** The pattern is finally specific: the lead has
been grouping work by *what it looks like on screen* — "the sheets", "the menu
region" — while the inventory groups it by *who is permitted to do it*.

- `sheet-freeform`, `sheet-remove`, `sheet-discount` and `zero` move to the
  gated family. A sheet is one node to a cashier; shipping its ungated half
  early would put a gated control on screen with nothing behind it.
- **Criterion 1 is restated for every future slice:** *no control this slice
  adds reaches a gated state except through the approval prompt. A panel's
  existing void paths are `I-12`'s and stay.* As originally written it could not
  hold for a non-sheet state, because behind `zero` the panel is live by design.
- **The gated work is three slices, shared piece first:** M-1 the approval
  prompt, then the discount family, then the void family. Both families lead to
  M-1, so it is built once.

### Idle is not done — proved a third way

`builder7` was stopped mid-response by the machine sleeping, one step before it
wrote its tests. It went **idle with source on disk and the suite green at
298** — with no tests for the new code and an empty handoff template. **A
passing suite proved nothing, because the tests that would have failed did not
exist yet.**

The signal that caught it was the **empty handoff section**, checked before
anything else. It was resumed in the same session with its context intact and
finished the work; nothing was lost and nothing was rebuilt. **Check the handoff
is written before checking anything it claims.**

---

## F2b landed — the locked order has a way out, and the check spans the seam

[FE-004](tasks/FE-004-menu-region.md) closed 2026-09-17, delivered by
`builder6`, committed `eca409c`. **Lead-verified: 273 tests across 13 files, up
from 213.**

**Acceptance criterion 1 was proven by deleting it.** Removing both route-out
actions failed four tests, named *"carries exactly one action, a link that goes
somewhere"* and *"whole screen: the panel stays inert and readable, and the
notice's action is the only way out"*, once per lock. **The cross-slice check is
a test, not a reviewer remembering to look across the seam.** That is better
than the task asked for, and it is the pattern to repeat wherever one slice
completes another.

**Looked at:** `lock-draft` gives the cashier exactly one control on the whole
frame — the route out — beside a fully legible panel. `eightysix` holds Steak
greyed and dashed in slot three of row one, grid unreflowed.

### The lead's task file was wrong twice, and the implementer checked both

- **It claimed the registry carries nothing for the category rail or the `86`
  tag. It carries all seven tokens.** The lead's grep was too narrow — `cat-`
  misses `category-`, `86` misses `unavailable-` — and the conclusion went into
  the task as fact.
- **It said `loading` shows neither rail nor grid.** The artifact keeps the rail;
  only the grid gives way to the skeleton.

**That is the third consecutive slice where a task file was wrong and a reviewed
artifact was right** (FE-003 mis-listed the three line signatures). The rule is
now explicit and belongs in every task file: **a task file is derived. Where it
disagrees with the artifact or the inventory, raise it and follow the artifact.**
Three implementers have now done exactly that, which is the process working —
but the lead is the one generating the errors, so the lead writes less
confidently: state a premise as a premise, not as a finding.

### RULED — `<button>` for acting, `<a>` for going, 2026-09-17

**Two consecutive slices reported the same unverified gap:** focused-and-pressed
could not be checked, because a mouse press drops `:focus-visible` and **Space
does not activate a link**. Repetition across slices is a signal, not an
accident.

The real question underneath is semantic. In the finished product a menu tile
*adds a line*, a category *filters the grid*, an order-line body *opens a
sheet*, and the × *removes a line*. None of those is navigation. They are links
today only because the Frost fixtures are static HTML that moves by URL, and
**fixture plumbing must not dictate the app's semantics.**

- **Anything that acts on the order is a `<button>`.** Tiles, categories, line
  bodies, the remove control, the close-bar actions.
- **Anchors are for going somewhere** — the route out of a lock, which genuinely
  leaves for the settlement screen.

**Scope, deliberately limited.** This is a refactor across two committed,
reviewed slices, so it is **its own task (F2e), not a blocker on F2c** and not a
silent edit. What F2c must do is **stop the debt growing: every new acting
control is a `<button>`.** Once F2e lands, focused-and-pressed becomes checkable
by the keyboard method FE-002 already established, and that check goes into the
suite rather than into another handoff's "not checked" list.

### Also carried

- **Three placeholder route names now exist** — `?state=settle`,
  `?state=settle-pending`, `?state=settle-takeover`. **F3 reconciles all three**;
  it is the first thing F3's task file will say.
- **The panel in `eightysix` and `loading` is not the artifact's**, because
  panel markup was out of bounds for F2b. The artifact tags the pending Steak
  *line* with `86` and skeletons the panel while loading. **The 86'd line is
  F2c's** — it is the setup for `fireblocked`.
- **Hover-on-touch could not be emulated.** `Emulation.setEmulatedMedia` did not
  take, so `builder6` declared the check **void** rather than reporting a pass it
  had not earned. Worth naming as the standard: a check that did not run is not
  a check that passed.

---

## F2a landed — the order panel, with I-12 checked rather than described

[FE-003](tasks/FE-003-order-panel.md) closed 2026-09-17 on
`agent/phase-0-foundations`, delivered by `builder5`, committed `89a100e`.
**Lead-verified: 213 tests across 12 files, up from 120; typecheck clean.**

**The three new guards were each proven red by the lead**, by injecting the
defect each claims to catch rather than accepting that it had been proven:
widening the ring offset failed the clearance tests; `Number()` on money failed
both the detector and the exactness check; wrapping a row in an anchor failed
the `I-12` slot guard in three states.

**`tsc` does not catch `Number()` on a bigint**, because `Number()` accepts one.
That makes the test the only guard on the money trap `builder2` measured, and it
is the reason the rule had to be a test rather than a note in a handoff.

**The `I-12` guard now catches automatically what DESIGN-002 pass 3 found by
hand** — a fired row built as one anchor that swallowed its own reserved slot,
violating the ruling in its own markup. That defect cost a review pass once.

**Looked at, not inferred:** a held pending row rings the body and stops clear
of the × box, which is `I-12` made visible and cannot be proven from CSS. The
measured clearance is 4px — the 12px gap minus the 8px offset, the number the
ruling predicts. `lock-draft` renders every slot empty, no row a control, the
reason on every header, rows fully legible: inert, not absent.

### A locked panel currently strands the cashier — F2b must fix it

The artifact puts the lock notice — *Back to payment*, *Manager: take over
payment* — in the **menu region**, which F2a does not own. So the panel is
correct and the *screen* is not: under either lock there is no visible route
out. `builder5` found this and **refused to invent a button in the panel**,
which was right in both directions.

**This is an acceptance criterion for F2b, not a note.** A slice boundary that
leaves a user stranded is only acceptable while the next slice is known to close
it, and that only holds if it is written down as a requirement.

### Owner decision owed before F3 — does IDR show its symbol

FE-003's task text said the symbol is the frontend's job; the reviewed artifact
draws every amount bare (`135.000`). `builder5` followed the artifact and
flagged the contradiction rather than choosing silently. **Provisionally ruled:
follow the artifact.** Whether `Rp` appears is one decision for every screen
that shows money, and **F3 is where it stops being cosmetic**, because that is
money shown to a customer at the point of payment. Raised with the owner
2026-09-16; unanswered.

### A lead error worth keeping

FE-003's task file listed the "three line signatures" as PENDING, FIRED and the
locked case. **The locked case is `I-12` holding, not a signature** — which the
same file says correctly two paragraphs later and then contradicts in its own
list. SCREEN-INVENTORY's third signature is VOIDED. `builder5` followed the
inventory over the task file and drew VOIDED rows. The lesson is the ordinary
one: a task file is a derived document, and where it disagrees with the
inventory the inventory wins.

### Accepted costs, recorded rather than fixed

- **Five artifact literals were omitted rather than approximated**, leaving the
  totals block about 6px tighter. Omitting beats inventing under
  `no-invented-values`, and each is commented in `pos.css`. One is not merely
  spacing: the empty notice's `700` heading renders as semibold 600. If the
  owner wants the artifact's exact block, the fix is registry tokens.
- **The `Number(` detector is blunt** — it bans the call across all of `src` and
  an alias slips through. Adequate; the limit is stated, not hidden.
- **Focused-and-pressed was not verified in a browser** on the new controls.
  Space does not activate a link, so FE-002's keyboard method does not carry
  over. A real gap, small, honestly reported, and it belongs in F2b's browser
  pass.
- **`?state=settle` is `builder5`'s placeholder name**; the artifact links to
  `settlement.html`. F3 settles it.

---

## A9 landed — the pressed ring is in the POS, and the hover rule is a test

[FE-002](tasks/FE-002-apply-a7-states.md) closed 2026-09-16 on
`agent/phase-0-foundations`, delivered by `builder4`. **Lead-verified: 120 tests
across 9 files, typecheck clean, 172 tokens, and the three design artifacts
byte-identical to `agent/design-direction`.** The lead also opened two of the
screenshots and looked at them.

**What is now true of the code branch:** the registry is the 172-token A7
version, `frost-states.css` is present, and every enabled boxed control on the
lock screen — twelve keys, Continue, the emergency action — draws
`--frost-pressed-ring` while held. The disabled Continue draws nothing, because
a disabled control's press did nothing.

Three things worth carrying:

- **The focus ring and the pressed ring collide, and only in the rendering.**
  `frost-states.css` says the inset ring never collides with the outside focus
  ring, which is true of the geometry. But `box-shadow` is one property, so a
  naive `:active` rule *replaces* the focus ring — a keyboard user would watch
  it vanish at the moment of the press. Both shadows go in one declaration. The
  lead found this while writing the task, not in review, which is the cheap
  place to find it.
- **The hover rule is now a test, not a comment.** A8's most expensive lesson
  was that A7's designer wrote a comment saying an implementation should gate
  hover, and `design-reviewer` rejected it: a comment fixes nothing and hands
  the bug to whoever writes the code. `apps/pos/test/hover-scoped.test.ts` fails
  on any `:hover` in `apps/pos/src` outside `@media (hover: hover)`. It carries
  detector self-tests so it cannot pass vacuously while `pos.css` has no hover
  rule at all — which it does not, today. **The lead proved it red** by
  appending an unscoped `.key:hover` and watching the suite fail, rather than
  accepting that it had been proven.
- **The implementer ran a negative control.** It could not hold `:active`
  through the Chrome tool, which only clicks, so it drove the same Chrome over
  the DevTools Protocol, held the press, and read computed style — then removed
  the collision fix and confirmed the focus halo disappears. Proving a fix by
  also proving its absence breaks things is the standard A7's review set, met
  here without being asked.

### The order-line ring offset — RULED, 2026-09-16

`frost-states.css:58` rings a pressed order line with
`border-radius: 2px; margin: -8px; padding: 8px`, so the ring clears the text
without moving it. Those are literal lengths, and `no-invented-values.test.ts`
rejects literal lengths in `apps/pos/src`. F2 is the screen that hits it.

`builder4` found what the lead had not: **DESIGN-005 already gives the token
form** — `margin: calc(-1 * var(--frost-space-2)); padding: var(--frost-space-2);
border-radius: var(--frost-radius-surface)`. The registry has
`--frost-space-2: 8px` and `--frost-radius-surface: 2px`, and the length regex
has no unit to catch inside the `calc`. So the route exists and no exemption is
needed. It did not decide whether a *space* token may carry a ring offset, and
was right not to.

**Lead's ruling: use the token form, and F2 must carry a test that pins the
relationship.** The offset is a genuine spacing fact, not a coincidence of equal
numbers — the states sheet derives it from the row's own padding and says 8px
"stays inside the row's padding and short of the 12px gap to the slot". So it
should track the spacing scale. But that creates a coupling nothing watches: if
`--frost-space-2` is ever retuned for layout, the ring silently crosses the gap
into the trailing slot and `I-12` breaks visually with no test failing.

The test asserts the offset stays within the row's padding and short of the slot
gap. This is the same move as the hover test and for the same reason: an
invisible coupling becomes a checked one. **An implementer that finds the test
inconvenient raises it; it does not widen the exemption.**

### Housekeeping left running

- **PostgreSQL is up.** `builder4`'s baseline `npm run verify` failed seven
  tests in `apps/server/test/migrate.test.ts` with `ECONNREFUSED ::1:5433`
  because the container was down. It ran `npm run db:up`, got 114/114, then
  started. Container `restaurant-pos-db-1` is still running.
- **A Vite dev server on 5173 is not `builder4`'s.** It was already listening
  when the task started, serving this checkout's `apps/pos`. Left alone.
- **The browser evidence is gone with the session.** Screenshots and the
  DevTools script lived in a scratchpad, not the repository. The claims they
  support are written down; the suite and the detector are the durable check.

---

## FE-001 landed — the first screen exists, and it is the owner's to judge

`apps/pos` builds and runs. The POS lock screen is real code at 1280×800 on the
Frost tokens, with eight fixture states. **Lead-verified: 114 tests across 8
files pass, typecheck clean over server, money and POS.** The lead also opened
it in a browser and looked at it.

**To see it:** `npm run dev -w apps/pos` from the repository root, then
`http://127.0.0.1:5173/pos/`. States hang off `?state=` — `loading`, `error`,
`permission-denied`, `throttled`, `invalidated`, `draft`, `incident`. The port
is strict, so it fails loudly rather than moving.

**Nothing behind it is real.** The PIN is compared against nothing.

Three things worth keeping:

- **`packages/tokens` declares no values of its own.** It is a one-line
  `@import` of `docs/design/tokens/frost.css`, and a test fails if it ever
  declares anything. That is the anti-drift mechanism working as intended: the
  registry stays the single source, and a client cannot fork it by accident.
- **`builder3` wrote tests that enforce the rules rather than trusting them.**
  `no-invented-values.test.ts` fails on any literal colour, length, font size
  or weight in `src/`, and on any `var(--frost-*)` absent from the registry.
  `console-free.test.ts` fails on any `console.`, storage, cookie, `fetch`,
  XHR or beacon. `B-12` is checked four ways, the sharpest being that entering
  `123456` and `987650` produce **byte-identical `innerHTML`**.
- **The 88px keys were measured in the rendered page, not read off the CSS** —
  twelve keys at exactly 88×88, and the same measurement run against the
  reviewed Frost artifact returns the same geometry.

**`A7` — no pressed state was used, and the reasoning is worth carrying.**
`builder3` did not reach for a provisional treatment, because on *this* screen
every key already changes something visible: a digit fills a dot, delete empties
one, Continue empties all. The gap does not bite here. **It will bite on the
order and tender screens**, where a tap often changes nothing nearby, so `A7`
should be settled before F2.

Deviations from the plan, each with a reason: Vite 8 and `@vitejs/plugin-react`
6 (vitest 4 already installs Vite 8; Vite 5 would put two Vites in one tree),
jsdom 29 at the root (30's engines field excludes this machine's Node 25, and
vitest resolves the environment from its own location), and the build output
left in `apps/pos/dist` rather than the plan's `apps/server/public/pos`,
because this task was not allowed to touch the server.

---

## Phase 0 Task 2 landed, and what came out of it

`packages/money` is on disk and lead-verified: **81 tests across 5 files, all
passing**, typecheck clean over both `apps/server` and `packages/money`. The
lead ran `npm run verify` rather than reading the claim.

**Two defects in the plan, found by building it.** Both now corrected in the
plan with a dated note saying what they were:
- The PRD worked example summed to **2000, not 1650**, so the plan's own
  assertion would have failed. The modifiers are part of the burger's price,
  not additions to it.
- `rateFromPercent(percent: number)` — a float path guarded by more float, and
  the one signature in the module `B-1` most obviously forbids. A rate is not
  money, but a float rate multiplied into money produces float money by a
  shorter route. It is `percent: string`, parsed exactly.

**A mistake of the lead's, caught by the implementer.** `git add -A` while
`builder2` was mid-task swept its working tree into a docs commit (`261129d`).
`builder2` checked and the files were byte-identical to what it had verified,
so nothing broke — but it was mid *mutation run*, and a deliberately broken
file could have been committed as real work. **Path-scoped `git add` from now
on while any implementer is live.**

### Rulings owed on what Task 2 raised

- **`Money` and `Rate` are the same type**, so `mulRate(rate, amount)` compiles
  with its arguments swapped. **Lead's ruling: brand `Rate`, leave `Money` as
  `bigint`.** A `Rate` is only ever produced by `rateFromPercent`, so branding
  it costs nothing at the call sites, while branding `Money` would force a
  constructor around every literal. It prevents the swap, which is the actual
  bug. **Not applied yet** — backend is paused, and this is a twenty-line change
  that is cheap now and expensive after ten tasks import the type. It runs when
  the backend resumes, before Task 3.
- **`FR-M3` and `B-2` say "half-up" and never say what that means below zero.**
  The code rounds **half away from zero**, so −74.5 → −75, which keeps a refund
  the exact negation of its sale; floor-style half-up would give −74 and a
  refund one rupiah short. This is **contract wording and therefore the
  owner's**. `builder2` proposed: *"Computed fractions round half away from zero
  (0.5 → 1, −0.5 → −1) at the point of becoming a stored or displayed value."*
  Nothing was edited.

### Model limits have now interrupted three agents in one day

Worth knowing before planning around any particular model:

- **Both codex agents** (`architect`, `designer2`) hit a shared **account**
  limit at 15:11, a minute apart, because they were running hard jobs in
  parallel on one account. `architect` had finished and lost only its closing
  report; `designer2` was cut off mid-task.
- **Fable 5.1 hit a monthly spend limit** at ~16:15 and **never processed the
  A7 prompt at all** — zero work, no partial state. `designer` was restarted on
  Opus 5 in the same pane, so the owner's Fable preference is overridden by
  availability, not by choice.

The practical lesson: a long prompt is cheap to re-send, but only if you check
that the agent actually did something. `agent_status: done` means the pane went
idle, not that work happened. `git log` is the check.

### A trap the frontend must not walk into

`formatMoney` renders `15590`, not `Rp 15.590` — grouping and the symbol are
the frontend's. `builder2` checked on this machine that
`Intl.NumberFormat('id-ID', …)` formats a **bigint exactly**, while wrapping it
in `Number(...)` first silently loses precision
(`9.007.199.254.740.993` becomes `…992`). **Any display helper passes the
bigint straight in and never calls `Number()` on money.** That is a `B-1`
violation waiting for a UI agent, and it goes into every frontend task file
from F2 onward — F1 has no money on it.

---

## Sequencing: frontend first, and smaller tasks — owner, 2026-09-14

Two instructions, both worth keeping in front of whoever reads this next.

**1. Frontend first.** The Phase 0 plan is backend-first — ten server tasks,
then the clients — and the lead followed it without ever asking whether that
order suited the owner. It did not. The frontend is built against fixtures,
the owner reviews it, and the backend follows once they say it is good. The
plan is suspended, not discarded: its twelve tasks, paths and tests remain the
specification for the server work when it resumes.

Backend Task 2 (`packages/money`) was allowed to finish rather than be
interrupted, because `B-1` governs money on a screen exactly as it governs
money in a column, and the frontend would otherwise render IDR through a
throwaway helper it would have to unpick later.

**2. Smaller tasks, reviewed between.** One reviewable slice per session. The
owner's reason is concrete and worth quoting rather than paraphrasing: a task
has a high risk of running out of context mid-way, and they would rather review
each piece themselves before the next begins. A task that exhausts its budget
halfway leaves a half-built screen and a handoff nobody can trust.

What that changes when writing a task file: one screen, not a client. Every
handoff names the command and the URL the owner opens. An agent that starts a
second screen has ended its task and says so.

First slice is [FE-001](tasks/FE-001-pos-shell-and-lock-screen.md) — the POS
bundle, the Frost tokens wired in, and the lock screen at 1280×800. Deliberately
the smallest thing that proves the whole chain: build, tokens, touch geometry
at real sizes. If the design system does not survive contact with real code,
one screen is the cheapest place to learn it.

---

## Phase 0 rulings and open engineering questions

Made by the lead on 2026-09-14 from `builder1`'s Task 1 findings. The first
three are applied in [PHASE0-002](tasks/PHASE0-002-money-module.md); the last
two must be settled before Task 3 writes a second database test file.

**Ruled:**

- **vitest goes to 4**, superseding the plan's `^2.1.0`. Five advisories sit in
  the vitest 2 dev-server and UI chain, one critical and one high. None is
  reachable the way this repository runs tests and none ships — but one test
  file exists today and eleven tasks' worth exist later, so the upgrade is
  cheap now and an argument in three weeks.
- **`"engines": { "node": ">=22" }`.** `docs/ARCHITECTURE.md` calls for Node
  LTS; this machine runs 25.2.1, which is not LTS, and everything passes on it.
  The field makes the expectation explicit rather than implied. Revisit at the
  pre-production gate.
- **`B-1` is enforced at the type level and proven by `@ts-expect-error`
  tests** that run under `npm run typecheck`. A rule nothing checks is a rule
  an agent in a hurry will break, and "no `number` for money" is precisely the
  kind of rule that erodes quietly.

**Open, and blocking Task 3:**

- **Parallel test files race on one database.** `builder1` demonstrated this
  rather than predicting it: a second test file with Task 3's `beforeAll` shape
  broke five runs out of five, once as `14 failed | 13 passed`. Both files run
  `DROP SCHEMA public CASCADE`, and vitest runs files in parallel. Candidates
  are `fileParallelism: false` for server tests or a database per worker.
  **Leaning to `fileParallelism: false`** — deterministic, and Phase 0 is too
  small for the complexity of per-worker databases — but it is not written into
  a task file yet, so it is not settled.
- **The pool's default role is a superuser.** `pool.ts` defaults to
  `pos_owner`, which is `POSTGRES_USER` and has `rolsuper = t`. Superusers
  bypass grants, so a `B-7` append-only test that goes through `query()` would
  pass while proving nothing. **Task 3's grant test must connect as `pos_app`.**
  This one is not a preference; a test that cannot fail is worse than no test.

Also fixed in the plan: Task 12 Step 7 said to *replace* the root `scripts`
block, which done literally would have deleted `typecheck` from `verify`. It
now says extend, and `db:up` carries `--wait` so migration does not race the
container's start.

---

## The Frost conversion was reviewed, and it did not come back clean

`design-reviewer` returned **ten findings on 2026-09-14, one critical**, all
recorded with the lead's rulings in
[DESIGN-004](tasks/DESIGN-004-frost-review-remediation.md) and assigned to
`designer`. Two were confirmed by the lead before the task was written:

1. **CRITICAL — the rejected-close state offers a live close on a stale
   balance.** `error` means the close was rejected *because the order changed
   while payment was being collected*, and the screen says so — while rendering
   balance `0`, tagging the draft `FULLY ALLOCATED`, and exposing a live
   **Close order & print receipt**. `B-18` closes an order only on exact
   settlement. **This is in the wireframe as well as in Frost**, and it came in
   through DESIGN-002 pass 1, which set the balance to 0.00 in four states —
   right for three of them, wrong for `error`, the one state where the total
   may have moved.
2. **HIGH — the tender pads are still typed `[SHEET]`** in `SITEMAP.md` and
   `SCREEN-INVENTORY.md`'s `M-4`, while `docs/DESIGN.md` now says persistent
   panel. The owner ruled the panel on 2026-09-10; this file recorded the
   retyping as *in progress* and it was never done. Four days later the design
   system asserted one side of it and the repository began contradicting itself
   in three places. **A ruling recorded in the present progressive is a ruling
   that does not land.**

The remaining eight ranged from a completeness claim stronger than the artifact,
through a `B-16` verdict that was never earned, to a 10px tag that is the only
thing telling a cashier a row is PIN-gated.

**Remediated 2026-09-14, committed as `ca0a4db` on `agent/design-direction`.**
Nine fixed, one raised. The lead verified the two confirmed findings rather
than accepting the report: `error` is out of the live close's `data-when` in
both the wireframe and the Frost fixture, no `[SHEET]`-typed tender pad
survives in any of the three documents, and the derived changed-order figures
reproduce the fixture's own arithmetic under the nett model — tax on the net,
not on the service charge, `184.500 ÷ 11 = 16.773`.

Two things came out of it that outlive the task:

- **The `error` state differed from its three siblings for a reason its own
  copy stated.** DESIGN-002 pass 1 corrected four states to a zero balance
  because they looked alike; three were right. When a fix applies to several
  states at once, the one that does not fit is the one to look at hardest.
- **`designer`'s handoff said it had committed. It had not** — the worktree was
  dirty and the branch unmoved. The lead found it by running `git log`, not by
  reading the sentence. The rule in CLAUDE.md is about tests, and it generalises
  to anything an agent reports as done.

**Still needs a ruling — finding 6.** On a fired order line the trailing slot
is deliberately empty (`I-12`), so a **10px** `MANAGER TO VOID` tag on the round
header is the only visible statement that the row opens the PIN-gated path —
while `docs/DESIGN.md` says nothing a cashier must act on sits below 13px, and
hover cannot rescue anything on a touch screen. No sourced value fixes it:
Frost contains no 13px tag, and moving the statement into the row is a new
composition. `designer` correctly invented nothing. The least-inventing
candidate is the tag at `--frost-text-13`, an existing size in a new place,
which makes it an `A7` item that goes through review rather than a typo to
correct.

**Work happens in a git worktree** at `../restaurant-pos-design` on
`agent/design-direction`, so design fixes and implementation do not fight over
one checkout.

---

## Known conflicts and blockers

**1. Deployment shape — RESOLVED IN THE DOCUMENT, 2026-09-10.**

`docs/PRODUCT.md` limits the MVP to the owner's local development machine.
The old proposal §4 described shared terminal browsers on a LAN hostname, an
appliance, a UPS, and encrypted backups.

The revised proposal §3.1 is now single-host and loopback-only: both bundles
and both API surfaces served by one Fastify process over HTTPS on localhost,
PostgreSQL unreachable from the LAN, and a startup guard that must reject any
non-loopback bind address. §3.2 moves the appliance, managed terminals, LAN
TLS, UPS, and backups into an explicit pre-production gate marked deferred.

PRODUCT.md and the proposal now agree. This clears gate condition 2. It does
**not** clear condition 1 — the owner still has to approve the document.

**2. Architecture approved in fact, `Proposed` on paper — CLEARED 2026-09-14.**

For four days this file was the only evidence the approval had happened, which
is exactly the condition WORKFLOW.md warns about. `architect` converted it on
2026-09-14, verified on disk by the lead:

- **`docs/ARCHITECTURE.md`**, 972 lines, 20 sections, standing on its own — a
  reader never needs the proposal.
- **Seven ADRs in `docs/decisions/`**, each `**Status:** Accepted`, each dated
  2026-09-10: single-host modular monolith with two clients; PostgreSQL as sole
  operational authority; versioned commands and bounded checkout leasing;
  versioned exact nett monetary policy; transactional print outbox with
  uncertain delivery; transactional immutable receipt numbering; transactional
  audit with separate failed-approval evidence.
- **§19's self-approval interpretation recorded** in `ARCHITECTURE.md` as
  settled, not as a recommendation.
- **The proposal retained under a superseded banner** rather than deleted —
  its 997-insertion reconciliation has still never been committed, so deleting
  the file would have destroyed work git has never seen.
- **§19 "Open product dependencies" preserves all five**, and the architect
  added one the lead had not asked for: ruling **I-8**, the back-office
  kitchen-ticket reprint, stated as needing a product decision before Phase 3
  completes rather than being silently resolved by architecture approval. The
  restaurant time zone is item 1 on the same list.

**Gate condition 1 is clear.**

**3. Visual direction — CLEARED 2026-09-14.**

Paper and Frost were both built and reviewed, and the choice sat with the owner
with nothing an agent could do to unblock it. **The owner chose Frost on
2026-09-14**, and `DESIGN-003` started the same day. No longer a blocker.

---

## Immediate next handoff

**`architect` — architecture conversion. DONE 2026-09-14**, verified on disk by
the lead. Details under conflict 2 above. Delegated rather than done by the
lead because the architect wrote the reconciliation and held the reasoning; the
lead owns the gate, not the typing.

**DESIGN-003 — DELIVERED 2026-09-14, verified by the lead.** `designer2`
extracted the token registry and hit the shared codex quota before writing the
document; on the owner's instruction the task moved to `designer`, restarted
fresh on Fable 5.1 rather than waiting out the window, and told to *verify* the
inherited tokens rather than trust an interrupted agent's provenance claims.

On disk: **`docs/DESIGN.md`** (47 KB) and a **169-token registry** at
`docs/design/tokens/frost.tokens.json`, with `frost.css` generated from it.
`designer` verified all 158 inherited source claims by script, renamed one that
named the wrong panel, and added eleven the document needed.

**The lead's own verification, run rather than assumed:**

- **169 / 169 / 169.** Every token in the registry appears in `frost.css`,
  every token named in `docs/DESIGN.md` exists in the registry, and no registry
  token goes unmentioned. Three-way exact, no orphans in either direction.
- **Twelve provenance claims spot-checked at random against the named file and
  line: twelve passed.** Across `visual.css`, `structure.css`, `mockup.js` and
  an inline style in `incidents.html`.
- **`visual-directions/structure.css` is byte-identical to
  `prototype/wireframe.css`** (`diff` empty), which is what makes the claim
  "POS touch targets are the wireframe's" true by construction rather than by
  assertion.
- **No contract document, wireframe, or Paper file was touched today.**

**Known limit, stated by `designer` rather than hidden:** it could not prove
`visual.css` is the file the finish review reviewed, because
`source-fingerprints.json` hashes the six HTML files and the wireframe sheets
but not `visual.css`. Its mtime sits seven minutes after the review's, which is
consistent with the two documented post-review corrections and with nothing
else.

**Lead — commit, then open the gate.** Once both jobs above land: commit the
documentation state on `agent/design-direction` in coherent pieces (docs and
memory, wireframe remediation, visual directions and the design system), then
re-read the gate in [ROADMAP.md](ROADMAP.md). With condition 4 cleared by the
owner on 2026-09-14 and condition 1 cleared by the conversion, **every gate
condition is met and Phase 0 may begin** — subagent-driven, from
[the plan](../docs/superpowers/plans/2026-09-08-phase-0-foundations.md), whose
stale closing paragraph the lead still owes a fix.

**Lead — close DESIGN-002.** Every finding is applied or declined and the task
still reads `Active`. It needs a closing entry, its standing items either
carried into this file or accepted as wireframe slack, and a ruling on whether
the quick-sale line editor is a seventh modal.

**[DESIGN-001](tasks/DESIGN-001-external-visual-direction.md) — delivered by a
different route than the task describes.** The task still reads as though
nothing has been returned. Two directions exist, reviewed, with a stated token
set. The task file needs a handoff entry saying so, and its `Still open` list
is out of date. The acceptance criteria are worth walking against what was
delivered before the task is called done — particularly criterion 8, that
`docs/DESIGN.md` and a token set could be written without inventing values.

Implementation stays blocked until the gate in [ROADMAP.md](ROADMAP.md) is
cleared.

---

## Authoritative documents

| Document | Authority |
|---|---|
| [docs/BOUNDARIES.md](../docs/BOUNDARIES.md) | Inviolable. Overrides every other document including this one |
| [docs/PRODUCT.md](../docs/PRODUCT.md) | Purpose, users, principles, deployment status |
| [docs/PRD.md](../docs/PRD.md) | Requirements `FR-*`, `NFR-*`, and 33 acceptance criteria |
| [docs/ROADMAP.md](../docs/ROADMAP.md) | Full product roadmap, phases, pre-production gate |
| [docs/ARCHITECTURE_PROPOSAL.md](../docs/ARCHITECTURE_PROPOSAL.md) | **Proposed only.** Reconciled 2026-09-10; not binding until approved and converted |
| [docs/design/SITEMAP.md](../docs/design/SITEMAP.md) | Confirmed navigable structure |
| [docs/design/SCREEN-INVENTORY.md](../docs/design/SCREEN-INVENTORY.md) | Confirmed screens, states, and requirement mapping |
| [docs/design/EXTERNAL-HANDOFF.md](../docs/design/EXTERNAL-HANDOFF.md) | The DESIGN-001 package. Written for an external tool, not for agents |
| [docs/design/prototype/](../docs/design/prototype/) | Behavioral wireframe. Greyscale by intent, not a visual proposal. **Behavioral authority** — the visual directions restyle it, they do not overrule it |
| [docs/design/VISUAL-DIRECTION-BRIEF.md](../docs/design/VISUAL-DIRECTION-BRIEF.md) | The contract the visual build ran under |
| [docs/design/visual-directions/](../docs/design/visual-directions/) | **Two proposals, neither approved.** Paper and Frost, six screens each, plus `DESIGN.md` (tokens) and `REVIEW.md` (finish review) |
| [docs/superpowers/plans/2026-09-08-phase-0-foundations.md](../docs/superpowers/plans/2026-09-08-phase-0-foundations.md) | Phase 0 implementation plan, written, not started, closing paragraph stale |
| [docs/superpowers/specs/2026-09-07-restaurant-pos-mvp-design.md](../docs/superpowers/specs/2026-09-07-restaurant-pos-mvp-design.md) | Design rationale. Superseded in part; the four documents above win |
