# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-26 (wrap-up for a fresh session): `development` at `0d6de09` (#137 S3b and #138 lead record merged); dev `pos`
at `0012`, no migration or lockfile change since. **Nothing is running; no agent but the lead; no task worktree.**
Narrative: [journal/2026-10-24.md](journal/2026-10-24.md), [journal/2026-10-26.md](journal/2026-10-26.md).

## Phase and gates

- **Phase 1 (Back office and catalog, ROADMAP `:60-90`): building.** Plan accepted 2026-10-20
  (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`). 11 slices S0-S10. **Done and merged:** S0
  (#115: compose `name:`, `0009`, startup schema check), S1a (#119: tables server, `0010`, `DUPLICATE`), S1b (#123:
  BO-05, the rail, the form pattern), S2a (#128: settings server, `0011`, `SETTINGS_CHANGED`, the rate codec, the
  installation constants), S2b (#130: BO-08's settings part), S3a (#134: tender methods server, `0012`), **S3b (#137:
  BO-08's payment methods; FR-B7 end to end)**. **Next build: S4a.** Consults: C1 (with ADR-012, #117), C2 (#116), C3
  (#121); C4 (POS catalog) not written; C5 not needed.
- **Rulings by slice** (DECISIONS 2026-10-20 to 22): S2 rates 0-100% (Q2), IDR fixed (Q5), five business details (Q12),
  footer required and `created_by` (owner-confirmed), DESIGN-018 Q1-Q6 (phone without `/`); S3 tender reactivation
  (C2 OQ1), cash and card fixed kinds (C2 §8), a custom name may be "Cash" or "Card" (DESIGN-018 Q1); S7 real items into
  the client stand-in (Q14); S8 Q1, Q6a, Q7-Q11, C3's OQ1 (create audited) and OQ2 (no name correction).
- **Architecture:** eleven accepted ADRs (001-007, 009-012); ADR-008 deferred. ARCHITECTURE §8: catalog → business day →
  dining table → order → lease/receipt (TenderMethod not in it: Phase 4's, with an architect); §7.2 users (#121).
- **Owed, not drafted:** ROADMAP Phase 1's users bullet omits role change (Q1c), its tender bullet "reactivate" (OQ1).
  Designer: BO-06 inventory and sitemap (E2, C3 *Stale text* 5); BO-07 stale-draft states (F's BO-07 half). Plan S1/S8
  goals predate Q10, Q1(b) (later consults win).
- **Built:** POS-01 to POS-07 on fixtures (POS-01 real); back office: sign-in, provisional BO-01, M-6, the rail, BO-05,
  BO-08 whole (settings and payment methods). Pattern later forms copy: `tables/model.ts`, `settings/model.ts`
  (versioned; two parts in one screen model, one command slot as a union, S3b Handoff), `fieldsInError`, `work/guard.ts`,
  `Decision`. **Frost designed:** A, B, C, I, E1 (BO-05), F's BO-08 half (018, 018b), BO-03 (019), BO-04 (020); left:
  DESIGN-021 (POS, G6), F's BO-07 half, E2; G, H later.
- **Implementation gate: OPEN since 2026-09-14** (roadmap archive L135-180); nothing open in PRD §9. **Last verify:** S3b
  (`67d6acd`) verify 122/4486, e2e:all 78.

## Integration branch

- **`development`** at `0d6de09` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed (the server refuses to start until it does, S0),
  **before reporting or dispatching**.
- **Guard hooks** current (`--check` 2026-10-26); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1026`** (from `0d6de09`): this wrap-up, pushed with its PR. The lead
  pushes task and lead branches and opens PRs (owner, DECISIONS 10-21). **Run `gh pr view <n> --json state` as its own
  step before any follow-up push.** After this PR merges, cut the next lead branch from the new `development`.
- **Task worktrees: none** (S3b's removed 10-26). Not the lead's: `../restaurant-pos-design`, `keen-chebyshev-ccf255`,
  branch `setting/add-permission`, pane `w2:pE`.

## Running tasks and agents

- **Nothing running;** Herdr shows only `lead`. **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density. **Open
  ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.
- **For S4a's task file** (detail: journal 2026-10-24, *What the next task files need*): C1 §2, DESIGN-019/020's names and
  price bounds, `reorderItems(categoryId, expected, ids)`, **DESIGN-020 Q1** (option-name swap against a non-deferrable
  partial unique index: removals first, then a swap mechanism, with an architect if needed), DESIGN-020 Q2.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout:
  7200000`, never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has
  it (the script commits it first), delete the kit copy. **Never commit a builder's task file on the lead branch.**
  Worktrees are cut from the local `development`; preflight reads `depends_on` from the **kit's** task files.
- **Preflight refuses when STATE.md is over its cap**, even by one line. **`max_builders` is 1;** reviewers and
  designers do not count; server and e2e test runs from different worktrees queue on their own locks.
- **Task files copy the consult verbatim**, then rulings, tests, ACs. **Reviewers cannot reach the database, a browser
  or the design checks;** the lead's verify note above the Handoff is the evidence (a "blocked" on that is ruled clear).
- **Lead review instead of a re-review:** trivial changes (`review.trivial_max_lines` 20, no touches flag), or a fully
  ruled fix round whose fixes are the review's own; the lead repeats the red proof and writes the note (S1a, S2a, S2b,
  DESIGN-017 to -020). For a design round, re-do the red by **mutating the new code** (old files may lack fixture hooks).
- **The browser harness:** `npm run test:e2e` / `test:e2e:all`; not in `verify`. **The lead runs `test:e2e:all` before
  merging any task touching** `apps/`, `packages/api-client`, `packages/contracts` or `db/migrations`. Design checks:
  `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/designNNN.cjs` in a worktree after `npm ci`
  (`design014.cjs` takes `DESIGN014_OUTPUT`, the others `DESIGN_EVIDENCE_DIR`). **The lead runs them for the designer**
  (saves its allowance and the owner's approvals). `design014` is 287 on `development`.
- **The lead cannot sign in to the back office** (no credentials, never the owner's): a screen's look is the owner's.
  **Close panes once no round is expected;** resume a hand-opened agent with `--resume <session>` (grep "You are <name>"
  in `~/.claude/projects/<worktree-path>/*.jsonl`) in a fresh pane.
- **Background commands die at two hours;** read a report whole even on exit 1. Approvals are the owner's, in the pane;
  **`herdr agent prompt` is refused while an agent shows a question.** The round watcher (text in journal 2026-10-21)
  wakes the lead on a commit, an approval, a gone agent or a 20-minute stall.
- **A `--resume` restarts the CLI and re-sends the brief once if it is not working within a minute;** a resumed round
  with no task-file or HEAD change is refused as no verdict. The lead resets `rounds` only for a round that did no work.
  A BLOCKED question the lead can rule without code is ruled above the Handoff and sent to review, spending no round.
- **`max_fix_cycles` is 2** (three rounds in all). A lead ruling for a round goes above the Handoff in the worktree,
  committed there, then `--resume --message` (builder) or a prompt (hand-opened). Widen `owns` in the same commit when a
  finding needs a file outside it (S2a, S2b: the manifests and lockfile, edited by hand, then the lead's `npm ci`).
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work** (owner exceptions, each once:
  DESIGN-017 r3, -018, -019, -020). **Allowances:** Codex weekly ~20% on 10-22 (resets 27 Oct 14:18); its 5h limit ran out
  mid-design twice. Stand-ins: wait, OpenCode `openai/gpt-6-astra`, or an owner exception. Never `gpt-6-luna` in a slice.
- **Designers are hand-opened** (recipes: journal 2026-10-24). **A Codex start stops on its update prompt (the owner's).**
  Write `.agent/runs/<ID>/builder/meta.json` before a review (`"cli"` decides the reviewer's family). Handover: a note
  above the Handoff naming uncommitted files and rulings, commit only it, brief the next designer to finish.
- **Hand checks serve from the task's worktree** (`build:clients`, `npm run dev -w apps/server`). Never print
  `db/dev.env`. `ask.sh`: Haiku, then luna. Contract: `ALLOW_CONTRACT=1`.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7). The
  schema check compares migration names, not contents (S0). `npm ci` warns about install scripts. One high npm advisory,
  development-only (PHASE0-008a). **BO-01 provisional** (S10 builds DESIGN-016). **012a/b:** no `makePeople` in `e2e/`.
- **Lengths are code points** (zod 4.6.5, `char_length`), not the "UTF-16 units" comments, `D:1607` and two client checks
  say; the client refuses more, never less. Queued cleanup (QUEUE lists every place; S3a's new comments are correct).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Lead rulings, yours to overturn:** S3b (task file): one screen model; client sort; `DUPLICATE` before its reread;
  BO-05's `load` fixed in S3b (F1); the added browser spec. DESIGN-020 (task file *Handover*, *Round 2*): names 1-64/1-32; *Keep* on child
  rows (touched row keeps the draft whole; an exception to DESIGN-018's no-merge, child rows only); URL-only return
  plumbing; BO-04's own read; over-maximum variant noted, not refused. The S3 split. DESIGN-019 F7; S2b's first-run
  unknown sentence; the NPWPD without a charset; S1b's nine rulings and two questions; S0's `0009`; C3's acting-manager
  lock, `OWN_ACCOUNT`/`USER_CHANGED`, `DUPLICATE`'s `{ field }`; the S1a and DESIGN-017 round rulings; PHASE0-004 to
  013, DESIGN-011-016, ARCH-006, FE-030-036.
- **When to start design slice E2 (BO-06 Users)**: every owner answer it waited on is in; lead: after DESIGN-021.
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each). Q12 settled the fields.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 question 2; C3's optional AC-18 sentence; ADR-012's optional FR-C7/FR-B1.
- **Kit:** builder `grep`/`python3`/`sed`/`node -e`? `BLOCKED ON APPROVAL` ping? A reviewer CLI override? Dispatchable
  designers? Exempt a `--resume` after a 529 from the round count? The round watcher as a kit script?
- **§3.2 gate, owner-accepted risks:** same-class PIN reset, username discovery, lockout, cookie jar, the two-tab
  case, saved passwords, sign-in without a pre-session token, the PIN-in-use refusal (C3).
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero (settle before Phase 2's totals).
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.

## Next up

1. **S4a** (the catalog server, from the inputs above; `touches` likely `boundaries`, maybe `money` for prices).
2. **DESIGN-021** (the POS addition, G6; Codex hand-opened, the lead runs its checks), beside S4a (Codex resets 27 Oct
   14:18). **Small:** the code-point lengths cleanup (BO-05's `tables/label.ts`, older comments), between slices.
