# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-19 (later): `development` at `afe7819`. The owner merged **#104** (PHASE0-012b), **#103** and **#105** (lead
memory) and **#102** (ADR-011). Verify and `test:e2e:all` green on `4967ade` (#105 is lead memory only). Narrative:
[journal/2026-10-17.md](journal/2026-10-17.md) *Later*, [journal/2026-10-19.md](journal/2026-10-19.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Done: tasks 1 to 11 (all slices), DESIGN-015, **012a** (PR #99), **012b** (PR
  #104). **Left:** the Phase 0 gate (below).
- **Architecture:** ten accepted ADRs (001-007, 009-011); ADR-008 reserved (deferred). ADR-011 (PR #102): the browser
  clients, their sessions and what is served; it settles ARCH-012 items 2 and 3, files the two-tab case as its own
  accepted risk, rewrites the §16 certificate row, decides `no-store` on root 404s (not built). Recommended, not
  commissioned: an inline-approval ADR (ARCH-013).
- **Frontend:** POS-01 to POS-07 against fixtures, POS-01 real. **Back office:** `apps/back-office` with real
  sign-in, the provisional BO-01 form, the empty Phase 0 frame and M-6; Frost slices A, C, I designed.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Phase 0 gate owes** (ARCH-015 §7, *For the lead* 4): `verify` then `test:e2e:all` from a
  fresh clone; the owner's Safari check and roadmap reading; the plan's Definition of Done wording (drafted in
  ARCH-016's Handoff, three lines, not approved); the root-404 `no-store` task (small, queued).
- **Last verify by the lead:** `development` `4967ade` (2026-10-19, main checkout, not a fresh clone): 93 / 3744,
  `test:e2e:all` 58 (51 s). Server tests need `npm run db:up` and `openssl` on `PATH`. Dev `pos` holds 0001-0008 and one manager. Certificate made.

## Integration branch

- **`development`** at `afe7819` on GitHub; the main checkout matches it (if the permission classifier refuses
  `git merge --ff-only`, the owner runs it). `main` and `development` are protected: PR required, 0 approvals, admins too.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-17); no agents.yaml or `.githooks/` change since.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1019b`** (from `afe7819`, not pushed). Before any follow-up push to a lead branch, check its PR is still open.
- **Task branches open:** none; no task worktree, `.agent/runs/` empty (the owner removed ARCH-016's and 012b's,
  2026-10-19; the classifier refuses the lead `git worktree remove`). Merged branches still exist (cleanup later). Not the lead's: worktrees
  `../restaurant-pos-design` and `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Live agents: the lead only.** No task running. `/lead` renames the pane `lead`.
- **PHASE0-012b, complete** (`6ee0e22`, `cycles: 1`): B1-B11, the AC-18 scan in every profile test, `scan.spec.ts`.
  Its Handoffs carry forward the harness rules for every later phase's browser tests.
- **ARCH-016, complete** (`a8f0939`): its Handoff holds the DoD wording and the root-404 task's two lines.
- **Carry-forwards:** Handoffs of PHASE0-005 to 012b (*For Task 12*, *For Phase 1's first form*, *What the next agent
  needs*); ARCH-012 to 016 *must carry forward* (Phase 1: AC-32's POS half and AC-35's last sentence close in the
  harness; Phase 2: AC-27's second sentence, AC-19's approval class, M-1 for real; a `CSRF_REFUSED` retry resends the
  same idempotency key, ADR-011).
- **Design slices left: B, D, E, F, G, H.** B takes DESIGN-012's N1-N3 and replaces the provisional BO-01 form.
  The users screen warns that a PIN or password reset ends all that manager's sessions (ADR-009).
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density.
- **Open ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout:
  7200000`, never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has
  it, delete the kit copy. **Never commit a builder's task file on the lead branch.** Worktrees are cut from the local
  `development`; preflight reads `depends_on` from the **kit's** task files.
- **Preflight refuses when STATE.md is over its cap**, even by one line: check before every dispatch or resume.
- **`max_builders` is 1;** reviewers do not count. Server test runs from different worktrees queue on an advisory
  lock; e2e runs queue on their own (`restaurant-pos:e2e`), so a build and a review may run together.
- **Task files copy the consult verbatim** (a Python slice by heading, headings demoted one level), then rulings,
  tests expected to change, ACs. **Reviewers cannot reach `127.0.0.1:5433` or launch a browser**; builders' runs and
  the lead's verify note above the Handoff are the evidence.
- **The browser harness:** `npm run test:e2e` (Chromium) / `test:e2e:all` (both); not in `verify`. Playwright 1.64.1
  browsers are installed on the host (`~/Library/Caches/ms-playwright`). **The lead runs `test:e2e` before merging any
  task touching** `apps/pos`, `apps/back-office`, `packages/api-client`, `packages/contracts`,
  `apps/server/src/http`, `apps/server/src/domain` or `db/migrations` (ARCH-015 *For the lead* 6). The harness makes
  its own people, so a served check needs no real credential (*For the lead* 3).
- **Background commands die at two hours;** a dispatcher may exit 1 when Codex hits its limit after writing its
  report: read the report whole before deciding. **Prompts do not wake the lead**; the owner answers them
  (`BLOCKED ON APPROVAL` in the dispatcher's output).
- **`max_fix_cycles` is 2** (three rounds in all; the BLOCKED resume counts). A lead ruling for a round goes above the
  Handoff in the worktree, committed there, then `--resume --message`. A re-review: `--role reviewer --resume
  --message "... Write only your report ..."`; the reviewer rewrites its report in place.
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work.** Codex's five-hour allowance
  is shared by the designer and the reviewer.
- **Hand-opened agents:** architects (journal 2026-10-12 launch line; for a writing task, cwd and role file from its
  own worktree, as ARCH-016); designers (journal
  2026-10-06; write `.agent/runs/<ID>/builder/meta.json` before review); OpenCode stand-in (journal 2026-10-14).
- **Hand checks serve from the task's worktree** (`build:clients`, `npm run dev -w apps/server`); the owner clicks
  through the certificate warning. Age sessions via `docker exec restaurant-pos-db-1 psql`. Never print `db/dev.env` values.
- `ask.sh`: Haiku, then Codex luna (both failed for the 012a reviewer). Contract edits: `ALLOW_CONTRACT=1` + DECISIONS.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7); no schema check at startup.
- **Root 404s carry no `Cache-Control`**: ADR-011 rule 12 says `no-store`; the small task is queued, not written.
  `npm ci` warns about install scripts (`esbuild`, `fsevents`).
- **011d1 found, not fixed:** two `<main>` while signed out (slice B); unchecked by eye: notice contrast, a password
  manager. After a logout BO-01 focuses Password, not Username; the frame stops at `--frost-office-width`. Slice B.
- **012a/b:** `makePeople` (server tests) names people after their PIN; never reuse it in `e2e/`. The AC-18 scan
  could, about once in a million, take a logged six-digit number for a PIN (012b Handoff).
- **One high-severity npm advisory** in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **ARCH-015, *For the owner*:** (1) a ten-minute Safari hand check at the Phase 0 gate (NFR-5 look, M-6); (2) confirm
  ROADMAP's Phase 0 "inline manager-approval prompt" is met by the primitive, the adapter and the stand-ins, the route
  coming with Phase 2 (architect: yes, no wording change).
- **The plan's Definition of Done wording** (ARCH-016 Handoff, three lines): approve to apply?
- **PHASE0-012b, yours to overturn:** its 15 lead rulings and the two substituted red proofs (B6/B7, B2; journal 10-19).
- **012a, lead acceptance yours to overturn:** a shell forging the marker, `E2E_REFUSED_DATABASES` and all three
  database names passes the worker guard (task file, round 3).
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each). **Service charge** before non-zero: Pasal 8.
- **PHASE0-008b's builder choices, yours to overturn** (its Handoff).
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 012b, DESIGN-011-015, ARCH-006, FE-030-036;
  among them the splits of 011c, 011d and Task 12, 012a's zod fix in `@pos/contracts/browser`, and PR #95's list.
- **Phase 1 (ADR-009 "Not decided here"):** own-password change, own-PIN reset, role change; before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 questions 2 and 3; reactivation keeps the PIN.
- **Kit:** builder `grep`/`python3`/`sed`/`node -e` (011d1 to 012a used them)? `BLOCKED ON APPROVAL` ping?
  hand-opened roles? reviewer CLI override? A `--resume` after a transient API error (529) counts as a round: exempt it?
- **§3.2 gate, owner-accepted risks:** same-class PIN reset, username discovery, lockout, cookie jar, the two-tab
  case (own entry, ADR-011), saved passwords, sign-in without a pre-session token (ADR-011 rule 5).
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero (L2699-2701).
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.

## Next up

1. **PHASE0-013** (root-404 `no-store`, `quick`) written in the kit, untracked; dry-run clean 2026-10-19 (Sonnet 5.5,
   interactive). Waits for the owner's go; the lead reviews it as trivial and runs `test:e2e:all` before merge.
2. The Phase 0 gate: fresh-clone `verify` + `test:e2e:all`, the owner's Safari check and roadmap reading, the DoD wording.
