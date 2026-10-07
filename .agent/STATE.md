# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-07, evening: the owner agreed to all of ARCH-008 *For the owner*; the PRD and B-11/B-12 now
say it (`408f707` on `agent/lead-1007c`). DESIGN-014 (slice I, BO-12) and ARCH-009 (the credential
ADR) are running. `development` at `93c6f2c`. Narrative: [journal/2026-10-07.md](journal/2026-10-07.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Backend tasks 1 to 7 of 12 are done, plus 006b:
  scaffold and PostgreSQL; money; schema (003a-c); PIN (`pin.ts`, Argon2id, keyed lookup digest);
  audit (`audit.ts`: `writeAudit`, `writeAuditOwnTransaction`, `writeSecurityEvent`); throttle
  (`throttle.ts`: one `verifyPinThrottled` under a row lock, `clock_timestamp()` after it); PIN unique
  among active staff (migration `0006`); sessions (`session.ts`: token + SHA-256, credential-version
  predicate, required `interactive`, `IDLE`, M-6 renewal). Tasks 8 to 12 (HTTPS server, auth routes,
  approval, client shells, acceptance tests) remain, plus the back-office credential. No API yet.
- **Frontend built** (fixtures plus a client order store): POS-01 to POS-07, every designed POS
  screen, bar Release (FR-A). Not built: all 13 back-office screens.
- **Back-office design:** slice A (DESIGN-012: frame, alerts, M-6, patterns) and slice C (DESIGN-013:
  BO-13 print incidents) drawn in Frost. BO-03, BO-11 in older Frost; ten are greyscale.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green at **2876 tests / 50 files** on 2026-10-07 on
  `development` at `93c6f2c`, main checkout. Server tests need `npm run db:up` (compose from
  `db/dev.env`, then provision `pos_app` and `pos_test`). The dev database `pos` holds 0001-0006.

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `93c6f2c` (PR #65) on GitHub;
  the local `development` matches it. `main` and `development` are protected: PR required, 0
  approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch` and
  fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting or
  dispatching**, then `npm ci` if the lockfile changed, and `npm run db:migrate` if a migration landed.
- **Guard hooks** in the shared `.git/hooks` with an `agents.yaml` snapshot, current (checked
  2026-10-07 at `93c6f2c`). Rerun `install-hooks.sh` after any change to `.githooks/` or agents.yaml.
- **Lead work happens in `../restaurant-pos-kit` on `agent/lead-1007c`** (from `93c6f2c`), not pushed.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations`. Merged, still existing: `agent/design-direction` (worktree
  `../restaurant-pos-design`), `agent/design-*`, `agent/fe-030` to `-036`, `agent/phase0-*`, `agent/lead-*`.

## Running tasks and agents

- **DESIGN-014 (slice I, BO-12 audit viewer) running:** `design014`, Codex `gpt-6-astra` high, pane
  `w2:p4E`, worktree `../restaurant-pos-wt/DESIGN-014` on `agent/design-014` (task file `7f3750e`).
  Three lead rulings on audit amounts (void, line void, discount) there, owner's to overturn.
- **ARCH-009 complete, waiting on the owner:** `cbf3aef` on `agent/arch-009` (worktree
  `../restaurant-pos-wt/ARCH-009`, pane `w2:p4F` kept open for a possible round). ADR-009 Proposed plus
  ARCHITECTURE §2.1/5.1/7.2/7.3/13/16. Handoff: FR-B3 vs own-password ruling, follow-up wording.
- **Live agents:** the lead (`w2:p1`), `design014`, `architect9`. Not the lead's: pane `w2:pE`,
  `.claude/worktrees/keen-chebyshev-ccf255`.
- **Next backend:** the **back-office credential** task, written from ARCH-008 §5 and ADR-009 once
  the owner accepts it; **ARCH-010, the consult for plan Task 8** (HTTPS server, loopback guard,
  client instance), not blocked. Task 9 (auth routes) needs 007 and the credential; Task 10 needs a
  consult that adds an audit outcome for a cooldown-refused approval (ARCH-007 §7).
- **Pattern for identity/audit tasks:** an Opus consult first, then a task file copying its *For the
  task file* sections verbatim. Slice B fixes BO-01 `:548–550`, SITEMAP `:248` (PIN at back office).
- **Carry-forwards for Tasks 8 to 10** are in the Handoffs of PHASE0-005 to 007 (six-digit rule at the
  route, `interactive` per route, `MANAGER` guard, no cookie logging; AC-19/27/28 close only via routes).
- **Design slices left after I: B, D, E, F, G, H.** Slice B takes DESIGN-012's lows N1-N3 first; M-6
  becomes password-only plus "another manager". Each slice repoints only the wireframe links it replaces.
- **The BO-13 frontend task** carries DESIGN-013's rules N1, N2 and the async-focus rule (its task file).
- **Open ACs (stand-ins, server owes them):** FE-032 refund AC-11/14/18/25/34; FE-035 discount
  AC-8/9/18/21; FE-036 void AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with the Bash tool's
  `run_in_background` **and `timeout: 7200000`**, never `&` (LESSONS), from `../restaurant-pos-kit`,
  where an undispatched task file lives untracked (delete that copy once the worktree has it). The
  worktree is cut from the **local** `development`.
- **A permission prompt does not wake the lead:** after every dispatch or resume, run in the
  background: wait until `herdr agent get <id>` says `working`, then `herdr agent wait <id> --until
  blocked`; re-arm after each prompt. Only the owner answers. If the dispatcher dies, the builder
  runs on and still pings the lead; close its pane by hand (`herdr pane close`).
- **`max_fix_cycles` is 2.** A lead ruling for a round goes in the worktree's task file above the
  Handoff, committed there, then `--resume --message`. A test-only or tiny fix may skip a re-review.
- **Codex is the reviewer for a Claude-built task** and shares one five-hour allowance with the Codex
  designer. If it runs out: set `roles.reviewer.pick.anthropic.strong` to `{ cli: opencode, model:
  openai/gpt-6.1-sol, account: openai-b }` for one run, `install-hooks.sh`, dry-run, then restore
  both (journal 2026-10-06 and 2026-10-07). `--profile` is refused for a reviewer; `--model` keeps the CLI.
- **Architects are opened by hand:** `herdr pane split <lead pane> --direction right --cwd <kit> --no-focus`,
  then the launch line in journal 2026-10-01 with `architect<N>`; close the pane when the report lands.
- **Tests expected to change: grep first**; the explorer is a cross-check only.
- **Designers are opened by hand** (journal 2026-10-06, *Designer how-to*). Write the run's
  `meta.json` (`cli: codex`) before the review; close each designer pane when its round ends.
- **Owner-approved contract edits** commit with `ALLOW_CONTRACT=1` plus a DECISIONS line. POS walk traps: journal 2026-10-02.
- **YAML 1.1 reads `caveman: off` as `false`.** After a merge the owner expects the worktree cleanup.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the
  Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** ARCH-006 §8 lists plan defects in Tasks 8-10. `session_replication_role` (superuser
  only) bypasses the append-only trigger: for ADR-008's wording (ADR-008 deferred by the owner).
- **A demoted manager keeps a resolving session** with role `CASHIER` (no version bump on a role
  change); the Task 9 back-office guard must refuse it (PHASE0-007 Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Push `agent/lead-1007c`?** It holds the wrap-up and the owner-approved contract commit `408f707`
  (PRD FR-A1/A2b/A3/A5b/B3, AC-32/35, §6; B-11/B-12; DECISIONS 2026-10-07 evening).
- **ADR-009 acceptance** (ARCH-009 Handoff): accept with amendments? FR-B3 own-password exception;
  cooldown-end reset for passwords (FR-A5/A5b text); AC-35 unknown username; stale §1/3.2/5.1/11/12/
  14.2/16 wording on acceptance. Phase 1: own change needs current password? own PIN reset? role bump?
- **PRD wording owed, not yet drafted,** for 2026-10-06 rulings that touch the contract: report-print
  failure placement, void `REFUSED` and abandoned approval as cancelled (FR-J3, AC-18), empty order
  cancelled, no rate range (§9 question 3), post-close corrections by adjustment (§9 question 2),
  reactivation keeps the PIN unless taken (FR-B3), cooldown-refused approval as an audit entry.
- **PRD §9 question 1, receipt content:** the owner asked the lead to research the usual content of an
  Indonesian F&B receipt and propose it. Not started; a librarian task, one step at a time.
- **Lead rulings, yours to overturn,** each in its task file's *Lead rulings* or round section:
  PHASE0-004 to 007, DESIGN-011 to 013, ARCH-006, FE-030 to FE-036 (FE-030 to 033 in journal 2026-10-05).
- **Kit:** add `Bash(grep:*)` to the builder allowlist? Should the dispatcher ping the lead on
  `BLOCKED ON APPROVAL`? Should `/lead` fetch and fast-forward before its report? Allow builders'
  `python3`/`sed` edits? Should the dispatcher support a hand-opened designer or architect, and a
  reviewer CLI override when Codex is out?
- **Pre-production gate, owner-accepted risk (DECISIONS 2026-10-07):** the same-class reset lets a
  cashier guess four PINs, log in as themselves and repeat. Revisit before any networked use.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero. Proposed at L2699-2701.
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md (POS-03 Q5, Q6, Q9 among them).

## Live conflicts

- **`floor.html:48` still draws the `dayclosed` header as *closed · 25 Sep***; the build follows the
  2026-09-30 ruling. Owed to the designer, with two strip questions (a sale being paid; telling equal
  sales apart).
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.

## Next up

Watch `design014` and `architect9`; route their permission prompts to the owner. When DESIGN-014
lands: verify, browser walk, Opus review (hand-opened designer: write `meta.json` first). When
ARCH-009 lands: read, take ADR-009 to the owner. Then ARCH-010 (Task 8 consult).
