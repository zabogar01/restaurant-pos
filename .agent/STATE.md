# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-08 (wrap-up): the owner merged PHASE0-008a (PR #71), ADR-010 (PR #72) and the lead's record
(PR #73); `development` at `4a69826`. The lead fast-forwarded, ran `npm ci`, verified, removed both
worktrees and the run directory, and cut `agent/lead-1008c` for this wrap-up. Nothing is running.
Narrative: [journal/2026-10-08.md](journal/2026-10-08.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Done: tasks 1 to 7, plus 006b, 007b (back-office credential,
  `0007`, `create-manager`) and **008a** (HTTPS process: TLS, loopback guard, safe logging, error
  envelope, health, `@pos/contracts`). Left: **008b**, then Tasks 9 to 12 (auth routes, approval,
  client shells, acceptance tests). No route beyond `GET /api/health` yet.
- **Architecture:** nine accepted ADRs (001-007, 009, 010); ADR-008 stays reserved (deferred).
  **ADR-010, the HTTP boundary**, accepted 2026-10-08 with ARCHITECTURE §3.1/3.2/7.2/11/12/13/16/18.
- **Frontend built** (fixtures plus a client order store): POS-01 to POS-07, every designed POS
  screen, bar Release (FR-A). Not built: all 13 back-office screens.
- **Back-office design in Frost:** slices A (DESIGN-012), C (DESIGN-013, BO-13) and I (DESIGN-014,
  BO-12). BO-03, BO-11 in older Frost; nine are greyscale.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Last verify by the lead:** `npm run verify` green at **3005 tests / 56 files** on 2026-10-08 on
  `development` at `4a69826`, main checkout, after `npm ci`. Server tests need `npm run db:up` and
  **`openssl` on `PATH`**. The dev database `pos` holds 0001-0007. Local certificate made (`npm run
  cert`, `~/.config/restaurant-pos/tls/`); the server is `npm run dev -w apps/server` on `:8443`.

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `4a69826` (PR #71) on GitHub;
  the local `development` matches it. `main` and `development` are protected: PR required, 0
  approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch` and
  fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting or
  dispatching**, then `npm ci` if the lockfile changed, and `npm run db:migrate` if a migration landed.
- **Guard hooks** in the shared `.git/hooks` with an `agents.yaml` snapshot, current (checked
  2026-10-08 at `4a69826`). Rerun `install-hooks.sh` after any change to `.githooks/` or agents.yaml.
- **Lead work happens in `../restaurant-pos-kit` on `agent/lead-1008c`** (from `4a69826`), not pushed.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations`. Merged, still existing: `agent/design-direction` (worktree
  `../restaurant-pos-design`), `agent/design-*`, `agent/arch-*`, `agent/fe-030` to `-036`,
  `agent/phase0-*`, `agent/lead-*`.

## Running tasks and agents

- **Nothing is running.** No task worktree under `../restaurant-pos-wt/`; `.agent/runs/` is empty.
- **Live agents:** the lead only. Not the lead's: pane `w2:pE`, `.claude/worktrees/keen-chebyshev-ccf255`.
- **PHASE0-008b drafted, untracked** in the kit's `.agent/tasks/` (Host/origin guard, `rpos_cid`, from
  ARCH-010 verbatim; lead ruling 5 adds the absolute-form 404 and ADR-010's two framework bodies). Before
  dispatch: recheck inputs and *Tests expected to change* against 008a as merged; AC 1 baseline 56/3005.
  Acceptance includes the lead's Chrome and Safari check that `rpos_cid` is stored and returned.
- **Beside 008b: ARCH-012, the Task 9 consult** (session cookies, CSRF incl. login, route declarations,
  auth codes); scope in ARCH-010 §10 and ARCH-011's Handoff. Task 10 needs a consult adding an audit
  outcome for a cooldown-refused approval (ARCH-007 §7).
- **Carry-forwards for Tasks 9 to 12:** Handoffs of PHASE0-005 to 008a (routes in the `/api` context,
  first details-bearing code tests the details path, AC-19/27/28/35 close via routes); ARCH-011's
  Handoff lists plan lines in Tasks 9 to 12 that must not be copied.
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
  **Preflight refuses when STATE.md is over its cap**: check before every dispatch or resume.
- **A permission prompt does not wake the lead:** after every dispatch or resume, run in the
  background: wait until `herdr agent get <id>` says `working`, then `herdr agent wait <id> --until
  blocked`; re-arm after each prompt. Only the owner answers. Kill stale waits when a run ends.
- **`max_fix_cycles` is 2.** A lead ruling for a round goes in the worktree's task file above the
  Handoff, committed there, then `--resume --message`. Past two, the owner rules (as on 008a).
- **Codex reviews Claude-built tasks** and shares one five-hour allowance with the Codex designer. At
  its limit, wait for the reset and `--role reviewer --resume` the same session (008a, 2026-10-08);
  the OpenCode stand-in is in journal 2026-10-07. Opus reviews Codex-built work.
- **Architects are opened by hand:** `herdr pane split`, wait for the shell prompt, then journal
  2026-10-01's launch line as `architect<N>` (plus the git tools when it commits); close when done.
- **Designers are opened by hand** (journal 2026-10-06, *Designer how-to*); a fresh worktree needs
  `npm ci`; write `.agent/runs/<ID>/builder/meta.json` (`cli: codex`) in the main checkout before review.
- **Real-terminal checks are the lead's** (builders have no TTY): drive a Herdr pane with `send-text`
  and literal control bytes, waiting for each prompt (LESSONS); run servers on `pos`, scripts on `pos_test`.
- **Tests expected to change: grep first**; the explorer is a cross-check only. **`/lead` reads the
  kit worktree's STATE when the kit branch is ahead of `development`** (the main copy lags until merge).
- **Contract edits** commit with `ALLOW_CONTRACT=1` plus a DECISIONS line. YAML reads `caveman: off` as `false`. POS walk traps: journal 2026-10-02.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the
  Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` (superuser only) bypasses the append-only trigger: for
  ADR-008's wording (deferred). A demoted manager keeps a resolving session with role `CASHIER`; the
  Task 9 back-office guard must refuse it (PHASE0-007 Handoff). 008a's open finding is in 008b's file.
- **Schema currency is not checked at startup** (ARCH-010 §9); a stale schema shows as `INTERNAL`.
- **One high-severity npm advisory** from `npm ci`, in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **ARCHITECTURE §16 certificate row** (ARCH-011 Handoff): replace "Script and document local
  certificate creation/trust" with "Script local certificate creation and document the one-time
  browser warning; nothing installs trust; do not substitute loopback HTTP"? Asked, not answered.
- **Lead rulings, yours to overturn,** each in its task file: PHASE0-004 to 008a (007b: creation checks
  no role, bumps no version; out-of-range passwords skip Argon2id; script asks twice, refuses non-TTY;
  008a: `StartupError`, the `migrate.ts` stream change), DESIGN-011 to 014, ARCH-006, FE-030 to FE-036.
- **Phase 1 questions (ADR-009, "Not decided here"):** must a manager changing their own password give
  the current one (architect: yes)? Does a manager who resets their own PIN stay signed in? Does a
  role change bump the credential version? Needed before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; void `REFUSED` and abandoned
  approval (FR-J3, AC-18) and empty-order cancel unaudited (FR-H3, AC-10), wording in DESIGN-014's
  Handoff; cooldown-refused approval; §9 questions 2 and 3; reactivation keeps the PIN (FR-B3).
- **PRD §9 question 1, receipt content:** the owner asked the lead to research the usual content of an
  Indonesian F&B receipt and propose it. Not started; a librarian task, one step at a time.
- **Kit:** builder `Bash(grep:*)`? dispatcher ping on `BLOCKED ON APPROVAL`? `/lead` fetch first? builders'
  `python3`/`sed`? dispatcher support for hand-opened designers/architects and a reviewer CLI override?
- **Pre-production gate, owner-accepted risks:** the same-class PIN reset (2026-10-07), username discovery
  and per-account lockout (ADR-009), the shared `localhost` cookie jar (ADR-010). Revisit at §3.2.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero. Proposed at L2699-2701.
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md (POS-03 Q5, Q6, Q9 among them).

## Live conflicts

- **`floor.html:48` still draws the `dayclosed` header as *closed · 25 Sep***; the build follows the
  2026-09-30 ruling. Owed to the designer, with two strip questions (a sale being paid; telling equal
  sales apart).
- **DESIGN-007 contradicts itself on `fireerror`** (`:365`/`:407` versus `:578`). You ruled the
  `:578` reading (L349); FE-022 built it. The design file itself is unchanged.

## Next up

Recheck PHASE0-008b's task file against 008a as merged, then dry-run and dispatch it. Beside it,
write and start ARCH-012 (the Task 9 consult) for a hand-opened Opus architect.
