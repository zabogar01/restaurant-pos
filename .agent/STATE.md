# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-15: `development` at `ff34d5c` (PR #92, **011c2 merged**), verify green; its worktree and run dir removed.
**Next: write PHASE0-011d** (the back office signs in). Narrative: [journal/2026-10-15.md](journal/2026-10-15.md) and [2026-10-14](journal/2026-10-14.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Done: tasks 1 to 10 (with 003a-c, 006b, 007b, 008a/b, 009a/b, 010a/b),
  **011a** (the server serves both bundles; errors outside `/api` are plain text) and **011b** (`SessionView`
  carries `idleSeconds`/`idleRemainingSeconds`; the route table and `CSRF_HEADER` in `@pos/contracts`).
  **DESIGN-015** (sign-in copy) and **011c1** (`@pos/api-client`, PR #91; one P2 left open by the owner, DECISIONS).
  **011c2** (the POS signs in, PR #92). Left: **011d** (plan Task 11, split by ARCH-014 and the lead), and Task 12.
- **Architecture:** nine accepted ADRs (001-007, 009, 010); ADR-008 reserved (deferred). **Commissioned, not
  written** (owner 2026-10-13): one ADR on the browser clients and what is served to them, taking in
  ARCH-012's sessions-over-HTTP ADR; the architect also adds the browser-saved-password item to §3.2.
  Recommended, not commissioned: an inline-approval ADR (ARCH-013).
- **Frontend:** POS-01 to POS-07 against fixtures. **Back office:** none built; Frost slices A, C, I and DESIGN-015 copy.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Browser check passed** (owner, 2026-10-13, Chrome and Safari; journal 2026-10-13): tell Task 12's consult a person checked it.
- **Last verify by the lead:** `development` `ff34d5c`, 78 files / 3494 tests, 2026-10-15, after `npm ci`. Server
  tests need `npm run db:up` and `openssl` on `PATH`. Dev database `pos` holds 0001-0008. Certificate made.

## Integration branch

- **`development`** at `ff34d5c` on GitHub; the main checkout matches it (the lead fast-forwarded it 2026-10-14;
  if the permission classifier refuses `git merge --ff-only` again, the owner runs it).
  `main` and `development` are protected: PR required, 0 approvals, admins too.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-12). Rerun `install-hooks.sh` after any change to `.githooks/` or agents.yaml.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1015`** (lead-1014 merged as PR #93), not pushed: `f6883a6`
  untracks `.claude/settings.local.json` and ignores it (owner, 2026-10-15). **After it merges,** the main checkout's
  modified copy blocks the fast-forward: copy it aside, `git checkout` it, fast-forward, copy it back.
- **Task branches:** none open.
- Only the owner merges; the lead commits when asked, pushes when told. Merged branches still exist (cleanup later).

## Running tasks and agents

- **Live agents: the lead only.** Not the lead's: pane `w2:pE`, worktree `.claude/worktrees/keen-chebyshev-ccf255`.
  A fresh session must rename its pane `lead` first (`/lead` does).
- **DESIGN-015 merged** (PR #89). Its Handoff's copy table is the builders' copy for 011c2 and 011d.
- **PHASE0-011c2 merged** (PR #92, 2026-10-15): the POS signs in for real. Codex review three findings fixed,
  re-review clean; owner signed in by hand. Its Handoff (*For 011d and Task 12*, rounds 2-3) carries forward.
- **PHASE0-011d, the back office:** not written; next. Must carry: DESIGN-015's BO-01/M-6 rows; ARCH-014
  question 5's back-office table and 011d sections; the owner's 2026-10-14 rulings (another manager signing in
  from M-6 destroys the idled draft; the same manager after eight hours gets it back); M-6's other-manager choice
  sends the ordinary back-office sign-in, not re-authentication; one sign-in, re-authentication or logout at a
  time (owner 2026-10-14, as 011c2 ruling 12).
- **Carry-forwards:** Handoffs of PHASE0-005 to 011b; ARCH-012, 013, 014 *The Handoffs must carry forward*.
- **Design slices left: B, D, E, F, G, H.** B takes DESIGN-012's N1-N3 and replaces the provisional BO-01 form.
  The users screen warns that a PIN or password reset ends all that manager's sessions (ADR-009).
- **Queue (not written):** POS-03's actor group and Release (order.html:77), left out of 011c2 by the lead.
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density.
- **Open ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout:
  7200000`, never `&`, from `../restaurant-pos-kit`. The kit's untracked task file is deleted once the worktree has
  it. **Never commit a builder's task file on the lead branch** (the dispatcher commits it on the task branch).
  Worktrees are cut from the local `development`; preflight reads `depends_on` from the **kit's** task files, so
  merge `origin/development` into the lead branch when a dependency merged after the branch was cut.
- **Preflight refuses when STATE.md is over its cap**, even by one line: check before every dispatch or resume.
- **`max_builders` is 1;** reviewers do not count. Server test runs from different worktrees queue on an advisory
  lock (`test/support/global-setup.ts`), so a build and a review may run together.
- **Task files copy the consult verbatim** (headings demoted, spliced by line range), then rulings,
  tests expected to change (explorer first), ACs. **Reviewers' sandboxes cannot run single server test files**
  (`EPERM 127.0.0.1:5433`); builders' standalone runs are the evidence for that criterion.
- **Background commands die at two hours;** a dispatcher may exit 1 when Codex hits its limit after writing its
  report: read the report whole before deciding. **Prompts do not wake the lead**; the owner answers them.
- **`max_fix_cycles` is 2.** A lead ruling for a round goes above the Handoff in the worktree, committed there, then
  `--resume --message`. The BLOCKED resume counts as a round (011b).
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work.** Codex's five-hour allowance
  is shared by the designer and the reviewer.
- **Hand-opened agents:** architects (journal 2026-10-12 launch line); designers (journal 2026-10-06 how-to; write
  `.agent/runs/<ID>/builder/meta.json` with the real CLI before review). **OpenCode stand-in** (journal 2026-10-14):
  `herdr pane split … --env "OPENCODE_CONFIG_CONTENT=<json>"`, then `herdr agent start <name> --kind opencode --pane
  <p> -- --model openai/gpt-6-astra`; the first start may exit, retry once. Use the **widened allow list** the owner
  approved on 2026-10-14 (DECISIONS). A designer handover: note above the Handoff, commit only it, close the pane.
- **Owner hand checks serve from the task's worktree** (`npm run build:clients`, `npm run dev -w apps/server` there);
  the main checkout serves `development` (journal 2026-10-15). The certificate is `~/.config/restaurant-pos/tls/`.
- `ask.sh`: Haiku, then Codex luna. Real-browser checks are the owner's. Contract edits: `ALLOW_CONTRACT=1` + DECISIONS.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7); no schema check at startup.
- **011a found, not fixed:** outside-prefix 404s (`/`) carry no `Cache-Control`; `assets` is a reserved first
  segment under each bundle prefix (for the commissioned ADR). `npm ci` warns about esbuild's install script.
- **One high-severity npm advisory** in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **ARCH-012:** (2) the FR-A2c reading, no route takes either cookie (lead: confirm)? (3) sign-in without a
  pre-session CSRF token until §3.2 (lead: accept)?
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each). **Service charge** before non-zero: Pasal 8.
- **PHASE0-008b's builder choices, yours to overturn** (its Handoff); **ARCHITECTURE §16 certificate row** (ARCH-011).
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 011c2, DESIGN-011-015, ARCH-006, FE-030-036;
  among them the split of 011c and the `actor-changed` rule for the POS.
- **Phase 1 (ADR-009 "Not decided here"):** own-password change, own-PIN reset, role change; before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 questions 2 and 3; reactivation keeps the PIN.
- **Kit:** builder `grep`/`python3`/`sed`? `BLOCKED ON APPROVAL` ping? dispatching hand-opened roles? reviewer CLI override?
  `--resume --message` tells a reviewer to "Update the Handoff", against its role (011c1 re-review did).
  A `--resume` after a transient API error (529) counts as a fix round (011c2 lost one, 2026-10-14): exempt it?
- **§3.2 gate, owner-accepted risks:** same-class PIN reset, username discovery, lockout, cookie jar (now also the
  two-tab sign-in race, 011c1), saved passwords. The commissioned browser-clients ADR takes the race too.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero (L2699-2701).
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.

## Next up

1. Write PHASE0-011d (explorer for tests expected to change; baseline 78 / 3494); owner reads it; dispatch.
2. Then Task 12 (the browser harness), after its consult. Owner, any time: the questions above.
