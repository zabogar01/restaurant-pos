# PHASE1-S7b2 review

## Verdict: findings

There are three findings: two implementation findings and one unreviewed-copy finding. The full verification suite passed in this review. The browser suite could not start its tests because its database connection was denied by the execution environment.

Reviewed branch: `agent/phase1-s7b2`, HEAD `03370a0e92dff57cd80e0902ed4abcc4485a688a` (implementation commit `f118283`). I inspected the branch comparison against `development` (`a589c23d71b43a19e0f24652ecd4010c78a432ed`) and reviewed this slice's changes against `agent/phase1-s7b1` (`ae4420060544fe763d5c21327da54a42de70323c`), as the task's scope instruction requires. S7b1's existing implementation is not reported as new work in this review.

## Findings

### F1 — P2: The served line editor does not receive the served sheet behavior

**Location:** `apps/pos/src/Sheets.tsx:580`, with the shared default at `Sheets.tsx:58` and the served heading styles at `apps/pos/src/pos.css:1198`.

`LineSheet` calls `SheetFrame` without `served`. Consequently, editing a line added from the served catalog opens a fixture-mode frame: focus lands on the dialog instead of its heading, Tab containment is disabled, and the growing, wrapping header styles do not apply. This is the shared-control problem the review method asks for: the new frame switch correctly handles the served item sheet, while its default hides the incorrect state in the served line editor.

**Authority:** The task's DESIGN-021 requirements bind the sheet focus rules and pending editor, and R1 requires the full sheet heading. The reviewed artifact's `docs/design/visual-directions/frost-order-flow.js:143` applies heading focus and Tab containment in its shared served shell; `openEdit` at line 181 uses that shell. `docs/design/visual-directions/frost-served-catalog.css:22` gives the same served editor a growing header and wrapping heading. These are design requirements, not a claim that B-8 or B-20 is broken.

**Failing scenario:** Add a served item with a 64-character name, then press its pending row to edit quantity. I reproduced the missing `sheet--served` class, opening focus on the dialog, and failure to wrap from Update to Back using additional assertions loaded in memory. The header also lacks the only applicable `overflow-wrap: anywhere`, `min-width: 0`, and growing-height rules for that name. The resulting visual overflow is inferred from the styles; I could not measure it in a browser in this environment.

**Proposed fix:** Propagate whether this is a served catalog through `SheetView` to `LineSheet` and `SheetFrame`, so the served pending editor uses the served heading, wrapping, and keyboard behavior. Keep the fixture editor's accepted behavior separate. Add coverage that opens the editor by adding and pressing a served line, including a long name and keyboard traversal.

### F2 — P2: The fire refusal retains one recovery button per line instead of the bound single action

**Location:** `apps/pos/src/OrderPanel.tsx:648`.

The notice maps every blocking line to `Show {line.name}`. Two pending lines for one unavailable item therefore draw two identically named recovery controls, although the notice correctly deduplicates the item name. Larger sets also grow the recovery controls with the number of lines. The single-item fixture did not expose this discrepancy; the newly supported plural does.

**Authority:** The task's DESIGN-021 section explicitly binds the copy table's fire rows exactly. `.agent/tasks/DESIGN-021-pos-catalog-states.md:773` specifies one **Show unavailable lines** action, `served-show-blocked`, revealing and focusing the first offending line. The reviewed artifact implements that action at `docs/design/visual-directions/frost-served-catalog.js:116`. ADR-011 rule 24 assigns the wording to design. This is a defect of this slice even though the old per-line rendering predates it, because this slice expressly adopts the fire rows and plural state.

**Failing scenario:** Add the same served item twice, then have the catalog poll mark it unavailable. My in-memory assertion expected `['Show unavailable lines']` and received `['Show Nasi Goreng', 'Show Nasi Goreng']`. The existing callbacks do reveal and focus the selected line; the defect is the number, wording, and target policy of the offered actions, not a missing focus call.

**Proposed fix:** On the served path, render the single designed action and pass the first blocking line to the existing reveal/focus behavior. Preserve the fixture path if its older recovery controls must remain unchanged. Test both several lines for one item and several distinct items.

### F3 — P3: Multiple removed choices use wording the builder introduced

**Location:** `apps/pos/src/catalog/menuCopy.ts:133`.

`REMOVED_NOTICE` joins names with commas and changes the sentence to “A, B were removed and deselected.” The Handoff explicitly identifies this wording as the builder's invention. The design table supplies only the sentence naming one removed option; it does not authorize the plural form.

**Authority:** ADR-011 rule 24 says the designer owns every screen sentence, the builder invents none, and a state without a designed sentence stops the builder. The task also requires exact copy and says an accepted ADR takes precedence. The relevant designed sentence is DESIGN-021's copy table at line 768.

**Failing scenario:** Select two modifiers and receive a projection that removes both, or remove selected choices across successive polls. `follow` accumulates their names, and `noticeOf` reaches the unreviewed plural branch. This scenario is established by source inspection; I did not run a separate reproduction of it.

**Proposed fix:** Obtain and record the designer's wording for multiple removals, then implement and test it. A proposal can reuse the reviewed per-option removal sentence for each removed choice after the shared introduction, but the reviewer is not approving new screen wording.

## What I ran and what I did not

- **`npm run verify`: passed, exit 0.** Typecheck completed successfully. Vitest reported **156 test files passed and 5,686 tests passed**, with a duration of 122.53 seconds. These are my observed results, not the Handoff's counts.
- **Tree stability:** `git diff --stat` was empty before verification and after its green result. HEAD, `development`, and `agent/phase1-s7b1` resolved to the same hashes above on both checks. `git status --short --branch` remained clean after the diagnostic run, before this report was written. There was no moving source tree during review.
- **`npm run test:unit -- --project=client`: passed, exit 0**, with **119 files and 4,773 tests**. I started this while full verification had not yet returned, to obtain independent client results; the full run subsequently passed as well.
- **`npm run test:e2e:all`: failed, exit 1, before test execution.** Both client builds succeeded. Playwright setup failed with `connect EPERM 127.0.0.1:5433 - Local (0.0.0.0:0)`. I observed no passing browser tests in this run. The task records the lead's separate 128-test, two-engine pass at `f118283`; that is attributed evidence, not my rerun.
- **Additional in-memory assertions:** I used a Vite transform supplied to `startVitest` to append two diagnostic tests to `served-item-sheet.test.tsx` without writing it. The result was **38 existing tests passed and two diagnostic tests failed**, reproducing F1 and F2. F1 had three failed assertions: served class, heading focus, and Tab wrap. F2 failed on the recovery-button list. Production code was unmodified. This was an added-assertion run, not a production-code mutation, and it does not replace the builder's mutation proofs.
- **Browser geometry attempt:** A separate headless Chromium launch for an isolated layout check failed at macOS `bootstrap_check_in` with permission denied. I therefore did not claim measured editor overflow, browser focus traversal, or fresh screenshots.
- **`git diff --check agent/phase1-s7b1..HEAD`: passed.** I inspected the changed tests: base-price arguments and outcome-returning stubs are mechanical; the served tile assertion appropriately changes to opening M-2; removal of the provisional-plural sentinel follows its own instruction now that the plural has a reviewed design.

I did not rerun the builder's or lead's production-code mutations, run the predecessor baseline, or rerun browser tests outside the sandbox. The current tests prove fixed-band structure and the existing browser P8 checks positions with a short option list; they do not independently establish browser scroll preservation with a long, already-scrolled list. I do not treat jsdom's assigned `scrollTop` as a measured browser-layout result.

The unit screen harness mounts `OrderScreen` with a served catalog provider. Production mounts `ControlledOrderScreen` through `PosRoutes`. I inspected that distinction, the common component path, and the browser test setup; I did not use the standalone harness to establish production lock reachability. P8 and P9 enter the served POS through real sign-in and visible controls. Their domain-function catalog setup is test preparation; P8's availability mutation is the back-office row control, and the POS receives it through the poll.

## Cleared

**Money and snapshots:** The screen and store use the same ceiling function. It checks the proposed line and resulting order total after discount and service, excludes the replaced line during quantity editing, and uses bigint amounts. The unit floors before multiplication. Lines retain their names, component deltas, and resolved units instead of repricing from the live catalog. These checks support FR-C2, FR-D4, AC-26, B-1, and B-8 within the authorized Phase 1 stand-in.

**The lead's order-ceiling question:** Including the fixture service charge is correct under C4 D1 and the task's explicit “total as the panel shows it” rule. A line at 99.999.999 may pass its own limit while failing the order limit. Isolating the exact line bound under a 100% discount is valid; the separate order-bound test covers service-charge arithmetic. There is no finding on this point.

**Availability and fire:** The open sheet preserves choices on an 86, distinguishes absence from unavailability, retains last-known details, follows changed figures, removes vanished selected options, and leaves new options unselected. Add and quantity controls use guarded `aria-disabled`. Store Add reads current availability at the press, refuses both lock kinds and ceilings, and advances its book ref for successive calls in one tick. Fire blocking uses item identity, not names; plural counts and deduplication are correct. The existing tests also cover restoration and a fixture item named like a served item. These are the stand-in's B-17 and B-20 protections, not server-command enforcement.

**The lead's lock question:** I found no current routed Phase 1 path that changes the payment lock while retaining an open M-2. Own-tab payment activation occurs on the settlement route (`PosRoutes.tsx:92`), which unmounts the order screen. Fixture lease changes are view changes, which clear open sheets (`OrderPanel.tsx:186`). Session sign-out also unmounts the order screen. A synthetic prop change could leave Add live and the store silently refusing, but it is not evidence of a reachable production case now. B-20 requires unchanged state on refusal, not explanatory copy. The store guard passes; the screen's missing live-lock state should be revisited when real external leases arrive.

**The lead's archive question:** The sheet blocks an item absent from the projection and keeps readable last-known details. C4's Phase 1 store-refusal table names the current 86 list, not archive rejection. ADR-012 rule 12 assigns active-and-available validation to the later server add-line command. I do not classify the stand-in's archive-store omission as a defect of this task. Pending archived items intentionally do not block fire under the task's explicit rule.

**The separate component and fixtures:** A separate `ServedItemSheet` is a larger implementation departure than C4 suggested, but that structure alone is not a correctness defect. The fixture item path retains its reviewed options and routing, with the authorized snapshot-price and refusal-outcome changes. It is not accurate to say every fixture layout is exactly unchanged: `LineSheet` now unconditionally reserves an empty reason row, including in fixture mode. The reviewed artifact reserves that row only for served mode. Scope it when propagating the served mode in F1; this does not need a separate finding. The ordinary fixture tests passed, but they do not prove unchanged pixel geometry.

**Navigation and scope:** Served M-2 opens through component state without changing the URL; Cancel, Escape, and successful Add return focus to the tile or selected category. The order panel's long-name wrapping is present and covered by P9's implementation, although I could not rerun its browser measurement. No catalog version is added to a line or command, no server source is changed, and this slice's changed paths stay within its ownership. I made no source or test edits, committed nothing, and pushed nothing.
