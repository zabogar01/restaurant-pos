# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-05: the owner merged FE-036, the void (PR #48), and the lead's record (PR #47). The lead
fast-forwarded the main checkout to `31483c2`, verified it green and, on the owner's word, removed
FE-036's worktree and run directory. Narrative: [journal/2026-10-05.md](journal/2026-10-05.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 and 2 of 12 are done (scaffold and
  PostgreSQL, money module). Tasks 3 to 12 (schema and grants, PIN, audit, throttling,
  sessions, HTTPS server, auth routes, approval, acceptance tests) **resumed** on the owner's
  word 2026-10-05 (DECISIONS.md), task 3 first. The server has a pool, a migration runner and
  one migration; no schema, no API and no auth.
- **Frontend built** (fixtures plus a client order store): POS-01 lock, POS-02 floor, POS-03
  order workspace, POS-04 settlement, POS-05 closed orders, POS-06 closed order (detail, reprint
  and the refund), POS-07 print incidents. Every designed POS screen is built, bar Release
  (FR-A). Not built: all 13 back-office screens.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green (exit 0) at **2722 tests / 41 files** on
  2026-10-05 on `development` at `31483c2`, in the main checkout. `apps/server/test/migrate.test.ts` needs
  `npm run db:up`; without it its seven tests fail with `ECONNREFUSED 127.0.0.1:5433` (L6-14).

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `31483c2` (PR #48) on
  GitHub; the local `development` matches it (fast-forwarded 2026-10-05). `main` and
  `development` are protected: PR required, 0 approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch`
  and fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting
  or dispatching**: on 2026-10-02 it was 11 commits behind and the lead's first report was wrong.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-10-05 after the last fast-forward). Rerun after any merge that changes
  `.githooks/` or agents.yaml.
- **Lead work happens in the worktree `../restaurant-pos-kit`, on `agent/lead-1005`** (cut from
  `31483c2`), **not committed**: this file, QUEUE, journal 2026-10-05.
- **No task worktree or run directory is left** (FE-036's removed 2026-10-05, owner's word).
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations` (`735301d`, behind). Merged, still existing: `agent/design-direction`
  (worktree `../restaurant-pos-design`), `agent/design-010`, `agent/fe-030` to `agent/fe-036`, fourteen `agent/lead-*`.

## Running tasks and agents

- **No task is running and none is written.** Merged: FE-036 (the void, PR #48, 2026-10-05; built
  from ARCH-005, both fix cycles used), FE-035 (discount, PR #45), FE-034 (PR #42). Each task file
  holds its Handoff, lead verifies and review.
- **The owner's frontend review is complete** now that the void is merged (DECISIONS.md,
  2026-10-03); the backend pause lifted 2026-10-05. Next: PHASE0-003's task file, then dispatch.
- **Open ACs (stand-ins, server owes them):** FE-032 refund AC-11/14/18/25/34; FE-035 discount
  AC-8/9/18/21; FE-036 void AC-3/10/11/18/21/22.
- **Live agents:** the lead (`w2:p1`) only. No lead dev server. Not the lead's: agentless pane
  `w2:pE`; worktree `.claude/worktrees/keen-chebyshev-ccf255`.

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

- **The lead read "okay start working on the void" as accepting both void recommendations**
  (the stand-in; a voided order listed nowhere): recorded in DECISIONS.md, yours to overturn.
- **FE-036 lead rulings, yours to overturn (ARCH-005, For the owner 1-2):** a line voided in the client
  shows only its strike-through (no *Voided 19:51*); the sheets keep the reviewed *A cancellation ticket
  will print* and *recorded against your name*, though the client prints and records nothing.
- **ARCH-005, before Phase 2:** how a cashier abandons an opened order with no lines (Void order is off
  on it; on the server it blocks end-of-day, FR-I2); does an approved void the server refuses write `REFUSED`?
- **FE-033's lead rulings, yours to overturn:** live Close lands on the plain floor, no receipt chip; an
  empty quick sale is off the strip; a new sale resumes at `?state=quick-new`; a paying sale keeps plain words.
- **Earlier lead rulings, yours to overturn:** FE-031 (unknown book id draws `error`; voided line not
  charged; cash contribution is cash less change); FE-032 (cancelled refund discards its draft; fixture
  refund keeps `20:31`); FE-030 (session closes list first by instant; `800` reads `08:00`).
- **Kit:** add `Bash(grep:*)` to the builder allowlist? Should the dispatcher ping the lead on
  `BLOCKED ON APPROVAL`? Do builders stay interactive by default (`roles.builder.mode`)? Should
  `/lead` fetch and fast-forward before its report (it was 13 behind on 2026-10-05)? Builders edit
  by `python3` heredoc against their rule (two owner prompts on FE-036): allow it, or say so in the prompt?
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

[QUEUE.md](QUEUE.md): Phase 0 task 3 (schema and grants), owner's go 2026-10-05, with the designer on
the back-office audit (9) alongside; 8b and 8g (store guards) can follow as a small money task.
