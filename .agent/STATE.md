# State

A rewritable snapshot of where the project stands, owned by the lead. It is rewritten at
each material change and never appended to; the cap is 150 lines (`bin/check-state.sh`).
Narrative and history live in the journal. The full pre-split record is the
[memory archive](journal/2026-09-29-memory-archive.md) and the
[roadmap archive](journal/2026-09-29-roadmap-archive.md); "L1234" below means that line of the
memory archive unless it says otherwise. Owner rulings live only in [DECISIONS.md](DECISIONS.md).

## Last updated

2026-10-09: PRs #74, #75 merged, `development` at `dfc96c3`. ARCH-012 and the receipt proposal done; explorer
and librarian on Claude Haiku 5.5 first. All on `agent/lead-1009`, PR #76. Nothing is running. Narrative: [journal/2026-10-09.md](journal/2026-10-09.md).

## Phase and gates

- **Phase 0**, started 2026-09-14. Done: tasks 1 to 7, plus 006b, 007b (back-office credential,
  `0007`, `create-manager`), **008a** (HTTPS process: TLS, loopback guard, safe logging, error
  envelope, health, `@pos/contracts`) and **008b** (Host/origin guard, `rpos_cid`). Left: Task 9
  (as 009a and 009b, ARCH-012), Tasks 10 to 12. No route beyond `GET /api/health` yet.
- **Architecture:** nine accepted ADRs (001-007, 009, 010); ADR-008 stays reserved (deferred).
  ADR-011 (sessions over HTTP) is recommended by ARCH-012 and not commissioned.
- **Frontend built** (fixtures plus a client order store): POS-01 to POS-07, every designed POS
  screen, bar Release (FR-A). Not built: all 13 back-office screens.
- **Back-office design in Frost:** slices A (DESIGN-012), C (DESIGN-013, BO-13) and I (DESIGN-014,
  BO-12). BO-03, BO-11 in older Frost; nine are greyscale.
- **Implementation gate: OPEN since 2026-09-14**; its five conditions are in the roadmap
  archive L135-180. It does not approve anything open in PRD §9: an implementer that needs one stops.
- **Last verify by the lead:** `npm run verify` green at **3095 tests / 58 files** on 2026-10-09 on
  `development` at `dfc96c3`, main checkout, after `npm ci`. Server tests need `npm run db:up` and
  **`openssl` on `PATH`**. The dev database `pos` holds 0001-0007. Local certificate made (`npm run
  cert`, `~/.config/restaurant-pos/tls/`); the server is `npm run dev -w apps/server` on `:8443`.

## Integration branch

- **`development` is the integration branch** (owner, 2026-09-29), at `dfc96c3` (PR #74) on GitHub;
  the local `development` matches it. `main` and `development` are protected: PR required, 0
  approvals, admins too.
- **The owner merges and pulls elsewhere.** At every `/lead` and after every merge, `git fetch` and
  fast-forward the main checkout (`git merge --ff-only origin/development`) **before reporting or
  dispatching**, then `npm ci` if the lockfile changed, and `npm run db:migrate` if a migration landed.
- **Guard hooks** in the shared `.git/hooks` with an `agents.yaml` snapshot, current (reinstalled
  2026-10-09 with this branch's agents.yaml). Rerun `install-hooks.sh` after any change to `.githooks/` or agents.yaml.
- **Lead work: `../restaurant-pos-kit` on `agent/lead-1009`** (from `dfc96c3`), pushed, PR #76: STATE,
  QUEUE, AGENTS.md, the explorer/librarian routing, the 2026-10-09 journal, the receipt research and ARCH-012's task and report.
  **This branch's STATE is the current one** until it merges (the main checkout's copy lags).
- Work goes on `agent/<topic>` cut from `development`. Only the owner merges; the lead commits
  when asked and pushes only when the owner says so.
- Stale: `agent/phase-0-foundations`. Merged, still existing: `agent/design-direction` (worktree
  `../restaurant-pos-design`), `agent/design-*`, `agent/arch-*`, `agent/fe-030` to `-036`,
  `agent/phase0-*`, `agent/lead-*`.

## Running tasks and agents

- **Nothing is running.** No task worktree under `../restaurant-pos-wt/`; `.agent/runs/` is empty.
- **Live agents:** the lead only. Not the lead's: `.claude/worktrees/keen-chebyshev-ccf255`.
- **ARCH-012 done** (report `.agent/reviews/ARCH-012-auth-routes.md`; summary in the journal): Task 9
  splits into **009a** (route declaration, guard, session routes) and **009b** (credential routes).
- **PHASE0-009a: next, not written**, from ARCH-012 *For the task file*; not blocked by the owner's
  items. `zod` is not installed. Task 10 needs its own consult (ARCH-007 §7).
- **Carry-forwards for Tasks 9 to 12:** Handoffs of PHASE0-005 to 008b; ARCH-011's Handoff lists plan
  lines in Tasks 9 to 12 not to copy; ARCH-012 §*The Handoffs must carry forward*, and its *For the
  lead* item 4 (client CSRF handling, idle countdown) for Task 11's consult.
- **Design slices left: B, D, E, F, G, H.** B takes DESIGN-012's N1-N3, M-6 password-only plus "another
  manager", BO-01 `:548–550`/SITEMAP `:248`, and ARCH-012 *For the lead* 1-3 (BO-01, POS-01 wording).
  The users screen warns that a PIN or password reset ends all that manager's sessions (ADR-009).
- **Frontend tasks carry design rules** from each design task's last lead ruling: BO-13 DESIGN-013's
  N1, N2, async focus; BO-12 DESIGN-014's C1 and standard density at any length.
- **Open ACs (stand-ins, server owes them):** FE-032 refund AC-11/14/18/25/34; FE-035 discount
  AC-8/9/18/21; FE-036 void AC-3/10/11/18/21/22.

## Kit facts the next session needs

- **Dispatch** with `.agent/bin/dispatch.sh <ID> --dry-run`, then for real with the Bash tool's
  `run_in_background` **and `timeout: 7200000`**, never `&` (LESSONS), from `../restaurant-pos-kit`,
  where an undispatched task file lives untracked (delete that copy once the worktree has it). The
  worktree is cut from the **local** `development`. A review needs task status `review` or `active`.
  **Preflight refuses when STATE.md is over its cap**: check before every dispatch or resume.
- **Background commands die at two hours;** the worker runs on and pings; verify and close by hand.
- **Prompts do not wake the lead:** a background loop polls `herdr agent get <id>` every 15 s and stops
  on the first `blocked` (`agent wait --until blocked` missed one). Re-arm after each; the owner answers.
- **`max_fix_cycles` is 2.** A lead ruling for a round goes in the worktree's task file above the
  Handoff, committed there, then `--resume --message`. A test-only fix may skip the re-review (008b).
- **Codex reviews Claude-built work** (one five-hour allowance with the designer; at the limit wait and
  `--role reviewer --resume`; OpenCode stand-in in journal 2026-10-07). Opus reviews Codex-built work.
- **Architects are opened by hand:** `herdr pane split w2:p1 --direction right --cwd <kit> --no-focus`,
  then journal 2026-10-01's launch line as `architect<N>`, then `herdr agent prompt`; close when done.
- **Designers are opened by hand** (journal 2026-10-06, *Designer how-to*); a fresh worktree needs
  `npm ci`; write `.agent/runs/<ID>/builder/meta.json` (`cli: codex`) in the main checkout before review.
- **`ask.sh`** runs Claude Haiku 5.5 first, Codex luna on failure (luna once answered unread and wrong). Inside a
  Codex sandbox both routes fail, as before: Codex reviewers have no librarian (owner: later, if it bites).
- **Browser checks:** the Chrome extension cannot pass the cert page and its navigations get `ORIGIN_REFUSED`.
- **Real-terminal checks are the lead's** (builders have no TTY): drive a Herdr pane with `send-text`
  and literal control bytes, waiting for each prompt (LESSONS); run servers on `pos`, scripts on `pos_test`.
- **Tests expected to change: grep first.** **`/lead` reads the kit worktree's STATE** whenever the kit
  branch is ahead of `development` **or has uncommitted `.agent/` changes**.
- **Contract edits** commit with `ALLOW_CONTRACT=1` plus a DECISIONS line. YAML reads `caveman: off` as `false`.

## Live bugs and known defects

- **Owner to see in a browser, then close:** the Burger-tile fix (FE-021 `7268943`, L257-262), and
  Add from POS-03 `eightysix` returning there by design (L353; `own-items.test.tsx:381-393`).
- **Money, not filed (ARCH-003, 9.6):** `closeOrder` (`close.ts:74–101`) accepts any drafts; only the
  Add gate (`tender.ts:39–41`) keeps a card under the balance (B-5). Unreachable today; own task, architect consult.
- **Must not become a guarantee:** optional `OrderLine.itemId` (L1787); the in-memory refund and change walk.
- **Backend:** `session_replication_role` (superuser only) bypasses the append-only trigger: for
  ADR-008's wording (deferred). A demoted manager keeps a resolving session with role `CASHIER`;
  ARCH-012 §8 says how the back-office guard refuses it (009a).
- **Schema currency is not checked at startup** (ARCH-010 §9); a stale schema shows as `INTERNAL`.
- **One high-severity npm advisory** from `npm ci`, in a development-only dependency (PHASE0-008a Handoff).

## Questions waiting for the owner

Nothing here is decided. Detail is where each line points.

- **ARCH-012, *For the owner*** (none blocks 009a): (1) commission ADR-011, sessions over HTTP, as
  Proposed (lead: yes)? (2) the FR-A2c reading: "may accept either" unused, a shared read is one
  handler under both paths, no route takes either cookie (lead: confirm)? (3) accept sign-in without a
  pre-session CSRF token until the pre-production gate, recorded in ARCHITECTURE §3.2 (lead: accept)?
- **Receipt, PRD §9 q1** (`reviews/RESEARCH-receipt.md`, *Proposal*): choices A (one never-reset
  sequence, or daily), B (*SALINAN* on reprints), C (refund slip), D (Indonesian only), E (*PBJT* or
  *PB1*); lead recommends the first of each. Then the lead drafts the PRD wording.
- **Service charge, latent:** rate 0 for now, adjustable (DECISIONS 2026-10-09). Before a non-zero rate,
  rule on DKI Pergub 35/2024 Pasal 8 (taxes it) against PRD §4 (not taxed); the lead drafts wording.
- **PHASE0-008b's builder choices, yours to overturn** (its Handoff): absolute-form target 400
  `VALIDATION_FAILED`; bad Host gets the envelope outside `/api`; cookie-hook DB failure 500 (ARCH-012 agrees).
- **ARCHITECTURE §16 certificate row** (ARCH-011 Handoff, exact wording there): asked, not answered.
- **Lead rulings, yours to overturn,** in task files: PHASE0-004 to 008b, DESIGN-011-014, ARCH-006, FE-030-036.
- **Phase 1 questions (ADR-009, "Not decided here"):** must a manager changing their own password give
  the current one (architect: yes)? Does a manager who resets their own PIN stay signed in? Does a
  role change bump the credential version? Needed before the users screen.
- **PRD wording owed, not drafted:** report-print failure placement; FR-J3/AC-18 and FR-H3/AC-10 (DESIGN-014
  Handoff); cooldown-refused approval; §9 questions 2 and 3; reactivation keeps the PIN (FR-B3).
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

Owner: merge PR #76. Write PHASE0-009a from
ARCH-012 *For the task file*, dry-run and dispatch on the owner's go. The owner's ARCH-012 and receipt answers.
