# Execution Queue

The immediate queue only. For the complete product roadmap — all six MVP
phases, the pre-production gate, and the three post-MVP horizons — see
[docs/ROADMAP.md](../docs/ROADMAP.md). This file exists to say what happens
next, not what happens eventually.

Owned by the Claude product lead. No other agent writes to this file.

Last updated 2026-09-23. The owner merged `agent/phase-0-foundations` into
`origin/development` as PR #5 (`59a7f3c`), and the lead wrote
[FE-016](tasks/FE-016-cash-and-card-diverge.md) for F3b. Earlier the same day, a fresh lead session re-verified the branch
(`5189125`, **1255 tests across 22 files**, clean) and corrected three stale
rows: FS and F3a were each still marked *Not committed* — they are `3ad3282` and
`cda4d4e` — and the live roster line stopped at `builder13`. **Next: F3b's task
file**, written from the code.

Previously 2026-09-22, when the owner asked when the frontend would have a
**working flow** rather than a preview, and **nothing in this queue produced
one.** FS — the order store — was inserted **ahead of F3**, written as
[FE-014](tasks/FE-014-order-store.md), built by `builder16` on Sonnet, and
**committed as `3ad3282`. 1216 tests across 20 files**, lead-verified by running
them and by walking the screen. The slice started from `1aeba7b` at 1136.

**The gap that question found is worth naming.** Eleven slices built POS-03
faithfully and every state is a fixture selected by `?state=`; a tile press
navigates rather than adds. F3 and F4 are more screens, Phase 0 tasks 3–12 are
the server, and **the mutable order between them belonged to no row at all.**
Frontend-first bought screens sooner and quietly deferred the spine that makes
them compose.

Previously the same day, when **F2 finished and its independent review closed**
— two P2 findings, both fixed in `2654e5c`. F2d landed as `2ed74aa` and F2h as
`456c37f`.

**Use a review agent on any slice that encodes a rule.** Twice now one has found
what the implementer could not: FE-010's wrong acceptance criterion, and F2h's
*Try again* restoring a removed line. Both times the task file was the defect.

Previously the same day, when F2d landed and **F2
finished**. F2h landed the same day (`456c37f`, 1077 tests) and put four items on
the lead's housekeeping. **The queue is now F3, settlement.** The owner set a
model policy that day too: implementers on Sonnet, review agents on codex, the
lead on Opus.

**Before F3's task file is written**, two things it inherits: four placeholder
route names to reconcile (`?state=settle`, `settle-pending`, `settle-takeover`
from F2b, `?state=incidents` from F2h), and the fact that **this branch's
`docs/design/visual-directions/settlement.html` is pre-remediation** — it still
draws DESIGN-004's critical defect, a live close on a stale balance with a zero
balance. Read the design worktree's copy.

Previously 2026-09-20, when F2k's task file was written and `builder11`
closed. Writing FE-010 from the code rather than from the roadmap line found a
fourth home for the opener defect — the category rail — and corrected how the
discount case had been stated here; both are recorded in MEMORY.md under *F2k,
as written*. A third housekeeping item was added: the menu tile's item sheet is
a design question, not a wiring bug.

Previously 2026-09-18, after F2g landed the approval prompt. Two items were
added to the lead's housekeeping from it: a designer owes what Cancel does while
an approval is verifying (a `B-20` question, not a styling one), and the design
branch owes a review note — both defects implementation has found in reviewed
artifacts were a control shared across states, hiding the one state where it is
wrong.

Previously, after F2c delivered three of its seven states and
correctly refused four. **Slice by authority, not by component** — that is the
lesson four task files have now paid for, and the reason the gated work is
planned as M-1 first, then the two families that depend on it.

Previously, 2026-09-17, after F2b landed. F2 is now five rows, not one: the
POS-03 fixture carries about twenty-six states, and splitting it is the reason
each slice has been reviewable. F2e was added the same day from a ruling, not
from a plan — two slices in a row could not verify a focused press, because
Space does not activate a link.

---

## Two tracks run in parallel

Design and architecture were independent and both blocked implementation.
**Both have now delivered.** What is left on each is review and open product
decisions, neither of which holds up Phase 0.

### Track A — Design

| # | Item | State | Owner |
|---|---|---|---|
| A1 | Sitemap and screen inventory | Confirmed, committed | `designer` |
| A2 | Behavioral wireframe prototype and its review | **Remediation done, task not closed.** Three passes: owner findings as rulings I-12 and I-13, then void-under-lock, then eight `design-reviewer` findings plus five found by verification. Seven `[INLINE]` nodes added; screen count unchanged. See [DESIGN-002](tasks/DESIGN-002-wireframe-review.md) | `designer`, captured by `lead` |
| A3 | [DESIGN-001](tasks/DESIGN-001-external-visual-direction.md) — visual direction | **Delivered and chosen. FROST, 2026-09-14.** Two light directions were built in-repo from the owner's reference; Paper is rejected and left untouched | Owner |
| A4 | [DESIGN-003](tasks/DESIGN-003-frost-design-system.md) — convert Frost into `docs/DESIGN.md` and a token set | **Done** 2026-09-14. `docs/DESIGN.md` plus a 169-token registry, every token carrying file, line, selector and property. Lead-verified: 169/169/169 three-way, 12 random provenance claims checked, all passed | `designer2` then `designer` |
| A5 | Decide whether a dark palette ships | Not started. Light only was delivered, deliberately | Owner |
| A6 | Review the Frost conversion | **Done** 2026-09-14. Ten findings, one critical — a live close offered on a stale balance. Nine fixed, one raised; remediation committed `ca0a4db`. See [DESIGN-004](tasks/DESIGN-004-frost-review-remediation.md). Finding 6 became A7 | `design-reviewer` |
| A7 | [DESIGN-005](tasks/DESIGN-005-a7-three-missing-states.md) — pressed/active touch state, field invalid state, the fired row's gated-path tag | **Done** 2026-09-14, three passes. Four designed tokens, `source: null` plus a `designed` block; reviewed stylesheets untouched | `designer` |
| A8 | Review DESIGN-005 | **Done** 2026-09-14. Eight findings, one high — a press still collapsed into a selection on touch. All fixed or answered | `design-reviewer` |
| A9 | [FE-002](tasks/FE-002-apply-a7-states.md) — apply the three states to `apps/pos` | **Done** 2026-09-16, lead-verified: 120 tests across 9 files, 172 tokens, the three design artifacts byte-identical to the design branch, and the hover detector proven red by the lead's own unscoped rule. Only the pressed ring had a surface; the invalid field and the round tag arrive unused, deliberately, for F3 and F2 | `builder4` |

A3's deliverable is real and reviewed: open
[docs/design/visual-directions/index.html](../docs/design/visual-directions/index.html)
to see both. The verdict was *ship for visual comparison* — a review of six
screens in each direction, not approval of a design system. The owner chose
Frost from it on 2026-09-14.

**A4 is the conversion, not a redesign.** Every value in `docs/DESIGN.md` must
trace to a built Frost artifact. Nothing else in the repository waits on it —
Phase 0 ships two client shells with a PIN pad and a login form and needs no
palette.

**Live as of 2026-09-23: `lead` alone.** Every implementer through `builder17`
is closed, each once its slice was delivered and committed. An implementer's
context is spent on the slice it built, so **every new slice gets a fresh agent
in a fresh pane** — the owner's subagent-driven ruling, not a preference — and
since 2026-09-22 a fresh implementer is a **Sonnet** one.

### Track B — Architecture

| # | Item | State | Owner |
|---|---|---|---|
| B1 | Architecture proposal | Written, all seven ADRs `Proposed` | `architect` |
| B2 | Reconcile the proposal with the scope cut, the two-client split, and the review deltas | **Done** 2026-09-10, committed 2026-09-14 in `10bcb4c`. 997 insertions, 638 deletions | `architect` |
| B3 | Close PRD open questions on stack, currency, and tax model | **Done** 2026-09-10, committed 2026-09-14 in `4c59cdc` | `lead` |
| B4 | Owner approval, then conversion into `docs/ARCHITECTURE.md` and accepted ADRs under `docs/decisions/` | **Done** 2026-09-14. `docs/ARCHITECTURE.md` (972 lines, standing alone) and seven `Accepted` ADRs under `docs/decisions/`. Verified by `lead`. Committed `10bcb4c` | `architect` |

---

## The implementation gate

**No agent writes application code until every condition below is true.** This
is a hard gate, not a checklist to work around. An agent that finds itself
reasoning about why a condition does not really apply should stop and raise it
instead.

1. ~~The owner has explicitly approved
   [docs/ARCHITECTURE_PROPOSAL.md](../docs/ARCHITECTURE_PROPOSAL.md), and it
   has been converted into `docs/ARCHITECTURE.md` with its ADRs moved to
   `docs/decisions/` and marked accepted.~~ **Both halves done.** Approved
   2026-09-10; converted 2026-09-14 by `architect` and verified on disk —
   `docs/ARCHITECTURE.md` stands alone at 972 lines and all seven ADRs in
   `docs/decisions/` read `Accepted`. `docs/ARCHITECTURE.md` is now the
   technical authority; the proposal survives under a superseded banner as the
   record of the reconciliation only.
2. ~~The deployment conflict is resolved in the documents, not merely
   understood.~~ **Done** 2026-09-10, committed `10bcb4c`. Proposal §3.1 is single-host
   and loopback-only with a startup guard; §3.2 defers the appliance, LAN TLS,
   UPS, and backups to a named pre-production gate. PRODUCT.md and the proposal
   now agree.
3. ~~PRD open questions on stack, currency, and tax model are closed in the
   PRD.~~ **Done** 2026-09-10, committed `4c59cdc`.
4. ~~The owner has chosen an execution mode for
   [the Phase 0 plan](../docs/superpowers/plans/2026-09-08-phase-0-foundations.md):
   subagent-driven or inline.~~ **Done** 2026-09-14: **subagent-driven.** A
   fresh implementer per task or small group, clean context each, a written
   handoff out of each, and the lead reviewing between tasks.
5. ~~A `.gitignore` exists and `docs/design/.DS_Store` is out of the index.~~
   **Done** 2026-09-10, committed `e6120f0`.

## THE GATE IS OPEN — 2026-09-14

All five conditions are met and all five are in git history, so a fresh clone
meets them too. **Phase 0 may begin**, subagent-driven.

What that does not mean: the gate opening does not approve anything still
listed as open. The restaurant time zone, receipt content, the permitted rate
range, post-close corrections, ruling I-8, the dark palette, and the three
visual states Frost does not cover are all still open, and each has a phase it
must be settled before. An implementer that needs one of them stops and raises
it.

**Not gated by visual direction.** Phase 0 ships two client shells with a PIN
pad and a login form. It needs no palette, and rebuilding those two screens
later against a real design system is cheap.

---

## Housekeeping the lead owes

Small, none of it blocking, all of it recorded so it does not get lost.

| Item | Why it is not done yet |
|---|---|
| **Rule what an emptied order draws** | Found building FS, by the lead opening the screen. The `empty` fixture states `{ subtotal: 0n, total: 0n }` — **two rows, no service charge and no tax** — and `OrderPanel` renders both rows conditionally precisely so it can. `zero`, the 100% comp, is reviewed **with** both rows at zero. Before FS, `empty` was a static picture nobody could reach; **now a cashier can remove their way into it**, so which of those two shapes an emptied order draws is a live question rather than a fixture detail. FS encodes the distinction as *lines, not money* — an order with no lines states no charges; an order discounted to nothing still states its service line — because that is what both reviewed fixtures already show. A designer's, then review |
| **Rule how a line's quantity is ever committed** | Found building FS, and it is the largest artifact gap found so far. **The line editor draws a quantity stepper that can never commit.** `LineSheetFixture` carries `back` and `remove` and no save target; `LineSheet` holds the stepper in local `useState` and says so in its own comment; and the reviewed artifact (`order.html:449-476`) gives both `sheet-line` and `quick-line` exactly two controls, `Back` and `Remove line`. So **`FR-D5` and `FR-M5` have no reachable path in the reviewed design at all** — the sheet the requirements point at for quantity is, as drawn, a removal sheet with an inert stepper. FS lands a tested `setQuantity` on the store with no caller (A9's precedent) rather than inventing a Save button. A designer's, then review |
| Send the design branch F2h's three findings | (1) *Send to kitchen* is live in `eightysix` and `sheet-item86`, which hold a PENDING 86'd line — `B-17` forbids firing it. (2) `fireerror`'s round header says `printed` under a banner saying the ticket did not. (3) **The refusal names a line the cashier cannot see**: at 1280×800 the notice is visible and the row it names is scrolled out of the lines area, with the `×` that resolves it on that invisible row. The third is a composition problem, not a wrong string, and it is the one the artifact cannot fix by editing copy |
| Rule what `UNKNOWN` kitchen delivery says | Held out of F2h. `FR-E3` gives `UNKNOWN` equal standing to `FAILED`, and `AC-23`/`AC-33` turn on kitchen-versus-receipt urgency rather than on which kitchen outcome it is. The artifact draws `FAILED` only, and the banner's *"the kitchen has not seen this work"* is exactly the sentence `UNKNOWN` cannot say. A designer's, then review |
| Rule what firing shows on POS-03 | Held out of F2h, and the reason is the same shape as the menu tile's. A fire result needs a new fired round, its **time**, and a delivery outcome; the artifact draws no such composition and this app has no clock, so minting one invents data. *Send to kitchen* therefore does nothing visibly today, on FE-001's PIN precedent. A designer's |
| Rule whether an unavailable action can be focused | Found building F2h. `aria-describedby` from a `<span aria-disabled="true">` to the reason is reachable in a screen reader's browse mode but **not by Tab**, because the span is not focusable. Nothing is silent — the notice is `role="status"` — but a cashier tabbing the close bar never hears why. This is a question about **every** `action--off` on the screen, not about the fire control |
| Decide on Prettier, either way | `npx prettier --write` on one hand-formatted source file rewrote 541 lines to its defaults, because the repository has no config and does not depend on it. `builder13` restored and re-applied its work, and said so — **nothing in the diff would have shown it.** Either add a config or record that nobody runs Prettier here; today the two are indistinguishable until someone does it again |
| Rule what a category press does before there is a second catalogue | Found building F2k. The rail's selection was made to follow the press, and a rail reading *Drinks* above a *Mains* grid tells the cashier something false. Reverted 2026-09-21: the rail stays on Mains and the URL stops carrying `category=`. The press still keeps the order on screen, which was the real bug. A designer's, then review |
| Rule a Comp's application history on the change sheet | Found building F2k. The artifact attaches *"Applied by Ana R. at 19:44"* to **Staff meal** only. Deriving that note from the discount's `source` extended it to a Comp nobody applied, and was rejected — the sheet now draws no note there, explicit rather than invented, following A7's `source: null` precedent. What a Comp's change sheet should say is a composition the artifact never draws. A designer's, then review |
| Rule the menu tile's item sheet | Held out of F2k. Every tile opens Burger's sheet because the artifact configures Burger only, so eleven of twelve items have no reviewed option set. Lead's proposal, in [FE-010](tasks/FE-010-opener-fix.md): the tile carries the item's **identity** (name and price, which `MENU_ITEMS` already holds) and option groups render only where a reviewed set exists. That is one new composition — a designer's, then review |
| ~~Commit the documentation state~~ | **Done** 2026-09-14: six commits on `agent/design-direction`, working tree clean. Not merged to `main` — the owner merges |
| ~~Close [DESIGN-002](tasks/DESIGN-002-wireframe-review.md)~~ | **Done** 2026-09-14. Ruled: the quick-sale line editor is a second *form* of the existing sheet, not a seventh modal — the count stands at 7 / 13 / 6. Four items carried forward as wireframe slack |
| ~~Bring [DESIGN-001](tasks/DESIGN-001-external-visual-direction.md) up to date~~ | **Done** 2026-09-14, closed. Delivered in-repo rather than through an external tool; six of eight acceptance criteria met, two met-with-a-limit |
| ~~Decide what to do with `.impeccable/`~~ | **Done** 2026-09-14: ignored entirely as build residue. `REVIEW.md`'s cited captures will therefore not exist in a clone |
| ~~Fix the Phase 0 plan's stale paragraphs~~ | **Done** 2026-09-14: both tax-model paragraphs corrected, and the token package's invented placeholder palette now points at the Frost registry instead of contradicting it |
| Propose PRD §9 time-zone wording | The PRD never names a restaurant time zone; receipt and business-day timestamps both need one. Contract document, so the owner approves the wording |
| Rule what Cancel does while an approval is verifying | Found by building F2g. If Cancel stays live during verification, *"Cancelling changes nothing on the order"* may be false — the server can approve and execute after it is pressed. `B-20` territory. A designer's, then review |
| Send the design branch a review heuristic | Both artifact defects implementation has found — DESIGN-004's live close on a stale balance, F2g's live confirm during lockout — were **one control shared across states**. That is where to look |
| **Collapse `OrderScreen`'s two stores into one path** | F3a lifted the store above both screens but left `OrderScreen` building its own `useOrderStore` behind `suppliedStore ?? localStore`, so every URL-driven mutation had two listeners and only the discarded one heard it. `builder19` found it; F3c patches it narrowly (`onLocationChange` on every navigate). The two paths remain. Take it up with the F3a–F3d review |
| **Send the design branch: the keypad is clipped in `cardover` and `ceiling`** | Found by the lead's browser walk of F3b. The rejection notice pushes the keypad down, and at 1280×800 the `0` / `←` row sits under the close bar: 47px hidden in `cardover`, 30px in `ceiling`. **The reviewed artifact clips worse.** These are the states where the cashier must delete digits. Re-tapping the method chip re-prefills, so a way out exists. A designer's, then review |
| **POS-03's URL names `eightysix` after *Add to order*** | Seen during the F3b walk. The store and totals are right; the URL names a fixture the cashier did not build. This is FE-016 rule 7's defect class on POS-03. Probably from FS; not traced yet |
| **Compose the single-tender-cap rejection** | Raised by `builder18`. When a balance above 90,000,000 makes the 99,999,999 cap bind rather than the change limit, only *Cash maximum {max}* is drawn, because the existing notice and caption both say the limit is about change. A designer's |
| Settle ruling I-8 | Back-office kitchen-ticket reprint is granted by `FR-E3` and unaudited by `FR-J3`. Drawn as the requirements read. Needs a ruling, not a workaround |

---

## Sequencing changed 2026-09-14 — frontend first

**Owner's instruction.** The Phase 0 plan is written backend-first: ten server
tasks, then the two client shells. That order is **suspended**. The frontend is
built first, against fixtures, styled from Frost; the owner reviews it; the
backend follows once they say it is good.

The plan is not discarded — its twelve tasks, their file paths and their tests
stay the specification for the server work when it resumes. What changed is
when they run.

**And tasks get smaller.** One reviewable slice per session, with the owner
reviewing between them. The reason is concrete: a task that exhausts its
context halfway leaves a half-built screen and a handoff nobody can trust.
A task that feels like it needs two sessions is two tasks.

| Rule | What it means when writing the next task file |
|---|---|
| One screen, or one slice of one screen | Not "the POS client" |
| Reviewable by a person in a browser | The handoff names the command and the URL |
| Stop at the edge | An agent that starts a second screen has ended its task and should say so |

## Frontend queue

| # | Task | State | Owner |
|---|---|---|---|
| F1 | [FE-001](tasks/FE-001-pos-shell-and-lock-screen.md) — POS bundle, Frost tokens wired, lock/PIN screen at 1280×800 | **Done** 2026-09-14, lead-verified: 114 tests across 8 files, typecheck clean, opened in a browser | `builder3` |
| F1 review | Owner opened FE-001 and approved it, 2026-09-14 | **Done.** "Screen's fine" | Owner |
| F2 | POS order workspace | **Split into three** 2026-09-16. The Frost fixture is 664 lines and carries about 26 states; FE-001 was one screen with 8 states and produced 114 tests. F2 as one task was three sessions pretending to be one | — |
| F2a | [FE-003](tasks/FE-003-order-panel.md) — the running order panel: fire-round groups, the three line signatures, money, totals, both settlement locks. Six states | **Done** 2026-09-17, lead-verified: 213 tests across 12 files, up from 120, and all three new guards proven red by the lead injecting the defect each catches. Committed `89a100e` | `builder5` |
| F2b | [FE-004](tasks/FE-004-menu-region.md) — the menu region | **Done** 2026-09-17, lead-verified: 273 tests across 13 files, and criterion 1 proven by deleting the route out and watching four tests fail, two of them whole-screen checks spanning F2a's panel. Committed `eca409c` | `builder6` |
| F2c | [FE-005](tasks/FE-005-ungated-sheets.md) — item config, item-86'd-mid-choice, the line editor | **Done 2026-09-18 for three of seven states**, lead-verified: 356 tests across 14 files, and criterion 1 proven by pointing a sheet control at a gated state. Committed `5edd874`. **Four states were correctly refused** — the task file put the discount sheets on the ungated side and the inventory says two of the three are gated | `builder7` |
| F2g | [FE-006](tasks/FE-006-approval-prompt.md) — M-1, the approval prompt, four states | **Done** 2026-09-18, lead-verified: 472 tests across 15 files, and `B-12` proven by leaking one digit into one dot attribute and failing all thirteen PIN tests. One guarantee covers both pads. Committed `6180c56`. **Found the artifact drawing a live confirm key during the approval lockout** and refused it | `builder8` |
| F2i | [FE-007](tasks/FE-007-discount-family.md) — the discount family, five states | **Done** 2026-09-18, lead-verified: 624 tests, and the `FR-F8` gate proven by ungating one transition. Committed `0b66d36` | `builder9` |
| F2j | [FE-008](tasks/FE-008-void-family.md) — the void family, three states | **Done** 2026-09-18, lead-verified: 753 tests, and the audit distinction proven by collapsing it. Committed `affd42a`. **Found the panel offering to void the wrong line** | `builder10` |
| F2h | [FE-011](tasks/FE-011-fire-and-rejection-states.md) — `error`, `fireerror`, `fireblocked`, the 86'd line in the order panel, the panel's loading skeleton | **Done 2026-09-22**, lead-verified at 1077 tests across 18 files and walked in a browser; committed `456c37f`. The refusal is a rule in `fire.ts`, not a per-state flag, so it **resolves** — proven by removing the offending line (19 tests fail if the rule reads a flag instead). **The artifact lets a cashier fire an 86'd item** from `eightysix` and `sheet-item86`, which `B-17` forbids, so `eightysix` and `fireblocked` now render identically — the finding, raised by the implementer rather than scoped away. **The lead found a second one by opening the screen:** a fully fired order still offered *Send to kitchen*, under a banner saying the ticket did not print. Ruling it inert retired an acceptance criterion's visible half, so `fireblocked-overflow` was added to buy it back — the same argument as F2k's `other-discount` | `builder13` |
| F2d | [FE-012](tasks/FE-012-quick-sale.md) — quick-sale / counter mode | **Done 2026-09-22**, lead-verified at 1127 tests across 19 files; committed `2ed74aa`. The order gains a **type** (`table` / `quick_sale`, `FR-D2`, PRD §2) and four affordances read it: the count, the group heading, the line editor's form and the close bar. **No fire control at all** on a counter sale — absent, not inert, because `C-1` reserves inert for a condition that passes and a quick sale can never fire. That is the opposite ruling to F2h's on the same control, and `fire.ts` came through untouched. Proven by handing a table fixture the quick type and vice versa. The lead's one correction: the tests classified by state **name** where production reads the **type** | `builder14` |
| F2e | [FE-009](tasks/FE-009-corrections.md) — four corrections to committed work | **Done** 2026-09-18, lead-verified: 853 tests, no test deleted or loosened. Reintroducing the wrong-line defect fails 12 tests; `B-12` came through **stronger** (22 failures, up from 13); the `I-12` guard was widened to recognise a button and still catches a nested slot. Committed `6b183b1` | `builder11` |
| F2k | [FE-010](tasks/FE-010-opener-fix.md) — **finish the opener fix.** The discount family and the line editor open over the *current* order and line; the category keeps the order on screen and the rail follows it; inline changes replace rather than push (SITEMAP `[INLINE]`: not back-stackable). **The discount case feeds a gate:** the picker's applied discount is a fixture's, which is what `needsManager` reads for `FR-F8` | **Done 2026-09-21**, lead-verified at 897 tests across 17 files and **independently reviewed** ([review](reviews/FE-010-review.md)) — three findings, all corrected; the gate proven by pointing the picker back at the fixture (7 failures), the fire-history rule by restoring the push (3), and the rejected Comp note by re-adding it (2). **The worst finding was the lead's own acceptance criterion**, and it is the first one an implementer could not have caught, because it followed the task file faithfully. Two things the task file adds that the roadmap line did not have — **the category's opener hardcodes `?state=default`** (a fourth home nobody had counted), and **no order fixture carries a `DiscountSnapshot` at all**, so the gate's fact is not on the order. **The menu tile is held**, not built: eleven of twelve items have no reviewed option set, which makes it an `A7`-shaped design gap rather than a wiring bug | `builder12` |
| FS | [FE-014](tasks/FE-014-order-store.md) — **the order store, the flow spine.** One mutable order behind POS-03: add a line from a tile, change its quantity, remove it, and watch the total move. Seeded from `ORDER_FIXTURES[state]`, so an unmutated store **is** the fixture and all 1136 tests must pass untouched — that safety property is the whole review. The seam already existed (`shownOrder`, `voidFixtures.ts:120`) and so did the arithmetic (`orderTotals`, `discount.ts:108`), so the slice invents no money rule. **Fire, discount mutation, void, settle and persistence are all held**, each for a stated reason: a fired round needs a time and a delivery outcome the artifact never draws. **Done 2026-09-22**, lead-verified at **1216 tests across 20 files** and **walked in a browser** — add a Burger on `quick` and 165.000 becomes 300.000; void the 86'd Coffee on `fireblocked-overflow` and *Send to kitchen* comes back live while two lines stay pending. **The implementer caught two task-file errors before writing a line** (the seam, and a save control that does not exist), and **the lead found a third defect by opening the screen**: `?state=empty` drew four totals rows where the fixture defines two, a consequence of the lead's own optional-prop ruling creating two render paths. Fixed by a 64-case parity sweep pinning the store to `shownOrder`, which also proved **every hand-figured `totalsWithout` in the repository agrees with `orderTotals`**. Committed `3ad3282` | `builder16` |
| F3 | POS settlement | **Split into four 2026-09-22**, on the same evidence F2 was: the artifact is 352 lines carrying **21 distinct states**, against POS-01's 8 (one slice) and POS-03's ~26 (eleven slices). SCREEN-INVENTORY lists seventeen behaviours plus a walkable tender walk. F3 as one task is three or four sessions pretending to be one | — |
| F3a | [FE-015](tasks/FE-015-settlement-shell.md) — **the screen exists**: the balance, the draft, an exact close. `empty`, `pressed`, `partial`, `exact`, `overflow`. Ruling **I-13**'s prefill with no split mode, and `FR-G5`/`B-18`'s exact-only close. **Consumes `--frost-invalid`**, which A9 landed unused. Two things the roadmap line never had: **POS-04 is a `[SCREEN]` and `main.tsx:10` picks the screen once at module load**, while Settle navigates by same-document `pushState` — so nothing re-evaluates it; and **the order lives in `useState` inside `OrderScreen`**, so leaving POS-03 destroys it. The slice's real work is lifting the store above both screens and routing client-side. The three `?state=settle*` placeholders are reconciled here; `?state=incidents` stays F4's | **Done 2026-09-22**, lead-verified at **1255 tests across 22 files** and walked in a browser: add a Burger on `quick`, press Settle, and POS-04 draws **315.000** — the order the cashier built, not the artifact's 155.925. Key 100.000 and the balance drops to 215.000 with the field re-prefilled and the total unmoved (`B-6`); add the remainder and Close goes live at exactly zero (`FR-G5`, `B-18`); Back returns to the order still mutated. `tender.ts` is the pure module F3b extends. **Committed `cda4d4e`.** Two things for the next slices: `OrderScreen` now takes an optional `store` prop — the same two-path shape that produced FE-014's `empty` divergence, and nothing pins the paths together yet; and the lead nearly filed a routing regression that was only failing synthetic clicks | `builder17` |
| F3b | [FE-016](tasks/FE-016-cash-and-card-diverge.md) — the two pads diverge: cash may exceed the balance, card may not (`FR-G3`, `FR-G4`, `B-5`, `FR-M5`). `card`, `cardsplit`, `cashover`, `cardover`, `ceiling`, `change`, `exactcash`, `exactsplit`. Extends F3a's `tender.ts` rather than any component. Written from the code, which added four things the roadmap line did not have: **`SettlementScreen.tsx:50`'s balance goes negative on a cash over-tender** and would refuse Close at −44.075; **cash shows the card caption today**, which SCREEN-INVENTORY makes a requirement to fix; **the URL rewrite after Add seeds a Card draft after a cash Add**, so it stops naming a state; and **two F3a tests encode the placeholder rule**, so they are the only tests allowed to change. The cash maximum is `min(balance + 9,999,999, 99,999,999)`, and the case where the single-tender cap binds has no drawn copy, so the implementer enforces it and raises the missing copy | **Done 2026-09-23.** Lead-verified at **1287 tests across 22 files** and walked in a browser: 400.000 cash against 315.000 gives change 85.000, balance 0, and Close live. **Not committed.** Two corrections went back: **the lead's formula had no zero case**, so cash could be added at zero balance and push change past `FR-M5`'s limit; and AC-10's method list was hand-kept. **No review after this slice.** By the owner's ruling, one review covers F3a–F3d once F3d is done | `builder18` |
| F3c | [FE-017](tasks/FE-017-close-outcomes.md), close outcomes: `loading`, `error`, `zero`, `pending`. Written from the code, which found **a live `FR-G10` breach**: POS-03's plain `/pos/order` carries a pending Steak (382.725), Settle is ungated, and paying in full turns Close live. **`pending` and `zero` are live rules** read from the store; **`loading` and `error` are fixture-only**, because no server exists to be in flight or to reject. The artifact's `pending` draws 155.925, the total *without* the Steak it names, so the implementation derives 382.725 and the divergence goes to the design branch. There are three lead rulings, on pending meeting zero, on the inert Close's label, and on when `error`'s notice clears, each for a designer | **Done 2026-09-23.** Lead-verified at **1306 tests across 22 files** and walked in a browser. The pending Steak refuses the close at zero balance; removing it on POS-03 unblocks it; zero closes; `error` derives 37.800. **Also fixed an F3a regression:** POS-03's row `×` never reached the lifted store, so a removed line was still billed. It is pinned by a test through `PosRoutes`. No review until after F3d | `builder19` |
| F3d | [FE-018](tasks/FE-018-payment-session.md): the payment becomes a session. `reauth`, `leaselost`, `takeover`, `cancel`. **Its centre is F3c's finding:** drafts die on the trip back to POS-03, contradicting `FR-G9`, the artifact's `← Order` → `lock-draft`, and F2a's own lock copy (*"until you finish or cancel it"*). So the session is lifted into `PosRoutes`, POS-03's own-tab lock is derived from it rather than from `?state=`, the tab guard refuses `?gone=` too, and **Cancel payment is live and ungated** (I-5). `reauth`, `leaselost` and `takeover` stay fixture-only, because there is no server. **Three lead rulings:** the Cancel count sentence is omitted at zero drafts; *Leave payment* keeps the draft, although the artifact's href contradicts its own caption; and *take over* is inert, because the artifact draws manager PIN dots with no keypad. **Criterion 12 pins the two-path trap this time rather than warning about it** | **Done 2026-09-23.** Lead-verified at **1327 tests across 22 files** and walked in a browser. Drafts survive the trip to POS-03, which locks itself; Cancel releases the order; the `?gone=` guard holds; takeover is reachable from `lock-lease`. One lead correction: a removal refused under the lock was remembered as applied, so the later genuine removal was ignored and the Steak was still billed | `builder20` |
| F3 review | **Done 2026-09-23**, [report](reviews/F3-settlement-review.md). Request changes, 3 P2 + 1 P3; the money rules cleared. | codex `gpt-6-sol` |
| F3e | [FE-019](tasks/FE-019-f3-review-corrections.md): the review's corrections. **One owner per piece of state** (the popstate staleness and the two-path shape behind three defects), PIN-seed placeholders, the rejection notice lost on a partial correction (**the lead's error: two rulings collided**), and the floor copy removed | **In progress** since 2026-09-23 | `builder21` |
| F4 | The remaining POS screens, then the back office | Not started | unassigned |

F1 is deliberately the smallest thing that proves the chain end to end: Vite
build, token import, touch geometry at real sizes. If the design system does
not survive contact with real code, that is cheaper to learn on one screen.

## Phase 0 backend, paused after Task 2

Branch **`agent/phase-0-foundations`**, cut 2026-09-14 from
`agent/design-direction` at `92359a2`.

| # | Task | State | Owner |
|---|---|---|---|
| 1 | Monorepo scaffold, PostgreSQL, migration runner — [PHASE0-001](tasks/PHASE0-001-monorepo-postgres-migrations.md) | **Done** 2026-09-14, lead-verified. 7 tests, typecheck clean | `builder1` |
| 2 | Money module — [PHASE0-002](tasks/PHASE0-002-money-module.md) | **Done** 2026-09-14, lead-verified: 81 tests across 5 files, typecheck clean. One ruling owed before Task 3 — brand `Rate`, leave `Money` as `bigint` — not yet applied | `builder2` |
| 3–12 | Schema and grants, PIN, audit, throttling, sessions, HTTPS server, auth routes, approval, client shells, acceptance tests | **Paused** until the owner has reviewed the frontend | unassigned |

Task files are written by the lead one at a time rather than all twelve up
front: each task's constraints depend on what the previous one actually built,
and a task file written against an imagined scaffold is worse than none.

---

## After the gate

Phase 0 executes from its plan, **subagent-driven** by the owner's 2026-09-14
ruling: twelve TDD tasks covering money primitives, PIN identity, throttling,
audience-scoped sessions, append-only audit, the HTTPS-on-localhost server, and
the two client shells. Its own definition of done is in the plan.

Subagent-driven means each task or small group goes to a fresh implementer with
a clean context; each returns a written handoff; the lead reviews between tasks
and does not implement. An implementer writes only its own task handoff — never
this file or MEMORY.md.

Before the first task starts, the plan's closing paragraph needs its fix: it
still calls the tax model open, and it was settled on 2026-09-10.

Phases 1 through 6 each need their own plan written before execution. Only
Phase 0 has one.
