# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-19: `development` at `33eb910`. **PHASE0-012b dispatched** (owner's go). **ADR-011 accepted** by the owner;
applied at `a8f0939`; `agent/arch-016` and `agent/lead-1017b` pushed for PRs, to be merged by the owner.
Narrative: [journal/2026-10-17.md](journal/2026-10-17.md) *Later*, [journal/2026-10-19.md](journal/2026-10-19.md). Narrative: [journal/2026-10-17.md](journal/2026-10-17.md), section *Later*.

## Phase and gates

- **Phase 0**, started 2026-09-14. Done: tasks 1 to 11 (with 003a-c, 006b, 007b, 008a/b, 009a/b, 010a/b, 011a,
  011b, 011c1, 011c2, 011d1, 011d2) and DESIGN-015; **012a** (the browser harness, PR #99). **Left: 012b**, then
  the Phase 0 gate (below).
- **Architecture:** ten accepted ADRs (001-007, 009-011; ADR-011 accepted 2026-10-19, merging via `agent/arch-016`);
  ADR-008 reserved (deferred). ADR-011: on the browser clients, their sessions and what is served, with the
  §3.1/§4.3/§7.2/§13/§14.3/§14.4 amendments and the §3.2 clauses. Recommended, not commissioned: an inline-approval
  ADR (ARCH-013).
- **Frontend:** POS-01 to POS-07 against fixtures, POS-01 real. **Back office:** `apps/back-office` with real
  sign-in, the provisional BO-01 form, the empty Phase 0 frame and M-6; Frost slices A, C, I designed.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Phase 0 gate owes** (ARCH-015 §7, *For the lead* 4): 012b; `verify` then `test:e2e:all` from a fresh clone; the
  ADR-011 merged (accepted 2026-10-19); the owner's Safari check and roadmap reading; the plan's Definition of Done wording.
- **Last verify by the lead:** `development` `9ae3a4d`, 93 files / 3744 tests and `test:e2e:all` 12 passed,
  2026-10-17, after `npm ci`. Server tests need `npm run db:up` and `openssl` on `PATH`. Dev `pos` holds 0001-0008
  and one manager. Certificate made.

## Integration branch

- **`development`** at `33eb910` on GitHub; the main checkout matches it (checked 2026-10-17; if the
  permission classifier refuses `git merge --ff-only`, the owner runs it). `main` and `development` are protected:
  PR required, 0 approvals, admins too.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-17, agents.yaml with the e2e allow-list merged).
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1017b`** (from `33eb910`, no upstream): DECISIONS, journal,
  STATE, QUEUE uncommitted; the 012b task file untracked there (never commit it on the lead branch).
- **Task branches:** `agent/arch-016` (worktree `../restaurant-pos-wt/ARCH-016`, task file `16f393a`). Only the owner
  merges; the lead commits when asked, pushes when told. Merged
  branches still exist (cleanup later). Not the lead's: worktrees `../restaurant-pos-design` and `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Live agents: `lead` and `phase0-012b`** (Sonnet 5.5 builder, pane `w2:p60`). `architect16` closed.
- **PHASE0-012b, dispatched 2026-10-19** (worktree `../restaurant-pos-wt/PHASE0-012b`, `agent/phase0-012b`, task file
  `1b14d81`; kit copy deleted). Owns `e2e/**` only. Ruling 5 makes the AC-18 scan exact (a credential only in its own
  route's bodies, as often as typed). Then: verify, Codex review, the lead's `test:e2e:all`, the owner's look.
- **ARCH-016 complete:** accepted, applied at `a8f0939`, `agent/arch-016` pushed for a PR. The lead updated the ADR counts in AGENTS.md, CLAUDE.md and the
  architect role on `agent/lead-1017b`, and AGENTS.md *What exists* from the Handoff's wording.
- **Carry-forwards:** Handoffs of PHASE0-005 to 012a (*For Task 12*, *For Phase 1's first form*, *What 012b needs*);
  ARCH-012, 013, 014, 015 *must carry forward* (Phase 1: AC-32's POS half and AC-35's last sentence close in the
  harness; Phase 2: AC-27's second sentence, AC-19's approval class, M-1 for real).
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
- **Hand-opened agents:** architects (journal 2026-10-12 launch line, used again for ARCH-015); designers (journal
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
- **011a found, not fixed:** outside-prefix 404s (`/`) carry no `Cache-Control`; `assets` is a reserved first
  segment under each bundle prefix (for the commissioned ADR). `npm ci` warns about install scripts (`esbuild`, `fsevents`).
- **011d1 found, not fixed:** two `<main>` while signed out (slice B); unchecked by eye: notice contrast, a password
  manager. After a logout BO-01 focuses Password, not Username; the frame stops at `--frost-office-width`. Slice B.
- **012a:** `makePeople` (server tests) still names people after their PIN; harmless there, never reuse it in `e2e/`.
- **One high-severity npm advisory** in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **ARCH-015, *For the owner*:** (1) a ten-minute Safari hand check at the Phase 0 gate (NFR-5 look, M-6); (2) confirm
  ROADMAP's Phase 0 "inline manager-approval prompt" is met by the primitive, the adapter and the stand-ins, the route
  coming with Phase 2 (architect: yes, no wording change).
- **PHASE0-012b's 15 lead rulings** are yours to overturn (task file).
- **The plan's Definition of Done wording** (ARCH-016 Handoff, three lines): approve to apply?
- **012a, lead acceptance yours to overturn:** a shell forging the marker, `E2E_REFUSED_DATABASES` and all three
  database names passes the worker guard (task file, round 3).
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each). **Service charge** before non-zero: Pasal 8.
- **PHASE0-008b's builder choices, yours to overturn** (its Handoff).
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 012a, DESIGN-011-015, ARCH-006, FE-030-036;
  among them the splits of 011c, 011d and Task 12, 012a's zod fix in `@pos/contracts/browser`, and PR #95's list.
- **Phase 1 (ADR-009 "Not decided here"):** own-password change, own-PIN reset, role change; before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 questions 2 and 3; reactivation keeps the PIN.
- **Kit:** builder `grep`/`python3`/`sed`/`node -e` (011d1 to 012a used them)? `BLOCKED ON APPROVAL` ping?
  hand-opened roles? reviewer CLI override? A `--resume` after a transient API error (529) counts as a round: exempt it?
- **§3.2 gate, owner-accepted risks:** same-class PIN reset, username discovery, lockout, cookie jar (also the
  two-tab sign-in race, 011c1), saved passwords. The commissioned browser-clients ADR takes the race too.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero (L2699-2701).
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.

## Next up

1. When `phase0-012b` reports: verify, Codex review, `test:e2e:all`, the owner's look; then merge by the owner.
2. After the owner merges both PRs: fast-forward, remove the ARCH-016 worktree; write the root-404 task.
3. Then the Phase 0 gate list above. Owner, any time: the questions above.
