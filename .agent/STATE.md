# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-09-30, after PR #24 merged and the lead opened the DESIGN-009 designer. The 2026-09-29
session that recorded KIT-005's acceptance and wrote DESIGN-009 is narrated in
[journal/2026-09-29.md](journal/2026-09-29.md), third entry. The only product change since
FE-028 is FE-029.

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
  (`agent/design-009`). `apps/server/test/migrate.test.ts` needs `npm run db:up`; without it its
  seven tests fail with `ECONNREFUSED 127.0.0.1:5433`, the environment, not the code (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `8b10f0b` (PR #24) on
  GitHub and in the owner's checkout. **`main`** and `development` are protected on GitHub:
  PR required, 0 approvals, enforced for admins.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current for `8b10f0b`. Rerun after any merge that changes `.githooks/` or agents.yaml.
- Lead work happens in the worktree `../restaurant-pos-kit`, now on `agent/lead-0930` (cut from
  `8b10f0b`). Dispatched tasks get worktrees under `../restaurant-pos-wt/<ID>` and run state in
  `.agent/runs/<ID>/` (gitignored). Merged lead and kit branches remain locally.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale or merged branches: `agent/phase-0-foundations` (`735301d`, behind); `agent/design-direction`
  (worktree `../restaurant-pos-design`, `5cbe8ca`, clean, merged).

## Running tasks and agents

- **Active task: DESIGN-009, in review.** The Codex `gpt-6-astra` designer (`design009`) delivered
  it with a full Handoff ending DONE, then could not commit (the Codex sandbox cannot write the
  worktree's index lock; LESSONS.md) and ran out of usage. On the owner's word the lead
  committed its files unchanged as `06f3a25` on `agent/design-009`, closed its pane, added the
  criterion 6 correction there (`74943f7`), and ran `npm run verify` there: green, 2256 / 32.
- **Review done** (Claude Opus 5.5, `90669f1`): findings, 9 (2 high). Every finding accepted.
  The owner ruled F4 and F5 (four DECISIONS lines, 2026-09-30); the lead ruled the rest and Part C
  (Close lands on the floor, on a new `after-close` state). All written as "Round 2" in the task
  file on `agent/design-009` (`4eb4fd2`, `status: active`, `cycles: 2`). **Round 2 running** since
  12:55 by a Claude Opus 5.5 designer (owner, once only; Codex out of usage), Herdr `design009`,
  pane `w2:p2E`. Its re-review goes to Codex (`runs/DESIGN-009/builder/meta.json` says `claude`).
- **Main checkout has one uncommitted edit:** DESIGN-008's Status line (accepted), identical
  to `1b50e7e` on `agent/lead-0930`; run `git checkout -- .agent/tasks/DESIGN-008-*` before pulling.
- **Live agents:** the lead (`w2:p1`, named `lead`) and the reviewer while it runs.

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
- OpenCode interactive and permissions, and Codex writable roots, are proven by dry run only.
- **Owner's `~/.claude/settings.json` changed 2026-09-29** (`/doctor`; journal, third entry):
  default mode `auto`, which workers override with their own `--permission-mode`; 29 unused
  skills off, none of them named in agents.yaml or a role prompt.
- Designers and architects are not dispatched: open their pane by hand with the model from
  agents.yaml passed explicitly. Codex trusts only the main checkout, so a Codex pane in a
  worktree may raise a folder-trust prompt; only the owner answers it.

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

- **Merge `agent/lead-0930`**: it holds the approved PRD change for the refund rulings (FR-H5, FR-J3,
  AC-18, AC-34), DESIGN-008's status fix, and this session's memory.
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

- **Close lands on the floor, the artifact says POS-06.** The lead ruled the floor with
  `replaceState` (FE-027, L188-193). DESIGN-009 Part C asks the designer to recommend; the
  lead rules at its review.
- **`docs/DESIGN.md` and DESIGN-003/005 still call the dark palette open.** DECISIONS.md
  records light only for the MVP. DESIGN-009 adds the `docs/DESIGN.md` line; the note in the
  DESIGN-003/005 task files is the lead's and not done.
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **The settlement and lock artifacts still link to the prototype** (L114-115). DESIGN-009
  Part C re-points them; its criterion 6 checks that no Frost artifact links to `prototype/`.

## Next up

The ordered list is [QUEUE.md](QUEUE.md). In one line: let the DESIGN-009 designer finish (the
entry under "Running tasks"), review it, rule Part C and the questions it raises, then
F4e through the dispatcher, then the back office; backend tasks 3 to 12 resume after the
owner's frontend review.
