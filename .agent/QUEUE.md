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
8f. *(Done: FE-036, the void applies on a live order, merged 2026-10-05 as PR #48.)*
8g. **The three line mutations refuse under a lock in the store (no ID yet)** — `addLine`,
   `removeLine`, `setQuantity` rely on the screen not offering them (ARCH-004) — small, can
   ride with 8b — not written.

## Back office

9. **Back-office design** — 13 screens (BO-01 to BO-13). *(Done: DESIGN-011, the audit,
   2026-10-05, `.agent/reviews/DESIGN-011-back-office-audit.md`.)* Nine slices, each a designer
   task re-pointing the wireframe links whose Frost destinations it creates:
   - *(Done: A, DESIGN-012, the shell, alerts, M-6 and shared patterns, merged 2026-10-06 as PR #55.)*
   - **B (BO-01, 02)** carries DESIGN-012's three low findings N1-N3 as its first items — waits on Q2, Q4.
   - *(Done: C, DESIGN-013, BO-13 print incidents, merged 2026-10-06 as PR #57.)*
     The BO-13 frontend task must carry its re-review rules N1 and N2 (task file, end).
   - *(Done: I, DESIGN-014, BO-12 audit viewer, merged 2026-10-08 as PR #67.)* The BO-12 frontend
     task must carry its rule C1 and density rule (task file, last lead ruling).
   - **Ready now:** B (BO-01, 02; also BO-01 and SITEMAP `:248` still
     name a PIN at the back office) · D (BO-03, 04) · E (BO-05, 06) · F (BO-07, 08; Q5 ruled out of
     scope by the lead) · G (BO-09) · H (BO-10, 11).
10. **Back-office frontend** — built against fixtures, in small slices, before the backend —
    depends on item 9 — not written. Ruling I-8 (reprint audited) is settled and drawn.

## Backend (resumed by the owner 2026-10-05)

11. **PHASE0-003 to PHASE0-012** — schema and grants, PIN, audit, throttling, sessions, HTTPS
    server, auth routes, approval, client shells wiring, acceptance tests, from
    `docs/superpowers/plans/2026-09-08-phase-0-foundations.md` — the owner's go 2026-10-05 —
    task files are written one at a time from what the previous task built, not all up front.
    The plan's SQL and code are **superseded wherever ARCH-006 differs**
    (`.agent/reviews/ARCH-006-phase0-core-schema.md`).
    - *(Done: PHASE0-003a, brand `Rate`, merged 2026-10-05 as PR #50.)*
    - *(Done: PHASE0-003b, serial server tests on `pos_test`, `pos_app`, merged 2026-10-06 as PR #51.)*
    - *(Done: PHASE0-003c, the six tables and 21 schema tests, merged 2026-10-06 as PR #53.)*
    - *(Done: PHASE0-004, PIN hashing and lookup, merged 2026-10-06 as PR #56.)*
    - *(Done: PHASE0-005, audit and security-event writers, merged 2026-10-07 as PR #59.)*
    - *(Done: PHASE0-006, throttled PIN verification, merged 2026-10-07 as PR #61.)*
    - *(Done: PHASE0-006b, PIN unique among active staff, merged 2026-10-07 as PR #63.)*
    - *(Done: PHASE0-007, sessions, merged 2026-10-07 as PR #64.)*
    - *(Done: ARCH-009, ADR-009 accepted 2026-10-08, merged as PR #66.)*
    - *(Done: ARCH-010, the Task 8 consult, 2026-10-08, merged with PR #73.)*
    - *(Done: PHASE0-008a, the HTTPS process, merged 2026-10-08 as PR #71.)*
    - *(Done: PHASE0-008b, Host and origin guard and `rpos_cid`, merged 2026-10-09 as PR #74.)*
    - *(Done: ARCH-011, ADR-010 accepted 2026-10-08, merged as PR #72.)*
    - *(Done: ARCH-012, the Task 9 consult, 2026-10-09, merged with PR #76.)*
    - *(Done: PHASE0-007b, the back-office credential, merged 2026-10-08 as PR #69.)*
    - *(Done: PHASE0-009a, route declarations, the session guard and six session routes, merged 2026-10-09 as PR #78.)*
    - *(Done: PHASE0-009b, the credential routes, merged 2026-10-12 as PR #80.)*
    - *(Done: ARCH-013, the Task 10 consult, 2026-10-12: split into 010a and 010b.)*
    - *(Done: PHASE0-010a, the approval primitive and `0008`, merged 2026-10-12 as PR #82.)*
    - *(Done: PHASE0-010b, the approval HTTP adapter, merged 2026-10-12 as PR #84.)*
    - *(Done: ARCH-014, the Task 11 consult, 2026-10-13: split into 011a to 011d.)*
    - *(Done: PHASE0-011a, serve the bundles, merged 2026-10-13 as PR #87.)*
    - *(Done: PHASE0-011b, the session clock and route table, merged 2026-10-13 as PR #88.)*
    - *(Done: DESIGN-015, sign-in copy and states, merged 2026-10-14 as PR #89.)*
    - *(Done: PHASE0-011c1, the transport core `@pos/api-client`, merged 2026-10-14 as PR #91.)*
    - *(Done: PHASE0-011c2, the POS signs in, merged 2026-10-15 as PR #92.)*
    - *(Done: PHASE0-011d1, the back office signs in, merged 2026-10-15 as PR #95.)*
    - *(Done: PHASE0-011d2, M-6 over the working area, merged 2026-10-16 as PR #97.)*
    - *(Done: ARCH-015, the Task 12 consult, 2026-10-16: split into 012a and 012b.)*
    - *(Done: PHASE0-012a, the browser harness and its premises, merged 2026-10-17 as PR #99.)*
    - *(Done: PHASE0-012b, the browser acceptance tests, merged 2026-10-19 as PR #104.)*
    - *(Done: ARCH-016, ADR-011 accepted 2026-10-19, merged as PR #102.)*
    - **PHASE0-013, root 404s answer `Cache-Control: no-store`** (ADR-011 rule 12) — complete 2026-10-19, PR #106,
      waits for the owner's merge. Then the Phase 0 gate.
    - **The queued POS gap:** POS-03's actor group and Release (`order.html:77`), left out of 011c2 — not written.
    - **ADR-008** (database roles and structural immutability), recommended by ARCH-006 — deferred
      by the owner 2026-10-06, possibly to after the MVP — not written.
12. **PRD wording proposal** — replace "half-up" in FR-M3 and B-2 with the half-away-from-zero
    sentence (L2699-2701) — depends on the owner (contract text) — waiting.

## Later

13. **Phases 1 to 6** and the **pre-production gate** (appliance, LAN TLS, UPS, backups) —
    each phase needs its own plan before execution; only Phase 0 has one — depends on Phase 0
    finishing — see `docs/ROADMAP.md`.
14. **Open PRD questions** — receipt content and fiscal requirements (before Phase 4),
    post-close corrections (before Phase 5), permitted tax and service-charge range (before
    Phase 2) — depends on the owner — waiting; see `docs/PRD.md` section 9.
