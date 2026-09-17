# Execution Queue

The immediate queue only. For the complete product roadmap — all six MVP
phases, the pre-production gate, and the three post-MVP horizons — see
[docs/ROADMAP.md](../docs/ROADMAP.md). This file exists to say what happens
next, not what happens eventually.

Owned by the Claude product lead. No other agent writes to this file.

Last updated 2026-09-15. That edit closed four rows this file still showed as
in flight — A6, F1, and Phase 0 Task 2 had all landed — and corrected the live
agent count from five to one.

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

**One agent is live as of 2026-09-15: `lead`.** Every other agent was shut down
on 2026-09-14 to free memory, with clean working trees and committed handoffs.
A9 and F2 each need a fresh implementer started into a fresh pane.

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
| ~~Commit the documentation state~~ | **Done** 2026-09-14: six commits on `agent/design-direction`, working tree clean. Not merged to `main` — the owner merges |
| ~~Close [DESIGN-002](tasks/DESIGN-002-wireframe-review.md)~~ | **Done** 2026-09-14. Ruled: the quick-sale line editor is a second *form* of the existing sheet, not a seventh modal — the count stands at 7 / 13 / 6. Four items carried forward as wireframe slack |
| ~~Bring [DESIGN-001](tasks/DESIGN-001-external-visual-direction.md) up to date~~ | **Done** 2026-09-14, closed. Delivered in-repo rather than through an external tool; six of eight acceptance criteria met, two met-with-a-limit |
| ~~Decide what to do with `.impeccable/`~~ | **Done** 2026-09-14: ignored entirely as build residue. `REVIEW.md`'s cited captures will therefore not exist in a clone |
| ~~Fix the Phase 0 plan's stale paragraphs~~ | **Done** 2026-09-14: both tax-model paragraphs corrected, and the token package's invented placeholder palette now points at the Frost registry instead of contradicting it |
| Propose PRD §9 time-zone wording | The PRD never names a restaurant time zone; receipt and business-day timestamps both need one. Contract document, so the owner approves the wording |
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
| F2b | The menu grid: tiles, categories, 86'd tiles disabled in place, quick sale | **Next.** Carries one hard requirement from F2a: **the lock notice**. The artifact puts the route out of a settlement lock in the menu region, so until F2b lands, `lock-draft` and `lock-lease` strand the cashier. Acceptance criterion, not a note | unassigned |
| F2c | The sheets, the approval PIN flow, and the fire-error states | Not started | unassigned |
| F3 | POS settlement — tender panel, prefilled amounts, the rejected-close state DESIGN-004 fixed | Not started. Consumes `--frost-invalid`, which A9 landed unused | unassigned |
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
