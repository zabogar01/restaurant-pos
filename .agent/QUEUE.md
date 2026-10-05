# Queue

Upcoming tasks only, in the order the lead expects to run them, rewritten as the queue
changes. Each line reads `ID — one-line goal — depends on — status`. The lead owns this file.
Where the product is heading in full is [docs/ROADMAP.md](../docs/ROADMAP.md) (the contract);
where the project stands is [STATE.md](STATE.md).

Completed work is not listed here. Every finished slice, from A1 to FE-028 and its commit,
review and test count, is in the
[roadmap archive](journal/2026-09-29-roadmap-archive.md) (frontend queue from L239,
Phase 0 backend from L281). Each task's own file in `tasks/` holds its handoff.

The kit rollout closed on 2026-09-29 (owner accepted the KIT-004 pilot); product tasks may
start. KIT-005 ran first (owner) and was accepted on 2026-09-29.

## Agent kit

1. **Kit Phase 5** (automatic review, designer alongside, profiles) from `AGENT-KIT.md` — done
   task by task as product work needs it, not as its own project — no task written.

## Frontend: what is left of F4

The floor, incidents, close and recovery slices (F4a to F4d) are done. POS-05 and POS-06 now
have Frost artifacts (DESIGN-009, complete and merged); what is left builds them.

5. *(Done: DESIGN-010, the two closed-order tokens and the refund fixture states, `9c5ed19`,
   merged 2026-10-01 as PR #31. Its task file holds the Handoff and review.)*
6. **F4e, sliced by authority** (lead's proposal, approved by the owner 2026-09-30). POS-05 has 11
   states, POS-06 27, the floor two new ones plus the Part D changes. Each slice's file is
   written from what the previous one built.
   - *(Done: FE-030, F4e-1, the POS-05 list, merged 2026-10-01 as PR #33.)*
   - *(Done: FE-031, F4e-2, the POS-06 detail and reprint, merged 2026-10-01 as PR #35.)*
   - *(Done: FE-032, F4e-3, the refund on POS-06, merged 2026-10-02 as PR #37.)*
   - *(Done: FE-033, F4e-4, the floor's after-close states, strip and line counts, merged 2026-10-02 as PR #39.)*
   - **Deferred to FR-A:** Release in the POS-02/05/06 headers, and clearing the closed-day
     banner at session end (owner's 2026-09-30 ruling) — the client has no session or idle lock.
7. *(Done 2026-09-30: the light-only note in the DESIGN-003 and DESIGN-005 task files.)*
8. *(Done: FE-034, code housekeeping — `sendPending` in `fire.ts`, the `unavailable` close
   refusal pinned, the jsdom line gone — merged 2026-10-02 as PR #42. Settled without a builder:
   Prettier (no formatter; AGENTS.md) and the POS-03 URL after Add (by design).)*
8b. **`closeOrder` refuses a non-cash tender above the running balance (no ID yet)** — B-5,
   ARCH-003 question 9.6; unreachable today because the Add gate holds — depends on an architect
   consult (`touches: money`) and the owner's look before merge — not written.
8c. **For the designer (no ID yet)** — the settlement state for a quick sale whose pending line
   is 86'd at Close (today a live-looking Close that does nothing); *Nothing outstanding* drawn
   twice on POS-07; `floor.html:48` and the two strip questions (STATE.md, Live conflicts) —
   depends on the owner's word — not written.
8d. **A reopened book-only order's URL** (`?state=default` names Table 1's fixture) — depends on
   the server's order ids (Phase 1); not worth a fixture-only URL scheme — deferred.
8a. **POS-03 Q6 (no ID yet)** — Cancel while a manager approval is verifying cancels the
   action, with no partial state (`B-20`), and the cancelled approval is audited per `FR-J3` —
   depends on the owner confirming the 2026-09-24 ruling (DECISIONS.md, conversation only) and
   on a design check of the approval prompt's verifying state — not written.

8e. *(Done: FE-035, the discount applies, merged 2026-10-03 as PR #45.)*
8f. **FE-036, the void applies on a live order** — fired-line and whole-order void are
   inert in the same way, and the void sheet reads the fixture's order (`OrderPanel.tsx:334`).
   Owner's word 2026-10-03: go, with the refund's stand-in, and a voided order listed nowhere in
   the POS (DECISIONS.md). FE-036 complete 2026-10-03 at `19210c5`; waits on the owner's look and merge.
8g. **The three line mutations refuse under a lock in the store (no ID yet)** — `addLine`,
   `removeLine`, `setQuantity` rely on the screen not offering them (ARCH-004) — small, can
   ride with 8b — not written.

## Back office

9. **Back-office design** — 13 screens (BO-01 to BO-13). Only the menu and a report detail
   have Frost artifacts (2026-09-14); the other screens render through a variable remap and were
   never reviewed. Needs an audit and a design task first — depends on DESIGN-009 — not written.
   The two Frost back-office artifacts still link to the wireframe 51 times (`menu.html` 40,
   `report-detail.html` 11); that design task re-points them.
10. **Back-office frontend** — built against fixtures, in small slices, before the backend —
    depends on item 9 — not written. Ruling I-8 (reprint audited) is settled and drawn.

## Backend (paused by the owner until the frontend has been reviewed)

11. **PHASE0-003 to PHASE0-012** — schema and grants, PIN, audit, throttling, sessions, HTTPS
    server, auth routes, approval, client shells wiring, acceptance tests, from
    `docs/superpowers/plans/2026-09-08-phase-0-foundations.md` — depends on the owner's review
    of the frontend — **paused**; task files are written one at a time from what the previous
    task built, not all up front.
    Before task 3: brand `Rate` and leave `Money` as `bigint`; settle `fileParallelism: false`
    versus a database per worker; the append-only grant test must connect as `pos_app`, not the
    superuser default (L2685-2694, L2789-2803).
12. **PRD wording proposal** — replace "half-up" in FR-M3 and B-2 with the half-away-from-zero
    sentence (L2699-2701) — depends on the owner (contract text) — waiting.

## Later

13. **Phases 1 to 6** and the **pre-production gate** (appliance, LAN TLS, UPS, backups) —
    each phase needs its own plan before execution; only Phase 0 has one — depends on Phase 0
    finishing — see `docs/ROADMAP.md`.
14. **Open PRD questions** — receipt content and fiscal requirements (before Phase 4),
    post-close corrections (before Phase 5), permitted tax and service-charge range (before
    Phase 2) — depends on the owner — waiting; see `docs/PRD.md` section 9.
