# KIT-001 — Split central memory by lifespan

**Status:** Complete — awaiting the owner's review
**Owner:** `lead` (sorting delegated to a Claude Sonnet subagent; the lead reviews its output before the owner sees it)
**Depends on:** Kit Phase 0 — [journal/2026-09-29-kit-phase0.md](../journal/2026-09-29-kit-phase0.md)
**Source:** [AGENT-KIT.md](../AGENT-KIT.md) § Memory model and § Phase 1. Requested by the owner on 2026-09-29 as the first of four rollout tasks (KIT-001 … KIT-004).
**Branch:** `agent/agent-kit`, cut from `development` (the integration branch).

---

## Objective

A lead can orient from about 5k tokens instead of about 55k. Today every agent
reads `.agent/MEMORY.md` (3,010 lines, 186 KB) and `.agent/ROADMAP.md` (314
lines, 43 KB). After this task the lead reads `STATE.md` then `QUEUE.md`,
owner rulings are one line each in `DECISIONS.md`, hard-won rules are in
`LESSONS.md`, and the originals are preserved unchanged in the journal.

## Required inputs

- `.agent/MEMORY.md` and `.agent/ROADMAP.md` as of `881a36d`.
- AGENT-KIT.md § Memory model (file table and rules).
- `.agent/tasks/*`, `.agent/reviews/*`, `docs/*` — to find where each ruling is
  written down, if anywhere.

## Constraints

- **Delete nothing.** `MEMORY.md` and `ROADMAP.md` are moved with `git mv` into
  `.agent/journal/`, byte-for-byte, so git records a 100% rename.
- **Never edit** `docs/PRODUCT.md`, `docs/PRD.md`, `docs/ROADMAP.md`,
  `docs/BOUNDARIES.md`.
- **Decided vs discussed.** Only an owner ruling goes in `DECISIONS.md`. Each
  line names where it is written. A ruling written nowhere but the old
  MEMORY.md is marked as conversation-only, so the owner can confirm or reject
  it (CLAUDE.md: a decision reached in conversation but not written into a
  document is unresolved). Lead rulings are not owner rulings; they stay in the
  task files that carry them.
- **Full prose.** These files are read by other agents and the owner. No
  caveman style in any file.
- **Caps.** `STATE.md` ≤ 150 lines, `QUEUE.md` ≈ 80, `LESSONS.md` ≈ 60.
  `DECISIONS.md` has no cap but is one line per ruling.
- No product task starts during this rollout.

## What changes

1. `git mv .agent/MEMORY.md .agent/journal/2026-09-29-memory-archive.md`
2. `git mv .agent/ROADMAP.md .agent/journal/2026-09-29-roadmap-archive.md`
3. New `.agent/STATE.md`: phase, gates (implementation gate included), running
   tasks and panes, live bugs (the menu-tile bug), POS-03 open questions and
   other questions waiting for the owner, live conflicts, next queue pointer.
4. New `.agent/DECISIONS.md`: `date · ruling · where recorded`, append-only.
5. New `.agent/LESSONS.md`: rules distilled from the narratives.
6. New `.agent/QUEUE.md`: the immediate queue from the old ROADMAP.md.
7. New `.agent/bin/check-state.sh`: exits non-zero if `STATE.md` exceeds 150
   lines.
8. Orientation updated to the new files: `CLAUDE.md` (lead reads STATE then
   QUEUE), `AGENTS.md` (workers read their task file only),
   `.agent/WORKFLOW.md` (points to the new files).

## Acceptance criteria

1. `git show --stat -M HEAD` shows both archives as renames with no content
   change (`R100`).
2. `.agent/bin/check-state.sh` passes on the new STATE.md and fails on a
   151-line file.
3. Every `DECISIONS.md` line cites a source; every line whose only source is
   conversation is marked so and listed in the lead's report to the owner.
4. STATE.md, QUEUE.md and LESSONS.md are within their caps.
5. No remaining orientation instruction in `CLAUDE.md`, `AGENTS.md` or
   `WORKFLOW.md` tells an agent to read `MEMORY.md` or `.agent/ROADMAP.md`.
   Historical task files and reviews keep their old links; they are records.
6. `npm run verify` is run and its real output reported.

## Out of scope

- `agents.yaml`, role prompts, skills (KIT-002). Hooks and branch rules
  (KIT-003). Dispatcher (KIT-004).
- Rewriting historical task files or reviews that link to MEMORY.md.
- Correcting stale facts in CLAUDE.md/AGENTS.md beyond the orientation
  pointers (raised in the report instead).

## Handoff

**What was done.**
- Archives: `git mv` of both files into `.agent/journal/`
  (`2026-09-29-memory-archive.md`, `2026-09-29-roadmap-archive.md`). SHA-1 is
  identical before and after (`deb21b1…`, `303608f…`).
- A Claude Sonnet subagent wrote `STATE.md` (133 lines), `QUEUE.md` (79),
  `DECISIONS.md` (55 lines, 39 rulings) and `LESSONS.md` (67, grouped by lead /
  builder / reviewer / designer). The lead then checked every DECISIONS line
  against the cited file or archive line.
- The lead wrote `.agent/bin/check-state.sh` and repointed `CLAUDE.md`,
  `AGENTS.md` and `.agent/WORKFLOW.md`.

**What the lead's review changed, and why.**
- Added one DECISIONS line: IDR at precision 0 and the stack. The sorter left
  it out because the roadmap archive credits the lead with closing the PRD
  question. But memory archive L1023 lists both as confirmed by the owner, and
  the text sits in a contract document (PRD §9, `4c59cdc`) that only the owner
  changes. Its "confirm" item was removed from STATE.md.
- Checked that archive L349 carries Q5, Q6 and Q9 and marks them "in
  conversation". Q7 there is delegated to the lead, so it is rightly absent.
- Checked that the PRD does not mention the subagent-driven ruling, so it
  stays conversation-only. The archive's claim at L1046 that "the last three"
  2026-09-14 rulings are in the PRD is wrong for this one.

**Found and not fixed (outside this task).**
- CLAUDE.md "Two conflicts live right now" and its "architecture proposed, not
  approved" line are stale. `docs/ARCHITECTURE.md` and seven Accepted ADRs
  exist, and PRD §9 states the stack and currency. AGENTS.md repeats both, and
  still names a Codex architect and says "No application code exists yet".
  AGENTS.md and WORKFLOW.md say the lead writes "the four product documents",
  which contradicts CLAUDE.md (only the human changes them).
- There is **no `main` branch**, local or on `origin`. KIT-003's branch
  protection must be scoped to `development`.
- The playbook calls the menu-tile bug live. FE-021 (`7268943`) fixed it on
  2026-09-24, so the playbook's Phase 4 pilot has to be a different task.
- LESSONS.md is 67 lines against a soft cap of about 60.

**Verification.** `check-state.sh` passes at 133/150. It fails with exit 1 on
a 151-line file and passes on a 150-line one. The orientation grep finds
MEMORY.md only in CLAUDE.md's archive note. `npm run verify` is green:
typecheck clean, 2253/2253 tests, 32 files.

DONE
