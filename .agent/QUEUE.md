# Queue

Upcoming tasks only, in the order the lead expects to run them, rewritten as the queue
changes. Each line reads `ID — one-line goal — depends on — status`. The lead owns this file.
Where the product is heading in full is [docs/ROADMAP.md](../docs/ROADMAP.md) (the contract);
where the project stands is [STATE.md](STATE.md).

Completed work is not listed here. Every finished slice, from A1 to FE-028 and its commit,
review and test count, is in the
[roadmap archive](journal/2026-09-29-roadmap-archive.md) (frontend queue from L239,
Phase 0 backend from L281). Each task's own file in `tasks/` holds its handoff.

Rule while the kit rolls out: **no product task starts until KIT-004 has closed** (owner,
2026-09-29). Product tasks below are queued, not started.

## Agent kit rollout (running now)

1. **KIT-001** — split central memory into STATE, QUEUE, DECISIONS and LESSONS, keep the old
   files unchanged in the journal, and repoint orientation — depends on Kit Phase 0 (done,
   journal/2026-09-29-kit-phase0.md) — **accepted 2026-09-29**.
2. **KIT-002** — `agents.yaml`, role prompts and skills, including how caveman style stays out
   of architect, designer and reviewer output — depends on KIT-001 — **accepted 2026-09-29**.
3. **KIT-003** — hooks and branch rules that enforce the human gates (only the owner merges,
   contract files untouched, `agent/*` branches only) — depends on KIT-002 — **accepted
   2026-09-29** (PR #14).
3a. **KIT-002a** — Context7 for the librarian only (per-run switches, `ask.sh` reads its model
   from agents.yaml) and `skills-report.sh` with a per-run skills gate for each CLI — depends
   on KIT-002 — **merged as PR #16** (2026-09-29), acceptance not stated; both rulings given
   (`grill-me` stays; no skills gate).
4. **KIT-004** — the dispatcher, supervised on one task at a time — depends on KIT-003 and
   KIT-002a — Stage 1 merged (PR #18); **Stage 2 pilot done 2026-09-29**: FE-029 built,
   verified, reviewed clean; awaiting the owner's merge of `agent/fe-029` and `agent/kit-pilot`
   and acceptance. See `AGENT-KIT.md` for the phases after it (Phase 5: automatic review,
   designer alongside, builder profiles).

## Frontend: what is left of F4

The floor, incidents, close and recovery slices (F4a to F4d) are done. What is left needs a
design task first, because POS-05 and POS-06 have wireframes only and no Frost artifact.

5. **DESIGN-009** — design POS-05 closed orders and POS-06 closed order detail in Frost, with
   the refund sheet (M-5) and its manager approval, and settle where Close lands (the floor,
   which the lead ruled provisionally, or POS-06, which the artifact draws) — depends on
   DESIGN-008 (done) — **not written**; a codex `gpt-6-astra` designer, then a design review.
   Fold in the design questions FE-026 and FE-028 raised: a place on the floor for an open
   quick sale; the tile counting units while the panel counts lines; the derived *1 line
   pending* copy; *Release* and the order-bar `h1`; *Nothing outstanding* drawn twice (L158-160, L249).
6. **DESIGN follow-up (no ID yet)** — point the settlement and lock artifacts at the Frost
   floor instead of the prototype floor, and note in `docs/DESIGN.md` and DESIGN-003/005 that
   light only is ruled for the MVP — depends on DESIGN-009 or rides with it — not written.
7. **F4e (no ID yet)** — build POS-05 and POS-06: the closed-order book already exists in the
   store (FE-027); refund and manager approval reuse M-1 — depends on DESIGN-009 and its
   review — not written.
8. **Code housekeeping (no IDs yet)** — the four P3s in STATE.md; re-check the POS-03 URL
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
