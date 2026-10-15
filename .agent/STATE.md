# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-15 (wrap-up): `development` at `42f7abb` (PR #95, **011d1 merged**), verify green 89 / 3652; its worktree
and run dir removed. **Next: write PHASE0-011d2** (M-6). Narrative: [journal/2026-10-15.md](journal/2026-10-15.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Done: tasks 1 to 10 (with 003a-c, 006b, 007b, 008a/b, 009a/b, 010a/b),
  **011a** (the server serves both bundles), **011b** (`SessionView` idle numbers; the route table), **DESIGN-015**
  (sign-in copy), **011c1** (`@pos/api-client`, PR #91; one P2 left open by the owner, DECISIONS), **011c2** (the POS
  signs in, PR #92), **011d1** (the back office signs in, PR #95). Left: **011d2** (M-6), then Task 12.
- **Architecture:** nine accepted ADRs (001-007, 009, 010); ADR-008 reserved (deferred). **Commissioned, not
  written** (owner 2026-10-13): one ADR on the browser clients and what is served to them, taking in
  ARCH-012's sessions-over-HTTP ADR; the architect also adds the browser-saved-password item to §3.2.
  Recommended, not commissioned: an inline-approval ADR (ARCH-013).
- **Frontend:** POS-01 to POS-07 against fixtures, POS-01 real. **Back office:** `apps/back-office` with real
  sign-in, the provisional BO-01 form and the empty Phase 0 frame; Frost slices A, C, I designed.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Browser check passed** (owner, 2026-10-13, Chrome and Safari; journal 2026-10-13): tell Task 12's consult a person checked it.
- **Last verify by the lead:** `development` `42f7abb`, 89 files / 3652 tests, 2026-10-15, after `npm ci`. Server
  tests need `npm run db:up` and `openssl` on `PATH`. Dev `pos` holds 0001-0008 and one manager. Certificate made.

## Integration branch

- **`development`** at `42f7abb` on GitHub; the main checkout matches it (the lead fast-forwarded it 2026-10-15;
  if the permission classifier refuses `git merge --ff-only` again, the owner runs it).
  `main` and `development` are protected: PR required, 0 approvals, admins too.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-15). Rerun `install-hooks.sh` after any change to `.githooks/` or agents.yaml.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1015b`**, committed and pushed for a PR (owner, 2026-10-15):
  STATE, QUEUE, DECISIONS (the 2026-10-15 line on 011d1's rulings 3 and 5), journal 2026-10-15. **Until it merges,
  this branch's STATE is the current one;** the next lead work goes on a new `agent/lead-<date>` branch after the merge.
- **Task branches:** none open. Only the owner merges; the lead commits when asked, pushes when told. Merged
  branches still exist (cleanup later). Not the lead's: worktrees `../restaurant-pos-design` and `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Live agents: the lead only.** A fresh session must rename its pane `lead` first (`/lead` does).
- **PHASE0-011d1 merged** (PR #95, 2026-10-15): the back office signs in for real in its own client. Two Codex rounds
  (F1 high, F2 and F3 medium, all fixed; re-review clean); owner signed in and out by hand. Ruling 5 (owner's go,
  DECISIONS): a failed back-office logout stays signed in, by a back-office-only `confirmsLogout` in the core.
- **PHASE0-011d2, M-6: not written; next.** Split from 011d by the lead (journal 2026-10-15). Must carry: ARCH-014
  011d rule 7, cases 6, 7, 8, 10 (and M-6's half of 9), red proofs "unmount the area when M-6 opens" (case 7) and "show
  M-6 on a reload" (case 5); DESIGN-015's M-6 rows (`.agent/tasks/DESIGN-015-sign-in-copy.md` Handoff table) and
  *Logout failed*'s M-6 half; the owner's 2026-10-14 rulings (another manager signing in from M-6 destroys the draft;
  the same manager after eight hours gets it back; both already carried by the keyed area); the other-manager choice
  sends the ordinary sign-in, not re-authentication; re-authentication joins the one-cookie-changing-request rule.
  **From 011d1's Handoff, *For PHASE0-011d2* and Round 2:** the interim tests to change (`session-lifecycle.test.tsx`
  case 9's `SESSION_IDLE` row, the deadline-read test, the Round 2 F2 pair); `meaningOf`'s `SESSION_IDLE` → `rest` and
  `onCoreEvent`'s case are what M-6 replaces; add an `idle` phase and `data-session="idle"`; keep the idle person's
  `username` ("Continue as {username}"); `api.ts` already declares `reauthenticate`. **Rule it explicitly:** a stale
  `me` must never close or bypass M-6 (a BO `SESSION_IDLE` keeps the core's generation; sequence (c) is the pattern).
  Baseline 89 / 3652 at `42f7abb`. SCREEN-INVENTORY `:617` still calls the eight-hour draft an owner question (owed
  to the designer; the owner answered 2026-10-14).
- **Carry-forwards:** Handoffs of PHASE0-005 to 011d1 (*For Task 12*); ARCH-012, 013, 014 *must carry forward*.
- **Design slices left: B, D, E, F, G, H.** B takes DESIGN-012's N1-N3 and replaces the provisional BO-01 form.
  The users screen warns that a PIN or password reset ends all that manager's sessions (ADR-009).
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
- **Task files copy the consult verbatim** (headings demoted with `perl -pe 's/^(#{2,3}) /#$1 /'`; BSD `sed` has no
  `t;`), then rulings, tests expected to change (explorer first), ACs. **Reviewers' sandboxes cannot run single
  server test files** (`EPERM 127.0.0.1:5433`); builders' standalone runs are the evidence for that criterion.
- **Background commands die at two hours;** a dispatcher may exit 1 when Codex hits its limit after writing its
  report: read the report whole before deciding. **Prompts do not wake the lead**; the owner answers them.
- **`max_fix_cycles` is 2.** A lead ruling for a round goes above the Handoff in the worktree, committed there, then
  `--resume --message`. The BLOCKED resume counts as a round (011b). A re-review message says "write only your
  report"; the reviewer then rewrites its report in place (the earlier one stays in git).
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work.** Codex's five-hour allowance
  is shared by the designer and the reviewer.
- **Hand-opened agents:** architects (journal 2026-10-12 launch line); designers (journal 2026-10-06 how-to; write
  `.agent/runs/<ID>/builder/meta.json` with the real CLI before review). **OpenCode stand-in** (journal 2026-10-14):
  `herdr pane split … --env "OPENCODE_CONFIG_CONTENT=<json>"`, then `herdr agent start <name> --kind opencode --pane
  <p> -- --model openai/gpt-6-astra`; the first start may exit, retry once. Use the **widened allow list** the owner
  approved on 2026-10-14 (DECISIONS). A designer handover: note above the Handoff, commit only it, close the pane.
- **Owner hand checks serve from the task's worktree** (`npm run build:clients`, `npm run dev -w apps/server` there);
  the main checkout serves `development`. The certificate is `~/.config/restaurant-pos/tls/`.
- `ask.sh`: Haiku, then Codex luna. Real-browser checks are the owner's. Contract edits: `ALLOW_CONTRACT=1` + DECISIONS.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7); no schema check at startup.
- **011a found, not fixed:** outside-prefix 404s (`/`) carry no `Cache-Control`; `assets` is a reserved first
  segment under each bundle prefix (for the commissioned ADR). `npm ci` warns about install scripts.
- **011d1 found, not fixed:** two `<main>` while signed out (slice B); unchecked by eye: BO-01 focus order, notice
  contrast, the 40px fields, a password manager. (A `CSRF_REFUSED` sign-in shows nothing; it cannot occur.)
- **One high-severity npm advisory** in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Merge the lead branch's PR** (`agent/lead-1015b`, opened 2026-10-15).
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **ARCH-012:** (2) the FR-A2c reading, no route takes either cookie (lead: confirm)? (3) sign-in without a
  pre-session CSRF token until §3.2 (lead: accept)?
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each). **Service charge** before non-zero: Pasal 8.
- **PHASE0-008b's builder choices, yours to overturn** (its Handoff); **ARCHITECTURE §16 certificate row** (ARCH-011).
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 011d1, DESIGN-011-015, ARCH-006, FE-030-036;
  among them the splits of 011c and 011d, and PR #95's list (only `FORBIDDEN` acts from BO-01; `autocomplete`
  hints; the name without the role; `FORBIDDEN` at load shows *Access refused*).
- **Phase 1 (ADR-009 "Not decided here"):** own-password change, own-PIN reset, role change; before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 questions 2 and 3; reactivation keeps the PIN.
- **Kit:** builder `grep`/`python3`/`sed`/`node -e` (011d1 used them)? `BLOCKED ON APPROVAL` ping? hand-opened roles? reviewer CLI override?
  `--resume --message` tells a reviewer to "Update the Handoff", against its role (011c1 re-review did).
  A `--resume` after a transient API error (529) counts as a fix round (011c2 lost one, 2026-10-14): exempt it?
- **§3.2 gate, owner-accepted risks:** same-class PIN reset, username discovery, lockout, cookie jar (also the
  two-tab sign-in race, 011c1), saved passwords. The commissioned browser-clients ADR takes the race too.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero (L2699-2701).
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.

## Next up

1. Write PHASE0-011d2 in the kit (explorer for tests expected to change; baseline 89 / 3652); owner reads it; dispatch.
2. Then Task 12 (the browser harness), after its consult. Owner, any time: the questions above.
