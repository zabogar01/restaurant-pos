# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-06, wrap-up: the owner merged PHASE0-003c (PR #53), the lead's record (PR #54) and
DESIGN-012 (PR #55). The lead fast-forwarded to `2ee2285`, verified green, removed both worktrees
and run directories, and cut `agent/lead-1006b`. Narrative: [journal/2026-10-06.md](journal/2026-10-06.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 to 3 of 12 are done: scaffold and PostgreSQL,
  money module, and Task 3 in three slices (003a `Rate` brand, 003b serial test harness on
  `pos_test` with an unprivileged `pos_app` pool, 003c the six-table schema with append-only
  audit). Tasks 4 to 12 (PIN, audit writer, throttling, sessions, HTTPS server, auth routes,
  approval, client shells, acceptance tests) remain; resumed by the owner 2026-10-05. The server
  has a pool, a migration runner and migrations 0001-0005; no API and no auth yet.
- **Frontend built** (fixtures plus a client order store): POS-01 to POS-07, every designed POS
  screen, bar Release (FR-A). Not built: all 13 back-office screens.
- **Back-office design:** shared frame, alerts, M-6 and patterns drawn (DESIGN-012); BO-03, BO-11
  in older Frost; the other eleven are greyscale wireframes.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green at **2758 tests / 46 files** on 2026-10-06 on
  `development` at `2ee2285`, main checkout. Server tests need `npm run db:up` (compose from
  `db/dev.env`, then provision `pos_app` and `pos_test`). The dev database `pos` holds 0001-0005.

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `2ee2285` (PR #55) on
  GitHub; the local `development` matches it (fast-forwarded 2026-10-06). `main` and
  `development` are protected: PR required, 0 approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch`
  and fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting
  or dispatching**: on 2026-10-02 it was 11 commits behind and the lead's first report was wrong.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-10-06 after the last fast-forward). Rerun after any merge that changes
  `.githooks/` or agents.yaml.
- **Lead work happens in `../restaurant-pos-kit` on `agent/lead-1006b`** (cut from `2ee2285`), holding
  this wrap-up, not pushed. `agent/lead-1006` merged as PR #54.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations` (`735301d`, behind). Merged, still existing: `agent/design-direction`
  (worktree `../restaurant-pos-design`), `agent/design-010`, `agent/design-012`, `agent/fe-030` to
  `agent/fe-036`, `agent/phase0-003a` to `003c`, and the `agent/lead-*` branches.

## Running tasks and agents

- **Nothing is running.** No task worktree exists under `../restaurant-pos-wt/`; `.agent/runs/` is empty.
- **Next backend task: PHASE0-004** (PIN hashing and lookup, plan Task 4), not written. Write it from
  the plan, ARCH-006 §8 item 1 (no credential default in `config.ts`; `findUserByPin` returns the
  credential version) and PHASE0-003c's Handoff (tests reset with `resetDatabase()`, never `DELETE`;
  `pos_app` cannot read the evidence tables, so no `RETURNING` from them). Touches identity: the
  architect consult is ARCH-006; the owner looks before merge.
- **Before plan Tasks 6, 7 and 10:** an architect consult each (ARCH-006 §8 found defects in all
  three), and the owner's answers on the cooldown-refused approval and the post-cooldown count.
- **Next design task: slice C (BO-13, print incidents)**, the lead's pick, not written; D, F and I
  are also ready. Each slice gets DESIGN-011's audit excerpt for its screens, consumes DESIGN-012's
  `office.css`/`office.js` frame and patterns, and repoints only the wireframe links it replaces.
  Slice B (BO-01, 02) must take DESIGN-012's three lows N1-N3 as first items (its task file, end).
- **Open ACs (stand-ins, server owes them):** FE-032 refund AC-11/14/18/25/34; FE-035 discount
  AC-8/9/18/21; FE-036 void AC-3/10/11/18/21/22.
- **Live agents:** the lead only. Not the lead's: pane `w2:pE`, worktree `.claude/worktrees/keen-chebyshev-ccf255`.

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then without it in the background
  (the `/dispatch` skill), from `../restaurant-pos-kit`, where an undispatched task file lives
  untracked (delete that copy once dispatched). The worktree is cut from the **local** `development`.
- **A permission prompt does not wake the lead:** the dispatcher prints `BLOCKED ON APPROVAL`
  and keeps waiting. After every dispatch or resume, run in the background: wait until
  `herdr agent get <id>` says `working`, then `herdr agent wait <id> --until blocked`; re-arm after
  each prompt. Only the owner answers. A queued Codex question keeps the agent `blocked`, so
  watch `herdr pane read` for a new commit or prompt instead.
- **`max_fix_cycles` is 2:** two `--resume` rounds, whatever their cause; a third goes to the owner.
- **Tests expected to change: grep first**; the explorer is a cross-check only.
- **Designers are opened by hand** (Codex launch, resume, OpenCode stand-in, usage limits, handover
  notes, the loopback walk server: journal 2026-10-06, *Designer how-to*). Write the run's
  `meta.json` before the review (LESSONS); close each designer pane when its round ends (owner).
- Architect launch line: journal 2026-10-01. POS browser-walk traps: journal 2026-10-02.
- **YAML 1.1 reads `caveman: off` as `false`.** **`--model <m>`** swaps the model for one run on
  the same CLI. The owner's `auto` classifier may refuse the lead `git worktree remove` or `rm -rf`
  unless the owner asked; after a merge the owner expects the cleanup.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the
  Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **P3, left out of FE-034 on purpose:** QUEUE 8c and 8d.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** ARCH-006 §8 lists plan defects in Tasks 4-10. `session_replication_role` (superuser
  only) bypasses the append-only trigger: for ADR-008's wording.

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **DESIGN-011:** Q2 business day (contract wording proposed: close to close, named by the WIB date
  it opened); Q4 the MVP back-office credential (M-6 drawn as *Password*, four strings in
  `shell.js`'s `credentialCopy`) and first-manager bootstrap, plus: does another manager's valid
  credential typed into M-6 count as a LOGIN failure?; Q7 report-print failure: BO-13 or report
  screen only?; Q3's eight-hour half (to Login, draft kept locally, never resent). Q5 out of scope
  and Q8 ruled by the lead, yours to overturn.
- **ARCH-006 lead rulings, yours to overturn:** Task 3 split in three; no `settings_version` until
  Phase 1; session token stored only as its SHA-256; outcomes `APPROVAL_FAILED`/`APPROVAL_CANCELLED`;
  an append-only trigger on `audit_entry` for every role; app role INSERT-only on evidence.
- **ARCH-006 for the owner:** a cashier's approval refused by the cooldown is audit, security event,
  or both (before plan Task 10)? Does the failure count reset when a cooldown ends (Task 6)? Kitchen
  staff as records (Phase 1)? A deactivated user's PIN reusable? Commission ADR-008?
- **DESIGN-012 lead rulings, yours to overturn:** nav, *Log out* and alert links stay on wireframes
  until each slice lands; three low findings carried to slice B rather than a third round.
- **FE-036 lead rulings, yours to overturn:** a client-voided line shows only its strike-through; the
  sheets keep *A cancellation ticket will print* and *recorded against your name*.
- **ARCH-005, before Phase 2:** abandoning an opened order with no lines; does a server-refused approved void write `REFUSED`?
- **Earlier lead rulings, yours to overturn:** FE-030 to FE-033's (journal 2026-10-05, end); "go" read as accepting both recommendations.
- **Kit:** add `Bash(grep:*)` to the builder allowlist? Should the dispatcher ping the lead on
  `BLOCKED ON APPROVAL`? Builders interactive by default? Should `/lead` fetch and fast-forward
  before its report? Allow builders' `python3` heredoc edits? Should the dispatcher support a
  hand-opened designer (record its CLI, accept `ui` design tasks)?
- **Before Phase 5 (ARCH-003):** is an abandoned approval prompt a *cancelled approval* (FR-J3, AC-18)? Joins POS-03 Q6.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero. Proposed at L2699-2701.
- **PRD section 9, three questions still open:** receipt content and fiscal requirements
  (blocks Phase 4), post-close corrections (blocks Phase 5), permitted tax and service-charge
  rate range (before Phase 2).
- **Confirm or reject the eight `conversation only` lines** in DECISIONS.md (POS-03 Q5, Q6, Q9 among them).

## Live conflicts

- **`floor.html:48` still draws the `dayclosed` header as *closed · 25 Sep***; the build follows the 2026-09-30
  ruling. Owed to the designer, with two strip questions (a sale being paid; telling equal sales apart).
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **Business day (Q2), contract text, owner's:** PRD §9 and DECISIONS 2026-09-24 say 00:00-23:59 WIB;
  FR-I1/I3, the glossary, ARCHITECTURE §6.6 and the inventory say close to close.
- **I-8 audited** (DECISIONS) but SCREEN-INVENTORY `:845-848`, `:991` and `P/incidents.html:110-113`
  still say open: owed to design slice C.

## Next up

[QUEUE.md](QUEUE.md): write and dispatch PHASE0-004 (PIN); alongside it, write and start design
slice C (BO-13), unless the owner picks D, F or I. B, E, G and H wait on Q2, Q4 and Q7.
