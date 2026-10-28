# PHASE1-S5 review

## Verdict: findings

One medium-priority finding. Reviewed `agent/phase1-s5` at `01d9621fb91754834d30980bb457effeb52a61b4` against `development` at `cf685d1ae2685f77c48e2e0a297b57dd24bcbe20`, using the task, its cited requirements and boundaries, ADR-012, C1 §3, the DESIGN-019 handoff and artifact, and the cited S4b and S4c1 context.

## Findings

### F1 — P2: The retained editor looks editable while an availability command silently rejects its input

**Location:** `apps/back-office/src/menu/Menu.tsx:531` (also `:534`, `:583`, and `:673`), made reachable by the new availability path at `apps/back-office/src/menu/model.ts:926`.

`EditorPanel` uses `pendingSave`, which means a command belonging to this editor, to disable the name input and Save button. An availability command deliberately has `editorKey: null`, so neither control becomes disabled while it runs over an open editor. However, `setDraft` rejects input whenever any command exists (`model.ts:1165`), and `save` rejects it whenever the screen is busy (`model.ts:798`). The name input therefore accepts focus but discards typing; Save and Save order look available but do nothing. The new controls correctly disable the row actions, which conceals this separate editor state from the existing pending-command test.

**Authority:** PHASE1-S5 lead rulings 5 and 6 require the one-command pending state while retaining the editor and draft under DESIGN-019 F7. The reviewed artifact explicitly disables the name input and Save for any pending command in `docs/design/visual-directions/frost/back-office/menu.js:74` and `:76`. The task's Rules require inert buttons to expose `aria-disabled` and leave the tab order. This is a control-state defect, not a claimed money or transaction-boundary violation.

**Concrete reproduction:** Open Rename Mains, enter `Main plates`, and press Mark Burger 86 while holding its response. The name input reports `disabled: false`; Save has no `aria-disabled` and remains at tab index 0. Typing `Attempted new draft` leaves the input at `Main plates`. In a second case, open Reorder items in Mains and hold Make available Soda. Save order has no `aria-disabled`; pressing it sends zero reorder requests. Both cases were observed through the existing real-screen/session harness with only the HTTP response held.

**Proposed fix:** Separate the editor's own-saving notice from the screen's busy state. Keep `pendingSave` for the Saving notice, but use the screen command slot (including `external`) to make the name input and submit control visibly inert. Apply the repository's `aria-disabled` and `tabIndex={-1}` convention to the submit button. Add coverage for a pending availability command over a rename and a reorder, then verify the controls recover and the draft remains after the answer.

## What I ran and what I did not

**Observed on the unchanged branch:**

- `npm run verify` passed: typecheck succeeded; **142 test files and 5,223 tests passed**, in 110.56 seconds. These are this review's results, not the handoff's counts.
- `npm run test:unit -- --project=client` passed: **107 files and 4,365 tests passed**.
- `git diff --stat` was empty before verification and after its successful completion. It remained empty after the focused checks and browser-suite attempt. HEAD and development retained the hashes above. The tree under review did not move.
- `npm run db:up` failed because access to the Docker socket was denied. The already-started verification nevertheless completed successfully; I do not claim that this command started or provisioned PostgreSQL.
- `npm run test:e2e:all` built both clients successfully, then failed during setup with `connect EPERM 127.0.0.1:5433`. No browser-test pass count was produced. Chromium and WebKit execution is therefore not independently cleared by this review.

**Focused reproduction and in-memory experiment:** I used the Vitest programmatic runner with a Vite transform that appended two review cases to `menu-availability.test.tsx` in memory. Both cases failed against the unmodified implementation: **2 failed, 22 skipped**. The logged values and ignored input are recorded in F1. I then repeated that file with a second in-memory transform changing the name input and submit busy checks from `pendingSave` to `command !== null || state.external`: **24 tests passed**. This supports the diagnosis and proposed direction; it is not an implemented fix or a verification of the proposed tab-order adjustment. No source or test file was edited, and no mutation remains on disk.

I did not independently replay the builder's other mutation proofs, perform a visual browser inspection, or exercise the deferred POS polling and lease behavior. The handoff's historical red runs and the lead's 100 browser passes remain their evidence. I did not commit or push.

## Cleared

- Both explicit domain commands use `catalogWrite(UNVERSIONED, ...)`, acquire the existing catalog lock before reading, change only availability, preserve options and archive flags, and advance the single version only for a write. The new integration tests cover both directions, no-ops, unknown IDs, stale edits after an 86, shared-lock waiting, and archived items/categories. This matches ADR-012 rules 10, 13 and 14 and C1 §3.
- Both strict request schemas, route declarations, response mappings, route-table entries, transport specs, configuration API functions, and fixture stubs are wired. Existing access/route-table tests remain in place; the new route cases exercise authentication, malformed bodies, no-ops and unknown IDs. No migration, grant, audit behavior or production fixture menu was added.
- Every item row receives the correctly named availability action. Offered versus archived-item/category result wording matches DESIGN-019 F2/F6. Success applies the answered record and focuses Edit; unknown outcomes reread without resending; session-held answers and the BO-04 outstanding-save guard are covered by the passing suite.
- The availability commands bypass departure decisions and retain drafts. The one-step `carryBase` condition matches the task's ruling; skipped versions retain the editor's base. Archive still opens the departure decision for a dirty rename. F1 is the uncovered pending-control state on this otherwise working path.
- The new browser case creates its item through the domain, signs in through the existing helper, opens Menu through the production rail, presses the row actions, counts requests, and compares database availability/version changes. This path is appropriate by inspection, although the reviewer browser run could not execute it.
- B-17/FR-C5's later order-entry enforcement, POS polling, and FR-G13/AC-29's lease refusal are explicitly deferred by this slice. The server preserves the availability fact and coordination point those tasks need; this review does not claim those later requirements are complete.
