# Decisions

Owner rulings only, one line each, oldest first, append-only. A ruling exists only once it is
written here. Lead rulings, reviewer findings and proposals do not belong in this file: lead
rulings stay in the task file that carries them, and anything not yet ruled goes under
"Questions waiting for the owner" in [STATE.md](STATE.md). Nothing here changes a contract
document; `docs/PRODUCT.md`, `docs/PRD.md`, `docs/ROADMAP.md` and `docs/BOUNDARIES.md`
change only by the owner's decision, and this file only records where a ruling landed.

Format: `- YYYY-MM-DD · <ruling in one sentence> · <where recorded>`

A line ending `conversation only — memory archive L<line>` was said by the owner in
conversation and noted by the lead only in the old MEMORY.md, now
[journal/2026-09-29-memory-archive.md](journal/2026-09-29-memory-archive.md). It is unresolved
until the owner confirms it or a document records it.

- 2026-09-09 · Seven PRD conflicts found by drawing the interface were ruled and written into the PRD (the date is that of the commit) · commit `78153ab`, docs/PRD.md
- 2026-09-10 · The reconciled architecture proposal is approved and becomes the standing architecture with accepted ADRs · docs/ARCHITECTURE.md, docs/decisions/ADR-001 to ADR-007, superseded banner on docs/ARCHITECTURE_PROPOSAL.md
- 2026-09-10 · A manager who initiated a POS action may re-enter their own PIN as its approver; no second manager is required · docs/ARCHITECTURE.md section 7.1
- 2026-09-10 · The tax model is nett: tax-inclusive prices, an untaxed service charge, and a tax line derived from the total, not Indonesian "++" · docs/PRD.md section 4
- 2026-09-10 · Currency is IDR at minor-unit precision 0, and the stack is TypeScript, Node, Fastify, React, Vite and PostgreSQL · docs/PRD.md section 9, commit `4c59cdc`
- 2026-09-10 · Ruling I-12: an order line's trailing slot carries exactly one meaning, so a pending line gets a no-prompt remove and a fired line's slot stays empty · docs/design/SCREEN-INVENTORY.md (I-12), .agent/tasks/DESIGN-002-wireframe-review.md
- 2026-09-10 · Ruling I-13: every tender amount prefills to the remaining balance and stays editable in place, with no split mode · docs/design/SCREEN-INVENTORY.md (I-13), .agent/tasks/DESIGN-002-wireframe-review.md
- 2026-09-10 · The tender pads are a persistent panel, not an edge-entering sheet · .agent/tasks/DESIGN-002-wireframe-review.md ("Owner rulings made during the review")
- 2026-09-14 · The visual direction is Frost; Paper is rejected and left untouched on disk · docs/DESIGN.md (Status), .agent/tasks/DESIGN-001-external-visual-direction.md
- 2026-09-14 · Phase 0 runs subagent-driven: a fresh implementer per task or small group, a written handoff from each, and the lead reviewing between tasks · conversation only — memory archive L1028
- 2026-09-14 · The `.impeccable/` directory is ignored entirely as build residue · .gitignore
- 2026-09-14 · Frontend first: the frontend is built against fixtures and reviewed by the owner before the backend resumes, so Phase 0 backend tasks 3 to 12 are paused · .agent/tasks/FE-001-pos-shell-and-lock-screen.md ("Why this task exists")
- 2026-09-14 · Tasks are small: one reviewable slice per session, with the owner reviewing between slices · .agent/tasks/FE-001-pos-shell-and-lock-screen.md ("Why this task exists")
- 2026-09-18 · An implementer is closed once its slice is delivered and committed, and a fresh implementer takes each new slice · conversation only — memory archive L1275
- 2026-09-22 · Implementers run on Sonnet · .agent/tasks/FE-014-order-store.md (header, "owner's model policy, 2026-09-22")
- 2026-09-22 · Review agents run on codex, and the lead stays on Opus · conversation only — memory archive L1223
- 2026-09-22 · The client order store (FS, FE-014) is built before F3 settlement, so the balance can actually change · .agent/tasks/FE-014-order-store.md (header, "at the owner's direction")
- 2026-09-23 · There is no review per slice for F3; one independent review covers F3a to F3d together after F3d · .agent/tasks/FE-017-close-outcomes.md, .agent/tasks/FE-018-payment-session.md
- 2026-09-24 · Fix the settlement design (DESIGN-006) before starting F4, with the designer on codex `gpt-6-astra` · conversation only — memory archive L585
- 2026-09-24 · Designers run on codex `gpt-6-astra` · .agent/tasks/DESIGN-006-settlement-corrections.md (header)
- 2026-09-24 · Architects run on Opus 5.5 or codex `gpt-6-astra`, never a default model · conversation only — memory archive L304
- 2026-09-24 · POS-03's three high design gaps (tile item sheets, quantity commit, what firing shows) are designed and built before F4 · .agent/tasks/DESIGN-007-order-flow-gaps.md
- 2026-09-24 · Each of the twelve menu items gets its own item sheet, modelled on the existing one · .agent/tasks/DESIGN-007-order-flow-gaps.md (Part A)
- 2026-09-24 · A line's quantity is committed by a button that adjusts it, modelled on Square's quantity control · .agent/tasks/DESIGN-007-order-flow-gaps.md (Part B)
- 2026-09-24 · Send to kitchen sends in one press with the count on the button and no confirmation modal · .agent/tasks/DESIGN-007-order-flow-gaps.md (Part C), .agent/reviews/ARCH-002-fire-confirmation.md
- 2026-09-24 · The `fireerror` state keeps its old two-round data, which settles DESIGN-007's contradiction · conversation only — memory archive L349
- 2026-09-24 · The restaurant time zone is WIB (Asia/Jakarta, UTC+7), times show as 24-hour HH:MM, and a business day runs 00:00 to 23:59 · docs/PRD.md section 9 ("Restaurant time zone"), commit `8af57a8`
- 2026-09-24 · Ruling I-8: a back-office reprint of a kitchen ticket is audited · docs/PRD.md FR-J3, commit `8af57a8`
- 2026-09-24 · No `Rp` symbol in the MVP; amounts stay bare · .agent/tasks/DESIGN-008-floor-and-incident-corrections.md (rule 7)
- 2026-09-24 · The MVP ships light only; a dark palette is deferred · .agent/tasks/DESIGN-008-floor-and-incident-corrections.md (rule 8)
- 2026-09-24 · POS-03 Q5: an emptied order shows no lines and no charge rows · conversation only — memory archive L349
- 2026-09-24 · POS-03 Q6: Cancel while an approval is verifying cancels, with no partial state (B-20), and a cancelled approval is audited per FR-J3 · conversation only — memory archive L349
- 2026-09-24 · POS-03 Q8: a category press shows that category's items, for example Beer, Water and Soda under Drinks and Steak under Mains · .agent/tasks/FE-023-menu-categories.md (Source)
- 2026-09-24 · POS-03 Q9: a comp carries no "applied by" note on its change sheet · conversation only — memory archive L349
- 2026-09-24 · Agents that are not in use, and the panes the lead made for them, are closed without asking · conversation only — memory archive L341
- 2026-09-25 · Clearing a kitchen incident, and dismissing a receipt warning, are not audited · .agent/tasks/FE-028-incident-recovery.md (header)
- 2026-09-25 · F4 is built in slices in this order: FE-025 print incidents, FE-026 floor, FE-027 Close closes, FE-028 incident recovery · .agent/tasks/FE-025-print-incidents.md, FE-026, FE-027 and FE-028 headers
- 2026-09-29 · The integration branch is `development`, replacing `agent/phase-0-foundations` · .agent/tasks/KIT-001-memory-split.md (header)
- 2026-09-29 · The agent kit is rolled out as KIT-001 to KIT-004, and no product task starts during the rollout · .agent/tasks/KIT-001-memory-split.md (Constraints)
- 2026-09-29 · A `main` branch is created from `development` at `881a36d`, and KIT-003 protects both `main` and `development` · .agent/tasks/KIT-002-config-roles-skills.md, .agent/agents.yaml (`protected_branches`)
- 2026-09-29 · A dispatch counts as asking: workers commit only on their own `agent/<task>` branch, only after verify is green, and never push · AGENTS.md, CLAUDE.md, .agent/WORKFLOW.md
- 2026-09-29 · The lead drafts changes to the four product documents; only the owner approves them · AGENTS.md, CLAUDE.md, .agent/WORKFLOW.md
- 2026-09-29 · Roles run as configured in agents.yaml: architect Claude Opus 5.5, designer Codex `gpt-6-astra`, builder Claude Sonnet with `economy` and `heavy` OpenCode profiles, explorer and librarian Codex `gpt-6-luna`, and caveman off for architect, designer and reviewer · .agent/agents.yaml, .agent/AGENT-KIT.md ("Decisions already made")
- 2026-09-29 · A reviewer is always from the other model family than the builder (cross-family review) · .agent/agents.yaml (`reviewer.pick`), .agent/WORKFLOW.md (Review gate)
- 2026-09-29 · The 2026-09-22 ruling "review agents run on codex" and the 2026-09-24 ruling "architects run on Opus 5.5 or codex `gpt-6-astra`" are superseded by agents.yaml and the cross-family review rule · .agent/agents.yaml
- 2026-09-29 · Caveman is off by role (architect, designer, reviewer), off for any task in category `arch` or `logic` or touching money, audit, identity or boundaries, and off in the lead's chat at decision moments; the owner's explicit mode switch always wins; files are always full prose · .agent/agents.yaml (`caveman_off_when`), CLAUDE.md ("When the lead writes plain prose")
- 2026-09-29 · The first real dispatch through the kit (KIT-004 pilot) is candidate A: render the `cancel`, `reauth` and `leaselost` modals inside `.pos-device` · .agent/tasks/KIT-002-config-roles-skills.md (Handoff, "For the owner" 2)
- 2026-09-29 · The skills layout is left as it is: `~/.agents/skills` is not put under git, and Claude keeps its own `impeccable` copy · .agent/tasks/KIT-002-config-roles-skills.md (Handoff, "For the owner" 1)
- 2026-09-29 · `main` and `development` require a pull request with 0 approvals, enforced for admins, with no force-push or deletion, because the owner and the agents share one GitHub account that cannot approve its own PRs · .agent/tasks/KIT-003-guardrails.md, GitHub branch protection
- 2026-09-29 · The contract and accepted-ADR guards apply to every commit, the lead's and the owner's included (bypass `ALLOW_CONTRACT=1`), and no one commits directly on `main` or `development` · .agent/tasks/KIT-003-guardrails.md, .githooks/pre-commit
- 2026-09-29 · Context7 belongs to the librarian only, whichever CLI runs it (`librarian.mcps: [context7]`, no other role gets MCPs); the other roles are told "Do not call Context7; use ask.sh librarian", and the Context7 Claude plugin stays installed for the fallback librarian · .agent/tasks/KIT-002a-context7-skills.md (Owner instructions)
- 2026-09-29 · `~/.codex/config.toml` stays as it is: Context7 is switched on and off per run only, not disabled globally, although that leaves it reachable by an interactive Codex designer · .agent/tasks/KIT-002a-context7-skills.md (Ruling in this session)
- 2026-09-29 · KIT-003 (guardrails) is accepted; it was merged as PR #14 · owner, lead session 2026-09-29; .agent/tasks/KIT-003-guardrails.md (Status)
- 2026-09-29 · The architect keeps `grill-me` in agents.yaml and its role prompt; skill names are not changed to suit a gate · owner, lead session 2026-09-29; .agent/tasks/KIT-002a-context7-skills.md (Handoff, owner's answers)
- 2026-09-29 · `skills:` in agents.yaml stays a hint: KIT-004 does not gate skills per run; `skills-report.sh --gate` is kept as a capability only · owner, lead session 2026-09-29; .agent/agents.yaml (base_skills comment)
- 2026-09-29 · KIT-002a (Context7 for the librarian only, `ask.sh` reading agents.yaml, `skills-report.sh`) is accepted; it was merged as PR #16 · owner, lead session 2026-09-29; .agent/tasks/KIT-002a-context7-skills.md
- 2026-09-29 · Dispatched Claude workers run with `--permission-mode acceptEdits`, a Bash allowlist and `git push` denied, as the lead recommended · owner, lead session 2026-09-29; .agent/agents.yaml (`launch.claude.permission_mode`, `allowed_tools`), .agent/tasks/KIT-004-dispatcher.md (Handoff)
- 2026-09-29 · The KIT-004 pilot (FE-029) is accepted, which closes KIT-004 and ends the rule that no product task starts during the kit rollout · owner, lead session 2026-09-29; .agent/tasks/KIT-004-dispatcher.md (Status)
- 2026-09-29 · KIT-005 (interactive dispatch mode and automatic pane close) runs before DESIGN-009 · owner, lead session 2026-09-29; .agent/tasks/KIT-005-interactive-dispatch.md
- 2026-09-29 · KIT-005 (interactive dispatch mode and automatic pane close) is accepted; it was merged as PR #21 · owner, lead session 2026-09-29; .agent/tasks/KIT-005-interactive-dispatch.md (Status, owner's answers)
- 2026-09-30 · DESIGN-009 may run headless Chrome through Playwright at 1280×800 against its worktree's Frost artifacts; the script and screenshots stay outside the repository and are not committed, and the Handoff reports the measurements · owner, lead session 2026-09-30 (answered the lead's question); relayed to design009 through Herdr
- 2026-09-30 · A refund's allocation may use only the order's original tender types; no row can be added · owner, lead session 2026-09-30 (DESIGN-009 review F4); .agent/tasks/DESIGN-009-closed-orders-and-refund.md (Round 2, O1)
- 2026-09-30 · A refund allocation row has no cap at its tender's effective contribution; only the sum must equal the order total · owner, lead session 2026-09-30 (DESIGN-009 review F4); DESIGN-009 task file (Round 2, O2)
- 2026-09-30 · A refund allocation row of 0 is dropped before the command and never recorded · owner, lead session 2026-09-30 (DESIGN-009 review F4); DESIGN-009 task file (Round 2, O3)
- 2026-09-30 · A manager-approved refund that the server then refuses writes one audit entry naming actor and approver, outcome REFUSED with the refusal code and no money fields · owner, lead session 2026-09-30 (DESIGN-009 review F5); DESIGN-009 task file (Round 2, O4)
- 2026-09-30 · The refund contract wording is approved as drafted and applied: FR-H5 (original tender types only, no per-row cap, zero rows never stored), FR-J3 and AC-18 (REFUSED entry for an approved refund the server refuses, refund-only), new AC-34 and two edge cases · owner, lead session 2026-09-30; .agent/journal/2026-09-30-refund-wording.md, docs/PRD.md
- 2026-09-30 · For DESIGN-009 round 2 only, the designer is Claude Opus 5.5 (effort high) instead of Codex gpt-6-astra, because Codex usage is exhausted; the re-review therefore goes to Codex · owner, lead session 2026-09-30
