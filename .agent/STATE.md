# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-19 (night): `development` at `1701e36` (PR #110 merged). **Phase 0 closed.** The owner approved the Phase 1 plan approach
(DECISIONS). **ARCH-017 done** (`7e7fb06`): the plan waits for the owner. **DESIGN-016 complete** (`8b0d87a`), pushed for a PR
with the lead branch on the owner's word (2026-10-20); the draft question ruled (destroyed). Narrative: [journal/2026-10-19.md](journal/2026-10-19.md) *Night*.

## Phase and gates

- **Phase 0: CLOSED 2026-10-19** (DECISIONS). All eight Definition of Done lines met, B-24 qualified by the 2026-10-13
  fixtures ruling; every ARCH-015 gate item done (fresh clone, ADR-011, PHASE0-013, DoD wording, roadmap reading,
  Safari check).
- **Phase 1 (Back office and catalog, ROADMAP `:60-81`): planning.** Approach approved (owner, DECISIONS 2026-10-19):
  an architect's slicing plan (ARCH-017, under `docs/superpowers/plans/`, `owns:` granted for that one file), accepted
  by the owner before any Phase 1 task; task files then one at a time. Designer beside it: slice B (DESIGN-016), then D-H.
- **Architecture:** ten accepted ADRs (001-007, 009-011); ADR-008 reserved (deferred by the owner). ADR-011: the
  browser clients, their sessions and what is served. Recommended, not commissioned: an inline-approval ADR (ARCH-013).
- **Frontend:** POS-01 to POS-07 against fixtures, POS-01 real. **Back office:** `apps/back-office` with real
  sign-in, the provisional BO-01 form, the empty Phase 0 frame and M-6. Frost slices A, C, I designed.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Last verify by the lead:** fresh clone of `development` `70fb286` from GitHub, 2026-10-19: `npm ci`, `db:up`,
  `db:migrate` (none pending), `verify` 93 files / 3744 tests, `test:e2e:all` 58. Later merges are docs only. Server
  tests need `npm run db:up` and `openssl` on `PATH`. Dev `pos` holds 0001-0008 and one manager. Certificate made.

## Integration branch

- **`development`** at `1701e36` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-19); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1019f`** (from `1701e36`, pushed 2026-10-20 for a PR). **Run `gh pr view <n> --json
  state` as its own step before any push to a lead branch**: chained behind a push it does not stop it (#110, 2026-10-19).
- **Task branches open:** `agent/arch-017` (plan `7e7fb06`), `agent/design-016` (`d4502d3`, `npm ci` run), worktrees
  `../restaurant-pos-wt/<ID>`, cut from `82876b4`; kit copies deleted. `.agent/runs/DESIGN-016/` holds the review run. Merged branches still exist (cleanup later).
  Not the lead's: worktrees `../restaurant-pos-design` and `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Live agents: the lead only.** All task panes closed 2026-10-20 (owner: close what is not needed). For an ARCH-017
  revision, resume `architect17`: `claude --resume f49d621e-bff4-4c8e-bed9-f9b89310b9a4` in its worktree (2026-10-12 line).
- **ARCH-017, done:** `docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, `Proposed`. 11 slices
  (S0-S10), ADR-012 (versioned configuration) and consults C1-C5, 14 owner questions. Key finding (Q13): AC-31, AC-12's
  rejections and AC-32's second sentence need orders, so cannot pass in Phase 1; ROADMAP wording proposed. Lead checked:
  only the plan and task file changed, `diff --check` clean, no code; Q2 (no rate range, 2026-10-06) and the
  reactivation ruling (2026-10-07) cited correctly. S0 can be written once the plan is accepted.
- **DESIGN-016, complete** (`agent/design-016` at `8b0d87a`, cycles 2): BO-01 (19 states) and BO-02 (9) in Frost, N1-N3,
  wide-window rule in DESIGN *Layout*; checks 399/293/371/288; lead verify exit 0, 93/3744. Review: F1-F5, then R2-1/R2-2,
  all fixed; round 3 lead-reviewed. Feeds plan slice S10. Its Handoff raises stale BO-01/M-6/DESIGN text (wording given).
- **Carry-forwards:** placed slice by slice in the Phase 1 plan §5 (Phase 2's stay Phase 2: AC-27, AC-19, M-1, the
  idempotency design). Design slices left: B (DESIGN-016), D, E, F, G, H (the plan §4 orders them).
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
- **A fresh-clone check** must clone into a directory named `restaurant-pos` until plan slice S0 adds a compose `name:`.
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
- **011d1 found, not fixed:** two `<main>`, focus after logout, the frame beyond 1440px, notice contrast, password
  managers: all handed to DESIGN-016 Part A item 3; the build follows its review.
- **012a/b:** `makePeople` (server tests) names people after their PIN; never reuse it in `e2e/`. The AC-18 scan
  could, about once in a million, take a logged six-digit number for a PIN (012b Handoff).
- **One high-severity npm advisory** in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Lead choices in ARCH-017, yours to overturn:** the plans path granted to the architect.
- **ARCH-017's 14 questions** (plan §8, Handoff): accept the plan; Q13 (ROADMAP acceptance line) first, then Q5, Q12,
  Q1 and Q7-Q11, Q14, Q4, Q10. Contract wording for ROADMAP, PRD FR-B1/B2/B3/B5/J3/M1 and §9 is drafted in its Handoff.
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

1. The owner reads the plan and answers Q13 first; on acceptance, record it, commission ADR-012 + C1 and C2, write S0.
2. The owner merges the DESIGN-016 and lead PRs. After merge: remove the worktree and
   `.agent/runs/DESIGN-016/` (owner runs removals). Next design slice: D, E or F per the plan §4, once accepted.
