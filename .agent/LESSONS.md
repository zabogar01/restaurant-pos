# Lessons

Rules this project learned the hard way, one line each with the incident behind it, grouped
by who acts on them so the best can be promoted into role prompts. Edit freely: merge
duplicates, drop a rule once a test or hook enforces it. The stories are in the
[memory archive](journal/2026-09-29-memory-archive.md); "L1234" is a line there.

## Lead

- Walk every UI flow in a real browser before closing a UI task, because a green suite said nothing about the empty state (FE-014), the clipped keypad (F3b), the zero-balance add (F3b) or the swallowed removal (F3d), all found only by opening the screen.
- Count, do not recall or infer: callers of a seam, states in an artifact, buttons in a sheet, what the repo holds, because a seam claimed from one function (FE-014, 2026-09-22, L1575-1606) and a save button remembered from habit (L1608-1632) were both wrong.
- Write a task file from the code and the reviewed artifact, and count the screen before assigning it, because F2, F3 and A9 were each resized after counting (26 states; 21 states; one surface) and FE-015's routing problem only showed in the code (L1450-1474).
- State a premise as a premise, and give "X holds because Y" its own criterion, because FE-016's cash maximum rested on "Add is refused at zero" and no test checked it (2026-09-23, L388-400).
- Name the case that goes red in the criterion; "prove it red" is not enough, because FE-011's "returns to the order the notice was drawn over" could be met without being met (L1753-1772).
- When a task reverses a placeholder or adds to a component, grep the tests for the copy and the structural assertions (counts, exact lists) and name those tests in the task, because FE-026, FE-027 and FE-028 each blocked on tests the task never named (2026-09-25, L143, L197-201, L229-234).
- Slice by authority, not by component, because F2c was handed three gated discount sheets on the ungated side and correctly built three of seven (2026-09-18, L2291-2366).
- When two rulings come from different slices, add a criterion where they meet, because FE-016 rule 7 and FE-017 rule 8 each looked right and together cleared a notice with 27.800 still owed (L545-556).
- Go to the requirement, not the inventory's summary of it, because "gated by the whole transition" was over-read from SCREEN-INVENTORY when `FR-F8` is narrower (L2321-2348).
- The artifact can be wrong: check every drawn state against the boundaries, because Frost drew a live close on a stale balance (DESIGN-004), a live confirm during lockout (F2g) and a fireable 86'd item (`B-17`, F2h). A boundary wins, and the finding goes back to the designer.
- A warning is not a test: when memory flags a two-path shape, the next task carries a criterion that exercises the real route, because "watch it" on F3a's optional `store` prop became a live regression (L453-474).
- When a safety property is bought with a default prop, pin the two paths together in the same slice, because FE-014's optional `order` prop made `empty` draw four rows on the real path and the panel's own tests never saw it (L1670-1724).
- Check `git log`, not the handoff, and read the whole handoff before trusting a "done", because a designer reported committing when nothing moved (L2854-2857) and codex wrote its handoff above the heading (L1216).
- Idle is not done: look for the empty handoff first, because `builder7` went idle with source on disk and a green suite but no tests written (2026-09-18, L2368-2379).
- After any interruption, run the suite and read which tests fail before prompting on, because machine sleep left a red-case mutation live in `tender.ts` (builder18, 2026-09-23, L405-409).
- Use path-scoped `git add` while any implementer is live, never `-A`, because one swept a mid-mutation tree into a docs commit (`261129d`, 2026-09-14, L2678-2683).
- Change an agent's model between slices, never inside one, because killing `builder13` nine files in would have left a half-mutated tree with no handoff (L1226-1230).
- After every `herdr agent prompt`, confirm `agent get` reads `working` before trusting the wait, because codex self-updated on start, dropped the brief and the wait woke on its exit (2026-09-25, L82-86). Answer *Skip*, never *Update now*, to a CLI update prompt (L1256).
- Confirm a suspected dead control with a direct DOM click before filing it, because synthetic clicks silently did nothing and nearly became a false regression (F3a, L1409-1424).
- A check that did not run is void, not passed, because hover emulation did not take and `builder6` declared it void rather than report a pass (L2452-2455).
- Rewrite STATE.md at every material change, not after the last commit, because MEMORY.md went confidently stale on 2026-09-10, 2026-09-14 and 2026-09-22 (L720-725, L697-702).
- A ruling exists only once written in DECISIONS.md, and one described as in progress does not land, because the tender-pad retyping was recorded as "in progress" and never done (DESIGN-004 finding 2, L2828-2834).
- Send a sandbox escalation to the owner and never answer it yourself, because widening an agent's sandbox is the owner's decision (designer3, 2026-09-24, L616-619; L49-52).
- Use an independent review on any slice that encodes a rule, because FE-010 and F2h reviews each caught a defect the lead's own criterion carried, which no implementer could see (L1990-2007, L1753). The owner may waive it, as for F3.
- Inject defects into a tree before handing it to a reviewer, or say so first, because the FE-010 reviewer watched `OrderPanel.tsx` mutate mid-run (L2037-2046).
- Leave a dispatched task file uncommitted on the lead's branch and edit only the worktree copy afterwards, because committing it in both places makes two PRs add the same file with different content (FE-029 pilot, journal/2026-09-29-kit-004.md).
- Parse a worker's verdict loosely and test the parser on each CLI's real output, because the Codex reviewer wrote `## Verdict: clean` where the dispatcher expected `**Verdict:**` (FE-029 pilot).
- Close a task's panes as soon as its review is in and no round is expected, not at merge, because the owner found FE-029's builder and reviewer panes still open after the clean review (owner feedback, KIT-005).
- When opening a Codex designer by hand in a worktree, pass `-c sandbox_workspace_write.writable_roots=["<main checkout>/.git"]` as the dispatcher does, because a worktree's index lock lives under the main checkout's `.git` and DESIGN-009's designer could not commit without it (2026-09-30).
- After a hand-opened task, write `.agent/runs/<ID>/builder/meta.json` with the author's `cli` before dispatching its review, because without it the dispatcher assumes the builder role's default CLI and picks a reviewer from the author's own family (DESIGN-009, 2026-09-30).
- Before dispatching a task that cites a consult report, make the report reachable from the task branch (merged into `development`, or committed on the task branch as an identical copy before the round that needs it), because PHASE0-003a's reviewer blocked on ARCH-006, which existed only uncommitted in the lead's worktree (2026-10-05).

## Builder

- Read the reviewed artifact and the contract, not only the task file, and follow them where they disagree, because seven slices running had a builder catch a wrong task file this way (L2206-2210, L2401-2416).
- Stop and raise instead of building on a wrong premise or scoping a rule back, because `builder16` and `builder19` stopped and `builder13` refused a per-state flag, each saving a rebuild (L1575, L453, L1880).
- Prove each guard red by making the mutation, reading the failure and reverting; the mutation must reproduce the real defect, because the first `I-12` injection hit a non-interactive branch and proved nothing (F2e, L2110-2112).
- Where production reads a fact, tests read the same fact, not a state name, because `TABLE_STATES` filtered by name was one rename from lying (FE-012, L1827-1838).
- Never call `Number()` on money and never fill in an unreviewed value, because `tsc` does not catch `Number()` on a bigint and an invented "applied by" note asserted a fact nobody recorded (L2471-2473, L2009-2022).
- Use `<button>` for acting and `<a>` for going, and `aria-disabled` rather than `disabled` on an off action, because Space does not activate a link (L2418-2441) and a `disabled` control drops out of Tab and out of the reason it is off (FE-024).
- Give each piece of state one owner, and never write `suppliedX ?? localX`, because it is two paths and two review defects (FE-019, L557-564).
- Never run Prettier, because there is no config and it rewrote 541 lines of `orderFixtures.ts` in silence; if it happens, say so (FE-011, L1936-1946).
- Tell the lead you have no browser and do not spend turns looking for one, because `builder17` burned two turns on it (L1212-1218).
- Write the handoff in its slot before reporting done, name every existing test you changed and why, and never loosen a test, because coverage that shrinks looks identical to coverage that held (FE-013, FE-028, L229-234).
- Do not reach into committed work outside the slice; report it, because `builder10` found the wrong-line void and did not touch F2a (L2076-2094).
- Run one simple command per shell call in an unattended run, because FE-029's builder lost five calls to compound commands the allowlist refused (FE-029 pilot).

## Reviewer

- Say what you ran and what you did not, and make no mutation-run claim you did not make, because the F2h reviewer separated "a blind guard" from "an observed bypass" and the lead could trust the rest (L1774-1783).
- Cite the authority that actually carries the rule, because the reviewer corrected `C-1` to `C-2` and `FR-E5` without changing the ruling (L1745-1751).
- Confirm the tree is not moving and note a diff hash either side of your last green run, because a reviewer cannot review a mutating tree (FE-010, L2037-2046).
- Look for one control or value shared across states, hiding the state where it is wrong, because it produced six defects in reviewed work (DESIGN-004, F2g, F2j, F3b, DESIGN-006, DESIGN-008; L2186-2195).
- Re-prove unproven red cases by mutating in memory, without editing a file, because the F3 review cleared F3c's debt that way (L545-550).
- Do not accept a green suite as evidence about the screen when the tests use a path production does not, because `empty` was tested only through the panel's own path (L1684-1689).

## Designer

- Invent, revert, ask: when a constraint and a need collide, draw nothing new and raise it, because DESIGN-005 built a BO-03 state, reverted it and asked (L1358-1367).
- Ship a rule as CSS or a test, not a comment, because A7's "an implementation should gate hover" fixed nothing until it became a media block and a test (L1340-1352, L2558-2566).
- Measure at 1280 by 800 in a browser, not by box-model arithmetic, because DESIGN-006 first clipped the keypad in two states and FE-020's takeover ran off the frame (L422-433, L665-671).
- Do not draw a state the contract forbids: a deactivated table cannot be open (`FR-C8`), and a confirm key cannot be live during lockout (`FR-A5`), because both reached review (L59-63, L2234-2242).
- Raise, do not rule, whether an action is audited or gated, and never make an acknowledgement implicit, because `FR-J3` and `FR-G14` are the owner's contract (DESIGN-006 review, L620-626).
- Give a link the destination its own caption promises, and check the fixture's own navigation across every state, because Try again, Leave payment and Reprint each went somewhere the copy denied (L627-637, L87-98).
- Do not invent a control the PRD does not grant, such as a line note, because DESIGN-007 left Square's note and taxes sections out for that reason (L309-312).
- When the owner reports a merged fix missing, check which commit their dev server serves before suspecting the code, and fast-forward the main checkout as soon as a merge lands, because the owner's Vite on port 5173 runs from the main checkout and on 2026-10-03 it was still serving the pre-FE-035 `development` (journal 2026-10-03).
- After a browser walk reaches a guard state (a sheet not drawn, a refusal, an empty address), keep operating the screen from it, because on FE-036 the walk stopped at "no sheet, frame live" and missed that every later tap also drew nothing; the strong review found it (journal 2026-10-03).
