# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-19 (wrap-up): `development` at `0339fad`. **Phase 0 is closed** ([reviews/PHASE0-gate.md](reviews/PHASE0-gate.md)).
Nothing running. **Next: the owner's word on how the Phase 1 plan is written** (Questions, first line). This STATE is on
`agent/lead-1019d` (PR #109): if `development`'s STATE still says Phase 0 waits to be closed, that PR has not merged;
read this file from the branch. Narrative: [journal/2026-10-19.md](journal/2026-10-19.md).

## Phase and gates

- **Phase 0: CLOSED 2026-10-19** (DECISIONS). All eight Definition of Done lines met, B-24 qualified by the 2026-10-13
  fixtures ruling; every ARCH-015 gate item done (fresh clone, ADR-011, PHASE0-013, DoD wording, roadmap reading,
  Safari check).
- **Phase 1 (Back office and catalog, ROADMAP `:60-81`): not started.** It needs its own plan first. The lead's
  proposal (journal 2026-10-19 *Phase 0 closed*): an architect writes a slicing plan (slices, order, which need an ADR
  or consult: likely the catalog schema with versioned settings FR-B1, catalog revisions with the two-second poll and
  `CATALOG_CHANGED` FR-C6/C7, sessions ended on deactivation or reset FR-B3; the Phase 1 DoD with AC-12, AC-31, AC-32
  and the carry-forwards); the owner accepts it before any Phase 1 task; task files then one at a time, as in Phase 0.
  Meanwhile the designer runs back-office slices B, then D-H. **Not approved yet.**
- **Architecture:** ten accepted ADRs (001-007, 009-011); ADR-008 reserved (deferred by the owner). ADR-011: the
  browser clients, their sessions and what is served. Recommended, not commissioned: an inline-approval ADR (ARCH-013).
- **Frontend:** POS-01 to POS-07 against fixtures, POS-01 real. **Back office:** `apps/back-office` with real
  sign-in, the provisional BO-01 form, the empty Phase 0 frame and M-6. Frost slices A, C, I designed.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Last verify by the lead:** fresh clone of `development` `70fb286` from GitHub, 2026-10-19: `npm ci`, `db:up`,
  `db:migrate` (none pending), `verify` 93 files / 3744 tests, `test:e2e:all` 58. Later merges are docs only. Server
  tests need `npm run db:up` and `openssl` on `PATH`. Dev `pos` holds 0001-0008 and one manager. Certificate made.

## Integration branch

- **`development`** at `0339fad` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-19); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1019d`** (from `0339fad`, pushed, PR #109). After it merges, cut
  a new lead branch from `development` for the next change. **Before any follow-up push to a lead branch, check its PR
  is still open** (`gh pr view <n> --json state`): a push after the merge is lost (it happened to #103 on 2026-10-19).
- **Task branches open:** none. No task worktree; `.agent/runs/` empty. Merged branches still exist (cleanup later).
  Not the lead's: worktrees `../restaurant-pos-design` and `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Live agents: the lead only.** Nothing running. `/lead` renames the pane `lead`.
- **Carry-forwards:** the Handoffs of PHASE0-005 to 013 (*For Task 12*, *For Phase 1's first form*, *What the next
  agent needs*); ARCH-012 to 016 *must carry forward*. Phase 1: AC-32's POS half and AC-35's last sentence close in the
  harness; the harness rules (012a/012b Handoffs, ADR-011 rules 27-28) bind every later browser test. Phase 2: AC-27's
  second sentence, AC-19's approval class, M-1 for real, the idempotency design (a `CSRF_REFUSED` retry resends the
  same key, ADR-011).
- **Design slices left: B, D, E, F, G, H.** B (BO-01/02) takes DESIGN-012's N1-N3 and replaces the provisional BO-01
  form. The users screen warns that a PIN or password reset ends all that manager's sessions (ADR-009).
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density.
- **Open ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout:
  7200000`, never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has
  it (the script commits it first), delete the kit copy. **Never commit a builder's task file on the lead branch.**
  Worktrees are cut from the local `development`; preflight reads `depends_on` from the **kit's** task files.
- **Preflight refuses when STATE.md is over its cap**, even by one line: check before every dispatch or resume.
- **`max_builders` is 1;** reviewers do not count. Server test runs from different worktrees queue on an advisory
  lock; e2e runs queue on their own (`restaurant-pos:e2e`), so a build and a review may run together.
- **Task files copy the consult verbatim**, then rulings, tests expected to change, ACs. **Reviewers cannot reach
  `127.0.0.1:5433` or launch a browser**; builders' runs and the lead's verify note above the Handoff are the evidence.
- **Trivial review** (`review.trivial_max_lines` 20, no touches flag, verify green): the lead reviews, repeats the red
  proof, writes a verify note above the Handoff with `status: complete`, commits it on the task branch, pushes for a PR.
- **The browser harness:** `npm run test:e2e` (Chromium) / `test:e2e:all` (both); not in `verify`. Playwright 1.64.1
  browsers installed on the host. **The lead runs `test:e2e` before merging any task touching** `apps/pos`,
  `apps/back-office`, `packages/api-client`, `packages/contracts`, `apps/server/src/http`, `apps/server/src/domain` or
  `db/migrations` (ARCH-015 *For the lead* 6). The harness makes its own people and certificate.
- **A fresh-clone check** must clone into a directory named `restaurant-pos` (the compose file has no `name:`, so any
  other name starts a second database on 5433; adding a `name:` is a small builder task, not filed).
- **The permission classifier refuses the lead** `git worktree remove` and `rm -rf` of run directories (even of merged,
  clean worktrees), and once refused a read-only `grep` after that; the owner runs removals. Read files with Read.
- **Background commands die at two hours;** a dispatcher may exit 1 when Codex hits its limit after writing its
  report: read the report whole before deciding. **Prompts do not wake the lead**; the owner answers them
  (`BLOCKED ON APPROVAL` in the dispatcher's output).
- **`max_fix_cycles` is 2** (three rounds in all; the BLOCKED resume counts). A lead ruling for a round goes above the
  Handoff in the worktree, committed there, then `--resume --message`. A re-review: `--role reviewer --resume
  --message "... Write only your report ..."`; the reviewer rewrites its report in place.
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work.** Codex's five-hour allowance
  is shared by the designer and the reviewer.
- **Hand-opened agents:** architects (journal 2026-10-12 launch line; for a writing task, cwd and role file from its
  own worktree, as ARCH-016); designers (journal 2026-10-06; write `.agent/runs/<ID>/builder/meta.json` before
  review); OpenCode stand-in (journal 2026-10-14).
- **Hand checks serve from the task's worktree** (`build:clients`, `npm run dev -w apps/server`); the owner clicks
  through the certificate warning. Age sessions via `docker exec restaurant-pos-db-1 psql`. Never print `db/dev.env` values.
- `ask.sh`: Haiku, then Codex luna. Contract edits: `ALLOW_CONTRACT=1` + DECISIONS.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7); no
  schema check at startup. `npm ci` warns about install scripts (`esbuild`, `fsevents`).
- **011d1 found, not fixed:** two `<main>` while signed out (slice B); unchecked by eye: notice contrast, a password
  manager. After a logout BO-01 focuses Password, not Username; the frame stops at `--frost-office-width`. Slice B.
- **012a/b:** `makePeople` (server tests) names people after their PIN; never reuse it in `e2e/`. The AC-18 scan
  could, about once in a million, take a logged six-digit number for a PIN (012b Handoff).
- **One high-severity npm advisory** in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **How to write the Phase 1 plan** (Phase and gates above; journal 2026-10-19 *Phase 0 closed*): approve the
  architect's slicing plan and the designer starting slice B? Then the lead writes both task files for the owner to read.
- **Phase 1 will need:** ADR-009 *Not decided here* (own-password change, own-PIN reset, role change) before the users
  screen; PRD §9's rate range already in Phase 1 (settings store rates; PRD says "before Phase 2")?
- **PHASE0-012b, yours to overturn:** its 15 lead rulings and the two substituted red proofs (B6/B7, B2; journal 10-19).
- **012a, lead acceptance yours to overturn:** a shell forging the marker, `E2E_REFUSED_DATABASES` and all three
  database names passes the worker guard (task file, round 3).
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each). **Service charge** before non-zero: Pasal 8.
- **PHASE0-008b's builder choices, yours to overturn** (its Handoff).
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 013, DESIGN-011-015, ARCH-006, FE-030-036;
  among them the splits of 011c, 011d and Task 12, 012a's zod fix in `@pos/contracts/browser`, and PR #95's list.
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

1. The owner rules on the Phase 1 plan approach (Questions, first line). On a yes: write the architect's task file
   (`arch`, hand-opened, like ARCH-016) and the slice B designer task (DESIGN-016), owner reads both, then open them.
2. After PR #109 merges: fast-forward the main checkout; cut a new lead branch for the next change.
