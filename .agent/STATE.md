# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-09-30, when a new lead session re-checked it: the checks are green, only the lead is
live, and `agent/lead-0929-kit005` is still unpushed, so DESIGN-009 waits on step 1 below.
Before that, 2026-09-29, at the wrap-up of the session that ran `/doctor`, recorded KIT-005's
acceptance and wrote DESIGN-009 (narrative in [journal/2026-09-29.md](journal/2026-09-29.md),
third entry). First built in KIT-001 from the two archives and `git log`. The only product
change since FE-028 is FE-029.

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
- Lead work happens in the worktree `../restaurant-pos-kit`, on `agent/lead-0929-kit005`, cut
  from `5a1122f`. It holds the KIT-005 wrap-up and acceptance, the DESIGN-009 task file and
  this wrap-up. `fb9f541` and `e88f9e8` are on origin; `5ede492`, `1ca97a6` and the wrap-up
  commit and the 2026-09-30 re-check are **local only** (the lead does not push unless told). **Until the owner pushes and
  merges it, `development` has neither this STATE.md nor the DESIGN-009 task file.**
  Dispatched tasks get worktrees under `../restaurant-pos-wt/<ID>` (none exist now) and run
  state in `.agent/runs/<ID>/` (gitignored). Merged kit branches remain locally.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits when asked.
- `agent/phase-0-foundations` (`735301d`) is behind `development` and stale. The design
  branch `agent/design-direction` (worktree `../restaurant-pos-design`, head `5cbe8ca`, clean)
  is fully merged. Any new design work needs a fresh branch.

## Running tasks and agents

- **Active task:** **DESIGN-009**, written and committed (`1ca97a6`,
  `.agent/tasks/DESIGN-009-closed-orders-and-refund.md`); the owner asked to start it in the
  next session. No worker is running. To start it: (1) the owner pushes and merges
  `agent/lead-0929-kit005`; (2) the lead cuts `agent/design-009` from `development` into
  `../restaurant-pos-wt/DESIGN-009`; (3) the lead opens a Codex `gpt-6-astra` designer (effort
  high, model passed explicitly) in its own pane there, briefs it with the task file, and
  starts `herdr agent wait` in the same turn. A design review follows before F4e.
- **Live agents:** the lead only, pane `w2:p1`, named `lead` in Herdr (`/lead` renames it after
  a session change). Every past worker is closed (roster: L1198-1264).
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

- **Menu tile adds a Burger: FIXED** by FE-021 (`7268943`, L257-262). Kept until the owner has
  seen it fixed in a browser.
- **Probably intended:** Add from POS-03's `eightysix` state returns there by design (L353;
  `orderFixtures.ts:990-995`, asserted at `own-items.test.tsx:381-393`). Close once the owner has seen it.
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

The ordered list is [QUEUE.md](QUEUE.md). In one line: start DESIGN-009 with a designer (the
three steps under "Running tasks"), review it, rule Part C and the questions it raises, then
F4e through the dispatcher, then the back office; backend tasks 3 to 12 resume after the
owner's frontend review.
