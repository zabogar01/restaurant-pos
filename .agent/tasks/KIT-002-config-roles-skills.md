# KIT-002 — Config, role prompts, subagents and skills layout

**Status:** Complete — awaiting the owner's review
**Owner:** `lead`
**Depends on:** KIT-001 (complete, `529dc8c`)
**Source:** [AGENT-KIT.md](../AGENT-KIT.md) § Roles, models and routing, § Skills and the base prompt, § Phase 2.
Owner rulings of 2026-09-29, given after KIT-001's review (recorded in [DECISIONS.md](../DECISIONS.md) by this task).
Phase 0 flags: [journal/2026-09-29-kit-phase0.md](../journal/2026-09-29-kit-phase0.md).
**Branch:** `agent/agent-kit`, cut from `development`.

---

## Objective

Role, model, effort, mode and owned paths live in one config file,
`.agent/agents.yaml`, rather than in chat or memory. Each role has a short
prompt that holds only what is specific to that role. Orientation files state
the rules the owner ruled on 2026-09-29 and no longer carry stale claims. The
launch shape for each CLI in the config matches what Phase 0 found installed,
not the playbook's untested templates.

## Owner decisions this task implements

- Architect = Claude Opus 5.5. Designer = Codex `gpt-6-astra`. Builder =
  Claude Sonnet by default, with an `economy` profile (OpenCode
  `openai/gpt-6-luna`) and a `heavy` profile (OpenCode `openai/gpt-6-sol`).
  Explorer and librarian = Codex `gpt-6-luna`, one-shot, with a Claude subagent
  as the fallback. Caveman is off for architect, designer and reviewer.
- **Commits:** a dispatch counts as asking. Workers commit only on their own
  `agent/<task>` branch, only after verify is green, and never push.
- **Contract:** the lead drafts changes to the four product documents; only
  the owner approves them.
- **Integration branch** is `development`. `main` is created from
  `development` at `881a36d`. KIT-003 protects both.
- **Rewrite the stale sections** of CLAUDE.md and AGENTS.md: live conflicts,
  architecture status, "no application code", Codex as architect, and the lead
  writing the product documents.
- **Supersede** the 2026-09-22 "reviewers on codex" ruling and the 2026-09-24
  "architects on Opus 5.5 or gpt-6-astra" ruling, in favour of agents.yaml and
  the cross-family review rule.
- Add POS-03 Q6 to QUEUE.md as its own item.
- Move the project rules held in the lead's private saved notes into the repo.

## Template corrections from Phase 0

1. **Codex has no system-prompt flag.** Its launch puts the role prompt at the
   start of the prompt text. OpenCode does the same.
2. **Only Claude has a turn cap** (`--max-turns`, undocumented but working).
   Codex and OpenCode get the stall alert (`stall_alert_min`) as their only
   runaway guard. The config says so rather than implying a cap exists.
3. **Herdr has no named split.** Split, then `herdr pane rename` (applied in
   KIT-004's `dispatch.sh`; the config records the command shape).
4. **Caveman off must be per run and must not touch the lead.** Claude loads
   caveman as a user-level plugin whose SessionStart hook fires in every
   `claude -p`. `CAVEMAN_DEFAULT_MODE=off` is rejected: in off mode the hook
   deletes the shared `~/.claude/.caveman-active` flag, which the lead's own
   session reads. Instead each caveman-off launch passes
   `--settings '{"enabledPlugins":{"caveman@caveman":false}}'`, which disables
   the plugin for that process only.

## What changes

1. `.agent/agents.yaml`, filled in with the model ids and flags from Phase 0.
2. `.agent/roles/{lead,architect,designer,builder,reviewer}.md`, each under
   80 lines. The playbook calls the builder's prompt `fixer.md`. It is named
   `builder.md` here because `dispatch.sh` resolves `roles/<role>.md` from the
   role key in agents.yaml, and that key is `builder`.
3. `.claude/agents/explorer.md` (Haiku, read-only tools) and
   `.claude/agents/librarian.md` (Sonnet, docs and web tools): the Claude
   fallbacks.
4. `.agent/bin/ask.sh`: the default explorer/librarian runner, Codex
   `gpt-6-luna` with `--sandbox read-only`.
5. `.agent/WORKFLOW.md`: the roles table points to agents.yaml, the commit
   rule, `development` as the integration branch, and no pane IDs.
6. `AGENTS.md`: an "Agent base" section shared by every CLI, the architect and
   designer swap, the commit rule, and the stale sections rewritten.
7. `CLAUDE.md`: imports `@AGENTS.md` and keeps only what is specific to the
   lead, so the two files do not repeat each other.
8. Skills layout: record where each CLI loads skills from and prove that the
   roles' skills load. Nothing in the owner's home directory is restructured
   without the owner's say (see Handoff).
9. DECISIONS.md, QUEUE.md and STATE.md updated for the rulings above.
10. The lead's saved notes that hold project rules are moved into the repo,
    and the notes are reduced to a pointer.

## Acceptance criteria

1. `agents.yaml` parses as YAML, and every model id in it is one Phase 0 or
   this task saw work.
2. Every role prompt is under 80 lines.
3. The caveman switch is proven. With the plugin enabled, a one-shot Claude run
   fires caveman hooks; with the per-run `--settings` override, it fires none;
   and the shared flag file is unchanged.
4. `ask.sh explorer "<question>"` returns an answer from Codex `gpt-6-luna` in
   read-only mode.
5. No orientation file names Codex as the architect, says the architecture is
   only proposed, says there is no application code, or lists the two
   resolved conflicts as live.
6. CLAUDE.md, AGENTS.md and WORKFLOW.md each state the commit rule in the
   owner's words.
7. `npm run verify` is run and its real output reported.

## Out of scope

- Hooks and branch protection (KIT-003). `dispatch.sh`, the `/dispatch` skill
  and `kit preset` (KIT-004).
- Editing any of the four product documents.
- Restructuring `~/.agents/skills` or `~/.claude/skills`.

## Handoff

**What was done.**
- `.agent/agents.yaml`: roles, profiles, routing, limits, and a `launch:`
  block holding each CLI's verified one-shot, resume, effort, read-only and
  caveman-off flags. `max_turns` is marked Claude-only; `stall_alert_min` is
  the only runaway guard for Codex and OpenCode. The herdr pane shape is split
  then rename. Codex and OpenCode take the role prompt prepended to the
  prompt text.
- `.agent/roles/{lead,architect,designer,builder,reviewer}.md` (79, 52, 60,
  77, 51 lines), carrying each role's ownership, its lessons from LESSONS.md,
  the block protocol, the Herdr report lines and the caveman rule.
- `.claude/agents/explorer.md` (Haiku, Read/Grep/Glob) and `librarian.md`
  (Sonnet, Context7 and web).
- `.agent/bin/ask.sh explorer|librarian "<q>"`: Codex `gpt-6-luna`,
  read-only, ephemeral, prints the last message only. The librarian adds
  `--search`, placed before `exec`.
- AGENTS.md rewritten as the shared base for every CLI: what exists, the
  commands, "Agent base", ownership (Claude Opus architect, Codex astra
  designer), the architecture as approved, the commit rule, and `development`.
  CLAUDE.md now imports it with `@AGENTS.md` and keeps only what is specific
  to the lead. WORKFLOW.md is rewritten: the roles table points to
  agents.yaml, no pane IDs, the Herdr rules, the dispatch loop, and a new task
  format with frontmatter and a "Tests expected to change" section.
- DECISIONS.md: six 2026-09-29 lines, including the supersession of the
  2026-09-22 reviewer and 2026-09-24 architect rulings. QUEUE.md gains item
  8a (POS-03 Q6). STATE.md is updated (133/150 lines).
- The lead's three saved notes (model policy, Herdr reporting, closing idle
  agents) are moved into WORKFLOW.md, `roles/lead.md` and agents.yaml, and
  replaced by one note pointing at the repo.
- `main` created locally at `881a36d`. It is not pushed; that goes with
  KIT-003's protection.

**Evidence** is in [journal/2026-09-29-kit-002.md](../journal/2026-09-29-kit-002.md).
The caveman switch: with the plugin enabled, 2 caveman hook events; with the
per-run `--settings` override, 0, and the shared flag file unchanged. Every
model id in agents.yaml was seen answering: claude-opus-5-5,
claude-sonnet-5-5, haiku, gpt-6-astra (high), gpt-6-luna on Codex and on
OpenCode, and openai/gpt-6-sol.

**Decided, and why.**
- Builder prompt named `builder.md`, not the playbook's `fixer.md`, so that
  `roles/<role>.md` resolves from the agents.yaml key.
- The builder's Claude permission mode was left out of the launch line.
  Builders need Bash for verify and git; which mode to run them unattended in
  is a KIT-004 decision.
- `--append-system-prompt-file` is used rather than inlining the prompt, which
  avoids shell quoting of an 80-line file.

**Found and not fixed.**
- OpenCode `--agent plan` hangs in `run` mode, so OpenCode has no read-only
  mode. No read-only role uses it.
- `yq` is not installed; the playbook's `dispatch.sh` sketch needs it. KIT-004
  must install it or parse with Ruby, which is present and was used here.
- Skills layout needs the owner (see below). Nothing in the home directory
  was restructured.

**For the owner.**
1. *Skills:* `~/.agents/skills` already acts as the master folder: Codex loads
   from it, and most of `~/.claude/skills` symlinks into it. It is managed by
   a skills installer (`.skill-lock.json`) and is not under git. Claude's
   `impeccable` is a separate, different copy from the 4.2.2 that Codex
   loads. Choose: keep it as is, `git init` the folder, and/or point Claude's
   `impeccable` at the shared copy.
2. *Pilot candidates* for KIT-004's first real dispatch:
   - **A (recommended), `quick`:** render the `cancel`, `reauth` and
     `leaselost` modals inside `.pos-device` in `SettlementScreen.tsx`
     (today at lines 1006–1010, after the device closes). Move them in
     beside `TakeoverModal` (1004–1005), whose placement comment already
     states the rule. No existing test pins their placement. New tests
     mirror `settlement.test.tsx:1277-1285` (the takeover's in-device
     assertion) for each of the three. Red case: each new test fails on
     today's code. No design or copy question.
   - **B, `quick` refactor:** `closeOrder` (`close.ts:87`) calls
     `fireOrder` with `type: 'table'` to get past `fireOrder`'s refusal of
     quick sales (`fire.ts`, "a quick sale has no fire"). Extract the
     round-building out of `fireOrder` into a helper that `closeOrder` calls
     directly, so no caller has to claim a type it is not. Behavior is
     unchanged (FR-E5). The existing close tests (`close-order.test.ts:42-50`,
     `order-book.test.tsx:148-156`) must stay green untouched. Weaker as a
     pilot, because it has no user-visible red case, and it sits next to
     settlement.
   - Rejected: the reopened book-only order URL (needs a URL and title
     decision), "Nothing outstanding" drawn twice (the designer's call), and
     the POS-03 `?state=eightysix` URL (current behavior is intended and
     tested).
3. *Unconfirmed:* the owner's reply had `<confirm / reject each>` as an
   unfilled placeholder, so eight conversation-only lines remain open (listed
   in STATE.md).

**Addendum, 2026-09-29: when caveman is off** (owner approved the lead's
recommendation after the first review of this task).
- By role, unchanged: off for architect, designer and reviewer.
- By task: `caveman_off_when` in agents.yaml. Categories `arch` and `logic`,
  and touches `money`, `audit`, `identity` and `boundaries`, launch any role
  with caveman off. KIT-004's `dispatch.sh` must apply it; until then it is
  config and documentation only.
- By moment: CLAUDE.md "When the lead writes plain prose" lists the lead's
  decision moments. The owner's explicit "normal mode" or `/caveman` always
  wins.
- AGENTS.md, WORKFLOW.md step 3, `roles/lead.md` and DECISIONS.md updated to
  match.

**Verification.** `npm run verify`: typecheck clean, 2253/2253 tests, 32
files, exit 0. agents.yaml parses (Ruby YAML). `bash -n ask.sh` is clean. A
grep of AGENTS.md, CLAUDE.md, WORKFLOW.md and the roles finds no stale claim
(Codex architect, "no application code", "proposed, not approved", the two
old conflicts, pane IDs, "commit only when asked").

DONE
