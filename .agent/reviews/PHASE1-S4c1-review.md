# PHASE1-S4c1 review

## Verdict

**findings** — two findings. Reviewed `agent/phase1-s4c1` at `ca09d8d67143fce9967d78fd445d09c40ffb4a6b` against `development` at `870c969273c6b9a6df37a9c8cb322e9434efe11b`, including the task's round-two ruling and implementation.

## Findings

### F1 — P2: A retry of the outcome reread bypasses the session and departure gates

**Location:** `apps/back-office/src/menu/model.ts:935`, particularly the presentation at lines 938–951.

`retryRead()` awaits the catalog read and immediately changes the form notice, comparison or page result. It checks `stopped`, but neither the session gate nor the departure decision. The original unknown and stale completion paths perform those checks and hold their completed result; the retry path does not.

**Authority:** PHASE1-S4c1 ruling 14 requires the gate and open decision to be rechecked after each asynchronous reread, with the finished result and its read held until presentation is permitted. This carries forward PHASE1-S2b round-two F2 and `docs/DESIGN.md`'s configuration-form command-result rule at lines 1540–1544. The relevant rule is result presentation, not merely preservation of the draft under FR-A2b.

**Observed failing scenario:** A manager renames Mains to Main plates. The save has an unknown outcome and its automatic reread fails. The manager presses the form's **Try again**, then M-6 opens while that read is outstanding. When the read returns version 6 with the name Other tab, the mounted screen immediately replaces its uncertainty notice with “The menu has been read again at version 6. It may include this save…” and renders the comparison and both choices behind M-6. I reproduced this both in the production model and through the real `Screens`/session harness in jsdom; the session was still `idle`. No additional save was sent. The existing gate tests cover the automatic reread, while the retry tests complete without a gate opening.

**Proposed fix:** Give the explicit retry the same gated completion handling as the automatic reread. Keep the completed read and the originating editor/result identity, recheck both gates before presenting, and consume it once after the same manager resumes or acknowledges Stay, without another request. Add delayed-retry cases for an unknown outcome and a stale refusal, including M-6 and the departure decision.

### F2 — P2: The shared list-usability condition disables creation in the read-failure state

**Location:** `apps/back-office/src/menu/Menu.tsx:258` and `apps/back-office/src/menu/model.ts:959`.

Both the button and its model opener require `usable`, meaning a successful read or an existing partial list. Consequently a failed initial catalog read disables **New category** and prevents its editor from opening. Category creation carries no catalog version and does not require a complete list. The builder acknowledges this departure from the artifact in its Handoff, but the task supplies no ruling that excludes or changes this state.

**Authority:** PHASE1-S4c1 ruling 1 requires BO-03 in every DESIGN-019 state except its enumerated exclusions; the error state is not excluded. The reviewed artifact, `docs/design/visual-directions/frost/back-office/menu.js:47`, disables New category only during loading or a pending command, leaving it live after read failure. Ruling 9 specifies the version-free `{ name }` create body. The complete-read restriction belongs to the reorder openers, as `docs/DESIGN.md:1795` specifies.

**Observed failing scenario:** Mount Menu through the real screens with a failed initial catalog response. The read-failure alert appears, but New category has `aria-disabled="true"` and `tabIndex=-1`. Pressing it opens no panel and sends no create request. I reproduced that rendered state in jsdom. The shared `usable` value is correct for drawing the table and permits creation in the partial state, which hides its incorrect use in the ordinary failure state.

**Proposed fix:** Give creation its own availability condition in both the view and model: block while loading or a command is pending, but permit it after read failure. Keep the complete-read restriction on reorders. Test the failed-read creation path and its successful transition to the partial-list composition, with counts withheld.

## What I ran and what I did not

I ran `npm run verify`. Typechecking completed and Vitest started, but the run produced no test results while waiting for database setup; I interrupted it. I then ran `env PGCONNECT_TIMEOUT=3 npm run verify`. Typechecking again completed, and verification exited 1 during global setup with `connect EPERM 127.0.0.1:5433`. That run completed no tests; its “No test files found” message accompanies the setup error and does not mean the repository has no tests.

I ran `npx vitest run --project client`: **98 files and 3,908 tests passed**. A second client run with `--pool threads --maxWorkers 2` passed the same **98 files and 3,908 tests**. The targeted category-name run with `--pool threads --maxWorkers 1` passed **1 file and 17 tests**. I initially suspected worker startup while output was pending; the completed client results and the bounded full run identify database access as the full-verification limitation.

The two additional rendered probes used the existing session harness, `Screens`, production transport/session behavior with stubbed responses, and the repository's dialog shim. The gate probe also ran against the production model directly. They were executed from inline Node commands without editing any source or test. These are DOM/model observations, not native-browser evidence. I did not run a mutation test or claim the builder's mutations as my own.

I did not run `npm run test:e2e:all`, a native-browser walkthrough, or visual viewport measurements. The task's Lead verify section explicitly supplies the inaccessible database/browser evidence and rules that limitation alone nonblocking: it records **133 files, 4,746 tests**, and **86 browser cases** in Chromium and WebKit. Those are the lead's results, not mine. I inspected the browser spec's page-driven commands and domain assertions; they use the actual rail and screen paths.

The tree was stable. `git diff --stat` was empty before verification, before the last green client run, and after it. HEAD and development remained at the hashes above, and `git status --short --branch` showed only the branch header before this report was added. No source, test, task or memory file was edited. This report is the only authored change; nothing was committed or pushed.

## Cleared

The reviewed code preserves exact integer money formatting through `decodeMoney` and `Intl.NumberFormat` without a Number conversion (B-1). Categories and items retain their archived rows, options counts exclude removed options, and the category-hidden explanation takes precedence. This slice adds no order-history mutation, audit write or seeded production menu; B-8, B-20 and B-24 are not weakened by its source changes.

The standing list version and draft base are separate. Contiguous command answers advance the standing version, skipped versions do not, and ordinary reads do not rebase an open editor. The round-two Keep implementation visibly rebuilds a changed reorder scope, drops departed records, appends new records in current order and sends nothing until Save order. The outgoing bodies and normal result paths match the task's create, rename, reorder, archive and restore contracts.

The screen has one command slot and work guard. Normal command completion holds results across the session gate and departure decision; different-manager isolation uses the keyed working area. The shared Decision extraction preserves the prior dialog lifecycle. Existing Settings/sign-in assertions only gain Menu, and the route/API changes include the required screen and all eleven catalog functions. The stated S4c2/S5 exclusions remain excluded. The client suite covers these behaviors, subject to the retry-path gap in F1 and the read-failure creation gap in F2.
