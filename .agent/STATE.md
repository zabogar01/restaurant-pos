# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-06: the owner merged PHASE0-003b (PR #51) and the lead's record (PR #52). The lead
fast-forwarded to `d7384a7`, ran `db:up`, verified green, removed 003b's worktree, dispatched
PHASE0-003c, and started DESIGN-012 (slice A). Narrative: [journal/2026-10-06.md](journal/2026-10-06.md).

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
- **Last verify by the lead:** `npm run verify` green at **2737 tests / 45 files** on 2026-10-06 on
  `development` at `d7384a7`, main checkout, after `npm run db:up` (now compose with `db/dev.env`, then
  provision `pos_app` and `pos_test`). Server tests need the database up.

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `d7384a7` (PR #52) on
  GitHub; the local `development` matches it (fast-forwarded 2026-10-06). `main` and
  `development` are protected: PR required, 0 approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch`
  and fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting
  or dispatching**: on 2026-10-02 it was 11 commits behind and the lead's first report was wrong.
- **Guard hooks** are installed in the shared `.git/hooks` with an `agents.yaml` snapshot,
  current (checked 2026-10-06 after the last fast-forward). Rerun after any merge that changes
  `.githooks/` or agents.yaml.
- **Lead work happens in `../restaurant-pos-kit` on `agent/lead-1006`** (cut from `d7384a7`), not pushed.
  `agent/phase0-003b` (PR #51) and `agent/lead-1005b` (PR #52) merged 2026-10-06; 003b's worktree and run dir removed.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations` (`735301d`, behind). Merged, still existing: `agent/design-direction`
  (worktree `../restaurant-pos-design`), `agent/design-010`, `agent/fe-030` to `agent/fe-036`, fourteen `agent/lead-*`.

## Running tasks and agents

- **ARCH-006 done** (`.agent/reviews/ARCH-006-phase0-core-schema.md`): the plan's Task 3
  SQL contradicts the architecture in 12 places (3 boundaries: null audit actor B-13, app pool is a
  superuser, mutable settings). Task 3 is split: **003a** `Rate` brand; **003b** serial server tests on
  `pos_test`, advisory lock, provisioned `pos_app`, pool split, no credential in source; **003c** the
  schema, from ARCH-006's four migrations and 21 test cases, cut after 003b merges.
- **003a and 003b merged** (PRs #50, #51). **PHASE0-003c complete** at `33769d0`, not pushed: one round, Codex review
  clean, lead verify 46/2758, schema test alone 21/21, `pos` holds 0001-0005 (owner-approved migrate). Owner's look before merge.
- **DESIGN-011 done** (audit; nine slices A-I). **The owner handed the design to the lead** (2026-10-06, no external
  tool). **DESIGN-012 (slice A) complete** at `c20c56d`, not pushed: 9 review findings closed in round 2 (`9931a8f`), 3 new lows
  carried to slice B; 216/216 browser checks, 47 states; lead verify 45/2737; owner's look before merge; worktree
  `../restaurant-pos-wt/DESIGN-012` on `agent/design-012`; opened by hand (journal 2026-10-05 launch line).
  Lead rulings in its file: M-6 credential drawn as *Password* (Q4 open); day shown by its opening WIB date (Q2 open).
- Merged: FE-036 (the void, PR #48), FE-035 (PR #45), FE-034 (PR #42). The frontend review is complete.
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
- Designers and architects are opened by hand (launch lines: ARCH-003 journal 2026-10-01; Codex designer, journal 2026-10-05).
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
- **Backend:** ARCH-006 §8 lists plan defects in Tasks 4-10; every later Phase 0 file is written against it.

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **ARCH-006 lead rulings, yours to overturn:** Task 3 split in three; no `settings_version` until
  Phase 1; session cookie carries a token stored only as its SHA-256; outcomes `APPROVAL_FAILED`/
  `APPROVAL_CANCELLED`; an append-only trigger on `audit_entry` for every role; app role INSERT-only on evidence.
- **ARCH-006 for the owner** (none blocks 003): a cashier's approval refused by the cooldown is audit,
  security event, or both (before plan Task 10)? Does the failure count reset when a cooldown ends
  (Task 6)? Kitchen staff as records (Phase 1)? A deactivated user's PIN reusable? Commission ADR-008?
- **DESIGN-011 for the owner:** Q3's eight-hour half; Q4 the MVP credential (M-6 drawn as *Password*; does another manager's valid one count as a LOGIN failure?)
  and first-manager bootstrap; Q5 out of scope (blocks nothing, lead); Q7 report-print failure: BO-13 or report only? Q8 ruled (lead, delegated).
- **"go" read as accepting both** the void's (2026-10-03) and Phase 0's (designer alongside) recommendations.
- **FE-036 lead rulings, yours to overturn:** a client-voided line shows only its strike-through; the
  sheets keep *A cancellation ticket will print* and *recorded against your name*.
- **ARCH-005, before Phase 2:** how a cashier abandons an opened order with no lines (Void order is off
  on it; on the server it blocks end-of-day, FR-I2); does an approved void the server refuses write `REFUSED`?
- **Earlier lead rulings, yours to overturn:** FE-030 to FE-033's, listed in journal 2026-10-05 (end).
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
- **Confirm or reject the eight `conversation only` lines** in DECISIONS.md (POS-03 Q5, Q6, Q9 among them).

## Live conflicts

- **`floor.html:48` still draws the `dayclosed` header as *closed · 25 Sep***; the build follows the 2026-09-30
  ruling. Owed to the designer, with two strip questions (a sale being paid; telling equal sales apart).
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.
- **Business day (DESIGN-011 Q2), contract text, owner's:** PRD §9 and DECISIONS 2026-09-24 say 00:00-23:59
  WIB; FR-I1/I3 and the inventory say the close opens the next day. **I-8 audited** (DECISIONS) but
  SCREEN-INVENTORY `:845-848`, `:991` still say open: owed to design slice C. 51 wireframe links: slices.

## Next up

[QUEUE.md](QUEUE.md): owner looks at and pushes/merges PHASE0-003c and DESIGN-012; then PHASE0-004 (PIN), from ARCH-006 §8;
next design slice: C (BO-13), D, F or I, ready now; B, E, G, H wait on the owner's Q2, Q4 and Q7.
