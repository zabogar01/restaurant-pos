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
   - **FE-032 (F4e-3)** — refund: M-5 allocation sheet (O1–O3), reason, M-1 with the money-back
     line, Cancel back to the sheet, REFUNDED in the book, `refund-error`, `day-refusal`, the
     no-response re-read — touches money, audit, boundaries; independent cross-family review —
     depends on FE-031 and DESIGN-010 — **complete 2026-10-01** (`39d6874`, second Codex review clean), after the architect
     consult ARCH-003 and the owner's two rulings; pushed 2026-10-02, waits on the owner's look and merge.
   - **FE-033 (F4e-4)** — floor: `after-close` and `after-close-receipt` driven by the close
     result, the `dayclosed` header naming the open day, the open quick-sale strip, *lines*
     on floor and order panel (DESIGN-009 Part C and D) — independent of FE-031/032 — not written.
   - **Deferred to FR-A:** Release in the POS-02/05/06 headers, and clearing the closed-day
     banner at session end (owner's 2026-09-30 ruling) — the client has no session or idle lock.
7. *(Done 2026-09-30: the light-only note in the DESIGN-003 and DESIGN-005 task files.)*
8. **Code housekeeping (no IDs yet)** — the four P3s in STATE.md; `closeOrder` refusing a non-cash tender above the running balance (B-5, ARCH-003 question 9.6); re-check the POS-03 URL
   after Add; decide Prettier either way — depends on nothing, can ride with F4e as a small
   slice — not written. (The modal move was FE-029, KIT-004's pilot.)
8a. **POS-03 Q6 (no ID yet)** — Cancel while a manager approval is verifying cancels the
   action, with no partial state (`B-20`), and the cancelled approval is audited per `FR-J3` —
   depends on the owner confirming the 2026-09-24 ruling (DECISIONS.md, conversation only) and
   on a design check of the approval prompt's verifying state — not written.

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
