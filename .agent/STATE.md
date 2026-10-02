# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-02, at the wrap-up of the lead session that ran FE-030, FE-031 and FE-032 (the three
closed-order slices) and the architect consult ARCH-003. Narrative:
[journal/2026-10-01.md](journal/2026-10-01.md), wrap-up in [journal/2026-10-02.md](journal/2026-10-02.md).
POS-05 and POS-06 (read-only) are on `development`; the refund waits on its own pushed branch.

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 and 2 of 12 are done (scaffold and
  PostgreSQL, money module). Tasks 3 to 12 (schema and grants, PIN, audit, throttling,
  sessions, HTTPS server, auth routes, approval, acceptance tests) are **paused** until the
  owner has reviewed the frontend. The server has a pool, a migration runner and one
  migration; no schema, no API and no auth.
- **Frontend built so far** (fixtures plus a client order store): POS-01 lock, POS-02 floor,
  POS-03 order workspace, POS-04 settlement, POS-05 closed orders, POS-06 closed order (detail and
  reprint on `development`; the refund on `agent/fe-032`), POS-07 print incidents. Not built:
  FE-033 (the floor's after-close changes) and all 13 back-office screens.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green at **2515 tests / 36 files** on 2026-10-01
  in the FE-032 worktree at `c42f39f` (`development`: 2411 / 34). `apps/server/test/migrate.test.ts` needs
  `npm run db:up`; without it its seven tests fail with `ECONNREFUSED 127.0.0.1:5433` (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `1fc0f6c` (PR #35) on
  GitHub; the local `development` matches it (checked 2026-10-02). `main` and `development` are
  protected: PR required, 0 approvals, admins too.
- **The owner merges and pulls elsewhere.** After every merge, `git fetch` in the main checkout
  and fast-forward it (`git pull --ff-only origin development`) before a dispatch: it was behind
  all three times this session, and the dispatcher cuts worktrees from it.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-10-02). Rerun after any merge that changes `.githooks/` or agents.yaml.
- Lead work happens in the worktree `../restaurant-pos-kit`, on `agent/lead-1001c` (cut from
  `1fc0f6c`), committed and pushed at this wrap-up: this file, QUEUE.md, DECISIONS.md (two
  rulings), both journals, ARCH-003's task file and report. After its merge, cut a new
  `agent/lead-<date>` from `development` there.
- Task worktree `../restaurant-pos-wt/FE-032` (`agent/fe-032`) and run dir `.agent/runs/FE-032/`
  in the **main checkout** stay until that branch is merged; then remove both.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations` (`735301d`, behind). Merged, still existing: `agent/design-direction`
  (worktree `../restaurant-pos-design`), `agent/design-010`, `agent/fe-030`, `agent/fe-031` and four `agent/lead-*`.

## Running tasks and agents

- **No active task. FE-032 is complete** (F4e-3, the refund on POS-06: 13 states, the M-5 sheet,
  a required reason, M-1 as a modal, the REFUNDED order): `39d6874` on `agent/fe-032`, **pushed
  2026-10-02**. It touches money, audit and boundaries: the owner **looks before merging**.
- **How it got there** (journal 2026-10-01): architect consult ARCH-003 and two owner rulings
  before dispatch; Claude Sonnet 5.5 builder; both fix cycles used; two Codex `gpt-6-astra`
  reviews, the second clean. Its task file holds the Handoff, the lead's verify and the rulings.
- **Lead evidence:** verify green; diff inside `owns:`; the 13 states and a live refund with an
  edited allocation walked in Chrome. Not seen in a browser: the refusal notice of review
  finding F1 (no route reaches it); it rests on the test and the second review's red and green.
- **AC-11, AC-14, AC-18, AC-25 and AC-34 stay open.** The refund is an in-memory stand-in for
  the server's command (DECISIONS.md, 2026-10-01): no PIN verified, no approver, no audit,
  deleted when the server command exists. FE-032's Handoff lists what the server owes.
- **Next: write FE-033** (F4e-4, the floor: `after-close` and `after-close-receipt`, the
  `dayclosed` header, the open quick-sale strip, *lines*; DESIGN-009 Part C and D). Not started.
- **Live agents:** the lead only (`w2:p1`, named `lead`). Every pane it opened is closed.
  Leftovers it did not make: agentless pane `w2:pE`; a detached worktree
  `.claude/worktrees/keen-chebyshev-ccf255` (`78153ab`).

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then without it in the background
  (the `/dispatch` skill), from `../restaurant-pos-kit`, where an undispatched task file lives
  untracked (delete that copy once dispatched). The worktree is cut from the **local** `development`.
- **A permission prompt does not wake the lead:** the dispatcher prints `BLOCKED ON APPROVAL`
  and keeps waiting, and a background task dies at 2h. After every builder dispatch or resume,
  also run in the background: wait until `herdr agent get <id>` says `working`, then
  `herdr agent wait <id> --until blocked`; re-arm it after each prompt. Only the owner answers.
- **`max_fix_cycles` is 2:** two `--resume` rounds, whatever their cause; a third goes to the owner.
- **A task that adds a control to a built screen:** grep its test file for the exact button
  list, not only test titles. FE-032 lost a cycle to fourteen assertions behind one constant.
- **Browser walks** (how, and the three traps: one click per script step, throttled timers,
  blocked `=` output) are in journal 2026-10-02. Codex reviewers cannot open a browser.
- Designers and architects are not dispatched: open their pane by hand with the model passed
  explicitly. Worked examples: a Codex designer, DESIGN-010 (journal 2026-09-30); a read-only
  Claude architect consult, ARCH-003 (journal 2026-10-01, the exact launch line).
- **YAML 1.1 reads `caveman: off` as `false`.** **`--model <m>`** swaps the model for one run on
  the same CLI. Owner's `~/.claude/settings.json` defaults to `auto`; workers override it.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only
  the Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; wants a task.
- **P3, not filed** (L172-175, L206-213, L248-249): a reopened book-only order lands on
  `?state=default` and the URL names Table 1's fixture; `closeOrder` fires a quick sale with
  `type: 'table'`; a quick sale holding an 86'd pending line refuses Close silently with no
  copy; *Nothing outstanding* appears twice when every incident is cleared (a designer's).
- **Housekeeping:** Prettier is neither configured nor banned (L1936-1946); Release waits on `FR-A`.
- **Must not become a guarantee:** `OrderLine.itemId` is optional, so a line with no identity
  can never block a fire (L1787). The in-memory refund and the change walk are stand-ins too.
- **Backend traps for tasks 3 to 12:** parallel server test files race one database (leaning
  `fileParallelism: false`, unruled); the append-only grant test must connect as `pos_app`, not
  the superuser default (L2789-2803); brand `Rate`, leave `Money` as `bigint` (L2685-2694).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Look at `agent/fe-032`** (`39d6874`, money and audit), **then merge it and `agent/lead-1001c`.**
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

- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **The two Frost back-office artifacts link to the wireframe 51 times**; owed to the
  back-office design task (QUEUE 9). The POS artifacts are clean since DESIGN-009.

## Next up

The ordered list is [QUEUE.md](QUEUE.md). In one line: the owner looks at and merges FE-032;
the lead writes FE-033; then the back office. Backend tasks 3 to 12 resume after the owner's
frontend review.
