# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-11-10: **all eleven Phase 1 slices merged** (S9 #180, S10 #181; lead #179). `development` at `de82604`, main
checkout fast-forwarded; verify there 180 files / 6284 tests, e2e:all 152. Nothing running. Lead branch
`agent/lead-1110b` (the gate report; #182 merged before it), unpushed. Narrative: [journal/2026-11-10.md](journal/2026-11-10.md).

## Phase and gates

- **Phase 1 (Back office and catalog, ROADMAP `:60-90`): built; the gate is next.** Plan accepted 2026-10-20
  (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`). 11 slices S0-S10. **Done and merged:** S0
  (#115: `0009`), S1a (#119: tables server, `0010`), S1b (#123: BO-05, the rail, the form pattern), S2a (#128: settings
  server, `0011`), S2b (#130: BO-08 settings), S3a (#134: tender methods, `0012`), S3b (#137: BO-08 methods), S4a (#140:
  catalog domain, `0013`), S4b (#142: catalog routes), S4c1 (#144: BO-03), S4c2a (#147), S4c2b (#149: BO-04), S5 (#151:
  86), S6a (#154: presets server, `0014`), S6b (#157: BO-07), S7a (#165), S7b1-3 (#169-171: the served POS catalog),
  S8a (#173: users server, `0015`), S8b (#174: credentials, the re-stamp), S8c1 (#177) and S8c2 (#178): BO-06 Staff and
  FR-B3 end to end, AC-32 in the browser; S9 (#180: POS-03's actor group and Release), S10 (#181: BO-01 from DESIGN-016).
- **Rulings by slice** (DECISIONS 2026-10-20 to 22, 11-02): S2 Q2, Q5, Q12, DESIGN-018 Q1-Q6; S3 C2 OQ1; S7 Q14, C4 OQ1; S8
  Q1, Q6a, Q7-Q11, C3's OQ1 (create audited), OQ2 (no rename).
- **Architecture:** eleven accepted ADRs (001-007, 009-012); ADR-008 deferred. **Owed, not drafted:** ROADMAP Phase 1
  users: role change (Q1c); tender: "reactivate" (OQ1).
- **Built:** POS-01 to POS-07; BO-01, M-6, BO-03 to BO-08. **Frost designed:** all but BO-09, BO-10, 11.
- **Implementation gate: OPEN since 2026-09-14**; nothing open in PRD §9. **Last verify:** `development` `de82604`,
  verify 180 files / 6284 tests, e2e:all 152 (lead, 2026-11-10).

## Integration branch

- **`development`** at `de82604` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the lockfile
  changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**. No lockfile change since 10-26.
- **Dev `pos` is at `0015`**, matching `development` (checked 11-10: S9 and S10 added no migration or lockfile change).
- **Guard hooks** current (`--check` 2026-11-05); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1110b`** (from `origin/development` at `0d42d54` after #182
  merged; unpushed). **After a dependency merges, merge `origin/development` into
  the lead branch before a dry run:** the kit reads `depends_on` from its own task files (S8c1, S8c2). New lead branches:
  from `origin/development`, `git branch --unset-upstream`, `-u origin` on push.
- **Pushing needs the owner's word, every time** (LESSONS); `gh pr view <n> --json state` before any follow-up push.
- **Task worktrees:** none live; S9's and S10's removed 11-10 with runs and local branches. Left behind:
  `wt/evidence/PHASE1-S9`, `-S10` (screenshots), `runs/PHASE1-S7a`, `runs/DESIGN-021`, `-023`, `wt/evidence/DESIGN-021`,
  `-023`; `wt/ARCH-021`, `wt/DESIGN-021` (the owner's). Not ours: `restaurant-pos-design`, `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Nothing running; only `lead` in Herdr. BO-06 as built** (`apps/back-office/src/staff/`): `/back-office/staff`, rail *Staff*; one model, one command slot;
  credentials in native uncontrolled inputs, emptied when a command answers; the own-password cooldown in the model,
  keyed to the manager, its deadline fixed on arrival. S8c2's decisions 2, 3, 5 (a blocked form is not dirty; a
  `DUPLICATE` on an unshown field is general; the warning is hidden on a blocked form) accepted by the lead.
- **S9 and S10 as built:** POS-03's routed bar draws `ActorChip` with Release (the floor's look). BO-01: the content
  pane is a `div` with `role="main"` only while framed, kept mounted (ADR-011 rule 22); the lock is announced once
  through a ref-written status element. M-6: N1 built, N3/F4 not (queued).
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density. **Open
  ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout: 7200000`,
  never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has it, `cmp`
  and delete the kit copy. **Never commit a builder's task file on the lead branch.** A new task's `status:` is
  `not-started`. **`base:`** cuts a worktree from another branch; `depends_on` must be `complete`.
- **Preflight refuses when STATE.md is over its cap.** **`max_builders` is 1;** reviewers and designers do not count.
- **Task files** copy the consult verbatim (by line range with `sed`), then rulings, tests, ACs; check each cited
  path against today's code, and **run the baseline verify on `development` yourself** (S8c1's was wrong). **Spell out
  test-first:** "run each test against the code before your change and record the failure before writing production
  code" (S8c2 ruling 16); without it builders wrote code first (S8b, S8c1 round 1). **Reviewers cannot reach the database or a browser:** the lead's verify note is the evidence.
- **Lead review instead of a re-review:** trivial changes (≤20 lines, no touches flag), or a fully ruled fix round; the
  lead repeats a red proof by mutating the new code, then restores the file from a copy and checks `git status`.
- **Exit 4 is not always a stop:** read the pane first. **A waiter killed at two hours writes no `session` file:** write it
  from `herdr agent list`'s `agent_session.value` before a `--resume` (LESSONS). **Builders still use heredocs** and stop
  on approval prompts (the owner's). **A forced file outside `owns`:** widen `owns` in the worktree's task file (commit it
  alone); the lead may commit the builder's own edit unchanged to save a round (S8a `d191ef7`).
- **The browser harness:** `npm run test:e2e` / `test:e2e:all`; not in `verify`. **The lead runs `test:e2e:all` before
  merging any task touching** `apps/`, `packages/api-client`, `packages/contracts` or `db/migrations`. Design checks:
  `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/designNNN.cjs` in a worktree after `npm ci`.
- **The lead cannot sign in to the back office:** a screen's look is the owner's. **Close panes once no round is expected.**
- **Background commands die at two hours;** read a report whole even on exit 1. Approvals are the owner's, in the pane;
  `herdr agent prompt` is refused while an agent shows a question. **`max_fix_cycles` is 2** (three rounds; every
  resume counts): a round's ruling goes above the Handoff in the worktree, committed there, then `--resume --message`.
- **Codex reviews Claude-built work; Claude Opus reviews Codex- or OpenCode-built work** (owner exceptions, each once).
  Codex's limit: wait for the reset its log names, then `--role reviewer --resume` (S8c2, 11-09); OpenCode, or an exception. Hand-opened work: write `runs/<ID>/builder/meta.json` first.
- **Designers and architects are hand-opened** (recipes: journal 10-24, 11-03). Evidence: `../restaurant-pos-wt/evidence/<ID>/`.
  Never print `db/dev.env`. `ask.sh`: Haiku, then luna.

## Live bugs and known defects

- **Owner to see in a browser, then close:** POS-03's Release (#180); BO-01 (#181); BO-06 Staff (#177, #178); the served POS (#169-171: the menu, M-2, the preset picker, whose layout
  of 40 entries, a 32-code-point name, the full-width Cancel and the gated entries was never measured); BO-03 (with 86),
  BO-04, BO-07 (48-row overflow unmeasured), BO-08's methods; the Burger-tile fix (FE-021 `7268943`); POS-03 Add (L353);
  DESIGN-021's and DESIGN-023's states in the gallery (`docs/design/visual-directions/index.html`).
- **Money (ARCH-003, 9.6):** `closeOrder` takes any drafts; only Add keeps a card under the balance (B-5).
- **Must not become a guarantee:** optional `OrderLine.itemId` (C4 §5); the in-memory refund and change walk; S7b3's
  optional `DiscountChange.shown` (its one caller always passes it); every POS store check is a stand-in (Phase 2).
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7). The
  schema check compares migration names, not contents (S0). `npm ci` warns about install scripts. One high npm advisory,
  development-only (PHASE0-008a). **012a/b:** no `makePeople` in `e2e/`.
  S8a: `reactivateUser` hashes a supplied PIN even for a no-op (cost only). `packages/contracts/src/users.ts` says
  `StaffName` counts UTF-16 units; zod counts code points (S8c1, S8c2 pair tests).
- **Lengths are code points** (zod 4.6.5, `char_length`), not the "UTF-16 units" comments (`tables.ts`, `settings.ts`,
  `0010`, `0011`), `D:1607`, DESIGN-019 and two client checks say; the client refuses more, never less. Queued cleanup.
- **From S7b1:** other screens' `import.meta.env.DEV` fixture gates stay (Phase 2); `SessionStore.catalogReads` optional;
  the hidden-tab pause proved in jsdom only. DESIGN-021 R1's name collision (BO-04 hint) is the owner's.
- **Noted, not filed:** C1 §3.2's S5-5 line; stale "eleven" test titles; `item-editor.html`'s money facts;
  `menu-availability.test.tsx:168`'s fixture; act warnings in `staff-credentials` and `item` tests.

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Push `agent/lead-1110b` (the gate report) and open its PR?** **Close Phase 1** on `.agent/reviews/PHASE1-gate.md`?
- **DESIGN-023 F3:** does a browser offer to save a PIN or another's password typed on Staff (Add person, Reset PIN,
  Reset password)? Unverified; a headed Chrome/Firefox check, now possible on `development`; if a prompt appears, does
  the 2026-10-13 "does not fight the password manager" ruling extend?
- **Lead rulings since 10-30, yours to overturn** (each in its task file): DESIGN-021 R1 and round 2; ARCH-021's
  acceptances; DESIGN-023 R1, R2 and round 2; S7b1 round 2; S7b2 R3 (two or more removed choices show the generic
  *changed* sentence; a drawn plural is queued, QUEUE 8c); S7b3 rulings 1-6 (presets from the catalog store in both
  modes, the decimal comma, the gated label) and round 2 (an approval binds the snapshot it displays); S8a rulings 1-8
  (C3's three readings accepted, audit rollback by privilege) and the lead's commit of the builder's forced test edit; S8b
  rulings 1-13 and R1; **the S8c split** and S8c1 rulings 1-21 (`/back-office/staff`, no placeholders, row-command
  refusals as definite failures); S8c2 rulings 1-16 and decision 5 (the warning hidden on a blocked form); S9
  rulings 1-7 (routed bar only, the floor's look); S10 rulings 1-8 (one `main` by role) and round 2 (mixed fields).
- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording; (2) best-effort cancel reports;
  (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN timing leak
  for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP `:50`** waits on ARCH-013 item 2, `:29` on FR-M3/B-2. **Receipt (PRD §9 q1):** RESEARCH-receipt A-E; lead: 1st.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014);
  FR-J3/AC-18 for a refused void; §9 question 2; C3's optional AC-18 sentence; ADR-012's optional FR-C7/FR-B1.
- **Kit:** a push/PR permission rule; builder shell tools (heredocs keep stopping builders); dispatchable designers.
- **FR-M3 / B-2:** "half-up" below zero vs the code's half away from zero (before Phase 2). **Ten `conversation only` lines** in DECISIONS.

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.
- **After a different manager signs in**, `OfficeApp.tsx` focuses Log out; DESIGN-022/023 say the screen's create control.

## Next up

1. **Phase 1 gate report written** (`.agent/reviews/PHASE1-gate.md`, recommends closing); the owner closes Phase 1, then
   commission the Phase 2 plan (architect, as ARCH-017).
2. **Small, between slices:** the code-point cleanup (now also `contracts/src/users.ts`); the frame focus
   (`OfficeApp.tsx`: Log out today, DESIGN-022/023 want the screen's create control); the dialog and name-check extraction.
