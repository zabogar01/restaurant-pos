# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-22: `development` at `608f412` (S2a #128, DESIGN-018b #127, lead #129 merged). Dev `pos` migrated to `0011`.
**S2b complete, PR #130 (owner's look). Running: DESIGN-019 (Codex).** Narrative:
[journal/2026-10-20.md](journal/2026-10-20.md), [journal/2026-10-21.md](journal/2026-10-21.md).

## Phase and gates

- **Phase 1 (Back office and catalog, ROADMAP `:60-90`): building.** Plan accepted 2026-10-20
  (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, merged; its banner says accepted). 11
  slices S0-S10. **Done and merged:** S0 (#115: compose `name:`, `0009`, startup schema check), S1a (#119: tables on
  the server, `0010`, `DUPLICATE`), S1b (#123: BO-05 and the rail); design F's BO-08 half (#125, #127); S2a (#128: settings on the server, `0011`, `SETTINGS_CHANGED`). **Complete, not merged:** S2b (#130).
  **Consults:** C1 (with ADR-012, #117), C2
  (#116), C3 (#121); C4 (POS catalog) not written; **C5 not needed** (S1b: median save-to-visible 91 ms, trigger 5 s).
- **Rulings by slice** (DECISIONS 2026-10-20/21): S2 0-100% rate ceiling (Q2), IDR fixed (Q5), five business details
  (Q12), footer required and `created_by` (owner-confirmed), DESIGN-018 Q1-Q6 (phone without `/`); S3 tender reactivation (OQ1); S7 real items into the client stand-in
  (Q14); S8 Q1, Q6a, Q7-Q11, C3's OQ1 (create audited) and OQ2 (no name correction).
- **Architecture:** eleven accepted ADRs (001-007, 009-012); ADR-008 reserved, deferred. ADR-012 (versioned
  configuration) accepted 2026-10-20 with one catalog counter. ARCHITECTURE §8 carries one lock order (catalog →
  business day → dining table → order → lease/receipt); §7.2 the users rules (#121).
- **Owed, not drafted:** ROADMAP Phase 1's users bullet omits role change (Q1c) and its tender bullet "reactivate"
  (OQ1). Designer: BO-06 inventory and sitemap (E2, C3 *Stale text* 5); BO-04/07 stale-draft states (D, F's BO-07
  half; DESIGN-018's `D` rule is the pattern). The plan's S1 and S8 goals predate Q10 and Q1(b) (later consults win; recorded, not edited).
- **Frontend:** POS-01 to POS-07 against fixtures, POS-01 real. **Back office:** real sign-in, the provisional BO-01,
  the Phase 0 frame and M-6; the rail and BO-05 Tables (the form pattern later forms copy: `tables/model.ts`,
  `forms/fieldsInError.ts`, `work/guard.ts`, the `Decision` dialog; Handoff *How it works*). **Frost designed:** slices A, B (BO-01,
  BO-02), C, I, **E1 (BO-05, DESIGN-017)**, **F's BO-08 half (DESIGN-018, 65 states; stale-draft, rate-field and
  one-form-per-screen rules in `D`; S2a's guards in its Handoff)**; DESIGN-018b drops `/` from the phone (owner).
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180). It approves nothing open in PRD §9.
- **Last verify by the lead:** S2b final (`d9215ed`): verify 114/4331, e2e:all 74, `npm ci` clean. Dev `pos`: 0011.

## Integration branch

- **`development`** at `608f412` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed (the server refuses to start until it does, S0),
  **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-20); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1022`** (from `608f412`), not pushed. The lead pushes and opens PRs
  (owner, DECISIONS 10-21). **Run `gh pr view <n> --json state` as its own step before any follow-up push** (#110).
- **Task branches:** `agent/phase1-s2b` and `agent/design-019` (worktrees under `../restaurant-pos-wt/`, no kit copies). S2a's and
  DESIGN-018b's worktrees, run dirs and branches removed. Not the lead's: worktrees
  `../restaurant-pos-design` and `keen-chebyshev-ccf255`, branch `setting/add-permission`, pane `w2:pE`.

## Running tasks and agents

- **PHASE1-S2b complete** (PR #130, `53af849`): copy question ruled by the lead (builder's sentence stands); Codex review
  F1-F6 fixed in round 2, lead-reviewed (Codex out of allowance), red 12/15 repeated; verify 114/4331, e2e 74. Owner
  looks at BO-08 served (the lead cannot sign in). Owed to a designer: `first-run-closed` lacks the money facts. **DESIGN-019** (BO-03, D part 1 of 3;
  020, 021 next): Codex drafted 74 states uncommitted (check 965/967) and hit its limit; **owner exception** (DECISIONS
  10-22): Claude Opus `design019c` (`w2:p8A`) finishes per *Handover*; Opus reviews. **Carry-forwards:** plan §5. Design left: F's BO-07 half, E2; G, H later.
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
- **Task files copy the consult verbatim** (`sed -n` the consult's *For the lead* section into the file), then rulings,
  tests expected to change, ACs. **Reviewers cannot reach `127.0.0.1:5433`, launch a browser, or run the design
  checks** (refused in every oneshot review so far); the lead's verify note above the Handoff is the evidence, and a
  reviewer's "blocked" on that alone is ruled clear in the task file (PHASE1-S0).
- **Trivial review** (`review.trivial_max_lines` 20, no touches flag, verify green): the lead reviews, repeats the red
  proof, writes a verify note. A last, small, fully ruled fix round may be lead-reviewed (S1a round 2, DESIGN-017 round 3).
- **The browser harness:** `npm run test:e2e` (Chromium) / `test:e2e:all` (both); not in `verify`. **The lead runs
  `test:e2e:all` before merging any task touching** `apps/pos`, `apps/back-office`, `packages/api-client`,
  `packages/contracts`, `apps/server/src/http`, `apps/server/src/domain` or `db/migrations`. Design checks:
  `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/designNNN.cjs` in a worktree after `npm ci`
  (`design014.cjs` takes `DESIGN014_OUTPUT`, the others `DESIGN_EVIDENCE_DIR`); the lead runs them without approval.
- **Close panes once no round is expected.** A vanished hand-opened pane: `--resume <session>` (newest `.jsonl` under
  `~/.claude/projects/<worktree-path>/`) in a fresh pane; `agent_pane_busy` on a new split: retry once.
- **Background commands die at two hours;** read a report whole even on exit 1. The owner answers approvals in the
  agent's pane. A watcher on the Handoff's last line and `herdr agent list` can wake the lead (journal 2026-10-21).
- **A `--resume` restarts the CLI and re-sends the brief once if it is not working within a minute;** a resumed round
  with no task-file or HEAD change is refused as no verdict (`dispatch.rb`, 10-21). Confirm the brief is in the
  transcript (`grep` the session `.jsonl`). The lead resets `rounds` in the run dir only for a round that did no work.
- **`max_fix_cycles` is 2** (three rounds in all). A lead ruling for a round goes above the Handoff in the worktree,
  committed there, then `--resume --message` (builder) or a prompt (hand-opened). A re-review: `--role reviewer
  --resume --message "... Write only your report ..."`; the reviewer rewrites its report in place.
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work** (one owner exception,
  DESIGN-017 round 3). **Codex's five-hour allowance runs out mid-slice** (twice on 10-21; resets are stated in its
  pane). Stand-ins: OpenCode `openai/gpt-6-astra` with a narrow finish-only brief (its limit is the owner's concern:
  keep briefs small), or wait for the reset. Never accept `gpt-6-luna` inside a slice.
- **Hand-opened agents:** architects (journal 10-12, `git add/commit/status/diff/log` allowed, read with Read/Grep/Glob);
  Codex designers (journal 10-06; *Skip* is the owner's); OpenCode (journal 10-20). Before reviewing one, write
  `.agent/runs/<ID>/builder/meta.json` (`"cli"` decides the reviewer's family).
- **Hand checks serve from the task's worktree** (`build:clients`, `npm run dev -w apps/server`). Age sessions via
  `docker exec restaurant-pos-db-1 psql`. Never print `db/dev.env`. `ask.sh`: Haiku, then luna. Contract: `ALLOW_CONTRACT=1`.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7). The
  schema check compares migration names, not contents (S0). `npm ci` warns about install scripts. One high npm advisory,
  development-only (PHASE0-008a). **Lengths are code points** (zod 4.6.5, `char_length`); comments, `D:1607`, `label.ts`,
  `SignIn.tsx` say UTF-16 units: the client refuses more, never less; queued cleanup. **BO-01 provisional** (S10 builds DESIGN-016). **012a/b:** no `makePeople` in `e2e/`.

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **NPWPD without a charset** (DESIGN-018 Q2's other half): not objected to, so the lead's reading stands; yours to overturn.
- **S1b's lead rulings, yours to overturn** (merged in #123): the nine and the builder's two questions.
- **When to start design slice E2 (BO-06 Users)**: the plan put it last, but every owner answer it waited on is in;
  lead: after F's BO-08 half, beside D.
- **Lead rulings, yours to overturn:** S0's `0009` (`pos_app` SELECT on `schema_migration`, over ARCH-006 case 1);
  ARCH-018's footer-required and `created_by`; C3's acting-manager lock, `OWN_ACCOUNT`/`USER_CHANGED`, `DUPLICATE`'s
  `{ field }`; the S1a and DESIGN-017 round rulings (task files); PHASE0-004 to 013, DESIGN-011-016, ARCH-006, FE-030-036.
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each). Q12 settled the fields.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 question 2; C3's optional AC-18 sentence; ADR-012's optional FR-C7/FR-B1.
- **Kit:** builder `grep`/`python3`/`sed`/`node -e`? `BLOCKED ON APPROVAL` ping? hand-opened roles? reviewer CLI
  override? A `--resume` after a transient API error (529) counts as a round: exempt it? Make the watcher a kit script?
- **§3.2 gate, owner-accepted risks:** same-class PIN reset, username discovery, lockout, cookie jar, the two-tab
  case, saved passwords, sign-in without a pre-session token, the PIN-in-use refusal (C3).
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero (settle before Phase 2's totals).
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.

## Next up

1. **After #130 merges:** fast-forward, `npm ci`; remove the S2b worktree and run dir. **DESIGN-019:** lead reruns its check.
2. **Then S3** (tender types: server and BO-08's payment methods together; C2 §8; S2b's *What S3 needs*).
3. **Design:** DESIGN-019 running; then DESIGN-020 (BO-04), DESIGN-021 (POS addition); then F's BO-07 half; E2 (owner's word).
