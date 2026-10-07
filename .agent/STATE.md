# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-07, afternoon: the owner merged PHASE0-006 (PR #61) and the lead's record (PR #62); `development`
at `20ae39e`. PHASE0-006b (PIN unique among active staff) dispatched; ARCH-008 (sessions and the
back-office credential) running. Narrative: [journal/2026-10-07.md](journal/2026-10-07.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 to 6 of 12 are done: scaffold and PostgreSQL,
  money module, Task 3 in three slices (003a `Rate` brand, 003b serial test harness with an
  unprivileged `pos_app` pool, 003c the six-table schema with append-only audit), and Task 4 (PIN:
  Argon2id hash, keyed lookup digest under `PIN_PEPPER`, `findUserByPin` returning the credential
  version), and Task 5 (`audit.ts`: `writeAudit`, `writeAuditOwnTransaction`, `writeSecurityEvent`). Task 6 (`throttle.ts`: `verifyPinThrottled` under a row lock). Tasks 7 to 12 ( sessions, HTTPS server, auth routes, approval,
  client shells, acceptance tests) remain. No API and no auth routes yet.
- **Frontend built** (fixtures plus a client order store): POS-01 to POS-07, every designed POS
  screen, bar Release (FR-A). Not built: all 13 back-office screens.
- **Back-office design:** slice A (DESIGN-012: frame, alerts, M-6, patterns) and slice C (DESIGN-013:
  BO-13 print incidents, 41 states) drawn in Frost. BO-03, BO-11 in older Frost; ten are greyscale.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green at **2780 tests / 47 files** on 2026-10-06 on
  `development` at `c507dfc`, main checkout, after `npm ci`. Server tests need `npm run db:up`
  (compose from `db/dev.env`, then provision `pos_app` and `pos_test`). The dev database `pos` holds 0001-0005.

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `20ae39e` (PR #61) on
  GitHub; the local `development` matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch`
  and fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting
  or dispatching**, then `npm ci` if the lockfile changed (LESSONS).
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-10-06 at `c507dfc`). Rerun after any merge that changes `.githooks/` or agents.yaml.
- **Lead work happens in `../restaurant-pos-kit` on `agent/lead-1007b`** (from `20ae39e`), not pushed.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations` (`735301d`, behind). Merged, still existing: `agent/design-direction`
  (worktree `../restaurant-pos-design`), `agent/design-010`, `-012`, `-013`, `agent/fe-030` to
  `agent/fe-036`, `agent/phase0-003a` to `003c`, `agent/phase0-004`, and the `agent/lead-*` branches.

## Running tasks and agents

- **PHASE0-006b (PIN unique among active staff) complete** at its last commit on `agent/phase0-006b`, not
  pushed: one round, Codex review clean. Migration `0006` (partial unique index) and the conflict clause;
  lead verify 49/2844. Identity: owner looks. **After merge, run `npm run db:migrate` on the dev `pos`.**
- **ARCH-008 running:** Opus `architect8` in pane `w2:p4A`, kit cwd, read-only, brief
  `.agent/tasks/ARCH-008-sessions.md`, report `.agent/reviews/ARCH-008-sessions.md`. Plan Task 7 (sessions)
  and the back-office username/password the owner ruled 2026-10-06 (no schema holds it; may need PRD wording).
- **Task 10's consult must add** an audit outcome for a cooldown-refused approval (none of the three fits).
- **Codex reset** (owner, 2026-10-07): reviews go back to the default pick. If Codex runs out again, the
  temporary OpenCode pick in journal 2026-10-07 is the way; the kit question stands.
- **Before plan Tasks 6, 7 and 10:** an architect consult each (ARCH-006 §8 found defects in all
  three). The owner's answers are in (DECISIONS 2026-10-06: cooldown refusal is audit; count resets).
- **PIN reuse (DECISIONS 2026-10-06) conflicts with the schema:** `0002_staff_user.sql:29` makes
  `pin_lookup` unique across every row, deactivated included. Needs a forward migration (unique only
  among active users) and a lookup that ignores inactive rows: give it to a Phase 0 task, not a new one.
- **Next design task: any of slices B, D, E, F, G, H, I** — Q2, Q4, Q7 are ruled. Slice B must take
  DESIGN-012's lows N1-N3 first (its task file, end); M-6 becomes password-only plus "another manager".
  Each slice consumes `office.css`/`office.js` and repoints only the wireframe links it replaces.
- **The BO-13 frontend task** carries DESIGN-013's rules N1, N2 and the async-focus rule (its task file).
- **Open ACs (stand-ins, server owes them):** FE-032 refund AC-11/14/18/25/34; FE-035 discount
  AC-8/9/18/21; FE-036 void AC-3/10/11/18/21/22.
- **Live agents:** the lead (`w2:p1`) and `architect8` (`w2:p4A`); worktree `../restaurant-pos-wt/PHASE0-006b` awaits merge. Not the lead's: pane `w2:pE`, `.claude/worktrees/keen-chebyshev-ccf255`.

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then without it in the background
  (the `/dispatch` skill), from `../restaurant-pos-kit`, where an undispatched task file lives
  untracked (delete that copy once dispatched). The worktree is cut from the **local** `development`.
- **A permission prompt does not wake the lead:** after every dispatch or resume, run in the
  background: wait until `herdr agent get <id>` says `working`, then `herdr agent wait <id> --until
  blocked`; re-arm after each prompt. Only the owner answers. A queued Codex question keeps the
  agent `blocked`: watch `herdr pane read` instead.
- **`max_fix_cycles` is 2:** two `--resume` rounds, whatever their cause; a third goes to the owner.
- **Codex is the only reviewer for a Claude-built task** and shares one five-hour allowance with the
  Codex designer; `/status` in a Codex pane shows the reset. Reviewers write only their report (LESSONS).
- **Tests expected to change: grep first**; the explorer is a cross-check only.
- **Designers are opened by hand** (Codex launch, resume by session id, OpenCode stand-in, handover
  notes, the loopback walk server: journal 2026-10-06, *Designer how-to*). Write the run's
  `meta.json` (`cli: codex`) before the review; close each designer pane when its round ends (owner).
  Codex's browser checks, `git add` and `git commit` each need the owner's approval in its pane.
- Architect launch line: journal 2026-10-01. POS browser-walk traps: journal 2026-10-02.
- **YAML 1.1 reads `caveman: off` as `false`.** **`--model <m>`** swaps the model for one run on
  the same CLI. The owner's `auto` classifier may refuse the lead `git worktree remove` or `rm -rf`
  unless the owner asked; after a merge the owner expects the cleanup.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the
  Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** ARCH-006 §8 lists plan defects in Tasks 5-10. `session_replication_role` (superuser
  only) bypasses the append-only trigger: for ADR-008's wording.

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **PRD wording owed, not yet drafted** for the other 2026-10-06 rulings that touch the contract:
  username and password with M-6's other-manager option (FR-A2b), report-print failure placement,
  void `REFUSED` and abandoned approval as cancelled (FR-J3, AC-18), empty order cancelled, no rate
  range (§9 question 3), post-close corrections by adjustment in the open day (§9 question 2).
- **PRD §9 question 1, receipt content:** the owner asked the lead to research the usual content of an
  F&B receipt in Indonesia and propose it. Not started; a librarian task, one step at a time.
- **Lead rulings, yours to overturn:** PHASE0-004 (Argon2id m=19456,t=2,p=1 in code; no `zod` until
  Task 8; `PIN_PEPPER` in `db/dev.env`); DESIGN-013 (reprint ungated, no audit wording on results,
  three re-review lows carried rather than a third round); DESIGN-012 (wireframe links until each
  slice lands, lows to slice B); ARCH-006 (Task 3 split; no `settings_version` until Phase 1; session
  token stored as SHA-256; `APPROVAL_FAILED`/`APPROVAL_CANCELLED`; append-only trigger for every role;
  app role INSERT-only on evidence); FE-036 (strike-through only; sheet copy kept); FE-030 to FE-033's
  (journal 2026-10-05, end); DESIGN-011 Q5 and Q8.
- **Kit:** add `Bash(grep:*)` to the builder allowlist? Should the dispatcher ping the lead on
  `BLOCKED ON APPROVAL`? Builders interactive by default? Should `/lead` fetch and fast-forward
  before its report? Allow builders' `python3`/`sed` edits (FE-036, PHASE0-004 twice)? Should the
  dispatcher support a hand-opened designer, and a non-Codex reviewer when Codex is out?
- **Pre-production gate, owner-accepted risk (DECISIONS 2026-10-07):** the same-class reset lets a cashier
  guess four PINs, log in as themselves and repeat. Revisit before any networked use.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero. Proposed at L2699-2701.
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md (POS-03 Q5, Q6, Q9 among them).

## Live conflicts

- **`floor.html:48` still draws the `dayclosed` header as *closed · 25 Sep***; the build follows the 2026-09-30
  ruling. Owed to the designer, with two strip questions (a sale being paid; telling equal sales apart).
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.

## Next up

Verify and review PHASE0-006b; read ARCH-008 and write PHASE0-007 (sessions) from it. Design slice I
(BO-12) on Codex when the owner says go. Draft owed PRD wording one item at a time; receipt research after.
