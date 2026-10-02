# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-02, in the lead session that found FE-032 and `agent/lead-1001c` merged (PR #37, #36),
fast-forwarded the main checkout, then ran FE-033 to a clean review (dispatched on the owner's word). Narrative:
[journal/2026-10-02.md](journal/2026-10-02.md); the closed-order slices are in [journal/2026-10-01.md](journal/2026-10-01.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 and 2 of 12 are done (scaffold and
  PostgreSQL, money module). Tasks 3 to 12 (schema and grants, PIN, audit, throttling,
  sessions, HTTPS server, auth routes, approval, acceptance tests) are **paused** until the
  owner has reviewed the frontend. The server has a pool, a migration runner and one
  migration; no schema, no API and no auth.
- **Frontend built so far** (fixtures plus a client order store): POS-01 lock, POS-02 floor,
  POS-03 order workspace, POS-04 settlement, POS-05 closed orders, POS-06 closed order (detail,
  reprint and the refund), POS-07 print incidents; FE-033 (the floor's after-close changes) is on
  `agent/fe-033`. Not built: all 13 back-office screens.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green at **2537 tests / 37 files** on 2026-10-02
  in the FE-033 worktree at `16310c6` (`development` at `0fab43c`: 2515 / 36). `apps/server/test/migrate.test.ts` needs
  `npm run db:up`; without it its seven tests fail with `ECONNREFUSED 127.0.0.1:5433` (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `0fab43c` (PR #37) on
  GitHub; the local `development` matches it (fast-forwarded 2026-10-02). `main` and
  `development` are protected: PR required, 0 approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch`
  and fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting
  or dispatching**: on 2026-10-02 it was 11 commits behind and the lead's first report was wrong.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-10-02 after the fast-forward). Rerun after any merge that changes
  `.githooks/` or agents.yaml.
- Lead work happens in the worktree `../restaurant-pos-kit`, on `agent/lead-1002` (cut from
  `0fab43c`), committed and pushed twice on 2026-10-02 (owner): this file, QUEUE.md and the
  journal. Until it is merged the main checkout's copies are behind.
- Task worktree `../restaurant-pos-wt/FE-033` (`agent/fe-033`, cut from `0fab43c`, the task file
  its first commit `887a0e1`) and run dir `.agent/runs/FE-033/` stay until that branch is merged.
- **For the owner to remove, or to allow** (the permission classifier refused the lead): worktree
  `../restaurant-pos-wt/FE-032` (merged, clean) and run dir `.agent/runs/FE-032/` (main checkout).
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations` (`735301d`, behind). Merged, still existing: `agent/design-direction`
  (worktree `../restaurant-pos-design`), `agent/design-010`, `agent/fe-030` to `agent/fe-032`, nine `agent/lead-*`.

## Running tasks and agents

- **No active task. FE-033 is complete** (F4e-4, the last F4e slice: the floor's two after-close
  states, the open quick-sale strip, *lines* on tile and panel, the `dayclosed` header): `82a4d07`
  on `agent/fe-033`, four commits, **pushed 2026-10-02** (owner's word). Sonnet 5.5 builder, no fix cycle; Codex
  `gpt-6-astra` review clean (it could not open a browser). **Lead evidence:** verify green; diff
  inside `owns:`; the floor walked in Chrome with a live close of Table 1 and five sales on the strip.
- **FE-032 is merged** (PR #37). AC-11, AC-14, AC-18, AC-25 and AC-34 stay open: the refund is
  an in-memory stand-in for the server's command (DECISIONS.md, 2026-10-01), with no PIN
  verified, no approver and no audit. FE-032's Handoff lists what the server owes.
- **Live agents:** the lead only (`w2:p1`, named `lead`); FE-033's two panes closed themselves. Leftovers it did not make: agentless
  pane `w2:pE`; a detached worktree `.claude/worktrees/keen-chebyshev-ccf255` (`78153ab`).

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then without it in the background
  (the `/dispatch` skill), from `../restaurant-pos-kit`, where an undispatched task file lives
  untracked (delete that copy once dispatched). The worktree is cut from the **local** `development`.
- **A permission prompt does not wake the lead:** the dispatcher prints `BLOCKED ON APPROVAL`
  and keeps waiting, and a background task dies at 2h. After every builder dispatch or resume,
  also run in the background: wait until `herdr agent get <id>` says `working`, then
  `herdr agent wait <id> --until blocked`; re-arm it after each prompt. Only the owner answers.
- **`max_fix_cycles` is 2:** two `--resume` rounds, whatever their cause; a third goes to the owner.
- **Tests expected to change: grep first** for the exact copy, control lists and shared constants
  a task changes; the explorer is a cross-check only (it missed assertions on FE-032 and FE-033).
- **Browser walks** (how, and the three traps: one click per script step, throttled timers,
  blocked `=` output) are in journal 2026-10-02. Codex reviewers cannot open a browser.
- Designers and architects are not dispatched: open their pane by hand with the model passed
  explicitly. Worked examples: a Codex designer, DESIGN-010 (journal 2026-09-30); a read-only
  Claude architect consult, ARCH-003 (journal 2026-10-01, the exact launch line).
- **YAML 1.1 reads `caveman: off` as `false`.** **`--model <m>`** swaps the model for one run on
  the same CLI. Owner's `~/.claude/settings.json` defaults to `auto`; workers override it, and
  its classifier refuses the lead a `git worktree remove` or `rm -rf` of a run dir.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only
  the Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; wants a task.
- **P3, not filed** (L172-175, L206-213, L248-249): a reopened book-only order lands on
  `?state=default` and the URL names Table 1's fixture; `closeOrder` fires a quick sale with
  `type: 'table'`; a quick sale holding an 86'd pending line refuses Close silently with no
  copy; *Nothing outstanding* appears twice when every incident is cleared (a designer's);
  FE-033's modified-click test prints one jsdom `Not implemented: navigation` line (noise, no failure).
- **Housekeeping:** Prettier is neither configured nor banned (L1936-1946); Release waits on `FR-A`.
- **Must not become a guarantee:** `OrderLine.itemId` is optional, so a line with no identity
  can never block a fire (L1787). The in-memory refund and the change walk are stand-ins too.
- **Backend traps for tasks 3 to 12:** parallel server test files race one database (leaning
  `fileParallelism: false`, unruled); the append-only grant test must connect as `pos_app`, not
  the superuser default (L2789-2803); brand `Rate`, leave `Money` as `bigint` (L2685-2694).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Merge `agent/fe-033`** (`82a4d07`) **and `agent/lead-1002`**, both pushed; then pull.
  **FE-033's lead rulings, built, yours to overturn:** a live Close stays on the plain floor and
  never shows the receipt chip (no printer in the client); a quick sale with no line is not on the
  strip, and one the book holds is listed on every state that has read the floor (not `loading`,
  `error`); a new sale resumes at `?state=quick-new`; a sale being paid keeps the ordinary words.
- **Lead rulings built, yours to overturn.** FE-031: an unknown book id draws `error`, never a
  fixture; a voided line is not listed as charged; the cash contribution is cash less change.
  FE-032: a cancelled refund sheet discards its draft; a refund confirmed on a fixture address
  keeps the artifact's `20:31`.
- **FE-030, two builder readings the lead accepted:** session closes list above all fixture rows
  by real instant (11:18 above 20:14); the time filter accepts a three-digit entry shown as
  `08:00`, which the artifact's `valid()` refuses.
- **Kit:** add `Bash(grep:*)` to the builder allowlist? (It stalled FE-031 for two hours and
  prompted again on FE-032.) Should the dispatcher ping the lead on `BLOCKED ON APPROVAL`?
  And whether builders stay interactive by default (`roles.builder.mode`) or return to one-shot.
- **Before Phase 5 (ARCH-003):** is an abandoned approval prompt (idle lock, navigation, a closed
  tab) a *cancelled approval* for FR-J3 and AC-18? It joins POS-03 Q6, the verifying-state cancel.
- **FR-M3 / B-2 wording.** The contract says "half-up" but not what that means below zero;
  the money code rounds half away from zero. Proposed sentence at L2699-2701. Contract text.
- **PRD section 9, three questions still open:** receipt content and fiscal requirements
  (blocks Phase 4), post-close corrections (blocks Phase 5), permitted tax and service-charge
  rate range (before Phase 2).
- **Confirm or reject the eight open `conversation only` lines** in DECISIONS.md (2026-09-14,
  2026-09-18 and six of 2026-09-24, among them POS-03 Q5, Q6 and Q9; Q6 is QUEUE.md 8a).
- **Context7 still reachable** by a launch without `mcp_off` (your ruling); `~/.codex/config.toml` holds two API keys in plain text.

## Live conflicts

- **`floor.html:48` still draws the `dayclosed` header as *Business day closed · 25 Sep***; FE-033
  builds the 2026-09-30 ruling (*open · 26 Sep*). Owed to the designer, with two strip questions.
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **The two Frost back-office artifacts link to the wireframe 51 times**; owed to the
  back-office design task (QUEUE 9). The POS artifacts are clean since DESIGN-009.

## Next up

[QUEUE.md](QUEUE.md): the owner merges FE-033; then housekeeping and the back office; backend tasks 3 to 12 after the frontend review.
