# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-12: PRs #80-85 merged, `development` at `e52d0a4` (**PHASE0-010b** and the lead wrap-up). Verify green,
010b cleaned up. ARCH-014 brief written; document scan done; settings moved to Phase 1 (owner). Narrative: [journal/2026-10-12.md](journal/2026-10-12.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Done: tasks 1 to 7, plus 006b, 007b (back-office credential,
  `0007`, `create-manager`), **008a** (HTTPS process, error envelope, `@pos/contracts`), **008b** (Host/origin
  guard, `rpos_cid`), **009a** (route access declarations, session guard, session routes), **009b** (POS and
  back-office sign-in, M-6, zod 4), **010a** (`0008`, `withManagerApproval`), **010b** (approval HTTP adapter). Left: Tasks 11, 12.
- **Architecture:** nine accepted ADRs (001-007, 009, 010); ADR-008 stays reserved (deferred).
  Recommended, not commissioned: ADR-011 (sessions over HTTP, ARCH-012) and an inline-approval ADR (ARCH-013).
- **Frontend built** (fixtures plus a client order store): POS-01 to POS-07, every designed POS
  screen, bar Release (FR-A). Not built: all 13 back-office screens.
- **Back-office design in Frost:** slices A (DESIGN-012), C (DESIGN-013, BO-13) and I (DESIGN-014,
  BO-12). BO-03, BO-11 in older Frost; nine are greyscale.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Last verify by the lead:** green at **3252 tests / 66 files** on 2026-10-12, `development` `e52d0a4`. Server tests
  need `npm run db:up` and **`openssl` on `PATH`**. Dev database `pos` holds 0001-0008. Certificate made (`npm run cert`).
- **Host memory:** full swap failed every verify on 2026-10-09 (LESSONS); Docker's 8 GB VM still runs. Runs take ~55 s.

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `e52d0a4` (PR #84) on GitHub;
  the local `development` matches it. `main` and `development` are protected: PR required, 0
  approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch` and
  fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting or
  dispatching**, then `npm ci` if the lockfile changed, and `npm run db:migrate` if a migration landed.
- **Guard hooks** in the shared `.git/hooks` with an `agents.yaml` snapshot, current (reinstalled
  2026-10-09; `--check` current on 2026-10-12). Rerun `install-hooks.sh` after any change to `.githooks/` or agents.yaml.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1012c`** (from `e52d0a4`), pushed as its own PR. `agent/lead-1012b`
  merged (PR #85). **This branch's STATE is the current one** until it merges.
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations`. Merged, still existing: `agent/design-direction` (worktree
  `../restaurant-pos-design`), `agent/design-*`, `agent/arch-*`, `agent/fe-030` to `-036`,
  `agent/phase0-*`, `agent/lead-*`.

## Running tasks and agents

- **PHASE0-010b merged** (PR #84); worktree and `.agent/runs/PHASE0-010b/` removed 2026-10-12.
- **Live agents:** the lead only. Not the lead's: pane `w2:pE`, `.claude/worktrees/keen-chebyshev-ccf255`.
- **Next: Task 11 (two client shells) needs an architect consult first** (ARCH-014, not written). Inputs: ARCH-012
  *For the lead* 4 (client CSRF, idle countdown); 009b's and 010b's Handoffs *For Task 11*; ARCH-013 *For the lead* 5 (M-1).
- **Carry-forwards:** Handoffs of PHASE0-005 to 010b; ARCH-011's plan lines not to copy; ARCH-012 and ARCH-013
  *The Handoffs must carry forward* (gated commands, and Phase 2's cancel route, `APPROVAL_REQUIRED`, `REFUSED`).
- **Design slices left: B, D, E, F, G, H.** B takes DESIGN-012's N1-N3, M-6 password-only plus "another
  manager", BO-01 `:548–550`/SITEMAP `:248`, and ARCH-012 *For the lead* 1-3 (BO-01, POS-01 wording).
  The users screen warns that a PIN or password reset ends all that manager's sessions (ADR-009).
  M-1 and BO-12 owe ARCH-013 *For the lead* 3-4 (no *permission-denied*, no attempt count; `APPROVAL_THROTTLED`).
- **Frontend tasks carry design rules** from each design task's last lead ruling: BO-13 DESIGN-013's
  N1, N2, async focus; BO-12 DESIGN-014's C1 and standard density at any length.
- **Open ACs (stand-ins, server owes them):** FE-032 refund AC-11/14/18/25/34; FE-035 discount
  AC-8/9/18/21; FE-036 void AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with the Bash tool's
  `run_in_background` **and `timeout: 7200000`**, never `&`. The undispatched task file, untracked in the main
  checkout, **is deleted once the worktree has it** (it blocks the fast-forward). Worktrees cut from local `development`.
  **Preflight refuses when STATE.md is over its cap**: check before every dispatch or resume.
- **Task files copy the consult verbatim** (headings demoted), then rulings, tests expected to change (explorer first), ACs.
- **Builders share one database** (port 5433): tell them not to run `npm run db:up` (it leaves a stray container).
- **Background commands die at two hours;** the worker runs on and pings; verify and close by hand.
- **Prompts do not wake the lead:** a background loop polls `herdr agent get <id>` every 15 s and stops
  on a `blocked` that lasts 10 s, and on 20 minutes of unchanged pane text (a dropped API connection stays
  `working`; LESSONS). Re-arm after each; the owner answers prompts.
- **`max_fix_cycles` is 2.** A lead ruling for a round goes in the worktree's task file above the
  Handoff, **read before editing** and committed there, then `--resume --message`.
- **Codex reviews Claude-built work** (one five-hour allowance with the designer; at the limit wait and
  `--role reviewer --resume`; OpenCode stand-in in journal 2026-10-07). Opus reviews Codex-built work.
- **Architects are opened by hand:** split a pane in the kit, `herdr agent start architect<N>` with the exact line in
  journal 2026-10-12, then `herdr agent prompt`; close when done. **Rename the lead pane `lead`** first.
- **Designers are opened by hand** (journal 2026-10-06, *Designer how-to*); a fresh worktree needs
  `npm ci`; write `.agent/runs/<ID>/builder/meta.json` (`cli: codex`) in the main checkout before review.
- **`ask.sh`** runs Claude Haiku 5.5 first, Codex luna on failure. Inside a Codex sandbox both routes
  fail: Codex reviewers have no librarian (owner: later, if it bites).
- **Browser checks:** the Chrome extension cannot pass the cert page and its navigations get `ORIGIN_REFUSED`.
- **Real-terminal checks are the lead's** (builders have no TTY): Herdr `send-text`, control bytes (LESSONS).
- **`/lead` reads the kit worktree's STATE** whenever the kit branch is ahead of `development`.
- **Contract edits** commit with `ALLOW_CONTRACT=1` plus a DECISIONS line. YAML reads `caveman: off` as `false`.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the
  Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` (superuser only) bypasses the append-only trigger: for
  ADR-008's wording (deferred). **PIN timing:** `findUserByPin` runs Argon2id only on a digest hit, so a
  failed PIN is faster when nobody holds it (ARCH-013 §7); bounded by the throttle; owner item below.
- **Schema currency is not checked at startup** (ARCH-010 §9); a stale schema shows as `INTERNAL`.
- **One high-severity npm advisory** from `npm ci`, in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **ARCH-013, *For the owner*** (lead: yes to each): (1) FR-J3/AC-18/FR-A5 wording, exact text there; (2) best-effort
  cancel reports; (3) no Cancel while verifying (replaces POS-03 Q6); (4) accept the approval-entry flood and the PIN
  timing leak for §3.2; (5) commission an inline-approval ADR. 2 and 3 are needed before Phase 2.
- **ROADMAP, left after the 2026-10-12 ruling** (journal 2026-10-12 *Evening* items 4 and 5): `:50`'s cancelled-approval
  line waits on ARCH-013 item 2; `:29`'s "half-up" follows the FR-M3/B-2 wording below.
- **ARCH-012, *For the owner***: (1) commission ADR-011 as Proposed (lead: yes)? (2) the FR-A2c reading, no route
  takes either cookie (lead: confirm)? (3) sign-in without a pre-session CSRF token until §3.2 (lead: accept)?
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, *Proposal*): choices A (one never-reset
  sequence, or daily), B (*SALINAN* on reprints), C (refund slip), D (Indonesian only), E (*PBJT* or
  *PB1*); lead recommends the first of each. Then the lead drafts the PRD wording.
- **Service charge, latent:** rate 0 for now, adjustable (DECISIONS 2026-10-09). Before a non-zero rate,
  rule on DKI Pergub 35/2024 Pasal 8 (taxes it) against PRD §4 (not taxed); the lead drafts wording.
- **PHASE0-008b's builder choices, yours to overturn** (its Handoff): absolute-form target 400
  `VALIDATION_FAILED`; bad Host gets the envelope outside `/api`; cookie-hook DB failure 500 (ARCH-012 agrees).
- **ARCHITECTURE §16 certificate row** (ARCH-011 Handoff, exact wording there): asked, not answered.
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 010b (010a: `APPROVAL_THROTTLED`,
  no reason on unapproved entries, `clock_timestamp()` default), DESIGN-011-014, ARCH-006, FE-030-036.
- **Phase 1 questions (ADR-009, "Not decided here"):** must a manager changing their own password give
  the current one (architect: yes)? Does a manager who resets their own PIN stay signed in? Does a
  role change bump the credential version? Needed before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014
  Handoff); FR-J3/AC-18 for a refused void (ruled 2026-10-06); §9 questions 2 and 3; reactivation keeps the PIN.
- **Kit:** builder `Bash(grep:*)`? dispatcher ping on `BLOCKED ON APPROVAL`? builders' `python3`/`sed`?
  dispatcher support for hand-opened designers/architects and a reviewer CLI override?
- **Pre-production gate, owner-accepted risks:** the same-class PIN reset (2026-10-07), username discovery
  and per-account lockout (ADR-009), the shared `localhost` cookie jar (ADR-010). Revisit at §3.2.
- **FR-M3 / B-2 wording:** "half-up" below zero; the code rounds half away from zero. Proposed at L2699-2701.
- **Confirm or reject the ten `conversation only` lines** in DECISIONS.md (POS-03 Q5, Q6, Q9 among them).

## Live conflicts

- **`floor.html:48`** draws `dayclosed` as *closed · 25 Sep*; the build follows 2026-09-30. Owed to the designer.
- **DESIGN-007 on `fireerror`** (`:365`/`:407` vs `:578`): you ruled `:578` (L349); the file is unchanged.

## Next up

Owner: read the ARCH-014 brief (`tasks/ARCH-014-client-shells.md`, written, untracked); on the owner's go the lead opens `architect14`.
Owner: ARCH-013 and ARCH-012 items, receipt.
