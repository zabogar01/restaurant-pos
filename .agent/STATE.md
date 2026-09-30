# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-09-30, second lead session of the day: wrote DESIGN-010 and FE-030 and sliced F4e
(narrative in [journal/2026-09-30.md](journal/2026-09-30.md)). The only product code change
since FE-028 is FE-029; DESIGN-009 added design artifacts and the PRD refund wording, no code.

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 and 2 of 12 are done (scaffold and
  PostgreSQL, money module). Tasks 3 to 12 (schema and grants, PIN, audit, throttling,
  sessions, HTTPS server, auth routes, approval, acceptance tests) are **paused** until the
  owner has reviewed the frontend. The server today has a pool, a migration runner and one
  migration. It has no schema, no API and no auth.
- **Frontend built so far** (against fixtures plus a client order store): POS-01 lock,
  POS-02 floor, POS-03 order workspace, POS-04 settlement, POS-07 print incidents. Not built:
  POS-05 closed orders, POS-06 closed order detail, and all 13 back-office screens.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted;
  KIT-005 (interactive dispatch, pane auto-close) merged as PR #21 (`5a1122f`). Product tasks run.
- **Last verify by the lead:** `npm run verify` green at **2256 tests / 32 files** on 2026-09-30
  (DESIGN-009 branch; no code changed since). `apps/server/test/migrate.test.ts` needs
  `npm run db:up`; without it its seven tests fail with `ECONNREFUSED 127.0.0.1:5433` (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `f5c9622` (PR #29) on
  GitHub. The owner's checkout still reads `b0f7de4` until pulled. **`main`** and `development` are protected on GitHub:
  PR required, 0 approvals, enforced for admins.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-09-30 at `b0f7de4`; PR #29 touched neither). Rerun after any merge that changes `.githooks/` or agents.yaml.
- Lead work happens in the worktree `../restaurant-pos-kit`, on `agent/lead-0930c` (cut from
  `f5c9622`, no upstream, all uncommitted; the DESIGN-010 and FE-030 files stay uncommitted
  until dispatched). No task worktree exists under `../restaurant-pos-wt/`, and
  `.agent/runs/` is empty. Merged lead and kit branches remain locally.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale or merged branches: `agent/phase-0-foundations` (`735301d`, behind); `agent/design-direction`
  (worktree `../restaurant-pos-design`, `5cbe8ca`, clean, merged).

## Running tasks and agents

- **No active task.** **Written, not started:** DESIGN-010 (tokens and refund fixtures) and
  FE-030 (F4e-1, POS-05 list), which needs DESIGN-010 merged first. QUEUE.md item 6 has the
  F4e slicing. They go out when the owner says go.
- DESIGN-009 is **complete and merged** (PRs #26 and #27): round 1 by a Codex
  designer, round 2 by a Claude Opus 5.5 designer (owner, once), re-review by Codex
  `gpt-6.1-sol` (one medium fixture finding, queued as DESIGN-010). Its worktree and run folder
  are removed. Browser evidence is the designer's own: 159 states measured at 1280×800 in
  headless Chrome. The re-reviewer's Chrome crashed (it crawled in JSDOM), and the lead has not
  walked the flows in a browser.
- **Live agents:** the lead only (`w2:p1`, named `lead`; `/lead` renames it after a session change).
- Leftovers the lead did not make and has not closed: agentless pane `w2:pE` (tab `t7`), and a
  detached worktree `.claude/worktrees/keen-chebyshev-ccf255` (`78153ab`).

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then without it in the background
  (the `/dispatch` skill). Builders run **interactive** (real CLI in the pane, Herdr agent
  `<id>`), reviewers one-shot; `--mode` overrides. Panes close themselves on DONE or a written
  review; the lead closes any kept pane once no round is expected.
- **Only the owner answers a permission prompt** (`BLOCKED ON APPROVAL`, pane text saved in
  the run directory). Claude workers: `acceptEdits`, a Bash allowlist, `git push` denied (owner).
- **YAML 1.1 reads `caveman: off` as `false`.** Anything reading `caveman:` must treat both as off.
- OpenCode interactive and permissions are proven by dry run only. **`--model <m>`** (added
  2026-09-30) swaps the model for one run on the same CLI; the reviewer keeps the other family.
  `gpt-6.1-sol` is a valid Codex model (checked 2026-09-30).
- **Owner's `~/.claude/settings.json` changed 2026-09-29** (`/doctor`; journal, third entry):
  default mode `auto`, which workers override with their own `--permission-mode`; 29 unused
  skills off, none of them named in agents.yaml or a role prompt.
- Designers and architects are not dispatched: open their pane by hand with the model from
  agents.yaml passed explicitly. A hand-opened Codex designer in a worktree needs
  `-c sandbox_workspace_write.writable_roots=["<main>/.git"]` to commit, and before its review
  the lead writes `.agent/runs/<ID>/builder/meta.json` with its `cli` (LESSONS.md, Lead). Only
  the owner answers a folder-trust or permission prompt.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
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

- **Merge `agent/lead-0930c`** (committed at the owner's word, unpushed): STATE, QUEUE, DECISIONS,
  journal, DESIGN-003/005 notes. The task files go in with their own tasks' PRs (LESSONS, Lead).
- **Walk DESIGN-009 in a browser before F4e?** The lead offered to walk the new POS-05/POS-06
  flows in Chrome itself (no one re-measured after round 2); not yet answered.
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
- **Optional machine cleanup from `/doctor`:** disable the synced `design`, `engineering` and
  `product-management` plugins in `/plugin` (about 1k tokens of skill listing), and the unused
  claude.ai connectors in `/mcp`. Nothing in the project depends on either.
- **Context7 still reachable** by an interactive Codex designer and any launch without
  `mcp_off`, because `~/.codex/config.toml` stays as it is (your ruling). That file also holds
  the Context7 and Stitch API keys in plain text; consider environment variables.

## Live conflicts

- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **The two Frost back-office artifacts link to the wireframe 51 times**; owed to the
  back-office design task (QUEUE 9). The POS artifacts are clean since DESIGN-009.

## Next up

The ordered list is [QUEUE.md](QUEUE.md). In one line: DESIGN-010 (designer), then FE-030 once
it is merged, then FE-031 to FE-033 written one at a time; then the back office. Backend tasks
3 to 12 resume after the owner's frontend review.
