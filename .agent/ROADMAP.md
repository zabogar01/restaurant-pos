# Execution Queue

The immediate queue only. For the complete product roadmap — all six MVP
phases, the pre-production gate, and the three post-MVP horizons — see
[docs/ROADMAP.md](../docs/ROADMAP.md). This file exists to say what happens
next, not what happens eventually.

Owned by the Claude product lead. No other agent writes to this file.

Last updated 2026-09-14, after auditing what actually happened on 2026-09-10.
The previous revision was written at 11:50 that day and missed the afternoon
entirely.

---

## Two tracks run in parallel

Design and architecture are independent right now. Neither blocks the other,
and both block implementation. **Both now wait on the owner, not on an agent.**

### Track A — Design

| # | Item | State | Owner |
|---|---|---|---|
| A1 | Sitemap and screen inventory | Confirmed, committed | `designer` |
| A2 | Behavioral wireframe prototype and its review | **Remediation done, task not closed.** Three passes: owner findings as rulings I-12 and I-13, then void-under-lock, then eight `design-reviewer` findings plus five found by verification. Seven `[INLINE]` nodes added; screen count unchanged. See [DESIGN-002](tasks/DESIGN-002-wireframe-review.md) | `designer`, captured by `lead` |
| A3 | [DESIGN-001](tasks/DESIGN-001-external-visual-direction.md) — visual direction | **Delivered and chosen. FROST, 2026-09-14.** Two light directions were built in-repo from the owner's reference; Paper is rejected and left untouched | Owner |
| A4 | [DESIGN-003](tasks/DESIGN-003-frost-design-system.md) — convert Frost into `docs/DESIGN.md` and a token set | **Done** 2026-09-14. `docs/DESIGN.md` plus a 169-token registry, every token carrying file, line, selector and property. Lead-verified: 169/169/169 three-way, 12 random provenance claims checked, all passed | `designer2` then `designer` |
| A5 | Decide whether a dark palette ships | Not started. Light only was delivered, deliberately | Owner |
| A6 | Review the Frost conversion | **Next.** A4 has landed and is lead-verified for completeness and provenance; it has not been reviewed for design judgement. The codex quota window has reset | `design-reviewer` |
| A7 | Style the three absences Phase 0 hits — pressed/active touch state, field error state, login form controls | Not started. Deliberately absent from Frost; goes to a designer and through review, never invented into `packages/tokens` | `designer` |

A3's deliverable is real and reviewed: open
[docs/design/visual-directions/index.html](../docs/design/visual-directions/index.html)
to see both. The verdict was *ship for visual comparison* — a review of six
screens in each direction, not approval of a design system. The owner chose
Frost from it on 2026-09-14.

**A4 is the conversion, not a redesign.** Every value in `docs/DESIGN.md` must
trace to a built Frost artifact. Nothing else in the repository waits on it —
Phase 0 ships two client shells with a PIN pad and a login form and needs no
palette.

Five agents are live: `designer` (Fable 5.1) working A4, `architect` finished
B4, `designer2` and `design-reviewer` idle on an exhausted codex quota, and
`lead`.

### Track B — Architecture

| # | Item | State | Owner |
|---|---|---|---|
| B1 | Architecture proposal | Written, all seven ADRs `Proposed` | `architect` |
| B2 | Reconcile the proposal with the scope cut, the two-client split, and the review deltas | **Done** 2026-09-10, uncommitted. 997 insertions, 638 deletions. ADRs deliberately left `Proposed` | `architect` |
| B3 | Close PRD open questions on stack, currency, and tax model | **Done** 2026-09-10, uncommitted | `lead` |
| B4 | Owner approval, then conversion into `docs/ARCHITECTURE.md` and accepted ADRs under `docs/decisions/` | **Done** 2026-09-14. `docs/ARCHITECTURE.md` (972 lines, standing alone) and seven `Accepted` ADRs under `docs/decisions/`. Verified by `lead`. Uncommitted | `architect` |

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
   understood.~~ **Done** 2026-09-10, uncommitted. Proposal §3.1 is single-host
   and loopback-only with a startup guard; §3.2 defers the appliance, LAN TLS,
   UPS, and backups to a named pre-production gate. PRODUCT.md and the proposal
   now agree.
3. ~~PRD open questions on stack, currency, and tax model are closed in the
   PRD.~~ **Done** 2026-09-10, uncommitted.
4. ~~The owner has chosen an execution mode for
   [the Phase 0 plan](../docs/superpowers/plans/2026-09-08-phase-0-foundations.md):
   subagent-driven or inline.~~ **Done** 2026-09-14: **subagent-driven.** A
   fresh implementer per task or small group, clean context each, a written
   handoff out of each, and the lead reviewing between tasks.
5. ~~A `.gitignore` exists and `docs/design/.DS_Store` is out of the index.~~
   **Done** 2026-09-10, uncommitted.

Three of the five conditions read "done, uncommitted". They are done on disk
and absent from git history. A clone would fail all three.

**Where the gate stands at the end of 2026-09-14.** Nothing is open. Condition
4 was cleared by the owner the same day. Condition 1's outstanding half — the
conversion — is in flight with `architect`. Conditions 2, 3 and 5 are done on
disk and are being committed as soon as the two in-flight jobs land, on the
owner's instruction to commit once rather than mid-flight.

**So the gate opens when `architect` returns and the commit lands.** Phase 0
then starts subagent-driven. Nothing in it waits on the design track: it ships
two client shells with a PIN pad and a login form, and needs no palette.

**Not gated by visual direction.** Phase 0 ships two client shells with a PIN
pad and a login form. It needs no palette, and rebuilding those two screens
later against a real design system is cheap.

---

## Housekeeping the lead owes

Small, none of it blocking, all of it recorded so it does not get lost.

| Item | Why it is not done yet |
|---|---|
| Commit the documentation state | **Authorised 2026-09-14, deliberately held** until `architect` and `designer2` land, so the tree is committed coherent rather than mid-flight |
| Close [DESIGN-002](tasks/DESIGN-002-wireframe-review.md) | Every finding is applied or declined; the task still reads `Active`. Needs a closing entry and a ruling on whether the quick-sale line editor is a seventh modal |
| Bring [DESIGN-001](tasks/DESIGN-001-external-visual-direction.md) up to date | Its handoff still says nothing has been returned. Two directions exist. The task needs an entry recording what was delivered and by what route |
| ~~Decide what to do with `.impeccable/`~~ | **Done** 2026-09-14: ignored entirely as build residue. `REVIEW.md`'s cited captures will therefore not exist in a clone |
| Fix the Phase 0 plan's closing paragraph | It still calls the tax model open. The architect supplied replacement wording. The plan is not a contract document, so the lead may apply it |
| Propose PRD §9 time-zone wording | The PRD never names a restaurant time zone; receipt and business-day timestamps both need one. Contract document, so the owner approves the wording |
| Settle ruling I-8 | Back-office kitchen-ticket reprint is granted by `FR-E3` and unaudited by `FR-J3`. Drawn as the requirements read. Needs a ruling, not a workaround |

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
