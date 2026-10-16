# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-16 (afternoon): `development` at `66e76e8` (PRs #97, 011d2, and #98 merged), verify green 90 / 3731. The
011d2 worktree and run dir removed. **ARCH-015 done** (Task 12 consult): split into **012a** (the harness and its
premises) then **012b** (the acceptance tests). Lead branch committed (owner: after the consult). Narrative: [journal/2026-10-16.md](journal/2026-10-16.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Done: tasks 1 to 10 (with 003a-c, 006b, 007b, 008a/b, 009a/b, 010a/b),
  **011a** (the server serves both bundles), **011b** (`SessionView` idle numbers; the route table), **DESIGN-015**
  (sign-in copy), **011c1** (`@pos/api-client`, PR #91; one P2 left open by the owner, DECISIONS), **011c2** (the POS
  signs in, PR #92), **011d1** (the back office signs in, PR #95), **011d2** (M-6, PR #97). Left: Task 12, as 012a then 012b (ARCH-015).
- **Architecture:** nine accepted ADRs (001-007, 009, 010); ADR-008 reserved (deferred). **Commissioned, not
  written** (owner 2026-10-13): one ADR on the browser clients and what is served to them, taking in
  ARCH-012's sessions-over-HTTP ADR; the architect also adds the browser-saved-password item to §3.2.
  Recommended, not commissioned: an inline-approval ADR (ARCH-013).
- **Frontend:** POS-01 to POS-07 against fixtures, POS-01 real. **Back office:** `apps/back-office` with real
  sign-in, the provisional BO-01 form, the empty Phase 0 frame and M-6; Frost slices A, C, I designed.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Browser check passed** (owner, 2026-10-13, Chrome and Safari; journal 2026-10-13): tell Task 12's consult a person checked it.
- **Last verify by the lead:** `development` `66e76e8`, 90 files / 3731 tests, 2026-10-16. Server
  tests need `npm run db:up` and `openssl` on `PATH`. Dev `pos` holds 0001-0008 and one manager. Certificate made.

## Integration branch

- **`development`** at `66e76e8` on GitHub; the main checkout matches it (the lead fast-forwarded it 2026-10-16;
  if the permission classifier refuses `git merge --ff-only` again, the owner runs it).
  `main` and `development` are protected: PR required, 0 approvals, admins too.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-16). Rerun `install-hooks.sh` after any change to `.githooks/` or agents.yaml.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1016`** (from `66e76e8`, no upstream), not yet committed:
  STATE, QUEUE, journal 2026-10-16, the ARCH-015 brief. **Until it merges, the main checkout's STATE is stale.**
- **Task branches:** none open. Only the owner merges; the lead commits when asked, pushes when told. Merged
  branches still exist (cleanup later). Not the lead's: worktrees `../restaurant-pos-design` and `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Live agents: the lead only.** A fresh session must rename its pane `lead` first (`/lead` does).
- **ARCH-015 done** (report in `.agent/reviews/`; journal 2026-10-16 *Evening*): 012a the harness (own `pos_e2e`,
  port 8543, server from `globalSetup`, schema reset, cases A1-A6), 012b B1-B11 and the AC-18 scan; e2e out of
  `verify`. Its *For the lead* 1-7 bind 012a; **first prove the builder sandbox can run Chromium, bind 8543, reach 5433.**
- **011d1 and 011d2 merged** (PRs #95, #97). Not seen in a browser from 011d2: the other-manager path (one manager
  exists), cooldowns, a failed logout, the overflow region; 012b's B9-B10 take them.
- **Carry-forwards:** Handoffs of PHASE0-005 to 011d2 (*For Task 12*, *For Phase 1's first form*); ARCH-012, 013, 014 *must carry forward*.
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
- **Lead browser checks** (journal 2026-10-16): serve from the worktree; Chrome stops at the self-signed certificate,
  and **the owner clicks through it** (a security warning is not the lead's to pass). Age a back-office session with
  `docker exec` on `restaurant-pos-db-1`, `psql` as `POS_OWNER_USER` from `db/dev.env` (ruling 17 of 011d2). Activity
  sends at most once per 60 s, so a click soon after a resume sends nothing.
- `ask.sh`: Haiku, then Codex luna. Real-browser checks are the owner's. Contract edits: `ALLOW_CONTRACT=1` + DECISIONS.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7); no schema check at startup.
- **011a found, not fixed:** outside-prefix 404s (`/`) carry no `Cache-Control`; `assets` is a reserved first
  segment under each bundle prefix (for the commissioned ADR). `npm ci` warns about install scripts.
- **011d1 found, not fixed:** two `<main>` while signed out (slice B); unchecked by eye: notice contrast, a password
  manager. (A `CSRF_REFUSED` sign-in shows nothing; it cannot occur.) Seen 2026-10-16: after a logout BO-01 focuses
  Password, not Username; the frame stops at `--frost-office-width` on a wide window. Both for slice B.
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
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 011d2, DESIGN-011-015, ARCH-006, FE-030-036;
  among them the splits of 011c and 011d, and PR #95's list (only `FORBIDDEN` acts from BO-01; `autocomplete`
  hints; the name without the role; `FORBIDDEN` at load shows *Access refused*).
- **ARCH-015, *For the owner*** (neither blocks 012a): (1) a ten-minute Safari hand check at the Phase 0 gate (NFR-5
  look, M-6); (2) confirm ROADMAP's Phase 0 "inline manager-approval prompt" is met by the primitive, the adapter and
  the stand-ins, the route coming with Phase 2 (architect: yes, no wording change).
- **Phase 1 (ADR-009 "Not decided here"):** own-password change, own-PIN reset, role change; before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 questions 2 and 3; reactivation keeps the PIN.
- **Kit:** builder `grep`/`python3`/`sed`/`node -e` (011d1 and 011d2 used them)? `BLOCKED ON APPROVAL` ping? hand-opened roles? reviewer CLI override?
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

1. Write PHASE0-012a from ARCH-015 (sandbox check and host browser install first); owner reads it; dispatch.
2. Then 012b; the browser-clients ADR after 012a merges; the fresh-clone run and `test:e2e:all` at the Phase 0 gate.
   Owner, any time: the questions above.
