# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-11-05: `development` at `a589c23`; dev `pos` at `0014`. **S7b1 and S7b2 complete, PRs #169 and #170 open**
(owner: push both). **S7b3 written**, untracked in the kit. Narrative: [journal/2026-11-04.md](journal/2026-11-04.md).

## Phase and gates

- **Phase 1 (Back office and catalog, ROADMAP `:60-90`): building.** Plan accepted 2026-10-20
  (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`). 11 slices S0-S10. **Done and merged:** S0
  (#115: `0009`), S1a (#119: tables server, `0010`), S1b (#123: BO-05, the rail, the form pattern), S2a (#128: settings
  server, `0011`, `SETTINGS_CHANGED`), S2b (#130: BO-08 settings), S3a (#134: tender methods, `0012`), S3b (#137: BO-08
  methods), S4a (#140: catalog domain, `0013`, `catalogWrite`), S4b (#142: catalog routes, `CATALOG_CHANGED`), S4c1
  (#144: BO-03), S4c2a (#147), S4c2b (#149: BO-04 whole), S5 (#151: the 86 toggle), S6a (#154: presets server,
  `0014`), S6b (#157: BO-07), **S7a (#165: the two POS catalog routes)**. **S7 in progress:** S7b1 (#169) and S7b2
  (#170) complete, PRs open; S7b3 written. Then S8a-c (users, C3; S8c from DESIGN-023), S9, S10.
- **Rulings by slice** (DECISIONS 2026-10-20 to 22): S2 rates 0-100% (Q2), IDR fixed (Q5), five business details (Q12),
  footer required and `created_by`, DESIGN-018 Q1-Q6; S3 tender reactivation (C2 OQ1), cash and card fixed kinds, a
  custom name may be "Cash"/"Card"; S7 real items into the client stand-in (Q14), real presets in the POS picker (C4
  OQ1, 11-02), **S7b1's PR held for S7b2, merged together (11-02)**; S8 Q1, Q6a, Q7-Q11, C3's OQ1, OQ2.
- **Architecture:** eleven accepted ADRs (001-007, 009-012); ADR-008 deferred. §8: catalog → day → table → order → lease.
- **Owed, not drafted:** ROADMAP Phase 1 users: role change (Q1c); tender: "reactivate" (OQ1).
- **Built:** POS-01 to POS-07 on fixtures (POS-01 real); back office BO-01 (provisional), M-6, BO-03/04/05/07/08.
  **Frost designed:** all but G (BO-09) and H (BO-10, 11); **E2 BO-06 is DESIGN-023 (#167)**.
- **Implementation gate: OPEN since 2026-09-14**; nothing open in PRD §9. **Last verify:** S7b2 final tree
  (`dcc19ef`) verify 157 files / 5696 tests, e2e:all 130.

## Integration branch

- **`development`** at `a589c23` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the
  lockfile changed, `npm run db:migrate` if a migration landed (the server refuses to start until it does, S0),
  **before reporting or dispatching**. `0014` applied; no lockfile change since 10-26.
- **Guard hooks** current (preflight `--check` 2026-11-04); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1104`** (from `a589c23`; the five post-#168 commits cherry-picked,
  the kit's `base:` change among them). New lead branches: from `origin/development`, then `git branch
  --unset-upstream`; push with `-u origin <branch>`.
- **Pushing needs the owner's word, every time** (LESSONS); push task and lead branches together; `gh pr view <n>
  --json state` as its own step before any follow-up push.
- **Task worktrees:** `wt/PHASE1-S7b1`, `wt/PHASE1-S7b2` (PRs open; remove after merge, with their `runs/` and
  `wt/evidence/`). Left behind: `runs/PHASE1-S7a`, `runs/DESIGN-023`, `wt/evidence/DESIGN-023`; `wt/ARCH-021`, `wt/DESIGN-021`
  (removal refused by the classifier: the owner's). Not ours: `restaurant-pos-design`, `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Nothing running; only `lead` in Herdr.**
- **PRs #169 (S7b1, `ae44200`) and #170 (S7b2, `988baa8`) open,** both against `development`; #170 holds S7b1's
  commits, so #169 merges first. **Owner looks at the served POS before merging (`touches: money, boundaries`).**
- **PHASE1-S7b3 written** (`.agent/tasks/PHASE1-S7b3-served-preset-picker.md`, untracked in the kit; `base:
  agent/phase1-s7b2`; dry run clean: Sonnet builder, Codex reviews). Lead rulings 1-6 in it (presets from the catalog
  store in both modes, `PRESETS` fixture-only, served M-3 vs reviewed fixture picker, gated label, decimal comma).
- **For S8c (from DESIGN-023):** FR-B3's own-PIN words (every other session ends); a Chrome/Firefox save-prompt check (F3).
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density. **Open
  ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout: 7200000`,
  never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has it, `cmp`
  and delete the kit copy. **Never commit a builder's task file on the lead branch.** A new task's `status:` is
  `not-started`. **`base:` (11-04)** cuts a worktree from another branch; `depends_on` is read from the kit's task
  files, else the dependency's worktree, and must be `complete`.
- **Preflight refuses when STATE.md is over its cap.** **`max_builders` is 1;** reviewers and designers do not count.
- **Task files** copy the consult verbatim, then rulings, tests, ACs; see LESSONS *Lead* for `owns`, the inert wording
  and builder shell use. **Reviewers cannot reach the database, a browser or the design checks;** the lead runs
  `verify` and `test:e2e:all` in the worktree before review, and its note above the Handoff is the evidence.
- **Lead review instead of a re-review:** trivial changes (≤20 lines, no touches flag), or a fully ruled fix round; the
  lead repeats a red proof by mutating the new code. A builder cannot check out an older commit: the lead does that.
- **The browser harness:** `npm run test:e2e` / `test:e2e:all`; not in `verify`. **The lead runs `test:e2e:all` before
  merging any task touching** `apps/`, `packages/api-client`, `packages/contracts` or `db/migrations`. Design checks:
  `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/designNNN.cjs` in a worktree after `npm ci`
  (`design014.cjs` takes `DESIGN014_OUTPUT`, the others `DESIGN_EVIDENCE_DIR`). **The lead runs them for the designer**
  (in one background script, every check, each to `runN/designNNN/stdout.txt`; read each JSON's passed/failures).
- **The lead cannot sign in to the back office:** a screen's look is the owner's. **Close panes once no round is
  expected.** Resume a hand-opened agent with `--resume <session>` (grep "You are <name>" in its `.jsonl`).
- **Background commands die at two hours;** read a report whole even on exit 1. Approvals are the owner's, in the pane;
  `herdr agent prompt` is refused while an agent shows a question. **`max_fix_cycles` is 2** (three rounds; every
  resume counts): a round's ruling goes above the Handoff in the worktree, committed there, then `--resume --message`.
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work** (owner exceptions, each once:
  DESIGN-017 r3, -018 to -020, -022, -023). **Codex's 5h limit** ran out mid-design five times (last DESIGN-023,
  11-03); stand-ins: wait, OpenCode, or an owner exception. Hand-opened: write `runs/<ID>/builder/meta.json`
  (`{"cli":…}`, the author's family decides the reviewer) before its review.
- **Designers and architects are hand-opened** (recipes: journal 10-24 and 11-03; Codex also needs `-c
  'sandbox_workspace_write.writable_roots=["<main>/.git"]'`; its update prompt is the owner's, a background waiter
  briefs after it). A designer's claimed edit is checked with `git diff` before a run (DESIGN-023 run2). Evidence goes
  to `../restaurant-pos-wt/evidence/<ID>/runN/`. Never print `db/dev.env`. `ask.sh`: Haiku, then luna.

## Live bugs and known defects

- **Owner to see in a browser, then close:** BO-03 (with 86), BO-04, BO-07 (48-row overflow unmeasured), BO-08's
  methods (if not seen before #137); the Burger-tile fix (FE-021 `7268943`, L257-262); POS-03 Add (L353); DESIGN-021's
  and DESIGN-023's states in the gallery (`docs/design/visual-directions/index.html`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` accepts any drafts; only the Add gate keeps a card under the balance (B-5).
- **Must not become a guarantee:** optional `OrderLine.itemId` (C4 §5); the in-memory refund and change walk.
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7). The
  schema check compares migration names, not contents (S0). `npm ci` warns about install scripts. One high npm advisory,
  development-only (PHASE0-008a). **BO-01 provisional** (S10 builds DESIGN-016). **012a/b:** no `makePeople` in `e2e/`.
- **Lengths are code points** (zod 4.6.5, `char_length`), not the "UTF-16 units" comments (`tables.ts`, `settings.ts`,
  `0010`, `0011`), `D:1607`, DESIGN-019 and two client checks say; the client refuses more, never less. Queued cleanup.
- **From S7b1, not fixed:** the other screens' `import.meta.env.DEV` fixture-state gates stay (Phase 2);
  `SessionStore.catalogReads` is optional (`fixtureSession.ts` was outside `owns`); the hidden-tab pause is proved in
  jsdom only. **For S7b2:** `fire.ts`'s provisional plural; R1's name collision (BO-04 hint) is the owner's.
- **Noted, not filed:** C1 §3.2's S5-5 line; stale "eleven" test titles; `item-editor.html`'s money facts; extract the
  dialog lifecycle and name check; `menu-availability.test.tsx:168`'s fixture.

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Dispatch PHASE1-S7b3?** Written; dry run clean. **Push `agent/lead-1104`** (unpushed commits since 11-04) and open
  its PR? **Look at the served POS** in a browser, then merge #169 before #170.
- **DESIGN-023 F3:** does `autocomplete="new-password"` stop a save prompt for a PIN or another's password? Unverified;
  S8c checks by hand; if a prompt appears, does the 2026-10-13 "does not fight the password manager" ruling extend?
- **Lead rulings since 10-30, yours to overturn** (each in its task file): DESIGN-021 R1 and round 2; ARCH-021's
  acceptances; DESIGN-023 R1, R2 (each screen's create control takes focus) and round 2; S7b1 round 2; S7b2 R3 (two
  or more removed choices show the generic *changed* sentence; plural queued, QUEUE 8c); S7b3 rulings 1-6.
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, `:29` on FR-M3/B-2. **Receipt (PRD §9 q1):** RESEARCH-receipt A-E; lead: 1st.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 question 2; C3's optional AC-18 sentence; ADR-012's optional FR-C7/FR-B1.
- **Kit:** a push/PR permission rule; builder shell tools; dispatchable designers (lead, 10-30: first two yes).
- **FR-M3 / B-2:** "half-up" below zero vs the code's half away from zero (before Phase 2). **Ten `conversation only` lines** in DECISIONS.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.
- **After a different manager signs in**, `OfficeApp.tsx` focuses Log out; DESIGN-022/023 say the screen's create control.

## Next up

1. **Dispatch S7b3** on the owner's word; verify, Codex review, as S7b2. Its PR follows #169 and #170.
2. **After #169/#170 merge:** fetch, fast-forward; remove the two worktrees, `runs/` and evidence.
3. **Small, between slices:** the code-point cleanup; the frame focus (`OfficeApp.tsx`, per-screen create control);
   the dialog and name-check extraction. Then S8a (users server, C3).
