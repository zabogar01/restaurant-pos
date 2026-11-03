# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-11-03: #165 PHASE1-S7a and #166 (lead) merged; `development` at `22be697`; dev `pos` at `0014`. **DESIGN-023
(E2, BO-06) opened** (owner's word). Lead branch `agent/lead-1103`, not pushed. Narrative:
[journal/2026-11-02.md](journal/2026-11-02.md).

## Phase and gates

- **Phase 1 (Back office and catalog, ROADMAP `:60-90`): building.** Plan accepted 2026-10-20
  (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`). 11 slices S0-S10. **Done and merged:** S0
  (#115: `0009`), S1a (#119: tables server, `0010`), S1b (#123: BO-05, the rail, the form pattern), S2a (#128: settings
  server, `0011`, `SETTINGS_CHANGED`), S2b (#130: BO-08 settings), S3a (#134: tender methods, `0012`), S3b (#137: BO-08
  methods), S4a (#140: catalog domain, `0013`, `catalogWrite`), S4b (#142: catalog routes, `CATALOG_CHANGED`), S4c1
  (#144: BO-03), S4c2a (#147), S4c2b (#149: BO-04 whole), S5 (#151: the 86 toggle), S6a (#154: presets server,
  `0014`), S6b (#157: BO-07). S0-S6 done. **S7 (POS catalog) in progress:** C4 and DESIGN-021 merged (#162,
  #163); **S7a merged** (#165); S7b1, S7b2, S7b3 to write from C4 *For the lead* and DESIGN-021's Handoff.
- **Rulings by slice** (DECISIONS 2026-10-20 to 22): S2 rates 0-100% (Q2), IDR fixed (Q5), five business details (Q12),
  footer required and `created_by`, DESIGN-018 Q1-Q6; S3 tender reactivation (C2 OQ1), cash and card fixed kinds, a
  custom name may be "Cash"/"Card"; S7 real items into the client stand-in (Q14), **real presets in the POS picker (C4
  OQ1, 11-02), S7b1's PR held for S7b2 (11-02)**; S8 Q1, Q6a, Q7-Q11, C3's OQ1, OQ2.
- **Architecture:** eleven accepted ADRs (001-007, 009-012); ADR-008 deferred. ARCHITECTURE §8: catalog → business day →
  dining table → order → lease/receipt (TenderMethod not in it: Phase 4's, with an architect).
- **Owed, not drafted:** ROADMAP Phase 1 users: role change (Q1c); tender: "reactivate" (OQ1). E2: BO-06 (C3 *Stale* 5).
- **Built:** POS-01 to POS-07 on fixtures (POS-01 real); back office: sign-in, provisional BO-01, M-6, the rail, and
  BO-05, BO-08, BO-03, BO-04, **BO-07** whole. BO-03 and BO-07 merge reads and answers by catalog version (FE-037, S6b
  r3). **Frost designed:** A, B, C, I, E1, F (018, 022), BO-03 (019), BO-04 (020), POS G6 (021, PR #163); **E2 in progress (DESIGN-023)**.
- **Implementation gate: OPEN since 2026-09-14**; nothing open in PRD §9. **Last verify:** S7a final tree
  (`e0b812c`) verify 151 files / 5497 tests, e2e:all 108.

## Integration branch

- **`development`** at `22be697` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed (the server refuses to start until it does, S0),
  **before reporting or dispatching**. `0014` applied; no lockfile change since 10-26.
- **Guard hooks** current (`--check` 2026-10-30); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1103`** (from `22be697`). New lead branches: from
  `origin/development`, then `git branch --unset-upstream`; push with `-u origin <branch>`.
- **Pushing needs the owner's word, every time** (the classifier refuses it otherwise; LESSONS). Ask, then push the task
  and lead branches together. **Run `gh pr view <n> --json state` as its own step before any follow-up push.**
- **Task worktrees:** `wt/DESIGN-023` (live, `npm ci` done). `wt/PHASE1-S7a` removed; `runs/PHASE1-S7a` left. `wt/ARCH-021`,
  `wt/DESIGN-021` merged and clean; their removal (with `runs/DESIGN-021`, `wt/evidence/DESIGN-021`) was refused by the
  classifier, so it is the owner's. Not the lead's:
  `restaurant-pos-design`, `keen-chebyshev-ccf255`.

## Running tasks and agents

- **DESIGN-023** (E2, BO-06 Users; task file committed `736112d` on `agent/design-023`): Codex `gpt-6-astra` high, Herdr
  agent `design023`, pane `DESIGN-023` (`w2:p9S`); a background waiter briefs it once the update prompt (owner's) clears.
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density. **Open
  ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout:
  7200000`, never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has
  it (the script commits it first), `cmp` and delete the kit copy. **Never commit a builder's task file on the lead
  branch.** Preflight reads `depends_on` from the **kit's** task files; a new task's `status:` is `not-started`.
- **Preflight refuses when STATE.md is over its cap**, even by one line. **`max_builders` is 1;** reviewers and
  designers do not count; server and e2e test runs from different worktrees queue on their own locks.
- **Task files** copy the consult verbatim, then rulings, tests, ACs; see LESSONS *Lead* for `owns`, the inert wording
  and builder shell use. **Reviewers cannot reach the database, a browser or the design checks;** the lead runs
  `verify` and `test:e2e:all` in the worktree before review, and its note above the Handoff is the evidence.
- **Lead review instead of a re-review:** trivial changes (`review.trivial_max_lines` 20, no touches flag), or a fully
  ruled fix round whose fixes are the review's own; the lead repeats a red proof by mutating the new code (S6b r3, 021 r2).
- **The browser harness:** `npm run test:e2e` / `test:e2e:all`; not in `verify`. **The lead runs `test:e2e:all` before
  merging any task touching** `apps/`, `packages/api-client`, `packages/contracts` or `db/migrations`. Design checks:
  `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/designNNN.cjs` in a worktree after `npm ci`
  (`design014.cjs` takes `DESIGN014_OUTPUT`, the others `DESIGN_EVIDENCE_DIR`). **The lead runs them for the designer.**
- **The lead cannot sign in to the back office** (no credentials, never the owner's): a screen's look is the owner's.
  **Close panes once no round is expected** (if the classifier refuses, ask the owner). Resume a hand-opened agent
  with `--resume <session>` (grep "You are <name>" in `~/.claude/projects/<worktree-path>/*.jsonl`) in a fresh pane.
- **Background commands die at two hours;** read a report whole even on exit 1. Approvals are the owner's, in the pane;
  **`herdr agent prompt` is refused while an agent shows a question** (a background waiter can send it after).
- **A `--resume` restarts the CLI and re-sends the brief once if it is not working within a minute;** a resumed round
  with no task-file or HEAD change is refused as no verdict. A BLOCKED question the lead can rule without code is ruled
  above the Handoff, committed in the worktree with `git commit -- <task file>` (leaves the builder's staging alone),
  then `--resume --message`. Every resume counts as a round, an idle-stop resume too (LESSONS).
- **`max_fix_cycles` is 2** (three rounds). A round's ruling goes above the Handoff in the worktree, committed there, then
  `--resume --message`; widen `owns` in the same commit when a finding needs a file outside it.
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work** (owner exceptions, each once:
  DESIGN-017 r3, -018 to -020, -022). **Codex allowance:** weekly reset 27 Oct 14:18, seven reviews since; its 5h limit
  ran out mid-design four times (DESIGN-021 r2, 10-30; the same pane resumed after the reset). Stand-ins: wait, OpenCode,
  or an owner exception. Hand-opened: write `runs/<ID>/builder/meta.json` (`{"cli":"codex",…}`) before its review.
- **Designers and architects are hand-opened** (recipes: journal 10-24; Codex also needs `-c
  'sandbox_workspace_write.writable_roots=["<main>/.git"]'`). **A dispatched reviewer cannot run a design check**
  (env-prefixed commands refused): make its probes assertions in the next round. Evidence goes to
  `../restaurant-pos-wt/evidence/<ID>/runN/`. Never print `db/dev.env`. `ask.sh`: Haiku, then luna.

## Live bugs and known defects

- **Owner to see in a browser, then close:** BO-03 (with 86), BO-04, BO-07 (48-row overflow unmeasured), BO-08's
  methods (if not seen before #137); the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the Add gate
  (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787, C4 §5); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7). The
  schema check compares migration names, not contents (S0). `npm ci` warns about install scripts. One high npm advisory,
  development-only (PHASE0-008a). **BO-01 provisional** (S10 builds DESIGN-016). **012a/b:** no `makePeople` in `e2e/`.
- **Lengths are code points** (zod 4.6.5, `char_length`), not the "UTF-16 units" comments (`tables.ts`, `settings.ts`,
  `0010`, `0011`), `D:1607`, DESIGN-019 and two client checks say; the client refuses more, never less. Queued cleanup.
- **For S7b (DESIGN-021):** `fire.ts`'s provisional plural is replaced by DESIGN-021's (S7b2); the DESIGN-007
  `fireblocked` picture's older wording is a known difference; R1's name collision (BO-04 hint) is the owner's.
- **Noted, not filed:** C1 §3.2's S5-5 line; stale "eleven" test titles; `item-editor.html`'s money facts (022 F3);
  third copies of the dialog lifecycle and the name check (extract); `menu-availability.test.tsx:168`'s fixture (FE-037).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **DESIGN-023's Codex update prompt** in pane `DESIGN-023` (Update or Skip): yours; the brief follows on its own.
- **Look at DESIGN-021's states** in the gallery (`docs/design/visual-directions/index.html`, POS-03 served states).
- **Lead rulings since 10-30, yours to overturn:** DESIGN-021 R1 (long tile names), its round 2 rulings (F5 lifetime, F6
  `fire.ts` form stands), the 86-stepper reading; ARCH-021's lead review acceptances (S7b split in three, the revision
  route's client-instance opt-out and log level, no backoff, no option ids in a stand-in line).
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, `:29` on FR-M3/B-2. **Receipt (PRD §9 q1):** RESEARCH-receipt A-E; lead: 1st each.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 question 2; C3's optional AC-18 sentence; ADR-012's optional FR-C7/FR-B1.
- **Kit** (lead, 10-30: allow push to `agent/*` and `gh pr create`; builders read-only `grep` only; drop the rest):
  push/PR permission rule, builder shell tools, approval ping, reviewer CLI override, dispatchable designers.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero (settle before Phase 2's totals).
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.
- **After a different manager signs in**, `OfficeApp.tsx` focuses Log out; DESIGN-022 says New preset (QUEUE; designer).

## Next up

1. **Write S7b1, S7b2, S7b3** (S7b1 copies C4's `idle.spec.ts` B6/B8 warning; its PR waits for S7b2), from C4 *For
   the lead* and DESIGN-021's Handoff; dispatch S7b1 on the owner's word (`max_builders` 1; the designer does not count).
2. **DESIGN-023:** run the checks the designer asks for; on DONE, lead verify, then a Claude Opus review (hand-opened:
   write `runs/DESIGN-023/builder/meta.json` with `{"cli":"codex",…}` first).
3. **Small, between slices:** the code-point cleanup; the frame-focus question; the dialog and name-check extraction.
