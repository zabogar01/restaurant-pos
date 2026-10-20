# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-20 (wrap-up for a fresh session): `development` at `38537bd`. Phase 0 closed 2026-10-19; **Phase 1 is planned, not
started**: the architect's plan (ARCH-017) waits for the owner to read and accept it. Design slice B (DESIGN-016) is
merged. Nothing is running. This STATE is on `agent/lead-1020`: if `development`'s STATE still names `agent/lead-1019f`
or `agent/lead-1020` as "not pushed", the wrap-up PR has not merged; read this file from the branch. Narrative:
[journal/2026-10-19.md](journal/2026-10-19.md) *Night* onward, [journal/2026-10-20.md](journal/2026-10-20.md).

## Phase and gates

- **Phase 1 (Back office and catalog, ROADMAP `:60-81`): planned, waiting for the owner.** Approach approved 2026-10-19:
  an architect's slicing plan, accepted by the owner before any Phase 1 task; task files then one at a time; the
  designer runs back-office slices beside it. **The plan:**
  `docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, `Proposed`, on `agent/arch-017` (`7e7fb06`,
  worktree `../restaurant-pos-wt/ARCH-017`, **not pushed**; the owner reads it from the worktree, since the branch is
  checked out there). 11 slices S0-S10; ADR-012 and consults C1-C5 recommended. **Key finding, Q13:** AC-31, AC-12's
  rejections and AC-32's second sentence need orders, so cannot pass in Phase 1. Detail: the architect's Handoff.
- **Architecture:** ten accepted ADRs (001-007, 009-011); ADR-008 reserved, deferred. Recommended: ARCH-013's inline-approval ADR, ADR-012.
- **Frontend:** POS-01 to POS-07 against fixtures, POS-01 real. **Back office:** `apps/back-office` with real
  sign-in, the provisional BO-01 form, the empty Phase 0 frame and M-6. **Frost designed:** slices A, B (DESIGN-016:
  BO-01 19 states, BO-02 9 states), C, I. Slice B's build is plan slice S10.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Last verify by the lead:** 93 files / 3744 tests at `44a6497` (2026-10-19); fresh clone + `test:e2e:all` 58 at
  `70fb286`; docs-only merges since. Server tests need `db:up` and `openssl`. Dev `pos`: 0001-0008, one manager.

## Integration branch

- **`development`** at `38537bd` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-19); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1020`** (from `38537bd`), pushed for the wrap-up PR. After it
  merges, cut a new lead branch from `development`. **Run `gh pr view <n> --json state` as its own step before any
  follow-up push**: chained with `&&` before a push it printed `MERGED` and did not stop it (#110, 2026-10-19).
- **Task branches:** `agent/arch-017` only. `.agent/runs/` empty. Local merged `agent/*` branches were deleted
  2026-10-20; remote branches untouched. Not the lead's: worktrees `../restaurant-pos-design` and `keen-chebyshev-ccf255`,
  branch `setting/add-permission`, pane `w2:pE`.

## Running tasks and agents

- **Live agents: the lead only.** Every task pane is closed. For an ARCH-017 revision round, resume `architect17` in
  a new pane with its worktree: the 2026-10-12 launch line plus `--resume f49d621e-bff4-4c8e-bed9-f9b89310b9a4`.
- **DESIGN-016, merged** (#112). Its Handoff gives wording for stale BO-01, M-6 and DESIGN paragraphs (later design
  task); S10 cites DESIGN *Layout*'s wide-window rule and the 2026-10-20 oversize ruling.
- **Carry-forwards:** placed slice by slice in the plan's §5 (Phase 2's stay Phase 2: AC-27's second sentence, AC-19's
  approval class, M-1, the idempotency design with ADR-011's `CSRF_REFUSED` retry). Design slices left: D, E, F (Phase
  1, ordered in the plan's §4; E may split into E1 BO-05 and E2 BO-06), G, H.
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density. **Open
  ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout:
  7200000`, never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has
  it (the script commits it first), delete the kit copy. **Never commit a builder's task file on the lead branch.**
  Worktrees are cut from the local `development`; preflight reads `depends_on` from the **kit's** task files.
- **Preflight refuses when STATE.md is over its cap**, even by one line: check before every dispatch or resume.
- **`max_builders` is 1;** reviewers do not count. Server test runs from different worktrees queue on an advisory
  lock; e2e runs queue on their own (`restaurant-pos:e2e`), so a build and a review may run together.
- **Task files copy the consult verbatim**, then rulings, tests expected to change, ACs. **Reviewers cannot reach
  `127.0.0.1:5433` or launch a browser** (DESIGN-016's reviewer was refused the design checks both rounds); builders'
  runs and the lead's verify note above the Handoff are the evidence.
- **Trivial review** (`review.trivial_max_lines` 20, no touches flag, verify green): the lead reviews, repeats the red
  proof, writes a verify note above the Handoff with `status: complete`, commits it on the task branch, pushes for a PR.
  A last fix round of about that size may be lead-reviewed instead of resumed to the reviewer (DESIGN-016 round 3).
- **The browser harness:** `npm run test:e2e` (Chromium) / `test:e2e:all` (both); not in `verify`. Playwright 1.64.1
  browsers installed on the host. **The lead runs `test:e2e` before merging any task touching** `apps/pos`,
  `apps/back-office`, `packages/api-client`, `packages/contracts`, `apps/server/src/http`, `apps/server/src/domain` or
  `db/migrations` (ARCH-015 *For the lead* 6). Design checks: `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node
  docs/design/checks/designNNN.cjs` in a worktree after `npm ci`.
- **A fresh-clone check** must clone into a directory named `restaurant-pos` until plan slice S0 adds a compose `name:`.
- **Worktree and run-dir removal:** the classifier has refused the lead before, allowed it 2026-10-20; try, else owner.
- **Close panes once no round is expected**; check `herdr pane list` after a dispatch (a reviewer pane stayed, 10-20).
- **Background commands die at two hours;** read a report whole even when the dispatcher exits 1. **Prompts do not
  wake the lead**; the owner answers them (`BLOCKED ON APPROVAL`, an OpenCode "Permission required" box).
- **`max_fix_cycles` is 2** (three rounds in all; the BLOCKED resume counts). A lead ruling for a round goes above the
  Handoff in the worktree, committed there, then `--resume --message`. A re-review: `--role reviewer --resume
  --message "... Write only your report ..."`; the reviewer rewrites its report in place.
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work.** Codex's five-hour allowance
  is shared; at the limit it offers `gpt-6-luna`: never accept it inside a slice.
- **Hand-opened agents:** architects (journal 2026-10-12); Codex designers (journal 2026-10-06; *Skip* its update
  prompt); the OpenCode stand-in (journal 2026-10-20). Before reviewing one, write `.agent/runs/<ID>/builder/meta.json`.
- **Hand checks serve from the task's worktree** (`build:clients`, `npm run dev -w apps/server`); the owner clicks
  through the certificate warning. Age sessions via `docker exec restaurant-pos-db-1 psql`. Never print `db/dev.env` values.
- `ask.sh`: Haiku, then Codex luna. Contract edits: `ALLOW_CONTRACT=1` + DECISIONS.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7); no
  schema check at startup (plan S0). `npm ci` warns about install scripts (`esbuild`, `fsevents`).
- **The built BO-01 is provisional:** two `<main>`, focus after logout, the frame beyond 1440px; DESIGN-016 decided
  each, and plan slice S10 builds it.
- **012a/b:** `makePeople` (server tests) names people after their PIN; never reuse it in `e2e/`. The AC-18 scan
  could, about once in a million, take a logged six-digit number for a PIN (012b Handoff).
- **One high-severity npm advisory** in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Accept the Phase 1 plan** (or ask for a revision), and answer its 14 questions (plan §8; the architect's Handoff has
  the proposed answers): **Q13 first** (ROADMAP's acceptance line), then Q5 and Q12 (settings), Q1 and Q7-Q11 together
  (users), Q14, Q4 (FR-B7 tender types into Phase 1), Q10. Q3 is the Pasal 8 service-charge question; Q6 the owed
  FR-B3 and half-up wording. Contract wording for ROADMAP, PRD FR-B1/B2/B3/B5/J3/M1 and §9 is drafted in the Handoff.
- **Lead choice in ARCH-017, yours to overturn:** the `docs/superpowers/plans/` file granted to the architect.
- **PHASE0-012b, yours to overturn:** its 15 lead rulings and the two substituted red proofs (B6/B7, B2; journal 10-19).
- **012a, lead acceptance yours to overturn:** a shell forging the marker, `E2E_REFUSED_DATABASES` and all three
  database names passes the worker guard (task file, round 3).
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each).
- **PHASE0-008b's builder choices, yours to overturn** (its Handoff).
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 013, DESIGN-011-016, ARCH-006, FE-030-036;
  among them the splits of 011c, 011d and Task 12, 012a's zod fix in `@pos/contracts/browser`, and PR #95's list.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 question 2.
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

1. The owner reads the plan (Q13 first) and accepts it or asks for a revision (resume `architect17`). On acceptance:
   record it in DECISIONS; push `agent/arch-017` for a PR; commission ADR-012 + C1 and C2 (architects, hand-opened);
   write S0 (no consult needed; the architect's Handoff lists the lead rulings S0 needs).
2. Design: slice E1 (BO-05 tables) can start with C2, since S1b needs it; then D and F per the plan's §4.
