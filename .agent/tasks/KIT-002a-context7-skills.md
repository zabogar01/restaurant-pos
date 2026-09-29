# KIT-002a — Context7 for the librarian only, and a skills report

**Status:** Complete — awaiting the owner's review
**Owner:** `lead`
**Depends on:** KIT-002 (accepted by the owner 2026-09-29, `a1d67d0`)
**Source:** the owner's follow-up to KIT-002, given in the lead session on 2026-09-29
(quoted under "Owner instructions" below), and the owner's ruling in the same session to
leave `~/.codex/config.toml` unchanged.
**Branch:** `agent/kit-context7-skills`, cut from `development` at `dccd3d0`, worked in the
worktree `../restaurant-pos-kit`.

---

## Objective

Only the librarian calls Context7, whichever CLI runs it; every other role
asks the librarian instead. `ask.sh` takes its model from agents.yaml rather
than from a hard-coded value. The owner can see, for each role, which skills
agents.yaml assigns to it and which ones its CLI actually has installed, and
knows whether the `skills:` key gates anything or is only a hint.

## Owner instructions (2026-09-29)

Context7:
- Context7 belongs to the librarian role only, whichever CLI runs it. Add
  `librarian: mcps: [context7]` to agents.yaml. No other role gets MCPs.
- `ask.sh librarian` (Codex) was thought to have web search only. Enable
  Context7 for librarian runs only, through a librarian profile or a per-run
  override, and not in the global Codex config that the designer uses. Prove
  it with one `ask.sh librarian` run that calls Context7, and record the
  output.
- The Context7 Claude plugin stays installed for the fallback librarian. Add
  "Do not call Context7; use ask.sh librarian." to the lead, builder,
  architect and reviewer role prompts.
- `ask.sh` reads the model from agents.yaml instead of hard-coding
  `gpt-6-luna`.

Skills visibility:
- Write `.agent/bin/skills-report.sh`. For each role in agents.yaml it prints
  the assigned skills (`base_skills` plus the role's `skills`), the skills that
  role's CLI actually has installed (user folder, repo folder, plugins), and
  flags skills that are "assigned but missing" and "installed but not
  assigned".
- Explain the `dispatch` skill: agents.yaml assigns it to the lead, but the
  repo has only `.claude/skills/lead`.
- Say, per CLI, whether `skills:` in agents.yaml is only a prompt hint or
  actually gates access. If a CLI can gate skills per run, use that.

## Ruling in this session

**`~/.codex/config.toml` stays as it is** (owner, 2026-09-29). The lead found
that the global Codex config already declares `[mcp_servers.context7]` with no
`enabled = false`, so every Codex run can reach Context7 today: the designer,
the explorer and the Codex reviewers as well as the librarian. The lead offered
to disable it globally; the owner declined. As a result:

- `ask.sh` turns Context7 on explicitly for the librarian and off explicitly
  for the explorer, per run, with `-c mcp_servers.context7.enabled=…`. The
  global file is untouched.
- An interactive Codex designer, and any Codex run that `dispatch.sh`
  (KIT-004) launches without that override, can still call Context7.
  agents.yaml records the per-run switch so that KIT-004 can apply it to every
  non-librarian launch.

## What changes

1. `.agent/agents.yaml`: `librarian.mcps: [context7]`; per-run MCP switches
   for Codex and Claude under `launch:`.
2. `.agent/bin/ask.sh`: the model is read from
   `roles.<role>.oneshot.model` with Ruby's YAML parser (`yq` is not
   installed). Context7 is on for librarian runs and off for explorer runs.
   The librarian brief tells it to try Context7 first.
3. `.agent/roles/{lead,builder,architect,reviewer}.md`: the Context7 line.
4. `.agent/bin/skills-report.sh`: new.
5. The Handoff answers the `dispatch` question and the gating question.

## Acceptance criteria

1. agents.yaml parses, and `librarian` is the only role with an `mcps` key.
2. `ask.sh` has no hard-coded model; changing
   `roles.librarian.oneshot.model` changes the model that `codex exec`
   receives.
3. One real `ask.sh librarian` run calls Context7, and its output is recorded
   in the journal.
4. `bash -n` is clean on both scripts, and `skills-report.sh` runs to the end
   and prints every role in agents.yaml.
5. The four role prompts carry the Context7 line and stay under 80 lines.
6. `~/.codex/config.toml` is unchanged.

## Out of scope

- Editing `~/.codex/config.toml`, `~/.claude/settings.json` or any skills
  folder in the home directory.
- `dispatch.sh` and the `/dispatch` skill (KIT-004).

## Handoff

**What was done.**
- `agents.yaml`: `librarian.mcps: [context7]`, the only role with MCPs. A new
  top-level `gated_mcps: [context7]`. Per-run switches under `launch:`:
  `codex.mcp_on/mcp_off.context7` and `claude.mcp_off.context7`. A
  `skills_gate` line for each CLI, and a comment that `skills:` is a hint
  until a launch applies the gate.
- `ask.sh`: the model comes from `roles.<role>.oneshot.model`, `--search` from
  `oneshot.web`, and the MCP flags from `mcp_on`/`mcp_off` for each gated MCP,
  all read with Ruby's YAML parser. The librarian brief says to try Context7
  first and to say which facts came from it. `--json` is always on, and
  `ASK_LOG=<file>` keeps the event stream, which is how a Context7 call is
  proven.
- Role prompts: "Do not call Context7; use ask.sh librarian." in lead (79
  lines; "The loop" paragraph rewrapped to make room), builder (78), architect
  (53) and reviewer (52).
- `.agent/bin/skills-report.sh`, new. Summary by default, `--full` names every
  installed-but-unassigned skill by source, and `--gate <role> <cli>` prints
  the per-run arguments that limit a CLI to the role's skills.

**Evidence** is in [journal/2026-09-29-kit-002a.md](../journal/2026-09-29-kit-002a.md):
the four-way Codex test, the Claude init-event test, the stub and real
`ask.sh` runs, the recorded librarian run with its six Context7 calls and its
answer, the gate checks for each CLI, and the inventory.

**Acceptance criteria.**
1. Met. agents.yaml parses (Ruby YAML) and `librarian` is the only role with
   `mcps`.
2. Met. A stub `codex` showed `-m TEST-MODEL` after the YAML value changed.
3. Met. The recorded librarian run made six completed Context7 calls.
4. Met. `bash -n` is clean on both scripts; the report prints all eight roles
   (exit 0).
5. Met. Line counts above.
6. Met. `~/.codex/config.toml` was last modified at 09:07, before this task,
   and the lead never wrote it.

**The `dispatch` skill.** It is planned for KIT-004; `/lead` did not replace it.
KIT-002's out-of-scope list names "`dispatch.sh`, the `/dispatch` skill and
`kit preset` (KIT-004)". `/lead` is a different skill: it re-orients a lead
session (rename, read STATE and QUEUE, health checks, five-line status) and has
`disable-model-invocation: true`, so only the owner starts it. Until KIT-004,
the report correctly shows `dispatch` as "assigned but missing" on the lead.

**Is `skills:` a hint or a gate?** Today it is only a hint, on every CLI.
Nothing reads it, and each CLI loads every installed skill. Each CLI can,
however, gate skills per run, so a launch *can* enforce it:

| CLI | Per-run gate (checked) | Granularity |
|---|---|---|
| Claude | `--settings '{"skillOverrides":{…:"off"},"enabledPlugins":{…:false}}'` | user, repo, bundled and synced skills one by one; plugin skills only with their whole plugin |
| Codex | `-c 'skills.config=[{path=…,enabled=false},…]'` | one by one, by path, plugins included; a denylist, so new skills are visible until the gate is regenerated |
| OpenCode | `OPENCODE_CONFIG_CONTENT='{"permission":{"skill":{"*":"deny",…:"allow"}}}'` | a true allowlist |
| Claude subagent | its `tools:` list; no `Skill` tool means no skills | all or nothing (explorer and librarian have none) |

"Use that" is done up to the launcher. The gate is generated from agents.yaml
by `skills-report.sh --gate`, and each CLI's generated gate was proven end to
end. No launcher exists yet to apply it: `dispatch.sh` is KIT-004. Nothing is
gated today. The owner decides whether KIT-004 applies the gate (see 2 below).

**Found and not fixed.**
- The ChatGPT **Context7 app** is a second route into Codex, separate from
  `[mcp_servers.context7]`. It is switched off per run by connector id. If the
  app is removed and reinstalled, the id may change, and the explorer would
  quietly regain Context7. Re-run the explorer check in the journal after any
  change to the ChatGPT apps.
- With the global config unchanged (owner's ruling), an **interactive Codex
  designer** and any Codex launch without `mcp_off` can still call Context7.
  The designer prompt has no Context7 line, because the owner's list named
  four roles. A Claude builder or reviewer launched without
  `launch.claude.mcp_off` can too, and the role-prompt line is the only guard.
- Codex and Claude runs also load other MCP servers from their global configs
  (Codex: playwright, stitchMCP, node_repl and others). "No other role gets
  MCPs" holds in agents.yaml, not in the CLIs. Only Context7 is gated.
- `~/.codex/config.toml` holds the Context7 and Stitch API keys in plain text,
  and `codex mcp list` prints them. Not copied anywhere in the repo.
- Claude's `--settings` is one object. KIT-004 must merge `caveman_off`, the
  skills gate and any other settings into a single `--settings` value, because
  two values do not combine.

**For the owner.**
1. **`grill-me` → `grilling`?** `grill-me` is a wrapper you invoke yourself
   (`disable-model-invocation: true`, body "Call the Skill tool with
   `grilling`"). A model cannot invoke it, and Codex does not even list it. If
   the architect is meant to stress-test proposals itself, agents.yaml and
   `roles/architect.md` should name `grilling`. Under a gate, `[herdr,
   grill-me]` hides `grilling` and leaves the architect without it.
2. **Gate or not, before KIT-004.** Applying the gate with today's assignments
   leaves the builder, reviewer, docs-writer, explorer and librarian with
   `herdr` only (plus caveman on Claude chat roles). That removes, for example,
   `tdd`, `superpowers:*` and `verify-and-stop` from builders. Either widen
   the `skills:` lists first (the `--full` report is the menu), or keep
   `skills:` as a hint and do not gate.

DONE
