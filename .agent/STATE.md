# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-01, when FE-031 finished (built, lead-verified, reviewed clean) after the owner merged
FE-030 (PR #33) and `agent/lead-1001` (PR #32). Earlier narrative:
[journal/2026-09-30.md](journal/2026-09-30.md) and [journal/2026-10-01.md](journal/2026-10-01.md).
FE-030 (POS-05) is on `development`; FE-031 (POS-06, read-only) waits on its own branch.

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 and 2 of 12 are done (scaffold and
  PostgreSQL, money module). Tasks 3 to 12 (schema and grants, PIN, audit, throttling,
  sessions, HTTPS server, auth routes, approval, acceptance tests) are **paused** until the
  owner has reviewed the frontend. The server has a pool, a migration runner and one
  migration; no schema, no API and no auth.
- **Frontend built so far** (fixtures plus a client order store): POS-01 lock, POS-02 floor,
  POS-03 order workspace, POS-04 settlement, POS-05 closed orders (list, read-only), POS-07 print
  incidents. Not built: POS-06 and the rest of F4e (FE-031 to FE-033) and all 13 back-office screens.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green at **2411 tests / 34 files** on 2026-10-01
  in the FE-031 worktree at `e652b45` (`development`: 2340 / 33). `apps/server/test/migrate.test.ts` needs
  `npm run db:up`; without it its seven tests fail with `ECONNREFUSED 127.0.0.1:5433` (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `ff28d23` (PR #33) on
  GitHub; the local `development` matches it (the lead fast-forwarded it on 2026-10-01). `main`
  and `development` are protected: PR required, 0 approvals, admins too.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-10-01). Rerun after any merge that changes `.githooks/` or agents.yaml.
- Lead work happens in the worktree `../restaurant-pos-kit`, on `agent/lead-1001b` (cut from
  `ff28d23`), committed and pushed on 2026-10-01 (owner). It carries this file, QUEUE.md and the
  journal: the main checkout's copies on `development` are one step behind until it is merged.
- Task worktree `../restaurant-pos-wt/FE-031` (`agent/fe-031`, cut from `ff28d23`, the task file
  its first commit) and run dir `.agent/runs/FE-031/` in the **main checkout** stay until that
  branch is merged; then remove both. FE-030's were removed on 2026-10-01 after its merge.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations` (`735301d`, behind). Merged, still existing: `agent/design-direction`
  (worktree `../restaurant-pos-design`), `agent/design-010`, `agent/lead-0930c`, `agent/fe-030`, `agent/lead-1001`.

## Running tasks and agents

- **No active task. FE-031 is complete** (F4e-2, POS-06 detail, read-only: 14 of the artifact's
  27 states, reprint, no Refund control): `0c05557` on `agent/fe-031`, four commits,
  pushed 2026-10-01 (owner's word), awaiting the owner's merge. Claude Sonnet 5.5 builder, no fix
  cycle; Codex `gpt-6-astra` review clean, no findings (it could not open a browser). **Lead
  evidence:** diff inside `owns:`; 14 states, `overflow` and a mixed-tender close walked in Chrome.
- **Next: write FE-032** (F4e-3, the refund; touches money, audit, boundaries: architect consult
  before dispatch, owner's look before merge) from FE-031's Handoff, *What FE-032 needs*.
- **Live agents:** the lead only (`w2:p1`, named `lead`). The lead closed the builder's pane.
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
- OpenCode interactive is proven by dry run only. **`--model <m>`** swaps the model for one run
  on the same CLI; the reviewer keeps the other family (`gpt-6.1-sol` is a valid Codex model).
- Owner's `~/.claude/settings.json` defaults to `auto` (2026-09-29); workers override it.
- Designers and architects are not dispatched: open their pane by hand with the model from
  agents.yaml passed explicitly. A hand-opened Codex designer in a worktree needs
  `-c sandbox_workspace_write.writable_roots=["<main>/.git"]` to commit, and before its review
  the lead writes `.agent/runs/<ID>/builder/meta.json` with its `cli` (LESSONS.md, Lead). Only
  the owner answers a folder-trust or permission prompt. DESIGN-010 is the worked example
  (journal 2026-09-30): worktree from `origin/development`, task file committed first,
  `export AGENT_ROLE=designer TASK_ID=<ID>` in the pane, then `herdr agent start <name> --kind
  codex -- -m gpt-6-astra -c model_reasoning_effort=high` plus the sandbox and Context7-off `-c`s.
- **The dispatcher reads the task file from the checkout it runs in** (`git rev-parse
  --show-toplevel`) and cuts the worktree from the **local** `development`. Run it from
  `../restaurant-pos-kit`, where an undispatched task file lives untracked, and make sure local
  `development` is current first.
- **Lead verify in a designer worktree:** run `npm ci` there first (designers have none). To
  walk Frost artifacts, serve `docs/design` (not `visual-directions`, or the token CSS 404s) on
  127.0.0.1 and open `visual-directions/frost/pos/<file>.html`.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **P3, not filed** (L172-175, L206-213, L248-249): a reopened book-only order lands on
  `?state=default` and the URL names Table 1's fixture; `closeOrder` fires a quick sale with
  `type: 'table'`; a quick sale holding an 86'd pending line refuses Close silently with no
  copy; *Nothing outstanding* appears twice when every incident is cleared (a designer's).
- **Housekeeping:** Prettier is neither configured nor banned (L1936-1946); Release waits on `FR-A`.
- **Must not become a guarantee:** `OrderLine.itemId` is optional, so a line with no identity
  can never block a fire (L1787). Fine for fixtures; wrong once the backend supplies real items.
- **Backend traps for tasks 3 to 12:** parallel server test files race one database (leaning
  `fileParallelism: false`, unruled); the pool's default role is a superuser, so the append-only
  grant test must connect as `pos_app` (L2789-2803); brand `Rate` and leave `Money` as `bigint`
  before task 3 (L2685-2694, not applied).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Merge `agent/fe-031`** (`0c05557`) **and `agent/lead-1001b`**, both pushed; then pull in
  the main checkout. FE-031 built three lead rulings, yours to overturn: an unknown book id
  draws `error`, never a fixture; a voided line is not listed as charged; the cash contribution
  is cash tendered less change (one helper, which also corrects FE-030's row for card plus cash).
- **FE-030, two builder readings the lead accepted, unruled:** session closes list above all
  fixture rows by real instant (11:18 above 20:14); the time filter accepts a three-digit entry
  shown as `08:00`, which the artifact's `valid()` refuses.
- **Kit:** whether builders stay interactive by default (`roles.builder.mode` in agents.yaml)
  or go back to one-shot with opt-in per task; and whether to add `Bash(grep:*)` to the builder
  allowlist (a read-only `grep` prompt stalled FE-031 for two hours; journal 2026-10-01).
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

- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **The two Frost back-office artifacts link to the wireframe 51 times**; owed to the
  back-office design task (QUEUE 9). The POS artifacts are clean since DESIGN-009.

## Next up

The ordered list is [QUEUE.md](QUEUE.md). In one line: FE-031 waits on the owner's merge; then
FE-032 and FE-033 written one at a time; then the back office. Backend tasks 3 to 12 resume after
the owner's frontend review.
