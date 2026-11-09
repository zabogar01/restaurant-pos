# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-11-09: **#177 S8c1 and #176 (lead) merged**; `development` at `599f724` (verify 171 / 6086); dev `pos` at `0015`.
**S8c2 built and lead-verified; Codex review running.** Lead branch renamed `agent/lead-1109` (holds `development`, unpushed).
Narrative: [journal/2026-11-06.md](journal/2026-11-06.md); 11-09 not yet written.

## Phase and gates

- **Phase 1 (Back office and catalog, ROADMAP `:60-90`): building.** Plan accepted 2026-10-20
  (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`). 11 slices S0-S10. **Done and merged:** S0
  (#115: `0009`), S1a (#119: tables server, `0010`), S1b (#123: BO-05, the rail, the form pattern), S2a (#128: settings
  server, `0011`), S2b (#130: BO-08 settings), S3a (#134: tender methods, `0012`), S3b (#137: BO-08 methods), S4a (#140:
  catalog domain, `0013`), S4b (#142: catalog routes), S4c1 (#144: BO-03), S4c2a (#147), S4c2b (#149: BO-04), S5 (#151:
  86), S6a (#154: presets server, `0014`), S6b (#157: BO-07), S7a (#165: POS catalog routes), S7b1 (#169: served menu),
  S7b2 (#170: M-2, Add), S7b3 (#171: the served preset picker), S8a (#173: users server, `0015`), S8b (#174:
  credentials, the re-stamp), S8c1 (#177: BO-06 part 1, D1/AC-32). **Left:** S8c2 (moves, resets, own changes, D2, D3), S9
  (POS-03 Release), S10 (BO-01).
- **Rulings by slice** (DECISIONS 2026-10-20 to 22, 11-02): S2 Q2, Q5, Q12, DESIGN-018 Q1-Q6; S3 C2 OQ1; S7 Q14, C4
  OQ1 (real presets at the POS); S8 Q1, Q6a, Q7-Q11, C3's OQ1 (create audited), OQ2 (no rename).
- **Architecture:** eleven accepted ADRs (001-007, 009-012); ADR-008 deferred. ARCHITECTURE already carries C3's §3.2,
  §7.2, §8 and §11 wording. **Owed, not drafted:** ROADMAP Phase 1 users: role change (Q1c); tender: "reactivate" (OQ1).
- **Built:** POS-01 to POS-07 (POS-01 real, POS-03's menu served); BO-01 (provisional), M-6, BO-03/04/05/07/08.
  **Frost designed:** all but G (BO-09) and H (BO-10, 11).
- **Implementation gate: OPEN since 2026-09-14**; nothing open in PRD §9. **Last verify:** S8c1 final tree (`44c29db`)
  verify 171 files / 6086 tests, e2e:all 140. `development` baseline 165 / 5861.

## Integration branch

- **`development`** at `599f724` on GitHub; the main checkout matches it. `main` and `development` are protected: PR
  required, 0 approvals, admins too. Only the owner merges.
- **At every `/lead` and after every merge:** `git fetch`, fast-forward the main checkout, then `npm ci` if the lockfile
  changed, `npm run db:migrate` if a migration landed, **before reporting or dispatching**. No lockfile change since 10-26.
- **Dev `pos` is at `0015`**, matching `development` (checked 11-06, no pending migrations).
- **Guard hooks** current (`--check` 2026-11-05); no agents.yaml or `.githooks/` change since 2026-10-17.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1109`** (renamed from `lead-1105` after #176 merged; contains
  `development` by merge; unpushed, no PR). New lead branches: from
  `origin/development`, `git branch --unset-upstream`, `-u origin` on push; after a lead PR merges, cherry-pick the rest.
- **Pushing needs the owner's word, every time** (LESSONS); `gh pr view <n> --json state` as its own step before any
  follow-up push.
- **Task worktrees:** none live (S8c1's removed 11-09). Left behind: `runs/PHASE1-S7a`,
  `runs/DESIGN-021`, `-023`, `wt/evidence/DESIGN-021`, `-023`; `wt/ARCH-021`, `wt/DESIGN-021` (the owner's). Not ours: `restaurant-pos-design`,
  `keen-chebyshev-ccf255`.

## Running tasks and agents

- **Running: PHASE1-S8c2 review** (Codex gpt-6-astra, oneshot, pane `PHASE1-S8c2-review`).
- **S8 server is merged.** S8a: `users.ts` (`lockUsers`, `USER_ACTIONS`), five routes, `OWN_ACCOUNT`, `USER_CHANGED`,
  `DUPLICATE` details. S8b: `set-pin`, `set-password`, `own-password`, `own-pin`, `restampOwnSession` (only `users.ts`
  may import it, `restamp-scan.test.ts`). The four back-office API functions per slice are declared, called by no screen.
- **PHASE1-S8c2 dispatched 2026-11-09** (`wt/PHASE1-S8c2`, `agent/phase1-s8c2` from `599f724`; kit copy deleted after `cmp`;
  C3 §2 and *S8c* verbatim, rulings 1-16, ACs 1-12). Moves, resets, own changes (FR-B3 words), the cooldown (shared
  formatter, owned by the manager's account), D2, D3, a promotion e2e; scan map adds `own-pin` for the current password
  (C3's AC 6 omitted it). Ruling 16 spells out test-first. Built `98fa2a7`, lead note `26f19a7`: verify 176 / 6223, e2e:all 150, test-first
  followed (135 assertions red before); cooldown red repeated. Builder changed three S8c1 behaviours (decisions 2, 3, 5:
  blocked form not dirty, DUPLICATE on an unshown field is general, warning hidden on a blocked form): for review. **F3** still the lead's and the
  owner's (headed Chrome/Firefox on Add person).
- **Frontend tasks carry design rules:** BO-13 DESIGN-013's N1, N2, async focus; BO-12 DESIGN-014's C1, density. **Open
  ACs (stand-ins, server owes them):** FE-032 AC-11/14/18/25/34; FE-035 AC-8/9/18/21; FE-036 AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch:** `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with `run_in_background` and `timeout: 7200000`,
  never `&`, from `../restaurant-pos-kit`. Leave the task file untracked in the kit; once the worktree has it, `cmp`
  and delete the kit copy. **Never commit a builder's task file on the lead branch.** A new task's `status:` is
  `not-started`. **`base:`** cuts a worktree from another branch; `depends_on` must be `complete`.
- **Preflight refuses when STATE.md is over its cap.** **`max_builders` is 1;** reviewers and designers do not count.
- **Task files** copy the consult verbatim (S8a: by line range with `sed`), then rulings, tests, ACs; check each cited
  path against today's code. **Reviewers cannot reach the database or a browser:** the lead's verify note is the evidence.
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
  Codex's 5h limit: wait, OpenCode, or an exception. Hand-opened work: write `runs/<ID>/builder/meta.json` first.
- **Designers and architects are hand-opened** (recipes: journal 10-24, 11-03). Evidence: `../restaurant-pos-wt/evidence/<ID>/`.
  Never print `db/dev.env`. `ask.sh`: Haiku, then luna.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the served POS (#169-171: the menu, M-2, the preset picker, whose layout
  of 40 entries, a 32-code-point name, the full-width Cancel and the gated entries was never measured); BO-03 (with 86),
  BO-04, BO-07 (48-row overflow unmeasured), BO-08's methods; the Burger-tile fix (FE-021 `7268943`); POS-03 Add (L353);
  DESIGN-021's and DESIGN-023's states in the gallery (`docs/design/visual-directions/index.html`).
- **Money (ARCH-003, 9.6):** `closeOrder` takes any drafts; only Add keeps a card under the balance (B-5).
- **Must not become a guarantee:** optional `OrderLine.itemId` (C4 §5); the in-memory refund and change walk; S7b3's
  optional `DiscountChange.shown` (its one caller always passes it); every POS store check is a stand-in (Phase 2).
- **Backend:** `session_replication_role` bypasses the append-only trigger (ADR-008); PIN timing (ARCH-013 §7). The
  schema check compares migration names, not contents (S0). `npm ci` warns about install scripts. One high npm advisory,
  development-only (PHASE0-008a). **BO-01 provisional** (S10 builds DESIGN-016). **012a/b:** no `makePeople` in `e2e/`.
  S8a: `reactivateUser` hashes a supplied PIN even for a no-op (cost only).
- **Lengths are code points** (zod 4.6.5, `char_length`), not the "UTF-16 units" comments (`tables.ts`, `settings.ts`,
  `0010`, `0011`), `D:1607`, DESIGN-019 and two client checks say; the client refuses more, never less. Queued cleanup.
- **From S7b1:** other screens' `import.meta.env.DEV` fixture gates stay (Phase 2); `SessionStore.catalogReads` optional;
  the hidden-tab pause proved in jsdom only. DESIGN-021 R1's name collision (BO-04 hint) is the owner's.
- **Noted, not filed:** C1 §3.2's S5-5 line; stale "eleven" test titles; `item-editor.html`'s money facts; extract the
  dialog lifecycle and name check; `menu-availability.test.tsx:168`'s fixture.

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **Push `agent/lead-1109` and open its PR?** S8c1's rulings 1-21 and S8c2's 1-16 are yours to
  overturn.
- **DESIGN-023 F3:** does a browser offer to save a PIN or another's password typed on Add person? Unverified; a headed
  Chrome/Firefox check (now possible); if a prompt appears, does the 2026-10-13 "does not fight the password manager"
  ruling extend?
- **Lead rulings since 10-30, yours to overturn** (each in its task file): DESIGN-021 R1 and round 2; ARCH-021's
  acceptances; DESIGN-023 R1, R2 and round 2; S7b1 round 2; S7b2 R3 (two or more removed choices show the generic
  *changed* sentence; a drawn plural is queued, QUEUE 8c); S7b3 rulings 1-6 (presets from the catalog store in both
  modes, the decimal comma, the gated label) and round 2 (an approval binds the snapshot it displays); S8a rulings 1-8
  (C3's three readings accepted, audit rollback by privilege) and the lead's commit of the builder's forced test edit; S8b rulings 1-13 and R1.
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

1. **S8c2 in review:** on exit, commit the report and rule findings, or `status: complete`.
2. **Small, between slices:** the code-point cleanup; the frame focus (`OfficeApp.tsx`, per-screen create control);
   the dialog and name-check extraction.
