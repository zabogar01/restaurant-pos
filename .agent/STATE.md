# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-28 (wrap-up for a fresh session): `development` at `beda531` (#151 S5 and #152 merged); dev `pos` at `0013`.
**Nothing running; no agent but the lead; no task worktree.** Lead branch `agent/lead-1028` holds this wrap-up, **not
pushed** (ask the owner). Narrative: [journal/2026-10-27.md](journal/2026-10-27.md), [journal/2026-10-28.md](journal/2026-10-28.md).

## Phase and gates

- **Phase 1 (Back office and catalog, ROADMAP `:60-90`): building.** Plan accepted 2026-10-20
  (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`). 11 slices S0-S10. **Done and merged:** S0
  (#115: `0009`), S1a (#119: tables server, `0010`), S1b (#123: BO-05, the rail, the form pattern), S2a (#128: settings
  server, `0011`, `SETTINGS_CHANGED`), S2b (#130: BO-08 settings), S3a (#134: tender methods, `0012`), S3b (#137: BO-08
  methods), S4a (#140: catalog domain, `0013`, `catalogWrite`), S4b (#142: catalog routes, `CATALOG_CHANGED`), S4c1
  (#144: BO-03), S4c2a (#147) and S4c2b (#149: BO-04 whole), **S5 (#151: the 86 toggle, server and BO-03)**. S4 and S5
  are done. **Next: S6a** (presets server, C1 §4); S6b (BO-07) waits on design F's BO-07 half. C4 (POS catalog) not
  written; S7 needs it.
- **Rulings by slice** (DECISIONS 2026-10-20 to 22): S2 rates 0-100% (Q2), IDR fixed (Q5), five business details (Q12),
  footer required and `created_by`, DESIGN-018 Q1-Q6; S3 tender reactivation (C2 OQ1), cash and card fixed kinds, a
  custom name may be "Cash"/"Card"; S7 real items into the client stand-in (Q14); S8 Q1, Q6a, Q7-Q11, C3's OQ1, OQ2.
- **Architecture:** eleven accepted ADRs (001-007, 009-012); ADR-008 deferred. ARCHITECTURE §8: catalog → business day →
  dining table → order → lease/receipt (TenderMethod not in it: Phase 4's, with an architect).
- **Owed, not drafted:** ROADMAP Phase 1's users bullet omits role change (Q1c), its tender bullet "reactivate" (OQ1).
  Designer: **BO-07 (F's BO-07 half, needed for S6b)**; BO-06 inventory and sitemap (E2, C3 *Stale text* 5).
- **Built:** POS-01 to POS-07 on fixtures (POS-01 real); back office: sign-in, provisional BO-01, M-6, the rail (Menu,
  Tables, Settings), BO-05, BO-08 whole, **BO-03 whole (86 included), BO-04 whole**. Shared: `forms/Decision.tsx`,
  `forms/answer.ts`, `fieldsInError`, `work/guard.ts`; models `tables/`, `settings/`, `menu/`, `item/`. **Frost
  designed:** A, B, C, I, E1, F's BO-08 half, BO-03 (019), BO-04 (020); left: DESIGN-021 (POS, G6), F's BO-07 half, E2.
- **Implementation gate: OPEN since 2026-09-14**; nothing open in PRD §9. **Last verify:** S5 final tree (`d1f6daf`)
  verify 142 files / 5226 tests, e2e:all 100.

## Integration branch

- **`development`** at `beda531` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed (the server refuses to start until it does, S0),
  **before reporting or dispatching**. `0013` applied 2026-10-26; no lockfile or migration change since.
- **Guard hooks** current (`--check` 2026-10-28); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1028`** (from `beda531`). Cut each new lead branch from
  `origin/development`, then `git branch --unset-upstream`; push with `-u origin <branch>`.
- **Pushing needs the owner's word, every time** (the classifier refuses it otherwise; LESSONS). Ask, then push the task
  and lead branches together. **Run `gh pr view <n> --json state` as its own step before any follow-up push.**
- **Task worktrees: none** (S5's removed 10-28). Not the lead's: `../restaurant-pos-design`, `keen-chebyshev-ccf255`,
  branch `setting/add-permission`.

## Running tasks and agents

- **Nothing running;** Herdr shows only `lead`.
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density. **Open
  ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout:
  7200000`, never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has
  it (the script commits it first), `cmp` and delete the kit copy. **Never commit a builder's task file on the lead
  branch.** Preflight reads `depends_on` from the **kit's** task files; a new task's `status:` is `not-started`.
- **Preflight refuses when STATE.md is over its cap**, even by one line. **`max_builders` is 1;** reviewers and
  designers do not count; server and e2e test runs from different worktrees queue on their own locks.
- **Task files** copy the consult verbatim, then rulings, tests, ACs; see LESSONS *Lead* (10-27/28) for `owns`, the
  inert wording and builder shell use. **Reviewers cannot reach the database, a browser or the design checks;** the
  lead runs `verify` and `test:e2e:all` in the worktree before review, and its note above the Handoff is the evidence.
- **Lead review instead of a re-review:** trivial changes (`review.trivial_max_lines` 20, no touches flag), or a fully
  ruled fix round whose fixes are the review's own. The lead repeats the red proof by mutating the new code (`sed`, run
  the file, `git checkout --` it) and writes the note. Done this way: S4c2a, S4c2b and S5 round 2.
- **The browser harness:** `npm run test:e2e` / `test:e2e:all`; not in `verify`. **The lead runs `test:e2e:all` before
  merging any task touching** `apps/`, `packages/api-client`, `packages/contracts` or `db/migrations`. Design checks:
  `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/designNNN.cjs` in a worktree after `npm ci`
  (`design014.cjs` takes `DESIGN014_OUTPUT`, the others `DESIGN_EVIDENCE_DIR`). **The lead runs them for the designer.**
- **The lead cannot sign in to the back office** (no credentials, never the owner's): a screen's look is the owner's.
  **Close panes once no round is expected;** resume a hand-opened agent with `--resume <session>` (grep "You are <name>"
  in `~/.claude/projects/<worktree-path>/*.jsonl`) in a fresh pane.
- **Background commands die at two hours;** read a report whole even on exit 1. Approvals are the owner's, in the pane;
  **`herdr agent prompt` is refused while an agent shows a question.** The auto-mode classifier sometimes gives no
  verdict on a Bash or Edit call; retry once, or do read-only work and come back.
- **A `--resume` restarts the CLI and re-sends the brief once if it is not working within a minute;** a resumed round
  with no task-file or HEAD change is refused as no verdict. A BLOCKED question the lead can rule without code is ruled
  above the Handoff, committed in the worktree with `git commit -- <task file>` (leaves the builder's staging alone),
  then `--resume --message`.
- **`max_fix_cycles` is 2** (three rounds in all). A lead ruling for a round goes above the Handoff in the worktree,
  committed there, then `--resume --message` (builder). Widen `owns` in the same commit when a finding needs a file
  outside it.
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work** (owner exceptions, each once:
  DESIGN-017 r3, -018, -019, -020). **Allowances:** Codex's weekly reset was 27 Oct 14:18; three reviews since (S4c2a,
  S4c2b, S5). Its 5h limit ran out mid-design twice. Stand-ins: wait, OpenCode `openai/gpt-6-astra`, or an owner
  exception.
- **Designers are hand-opened** (recipes: journal 2026-10-24; a Codex start stops on its update prompt, the owner's).
- **Hand checks** serve from the task's worktree. Never print `db/dev.env`. `ask.sh`: Haiku, then luna.

## Live bugs and known defects

- **Owner to see in a browser, then close:** BO-03 (with 86) and BO-04 (S4c1, S4c2a/b, S5: none was confirmed seen
  before merge); BO-08's methods part (S3b, if not seen before #137); the Burger-tile fix (FE-021 `7268943`, L257-262);
  POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7). The
  schema check compares migration names, not contents (S0). `npm ci` warns about install scripts. One high npm advisory,
  development-only (PHASE0-008a). **BO-01 provisional** (S10 builds DESIGN-016). **012a/b:** no `makePeople` in `e2e/`.
- **Lengths are code points** (zod 4.6.5, `char_length`), not the "UTF-16 units" comments (`tables.ts`, `settings.ts`,
  `0010`, `0011`), `D:1607`, DESIGN-019 and two client checks say; the client refuses more, never less. Queued cleanup.
- **Noted, not filed:** C1 §3.2's S5-5 red line is imprecise; stale "eleven" test titles (journal 2026-10-28).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Lead rulings, yours to overturn** (each in its task file): S5 (route names; a no-op 86 announces the reached
  state); S4c2b (option uniqueness by `lower(name)`; saved name on removal; F3 rejected); S4c2a (the split; the item in
  client state at `/back-office/menu/item`; BO-04's own read; top bar kept; one command across BO-03/BO-04); S4c1; S4b
  (bare `DUPLICATE`); S4a (option swap by temporary deactivation); S3b; DESIGN-020; DESIGN-019 F7; S2b; S1b; S0; C3;
  S1a; DESIGN-017; PHASE0-004-013; DESIGN-011-016; ARCH-006; FE-030-036.
- **When to start design slice E2 (BO-06 Users), and F's BO-07 half:** every owner answer they waited on is in. Lead:
  BO-07 first (S6b needs it), beside S6a; then DESIGN-021; then E2.
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, **`:29`** on FR-M3/B-2 below (journal 2026-10-12 *Evening* items 4, 5).
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, A to E; lead: the first of each). Q12 settled the fields.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 question 2; C3's optional AC-18 sentence; ADR-012's optional FR-C7/FR-B1.
- **Kit:** a permission rule for `git push` and `gh pr create`, so the lead need not ask each time? Builder
  `grep`/`python3`/`sed`/`node -e`? `BLOCKED ON APPROVAL` ping? A reviewer CLI override? Dispatchable designers? Exempt
  a `--resume` after a 529 from the round count? The round watcher as a kit script?
- **§3.2 gate, owner-accepted risks:** same-class PIN reset, username discovery, lockout, cookie jar, the two-tab
  case, saved passwords, sign-in without a pre-session token, the PIN-in-use refusal (C3).
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero (settle before Phase 2's totals).
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.

## Next up

1. **S6a** (presets server, plan S6; C1 §4 verbatim; `0014`; touches money): write and dispatch. Beside it, **design F's
   BO-07 half** (Codex hand-opened; the lead runs the checks), which S6b needs.
2. **Then S6b** (BO-07), **DESIGN-021** (POS addition, G6), **C4** (the POS catalog consult, for S7). **Small:** the
   code-point cleanup between slices.
