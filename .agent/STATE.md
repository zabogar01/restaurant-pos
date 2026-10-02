# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-02, third lead session of the day: the housekeeping slice, **FE-034, ran from task file
to merge (PR #42)**; the lead's record merged as PR #41. No task is running or written. Narrative:
[journal/2026-10-02.md](journal/2026-10-02.md) (its last section is this session) and [journal/2026-10-01.md](journal/2026-10-01.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 and 2 of 12 are done (scaffold and
  PostgreSQL, money module). Tasks 3 to 12 (schema and grants, PIN, audit, throttling,
  sessions, HTTPS server, auth routes, approval, acceptance tests) are **paused** until the
  owner has reviewed the frontend. The server has a pool, a migration runner and one
  migration; no schema, no API and no auth.
- **Frontend built** (fixtures plus a client order store): POS-01 lock, POS-02 floor, POS-03
  order workspace, POS-04 settlement, POS-05 closed orders, POS-06 closed order (detail, reprint
  and the refund), POS-07 print incidents. Every designed POS screen is built, bar Release
  (FR-A). Not built: all 13 back-office screens.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green at **2544 tests / 37 files** on 2026-10-02
  on `development` at `9e492e1`, in the kit worktree. `apps/server/test/migrate.test.ts` needs
  `npm run db:up`; without it its seven tests fail with `ECONNREFUSED 127.0.0.1:5433` (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `9e492e1` (PR #42) on
  GitHub; the local `development` matches it (fast-forwarded 2026-10-02). `main` and
  `development` are protected: PR required, 0 approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch`
  and fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting
  or dispatching**: on 2026-10-02 it was 11 commits behind and the lead's first report was wrong.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-10-02 after the last fast-forward). Rerun after any merge that changes
  `.githooks/` or agents.yaml.
- **Lead work happens in the worktree `../restaurant-pos-kit`, on `agent/lead-1002d`** (cut from
  `9e492e1`), **committed and pushed** (owner's word): this file, QUEUE.md and the journal. Until
  the owner merges it, the main checkout's STATE.md is the PR #41 copy, which still says FE-034
  awaits its merge: read the kit worktree's copy, then cut a new lead branch.
- **No task worktree or run directory is left** (removed 2026-10-02 on the owner's word: the
  FE-033 and FE-034 worktrees, `.agent/runs/FE-032/`, `FE-033/` and `FE-034/`). The classifier
  refuses the lead a removal without the owner's word. Untouched, not the lead's: see Live agents.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations` (`735301d`, behind). Merged, still existing: `agent/design-direction`
  (worktree `../restaurant-pos-design`), `agent/design-010`, `agent/fe-030` to `agent/fe-034`, twelve `agent/lead-*`.

## Running tasks and agents

- **No task is running and none is written.** FE-034 (`sendPending` in `fire.ts`, the
  `unavailable` close refusal pinned, the jsdom line gone) merged 2026-10-02 as PR #42. Its task
  file holds the Handoff, both lead verifies and the review (one finding, fixed in cycle 1).
- **The owner asked how to review the frontend** and was given the steps (journal 2026-10-02,
  wrap-up). The owner has not said the review is done or what it found.
- **FE-032's open acceptance criteria:** AC-11, AC-14, AC-18, AC-25 and AC-34: the refund is an
  in-memory stand-in (DECISIONS.md, 2026-10-01). FE-032's Handoff lists what the server owes.
- **Live agents:** the lead only (`w2:p1`); no dev server runs. Leftovers the lead did not
  make: agentless pane `w2:pE` (not re-checked); worktree `.claude/worktrees/keen-chebyshev-ccf255`.

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
- **Browser walks** (how, the three traps, and switching a fixture state without losing the
  book) are in journal 2026-10-02. Codex reviewers cannot open a browser.
- Designers and architects are not dispatched: open their pane by hand with the model passed
  explicitly. Worked examples: a Codex designer, DESIGN-010 (journal 2026-09-30); a read-only
  Claude architect consult, ARCH-003 (journal 2026-10-01, the exact launch line).
- **YAML 1.1 reads `caveman: off` as `false`.** **`--model <m>`** swaps the model for one run on
  the same CLI. Owner's `~/.claude/settings.json` defaults to `auto`; workers override it, and
  its classifier refuses the lead a `git worktree remove` or `rm -rf` unless the owner asked.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the
  Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **P3, left out of FE-034 on purpose** (QUEUE 8c, 8d): a reopened book-only order lands on
  `?state=default`, Table 1's fixture (waits on server order ids); a quick sale holding an 86'd
  pending line refuses Close silently and `settlement.html` draws no such state (a designer's);
  *Nothing outstanding* appears twice when every incident is cleared (a designer's).
- **Housekeeping:** Prettier ruled by the lead 2026-10-02: no formatter (AGENTS.md); Release waits on `FR-A`.
- **Must not become a guarantee:** `OrderLine.itemId` is optional, so a line with no identity
  can never block a fire (L1787). The in-memory refund and the change walk are stand-ins too.
- **Backend traps for tasks 3 to 12:** parallel server test files race one database (leaning
  `fileParallelism: false`, unruled); the append-only grant test must connect as `pos_app`, not
  the superuser default (L2789-2803); brand `Rate`, leave `Money` as `bigint` (L2685-2694).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **What runs next:** the B-5 `closeOrder` task (QUEUE 8b; money, architect consult first), the
  designer's items (8c) or the back-office design audit (9)? Your frontend review outranks them.
- **Merge `agent/lead-1002d`** (pushed). The Prettier ruling, merged, is yours to overturn (a
  config and one formatting commit is the other way).
- **FE-033's lead rulings, merged, yours to overturn:** a live Close stays on the plain floor
  and never shows the receipt chip (no printer in the client); a quick sale with no line is not
  on the strip, and one the book holds is listed on every state but `loading` and `error`; a new
  sale resumes at `?state=quick-new`; a sale being paid keeps the strip's ordinary words.
- **Earlier lead rulings, yours to overturn.** FE-031: an unknown book id draws `error`, never
  a fixture; a voided line is not listed as charged; the cash contribution is cash less change.
  FE-032: a cancelled refund sheet discards its draft; a refund confirmed on a fixture address
  keeps the artifact's `20:31`. FE-030 (builder readings): session closes list above all fixture
  rows by real instant; the time filter accepts a three-digit entry shown as `08:00`.
- **Kit:** add `Bash(grep:*)` to the builder allowlist? Should the dispatcher ping the lead on
  `BLOCKED ON APPROVAL`? Do builders stay interactive by default (`roles.builder.mode`)? Should
  `/lead` fetch and fast-forward before its report (the stale report of 2026-10-02)?
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

- **`floor.html:48` still draws the `dayclosed` header as *closed · 25 Sep***; the build follows the 2026-09-30
  ruling. Owed to the designer, with two strip questions (a sale being paid; telling equal sales apart).
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **The two Frost back-office artifacts link to the wireframe 51 times**; owed to the
  back-office design task (QUEUE 9). The POS artifacts are clean since DESIGN-009.

## Next up

[QUEUE.md](QUEUE.md): 8b (B-5), 8c (the designer's items) or the back-office design audit (9), on the owner's word; backend after the frontend review.
