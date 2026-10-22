# PHASE1-S2b review

## Verdict

**findings** — five P2 findings and one P3 finding, including the dependency issue already acknowledged by the lead.

Reviewed `agent/phase1-s2b` at `a53943c256aaef43d7538f8d2911c5f73e604ddf` against `development` at `608f412a54803bbd992fa9a39f43ea39fba738c8`, the task's lead rulings, the cited requirements and boundaries, DESIGN-018 and DESIGN-018b, the Frost artifact, and the inherited configuration-form rules.

## Findings

### F1 — P2: A discarded save's failed reread leaves the old version labelled as current

**Location:** `apps/back-office/src/settings/model.ts:379` (the early return at lines 380–382), with the facts renderer at `apps/back-office/src/settings/Settings.tsx:183`.

When an unknown command outcome is followed by a failed reread, `withheld` is set only by `settleUnknown`, which is skipped if the form has been discarded. The page clears the waiting status and presents the previously read version as still in force, although the discarded command may have saved a newer version.

**Authority:** PHASE1-S2b lead ruling 5 and AC 8; `docs/DESIGN.md:1668`, “An unknown outcome on a versioned form,” requires withholding version facts when that reread fails. Discarding a draft does not establish the command's outcome.

**Observed scenario:** Read version 4, change the phone, send Save, choose Cancel then Discard while the request is pending, resolve the save as `unavailable`, and fail its one reread. A direct execution of the actual model ended with `read: "ready"`, `withheld: false`, `current.version: 4`, `form: null`, and `command: null`; there were two reads including the initial read and exactly one save. The renderer therefore meets its condition for displaying “Version 4 · In force since …”. This also occurs if Discard happens during the reread.

**Proposed fix:** Record the failed unknown-outcome reread at page level before checking whether the originating form still exists. Clear the command silently as required for a discarded save, but withhold the facts until a subsequent successful read or authoritative answer establishes the current version. Cover both discard timings.

### F2 — P2: A gate that closes during the result's reread does not hold the completed result

**Location:** `apps/back-office/src/settings/model.ts:375` and `apps/back-office/src/settings/model.ts:406` (the continuations after `await reread()`).

`answered()` checks the session/decision gate before entering `present()`, but the unknown and stale branches await a read and then apply the notice, clear the command, and issue focus without checking that gate again. M-6, BO-01, or a departure/logout decision can open during that await. The result then becomes visible state behind the gate instead of being held for the same manager's return. The Settings focus effect also consumes focus requests while signed out or idle (`Settings.tsx:148`), so reopening the gate cannot replay the intended result focus.

**Authority:** `docs/DESIGN.md:1540`–1544 requires an answer to be held behind an active session gate and presented after the same manager resumes. The task's required S1b pattern and DESIGN-018's Focus table require the stale/newer-version notice to receive focus when presented.

**Observed scenario:** Send a phone change; let its answer become `unavailable` and hold the resulting read; call `setGate(false)` as the working area does when the session leaves signed-in; then resolve the read with version 5. Execution of the actual model produced `command: null`, `notice: "unknown-changed"`, and `offered.version: 5` while the gate remained closed. No result was left for `flush()` on resumption. The corresponding stale branch has the same unchecked continuation. The lost-focus consequence follows from the component code; I did not reproduce that consequence in a real browser.

**Proposed fix:** Recheck both the session/frame gate and the local decision after the asynchronous read. Retain the completed result and its read data until presentation is permitted, then apply it and request focus once. Resumption must not repeat the save or the already completed reread. Add delayed-reread cases for session and departure gates, not only cases where the original command answer arrives after the gate closes.

### F3 — P2: The stale comparison describes the submitted values after the editable draft has changed

**Location:** `apps/back-office/src/settings/model.ts:590`–595; comparison creation at `model.ts:351` and `model.ts:419`; rendering at `apps/back-office/src/settings/Settings.tsx:372`.

The fields remain editable in stale and unknown states, but `setField()` updates only the draft and errors. `nowInForce` and the “same values as your draft” sentence remain based on the last submission. Consequently, a field that becomes different has no current-value annotation, and a field edited to match can retain a spurious difference. Retrying an unknown outcome's failed read also compares against `form.sent`, even when the manager edited the draft before pressing Try again.

**Authority:** PHASE1-S2b AC 7 and AC 8; `docs/DESIGN.md:1636`–1654 and DESIGN-018's stale copy require the displayed comparison to describe the draft beside it, with the current value next to every differing field.

**Observed scenario:** A stale save is reread as a newer version whose phone matches the submitted phone, `021 777`. Edit the still-enabled phone to `021 999` before choosing Keep or Use. The actual model retained an empty comparison map. A separate rendering check using the actual `Settings` component and model reproduced the visible contradiction: phone `021 999`, no `phone-current` element, and “It has the same values as your draft. Choose which to keep.” The comparison's reference phone remained `021 555` in that rendering check.

**Proposed fix:** Derive comparison annotations and the same/different sentence from the current draft and the offered version, updating them when a field changes and when a reread completes. Use exact rate normalization and the existing text normalization; do not rebase or send anything implicitly. Test both becoming different and becoming equal, including an edited draft before an unknown-outcome read retry.

### F4 — P2: The draft's null base keeps first-run claims visible after version 1 exists

**Location:** `apps/back-office/src/settings/Settings.tsx:361` and `Settings.tsx:409`–410.

`firstRun` is derived from `form.base === null`. Keeping that base unchanged until the manager makes a stale-state choice is correct for concurrency, but it is not evidence that nothing has been saved. The same boolean controls the form's title and factual context, so a concurrent first save produces contradictory current-state copy.

**Authority:** PHASE1-S2b lead rulings 5 and 6 explicitly distinguish the version in force from the draft's base. DESIGN-018's first-run context applies when nothing is saved, whereas its stale/unknown states identify the version now in force. ADR-012 rule 3 requires preserving the base, not presenting it as the current installation state.

**Observed scenario:** Open Enter settings when no version exists, fill all fields, and let another manager create version 1 before Save. Return `SETTINGS_CHANGED` and reread version 1. The actual model correctly retained a null base, while the actual component simultaneously rendered “Version 1 · In force since … · Saved by Other manager” and “Nothing is saved yet. Enter every rate and detail; saving creates version 1.” The existing first-run stale test checks the notice and facts but not this context.

**Proposed fix:** Keep `form.base` exclusively responsible for the outgoing version and rate comparison. Choose the form's factual context from the known current/read state, using the existing edit context once a version exists and avoiding a definite “nothing is saved” claim when the outcome/read is unknown. Cover first-run stale and unknown transitions without changing the base before the manager chooses.

### F5 — P2: The closed first-run state omits currency and precision

**Location:** `apps/back-office/src/settings/Settings.tsx:228`–248.

When a successful read returns `current: null` and the form is closed, only the empty notice and Enter settings button render. The Money facts exist only in `ReadView` (which requires a current version) or the open form. They therefore disappear both on the initial visit and after cancelling an untouched first-run form, despite the successful read supplying them.

**Authority:** FR-B1 requires the back office to show the fixed currency and precision; ADR-012 rule 5 makes them independent of a settings version. `docs/DESIGN.md:1721`–1726 explicitly requires plain facts at the first run as well. The Frost artifact has the same omission in `first-run-closed`; that drawing does not override these requirements.

**Observed scenario:** Mount the actual Settings component with a successful `{ installation: { currency: "IDR", minorUnitPrecision: 0 }, current: null }` read. The rendered output contained Enter settings but contained neither IDR nor “whole rupiah.” The existing test checks currency only after opening the form.

**Proposed fix:** Render the installation's plain Money facts in the closed first-run state whenever the read succeeds. Keep both rates unfilled and retain the loading/failure withholding rules. Add assertions before Enter settings and after clean Cancel.

### F6 — P3: The new money import is absent from the client's dependency declaration

**Location:** `apps/back-office/src/settings/rate.ts:1`; missing declaration at `apps/back-office/package.json:11` and the corresponding back-office entry in `package-lock.json`.

The settings implementation directly imports `@pos/money`, but the back-office package does not declare it. Root workspace linking currently masks the missing dependency, so today's build is green; tooling or installation based on the declared package graph will not know to include this required package.

**Authority:** The task's lead ruling on the Handoff explicitly accepts this finding at `.agent/tasks/PHASE1-S2b-settings-screen.md:238` and requires the two manifest files to be added to the next round's ownership. This is a carried-forward issue, not a newly discovered blocker.

**Observed evidence and limitation:** I inspected the direct import and both package declarations. Both client builds passed in the existing workspace. I did not attempt an isolated installation, so failure under such an installation is an inference from the missing graph edge, not an observed build failure.

**Proposed fix:** Add `"@pos/money": "*"` to the back-office dependencies and its lockfile entry under the lead's expanded ownership.

## What I ran and what I did not

- **`npm run verify`: passed**, including all seven typecheck projects and **113 test files / 4,316 tests**. The command exited 0. Its reported test duration was 69.47 seconds.
- **`npm exec vitest run -- --project client`: passed**, **81 test files / 3,594 tests**, exit 0. I launched this while the full run had not yet returned output; it was not a substitute for the full verify result.
- **`npm run test:e2e:all`: did not reach browser tests.** Both Vite client builds passed, then Playwright setup failed with `connect EPERM 127.0.0.1:5433`. No Chromium or WebKit pass count is claimed from my run. The task records the lead's separate 74-pass run; that is attributed evidence only. I did not retry outside the sandbox or alter database configuration.
- **`git diff --check development`: passed.** Before verification and after the green runs, `git diff --stat development` was identical: **29 files, 4,330 insertions, 24 deletions**. HEAD and development remained the hashes above, and `git status --short --branch` showed a clean source tree before this report was written.
- Ran read-only, in-memory scenarios with `node --import tsx --input-type=module -e`, importing the actual settings model. They reproduced F1–F4's state evidence, including the command/read counts and a gate closing during a delayed reread. No source mutation was applied.
- Mounted the actual Settings component and SessionProvider with the actual model in jsdom, using a controlled configuration source. This reproduced F3–F5's rendered copy and missing elements. The initial ad hoc mount failed because the standalone JSX runner lacked React in scope; rerunning with that runner binding supplied succeeded. These checks prove component output, not browser top-layer behavior or visual appearance. An earlier attempt to import TypeScript through the Node REPL failed on its module/runtime restrictions; the shell Node runs supplied the evidence reported here.
- Read the changed source, the changed existing assertions, the new test coverage and browser spec, and the cited design/contract rules. The browser spec uses real sign-in helpers, the page's requests, and domain functions for the competing save and database assertions. Its production-path coverage is materially stronger than a fixture-only screen mount, but I could not execute it here.
- I did not independently rerun the builder's mutation proofs, conduct a served-screen visual inspection, use Context7, edit source/tests/task files, commit, or push. Only this review report was authored.

## Cleared

The rate conversion path stays in strings and bigint through `rateFromPercent` and `encodeRate`; its refusal order, decimal-comma display, four-place precision, zero acceptance and upper bound match the cited rate table and B-1/FR-M5. Text validation, normalization, null NPWPD, phone slash refusal and code-point lengths agree with the contract vectors and the lead's length ruling.

The outgoing version remains the draft's base until an authoritative answer or explicit stale-state choice. Keep and Use do not send a command. Rate confirmation compares against that base, distinguishes details-only and first-run saves, and sends only on its explicit action. Unknown outcomes initiate a read rather than an automatic resend. Saved and unchanged answers are distinguished by the carried version. Older reads cannot replace a newer known version.

The settings model belongs to the keyed working area; ordinary navigation does not destroy an outstanding command, and a different manager destroys the old area's state. The confirmation and departure dialogs use the required close/retain/reopen pattern at BO-01 and remain mounted under M-6. These ordinary paths pass the unit suite; F2 identifies the additional asynchronous gap.

Navigation, ConfigApi exposure, fixture-mode wiring and fixture exclusion checks pass. The settings fields are not seeded production configuration, currency and precision have no editing controls, and saves introduce no path to change historical orders or day snapshots (B-8/B-9). The B-13 audit boundary is not a requirement to add settings audit events: the cited owner ruling explicitly excludes them. No server transaction or partial-order mutation was added (B-20).

BO-05's partial-list wording is isolated from its plain failed-read wording, and the changed existing assertions preserve that distinction. The settings CSS follows the cited Frost rules and existing tokens. Payment methods and the task's other explicit exclusions remain absent. The lead-approved first-run unknown sentence and code-point correction are not findings.
