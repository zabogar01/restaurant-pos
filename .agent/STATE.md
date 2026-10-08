# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-08, evening: the owner merged PHASE0-007b (PR #69) and the lead's record (PR #70);
`development` at `d0865bf`. ARCH-010 (Task 8 consult) done; PHASE0-008a dispatched.
Narrative: [journal/2026-10-08.md](journal/2026-10-08.md) (the evening before is in 2026-10-07.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Tasks 1 to 7 of 12 done, plus 006b and 007b: scaffold, money,
  schema (003a-c), PIN, audit, throttle, PIN unique among active staff (`0006`), sessions, and the
  back-office credential (`0007`, per-account throttle, `create-manager`). Tasks 8 to 12 (HTTPS
  server, auth routes, approval, client shells, acceptance tests) remain. No API yet.
- **Back-office credential decided:** username and password in the PRD and B-11/B-12, and **ADR-009
  Accepted 2026-10-08** with its ARCHITECTURE amendments. Eight accepted ADRs; ADR-008 stays reserved.
- **Frontend built** (fixtures plus a client order store): POS-01 to POS-07, every designed POS
  screen, bar Release (FR-A). Not built: all 13 back-office screens.
- **Back-office design in Frost:** slice A (DESIGN-012: frame, alerts, M-6, patterns), slice C
  (DESIGN-013: BO-13 print incidents) and slice I (DESIGN-014: BO-12 audit viewer, 24 states).
  BO-03, BO-11 in older Frost; nine are greyscale.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Kit rollout done** (owner, 2026-09-29): KIT-001 to KIT-005 and the pilot FE-029 accepted.
- **Last verify by the lead:** `npm run verify` green at **2911 tests / 51 files** on 2026-10-08 on
  `development` at `d0865bf`, main checkout. Server tests need `npm run db:up` (compose from
  `db/dev.env`, then provision `pos_app` and `pos_test`). The dev database `pos` holds 0001-0007.

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `d0865bf` (PR #69) on GitHub;
  the local `development` matches it. `main` and `development` are protected: PR required, 0
  approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch` and
  fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting or
  dispatching**, then `npm ci` if the lockfile changed, and `npm run db:migrate` if a migration landed.
- **Guard hooks** in the shared `.git/hooks` with an `agents.yaml` snapshot, current (checked
  2026-10-08 at `d0865bf`). Rerun `install-hooks.sh` after any change to `.githooks/` or agents.yaml.
- **Lead work happens in `../restaurant-pos-kit` on `agent/lead-1008b`** (from `d0865bf`), not pushed.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations`. Merged, still existing: `agent/design-direction` (worktree
  `../restaurant-pos-design`), `agent/design-*`, `agent/arch-009`, `agent/fe-030` to `-036`,
  `agent/phase0-*`, `agent/lead-*`.

## Running tasks and agents

- **ARCH-010 done** (report uncommitted on lead-1008b): Task 8 split into 008a and 008b (Host/origin
  guard, `rpos_cid` cookie); recommends ADR-010; Task 9 consult still owed (its §10 lists the scope).
- **PHASE0-008a complete** at `95ccf8b` on `agent/phase0-008a`: three rounds; lead verify 56/3005; the
  final review's absolute-form 404 finding carried to 008b by the owner. PR pending (owner: push all).
- **ADR-010 accepted** (owner, 2026-10-08), status and §18 applied on `agent/arch-011` (`ARCH-011` complete,
  worktree `../restaurant-pos-wt/ARCH-011`). The §16 certificate-row wording was not ruled.
- **Live agents:** the lead (`w2:p1`) only. 008b's task file is drafted, untracked in the kit. Not the lead's: pane `w2:pE`, `.claude/worktrees/keen-chebyshev-ccf255`.
- **Next:** PHASE0-008b from ARCH-010 after 008a (browser cookie check by the lead, Chrome and Safari);
  the Task 9 consult can run beside 008b; ADR-010 if the owner commissions it.
- **Carry-forwards for Tasks 8 to 10** are in the Handoffs of PHASE0-005 to 007b (six-digit rule at the
  route, `interactive` per route, `MANAGER` guard, no cookie logging; AC-19/27/28 close only via routes).
- **Design slices left: B, D, E, F, G, H.** B takes DESIGN-012's N1-N3, M-6 password-only plus "another
  manager", and BO-01 `:548–550`/SITEMAP `:248` (still a PIN at the back office). The users screen
  warns that a PIN or password reset ends all that manager's sessions (ADR-009).
- **Frontend tasks carry design rules** from each design task's last lead ruling: BO-13 DESIGN-013's
  N1, N2, async focus; BO-12 DESIGN-014's C1 and standard density at any length.
- **Open ACs (stand-ins, server owes them):** FE-032 refund AC-11/14/18/25/34; FE-035 discount
  AC-8/9/18/21; FE-036 void AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with the Bash tool's
  `run_in_background` **and `timeout: 7200000`**, never `&` (LESSONS), from `../restaurant-pos-kit`,
  where an undispatched task file lives untracked (delete that copy once the worktree has it). The
  worktree is cut from the **local** `development`. A review needs task status `review` or `active`.
- **A permission prompt does not wake the lead:** after every dispatch or resume, run in the
  background: wait until `herdr agent get <id>` says `working`, then `herdr agent wait <id> --until
  blocked`; re-arm after each prompt. Only the owner answers. A background wait dies at its two-hour
  limit; re-arm it. If the dispatcher dies, the worker runs on; close its pane by hand.
- **`max_fix_cycles` is 2.** A lead ruling for a round goes in the worktree's task file above the
  Handoff, committed there, then `--resume --message`. A test-only or tiny fix may skip a re-review.
- **Codex reviews Claude-built tasks** and shares one five-hour allowance with the Codex designer; if
  it runs out, the OpenCode stand-in is in journal 2026-10-07. Opus reviews Codex-built work.
- **Architects are opened by hand:** `herdr pane split <lead pane> --direction right --cwd <wt> --no-focus`,
  then the launch line in journal 2026-10-01 with `architect<N>` (add `Bash(git add:*)`, `git commit`,
  `git diff`, `git status` when it commits); close the pane when the work is accepted.
- **Designers are opened by hand** (journal 2026-10-06, *Designer how-to*); a fresh worktree needs
  `npm ci`; write `.agent/runs/<ID>/builder/meta.json` (`cli: codex`) in the main checkout before review.
- **Tests expected to change: grep first**; the explorer is a cross-check only. **`/lead` reads the
  kit worktree's STATE when the kit branch is ahead of `development`** (the main copy lags until merge).
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
- **One high-severity npm advisory** reported by `npm ci` (DESIGN-014 Handoff); not investigated.

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **PHASE0-007b's three lead rulings** (task file, Required inputs and rules 5, 9, 13) stand unless
  overturned: creation checks no role and bumps no version; out-of-range passwords skip Argon2id.
- **Phase 1 questions (ADR-009, "Not decided here"):** must a manager changing their own password give
  the current one (architect: yes)? Does a manager who resets their own PIN stay signed in? Does a
  role change bump the credential version? Needed before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; void `REFUSED` and abandoned
  approval (FR-J3, AC-18) and empty-order cancel unaudited (FR-H3, AC-10), wording in DESIGN-014's
  Handoff; cooldown-refused approval; §9 questions 2 and 3; reactivation keeps the PIN (FR-B3).
- **Lead rulings, yours to overturn,** each in its task file's *Lead rulings* or round section:
  PHASE0-004 to 007, DESIGN-011 to 014 (014: audit amounts for void, line void, discount), ARCH-006,
  FE-030 to FE-036 (FE-030 to 033 in journal 2026-10-05).
- **PRD §9 question 1, receipt content:** the owner asked the lead to research the usual content of an
  Indonesian F&B receipt and propose it. Not started; a librarian task, one step at a time.
- **Kit:** builder `Bash(grep:*)`? dispatcher ping on `BLOCKED ON APPROVAL`? `/lead` fetch first? builders'
  `python3`/`sed`? dispatcher support for hand-opened designers/architects and a reviewer CLI override?
- **Pre-production gate, owner-accepted risks:** the same-class PIN reset (DECISIONS 2026-10-07), and
  username discovery and per-account lockout (ADR-009). Revisit before any networked use (§3.2).
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero. Proposed at L2699-2701.
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md (POS-03 Q5, Q6, Q9 among them).

## Live conflicts

- **`floor.html:48` still draws the `dayclosed` header as *closed · 25 Sep***; the build follows the
  2026-09-30 ruling. Owed to the designer, with two strip questions (a sale being paid; telling equal
  sales apart).
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.

## Next up

Watch `phase0-008a`; route prompts to the owner. Owner: ARCH-010 *For the owner* (cookie-jar risk,
two readings, ADR-010). When 008a lands: verify, the lead's cert/dev/curl runs, Codex review.
