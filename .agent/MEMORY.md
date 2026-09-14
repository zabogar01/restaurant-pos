# Agent Memory

Central coordination state for this repository. Owned by the Claude product
lead. No other agent writes to this file.

Last updated: 2026-09-14, from repository evidence at commit `c5a2807` plus the
uncommitted working tree and the live Herdr roster.

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

**Read this warning first.** Nothing since `c5a2807` is committed. This file,
`.agent/` entirely, `CLAUDE.md`, `AGENTS.md`, `.gitignore`, the external design
handoff, the PRD closures, the whole architecture revision, three passes of
wireframe remediation, and both visual directions exist only in the working
tree. A fresh clone has none of it.

---

## Current phase

**Pre-implementation.** No application code exists in this repository. There
is no `package.json`, no source tree, and no test suite.

Work completed so far is product definition, a reconciled and owner-approved
architecture proposal, UX structure, a remediated behavioral wireframe, two
proposed light visual directions, and one implementation plan. Two tracks ran
in parallel: visual direction (`DESIGN-001`, `DESIGN-002`) and architecture
approval. Both now wait on the owner rather than on an agent.

Implementation has not started and is gated — see [ROADMAP.md](ROADMAP.md). One
gate condition is open (Phase 0 execution mode) and one is half done (the
architecture is approved but not converted).

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

The last three are recorded in the PRD only in the **uncommitted** working
tree.

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

- **Branch:** `agent/design-direction`
- **Latest commit:** `c5a2807` "Documents and wireframe"
- **Nothing has been committed since.**

```
 M docs/ARCHITECTURE_PROPOSAL.md        architect's full reconciliation
 M docs/PRD.md                          stack, currency, and tax closures
D  docs/design/.DS_Store                staged removal
 M docs/design/SITEMAP.md               DESIGN-002 [INLINE] nodes and verdict
 M docs/design/SCREEN-INVENTORY.md      DESIGN-002 states and rulings I-12, I-13
 M docs/design/prototype/index.html     DESIGN-002 remediation
 M docs/design/prototype/pos/order.html        "
 M docs/design/prototype/pos/settlement.html   "
 M docs/design/prototype/wireframe.css         "
 M docs/design/prototype/wireframe.js          "
?? .agent/                              this file and everything beside it
?? .gitignore
?? AGENTS.md
?? CLAUDE.md
?? .impeccable/                         4.9 MB of tool state and review captures
?? docs/design/EXTERNAL-HANDOFF.md      the DESIGN-001 package, route not taken
?? docs/design/VISUAL-DIRECTION-BRIEF.md  the direction contract
?? docs/design/visual-directions/       Paper and Frost, DESIGN.md, REVIEW.md
```

Repository hygiene, fixed 2026-09-10 and still uncommitted: a `.gitignore` now
exists at the root, and `docs/design/.DS_Store` has been removed from the index
(the file remains on disk, now ignored).

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

Roster verified against `herdr agent list` on 2026-09-14.

| Name | Kind | Pane | State | Role |
|---|---|---|---|---|
| `lead` | claude | `w2:p1` | live | Product lead and coordinator. Sole writer of this file and `.agent/ROADMAP.md`. A fresh session took this pane on 2026-09-14 and named it |
| `architect` | codex | `w2:p2` | live, idle | Delivered the reconciliation 2026-09-10 after 36 minutes. Owns architecture questions |
| `designer` | claude, **Fable 5.1** | `w2:p3` | live, working | Same pane, **new session with no memory of the earlier work** — owner's instruction, 2026-09-14. Holds [DESIGN-003](tasks/DESIGN-003-frost-design-system.md) from where `designer2` stopped. The session that authored the sitemap, screen inventory, prototype and all three DESIGN-002 passes was exited to clear 345k tokens of context |
| `design-reviewer` | codex | `w2:p9` | live, idle | Returned the eight findings that drove DESIGN-002 pass 3, and wrote the visual finish review in `visual-directions/REVIEW.md` |
| `designer2` | codex, gpt-6-astra | `w2:pA` | live, idle, **out of quota** | Started 2026-09-14 and equipped with the Impeccable skill. Delivered the token set, then stopped before `docs/DESIGN.md`. DESIGN-003 was reassigned off it the same day; kept alive because its scrollback is the only record of how the tokens were extracted |

**Both codex agents share one account quota and both exhausted it at 15:11 on
2026-09-14**, mid-task in `designer2`'s case. The window resets at 15:25. This
is worth knowing before parallelising codex agents again: running two hard jobs
concurrently on one account spends the budget twice as fast and stops both at
once. `architect` finished first and lost only its closing report; `designer2`
lost the second half of its task.

`designer` (claude) and `design-reviewer` (codex) are idle and available.
`design-reviewer` wrote the visual finish review and is the natural reviewer for
whatever `designer2` returns — but it draws on the same exhausted quota.

The previous revision of this file recorded `designer` as **gone** and an
unassigned idle Claude at `w2:p8`. Both were wrong by the time anyone read
them: the designer was reinstated and did the bulk of the afternoon's work, and
`w2:p8` no longer exists. `design-reviewer` was never recorded at all.

There is no task file for the architecture work. `B2` was carried out against
the proposal document itself, and the architect's account of it exists only in
its pane scrollback — which is why the material parts of it are copied into
this file. The same is true of the visual direction build: `REVIEW.md` and the
brief are its only durable record, and neither is a task file.

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
