# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-09-29, memory split, KIT-001. Built by a sorting subagent from the two archives and
`git log`, then reviewed by the lead against its sources. Where two passages in the archive
disagreed, the newer date won. Nothing below is newer than 2026-09-25 except the integration
branch change and the kit rollout, because no product work has run since FE-028.

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 and 2 of 12 are done (scaffold and
  PostgreSQL, money module). Tasks 3 to 12 (schema and grants, PIN, audit, throttling,
  sessions, HTTPS server, auth routes, approval, acceptance tests) are **paused** until the
  owner has reviewed the frontend. The server today has a pool, a migration runner and one
  migration. It has no schema, no API and no auth.
- **Frontend built so far** (against fixtures plus a client order store): POS-01 lock,
  POS-02 floor, POS-03 order workspace, POS-04 settlement, POS-07 print incidents. Not built:
  POS-05 closed orders, POS-06 closed order detail, and all 13 back-office screens.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It required five
  things, all met and in git history: (1) the architecture approved and converted into
  `docs/ARCHITECTURE.md` with seven Accepted ADRs; (2) the deployment conflict resolved in the
  documents; (3) the PRD's stack, currency and tax-model questions closed; (4) an execution
  mode chosen, which is subagent-driven; (5) a `.gitignore`. The open gate does not approve
  anything still listed as open in PRD section 9; an implementer that needs one stops and raises it.
- **Kit rollout** (owner, 2026-09-29): KIT-001 memory split is complete and awaiting the
  owner's review (this file is its output). KIT-002 config and roles, KIT-003 guardrails, KIT-004 dispatcher follow. **No
  product task starts during the rollout** ([KIT-001](tasks/KIT-001-memory-split.md)).
- **Last verify by the lead:** `npm run verify` green at **2253 tests / 32 files** on
  2026-09-29 (KIT-001, no source changed since FE-028). The seven tests in
  `apps/server/test/migrate.test.ts` need Docker and Postgres (`npm run db:up`); without it
  they fail with `ECONNREFUSED 127.0.0.1:5433`, which is the environment, not the code (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29; this replaces
  `agent/phase-0-foundations`). This repository has no `main`. Local `development`,
  `origin/development` and the head of PR #13 are all `881a36d`.
- Work goes on `agent/<topic>` cut from `development`. This session is on `agent/agent-kit`.
  Only the owner merges. Commit only when asked.
- `agent/phase-0-foundations` (`735301d`) is now behind `development` and stale. The design
  branch `agent/design-direction` (worktree `../restaurant-pos-design`, head `5cbe8ca`, clean)
  is fully merged into `development`. Any new design work needs a fresh branch.

## Running tasks and agents

- **Active task:** none. KIT-001 awaits the owner's review; KIT-002 starts after it.
- **Live agents:** the lead only, pane `w2:p1` (Claude, Opus 5.5), verified with
  `herdr agent list` on 2026-09-29. Herdr currently names it `claude`, not `lead`; the name
  drops when a session changes, so re-run `herdr agent rename w2:p1 lead` before addressing
  it by name.
- **Every builder, designer, reviewer and architect from the log is closed** (last: `builder30`
  on FE-028, `designer7`, `design-reviewer4`, all closed 2026-09-25). The full roster is in
  L1198-1264 if a past agent's model or verdict matters.
- Leftover panes `w2:pE` (tab `t7`) and `w2:pS` (tab `t8`) are agentless shells. A detached
  worktree at `.claude/worktrees/keen-chebyshev-ccf255` (`78153ab`) is tooling residue. The lead
  made none of them and has not closed them.

## Live bugs and known defects

- **Menu tile adds a Burger: FIXED.** Recorded 2026-09-24 (L257-262): every tile opened the
  Burger's sheet, so tapping Fish and Chips added a Burger at 135.000. FE-021 (`7268943`)
  gave each of the twelve items its own sheet; accepted 2026-09-24 after 5 rounds and
  walked in Chrome. Kept here until the owner has seen it fixed in a browser.
- **Unverified, possibly fixed:** after Add to order on POS-03, the URL read `?state=eightysix`
  (L353, seen 2026-09-23). FE-021 rebuilt the origin handling; nobody re-checked this URL.
- **P3, not filed** (L172-175, L206-213, L248-249): a reopened book-only order lands on
  `?state=default` and the URL names Table 1's fixture; `closeOrder` fires a quick sale with
  `type: 'table'`; a quick sale holding an 86'd pending line refuses Close silently with no
  copy; *Nothing outstanding* appears twice when every incident is cleared (a designer's).
- **Housekeeping:** the `cancel`, `reauth` and `leaselost` modals still render outside
  `.pos-device` and fit only because they are short (L671); Prettier is neither configured nor
  banned, and a stray run once rewrote 541 lines (L1936-1946); the *Release* table action is
  deferred because it needs the actor session (`FR-A`).
- **Must not become a guarantee:** `OrderLine.itemId` is optional, so a line with no identity
  can never block a fire (L1787). Fine for fixtures; wrong once the backend supplies real items.
- **Backend traps for tasks 3 to 12:** parallel server test files race one database (leaning
  `fileParallelism: false`, unruled); the pool's default role is a superuser, so the append-only
  grant test must connect as `pos_app` (L2789-2803); brand `Rate` and leave `Money` as `bigint`
  before task 3 (L2685-2694, not applied).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **FR-M3 / B-2 wording.** The contract says "half-up" but not what that means below zero;
  the money code rounds half away from zero so a refund is the exact negation of its sale.
  Proposed sentence at L2699-2701. Contract text, so yours.
- **PRD section 9, three questions still open:** receipt content and fiscal requirements
  (blocks Phase 4), post-close corrections (blocks Phase 5), permitted tax and service-charge
  rate range (before Phase 2). Detail in `docs/PRD.md` section 9.
- **POS-03's ten design questions** (L264-288): all ten now have rulings and nine are built.
  Q1 tile sheet, Q2 quantity, Q3 what firing shows and Q10 the fire notice are done via
  DESIGN-007, FE-021 and FE-022. Q4 UNKNOWN wording is in FE-022. Q5 emptied order, Q6 Cancel
  while approving and Q9 no comp note are ruled by you in conversation only (see the
  `conversation only` lines in DECISIONS.md, for you to confirm). Q7 focusable off actions
  (FE-024) and Q8 category press (FE-023) are done. **Still not carried by any task: Q6.**
  No design or code task covers "Cancel while an approval is verifying cancels" (B-20).
- **Confirm: agents report by `herdr agent prompt lead` and the lead runs a background wait.**
  The log says this followed the owner noticing silent codex agents (L334). Was it your ruling?
- **Confirm the ten `conversation only` lines** in DECISIONS.md, or reject any of them.
- **Review the kit rollout results** as each KIT task closes; only you merge `agent/agent-kit`.

## Live conflicts

- **Neither of the two named in CLAUDE.md is live.** Deployment shape was resolved in the
  documents on 2026-09-10: `docs/ARCHITECTURE.md` section 3 is loopback-only and the proposal
  is superseded (L2878-2891). The Phase 0 plan's stack and currency are now closed in the PRD
  (`4c59cdc`, L2893-2918). CLAUDE.md still says both are live; that is stale and belongs to
  KIT-002 or the owner.
- **Close lands on the floor, the artifact says POS-06.** The lead ruled the floor with
  `replaceState` (FE-027, L188-193) until DESIGN-009 settles POS-06. DESIGN-009 must settle it.
- **`docs/DESIGN.md` and DESIGN-003/005 still call the dark palette open.** DECISIONS.md
  records light only for the MVP (DESIGN-008 rule 8). The design docs need a note; not a contract file.
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **The settlement and lock artifacts still link to the prototype floor** (L114-115).
  Owed to the next design task.
- **AGENTS.md and WORKFLOW.md still name a Codex architect.** The current policy is an Opus 5.5
  or `gpt-6-astra` architect (DECISIONS.md). Owed to KIT-002.

## Next up

The ordered list is [QUEUE.md](QUEUE.md). In one line: finish KIT-001 to KIT-004, then
DESIGN-009 (POS-05 and POS-06 design, plus where Close lands), then its code slice, then the
back office, with backend tasks 3 to 12 resuming when the owner has reviewed the frontend.
