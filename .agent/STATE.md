# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-09-29, after the owner accepted KIT-005 (narrative in
[journal/2026-09-29.md](journal/2026-09-29.md), third entry). First built in KIT-001 from the
two archives and `git log`. The only product change since FE-028 is FE-029.

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
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-004 accepted; the pilot FE-029 was
  accepted, so product tasks may start again. **KIT-005** (interactive dispatch, pane
  auto-close) was merged as PR #21 (`5a1122f`) and **accepted** by the owner the same day.
  The owner approved the permission prompts in the KITTEST-011 and KITTEST-014 panes.
- **Last verify by the lead:** `npm run verify` green at **2256 tests / 32 files** on
  2026-09-29 (KIT-005 branch, now merged; it holds FE-029). The seven tests in
  `apps/server/test/migrate.test.ts` need Docker and Postgres (`npm run db:up`); without it
  they fail with `ECONNREFUSED 127.0.0.1:5433`, which is the environment, not the code (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `5a1122f` (PR #21) on
  GitHub and in the owner's checkout. **`main`** and `development` are protected on GitHub:
  PR required, 0 approvals, enforced for admins.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  reinstalled from `5a1122f` and current. Rerun after any merge that changes `.githooks/` or agents.yaml.
- Lead work happens in the worktree `../restaurant-pos-kit`, on `agent/lead-0929-kit005`
  (the KIT-005 wrap-up and acceptance: STATE, QUEUE, DECISIONS, the task file, the journal;
  cut from `5a1122f`; its first two commits are on origin, later edits may not be).
  **Until the owner merges it, `development`'s STATE.md is behind this file.**
  Dispatched tasks get worktrees under `../restaurant-pos-wt/<ID>` (none exist now) and run
  state in `.agent/runs/<ID>/` (gitignored). Merged kit branches remain locally.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits when asked.
- `agent/phase-0-foundations` (`735301d`) is behind `development` and stale. The design
  branch `agent/design-direction` (worktree `../restaurant-pos-design`, head `5cbe8ca`, clean)
  is fully merged. Any new design work needs a fresh branch.

## Running tasks and agents

- **Active task:** none. Next is **DESIGN-009** (QUEUE.md item 5), not yet written; the owner
  agreed on 2026-09-29 that the lead writes it next. No worker is running.
- **Live agents:** the lead only, pane `w2:p1` (Claude, Opus 5.5), named `lead` in Herdr. The
  name drops when a session changes; `/lead` renames it. In `herdr agent list`, `agent` is the
  CLI kind and `name` is the name.
- All past builders, designers, reviewers and architects are closed (roster: L1198-1264).
  FE-029's panes and worktree were removed after its merge.
- Leftover pane `w2:pE` (tab `t7`) is an agentless shell. A detached worktree at
  `.claude/worktrees/keen-chebyshev-ccf255` (`78153ab`) is tooling residue. The lead made
  neither and has not closed them.

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then without it in the background
  (the `/dispatch` skill). Builders run **interactive** (real CLI in the pane, Herdr agent
  `<id>`), reviewers one-shot; `--mode` overrides. Panes close themselves on DONE or a written
  review; the lead closes any kept pane once no round is expected.
- **Only the owner answers a permission prompt** (`BLOCKED ON APPROVAL`, pane text saved in
  the run directory). Claude workers: `acceptEdits`, a Bash allowlist, `git push` denied (owner).
- **YAML 1.1 reads `caveman: off` as `false`.** Anything reading `caveman:` must treat both as off.
- OpenCode interactive and permissions, and Codex writable roots, are proven by dry run only.
- **Owner's `~/.claude/settings.json` changed 2026-09-29** (`/doctor`; journal, third entry):
  default mode `auto`, which workers override with their own `--permission-mode`; 29 unused
  skills off, none of them named in agents.yaml or a role prompt.
- Designers and architects are not dispatched: open their pane by hand with the model from
  agents.yaml passed explicitly (DESIGN-009's designer is Codex `gpt-6-astra`, effort high).

## Live bugs and known defects

- **Menu tile adds a Burger: FIXED.** Recorded 2026-09-24 (L257-262): every tile opened the
  Burger's sheet, so tapping Fish and Chips added a Burger at 135.000. FE-021 (`7268943`)
  gave each of the twelve items its own sheet; accepted 2026-09-24 after 5 rounds and
  walked in Chrome. Kept here until the owner has seen it fixed in a browser.
- **Probably intended, not a bug:** after Add on POS-03 the URL read `?state=eightysix`
  (L353, 2026-09-23). Since FE-021, Add from the `eightysix` state returns there by design
  (`keeps` policy, `orderFixtures.ts:990-995`) and a test asserts it
  (`own-items.test.tsx:381-393`). Close it once the owner has seen it in a browser.
- **P3, not filed** (L172-175, L206-213, L248-249): a reopened book-only order lands on
  `?state=default` and the URL names Table 1's fixture; `closeOrder` fires a quick sale with
  `type: 'table'`; a quick sale holding an 86'd pending line refuses Close silently with no
  copy; *Nothing outstanding* appears twice when every incident is cleared (a designer's).
- **Housekeeping:** Prettier is neither configured nor banned, and a stray run once rewrote 541 lines (L1936-1946); the *Release* table action is
  deferred because it needs the actor session (`FR-A`).
- **Must not become a guarantee:** `OrderLine.itemId` is optional, so a line with no identity
  can never block a fire (L1787). Fine for fixtures; wrong once the backend supplies real items.
- **Backend traps for tasks 3 to 12:** parallel server test files race one database (leaning
  `fileParallelism: false`, unruled); the pool's default role is a superuser, so the append-only
  grant test must connect as `pos_app` (L2789-2803); brand `Rate` and leave `Money` as `bigint`
  before task 3 (L2685-2694, not applied).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Kit:** whether builders stay interactive by default (`roles.builder.mode` in agents.yaml)
  or go back to one-shot with opt-in per task. They are interactive until you say otherwise.
- **FR-M3 / B-2 wording.** The contract says "half-up" but not what that means below zero;
  the money code rounds half away from zero so a refund is the exact negation of its sale.
  Proposed sentence at L2699-2701. Contract text, so yours.
- **PRD section 9, three questions still open:** receipt content and fiscal requirements
  (blocks Phase 4), post-close corrections (blocks Phase 5), permitted tax and service-charge
  rate range (before Phase 2). Detail in `docs/PRD.md` section 9.
- **POS-03's ten design questions** (L264-288): all ten have rulings and nine are built. Q5
  emptied order, Q6 Cancel while approving and Q9 no comp note are ruled by you in
  conversation only (see the `conversation only` lines in DECISIONS.md). Q6 is QUEUE.md 8a.
- **Confirm or reject the eight open `conversation only` lines** in DECISIONS.md: the
  2026-09-14 subagent-driven Phase 0; 2026-09-18 closing implementers; 2026-09-24 DESIGN-006
  before F4, `fireerror`, POS-03 Q5, Q6 and Q9, and closing unused agents.
- **Context7 still reachable** by an interactive Codex designer and any launch without
  `mcp_off`, because `~/.codex/config.toml` stays as it is (your ruling). That file also holds
  the Context7 and Stitch API keys in plain text; consider environment variables.

## Live conflicts

- **Close lands on the floor, the artifact says POS-06.** The lead ruled the floor with
  `replaceState` (FE-027, L188-193) until DESIGN-009 settles POS-06. DESIGN-009 must settle it.
- **`docs/DESIGN.md` and DESIGN-003/005 still call the dark palette open.** DECISIONS.md
  records light only for the MVP (DESIGN-008 rule 8). The design docs need a note; not a contract file.
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **The settlement and lock artifacts still link to the prototype floor** (L114-115).
  Owed to the next design task.

## Next up

The ordered list is [QUEUE.md](QUEUE.md). In one line: write DESIGN-009 (POS-05 and POS-06 in
Frost, the refund sheet and its approval, and where Close lands), run it with a designer and a
design review, then its code slice F4e through the dispatcher, then the back office; backend
tasks 3 to 12 resume after the owner's frontend review.
