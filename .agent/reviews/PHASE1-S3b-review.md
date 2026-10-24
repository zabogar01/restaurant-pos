# PHASE1-S3b review

## Verdict

**findings** — two P2 findings, one newly reproduced and one confirming the lead's L1 with an additional numeric-name case.

Reviewed `agent/phase1-s3b` at `060ca33d15d9a9a1d95076502cb18088c03e9ff7` against `development` at `872277036c5a34e86db40861324ef442adae4b3f`, the task's lead rulings and acceptance criteria, and its cited design, boundary and prior-slice authorities. No source, test or task file was edited. No commit or push was made.

## Findings

### F1 — P2: An ignored reread can announce that a failed list was refreshed

**Location:** `apps/back-office/src/settings/model.ts:616`, consumed at `apps/back-office/src/settings/model.ts:673` and `:692`.

`loadMethods` correctly applies only the latest read, but returns the success of its own response even when that response was ignored. The unknown-outcome handler uses that return value to choose the refresh sentence. The list and the notice therefore disagree when another visit starts a newer read.

**Observed scenario:** Starting with active GoPay 2, press Deactivate and return a command fault with a successful health check. Hold its automatic methods reread. Use the rail to visit Tables and then Settings, and fail the new visit's methods read. Finally deliver the older automatic reread successfully, showing GoPay 2 inactive. Through the real `Screens`, `OfficeApp`, session transport and rail in the existing jsdom harness, I observed all of the following together:

- The page is `/back-office/settings`.
- The methods status says, “GoPay 2: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.”
- The alert says “Payment methods could not be loaded”; the methods table is absent.
- Exactly one deactivation and three methods reads were sent: initial load, command reread, and return visit.

The older successful response never updated the displayed list, so its success cannot support the refresh claim.

**Authority:** Task lead ruling 4 requires the latest-read behavior inherited from S1b, while ruling 10 and acceptance criterion 6 require truthful refreshed/unread copy after an unknown outcome. `docs/DESIGN.md:1532` explicitly requires a reread failure to say that the list could not be refreshed and forbids claiming it is current; the status-command rule at `:1548` applies the same distinction.

**Proposed fix:** Base the refresh statement on the read result accepted into the list, retaining enough read-generation information to distinguish an ignored response. Keep the uncertainty notice consistent if a newer read settles later, including across a held result. Preserve the latest-read rule, the single command, and the prohibition on automatic resend. Add the rail scenario above as a regression test, including the opposite completion order.

### F2 — P2: The sorting comparator marks unrelated names as duplicate holders

**Location:** `apps/back-office/src/settings/methods.ts:36`, used by the holder predicate at `apps/back-office/src/settings/Settings.tsx:384`.

`sameName` reuses the natural-order collator, whose accent-insensitive and numeric comparison is broader than the server's case-only uniqueness rule. This is the shared-value trap: a comparator appropriate for ordering is also used to assert name identity.

**Observed scenario:** With active methods named Cafe and Café, submit `cafe` and answer `DUPLICATE`. The existing screen harness renders “Name in use” on both rows. With active GoPay 2 and GoPay 02, submitting `gopay 2` likewise marks both rows. I reproduced both through the method form, and separately observed `sameName("Cafe", "Café")` and `sameName("GoPay 2", "GoPay 02")` returning `true`. Only the case-equivalent row holds the submitted name under the server's rule.

**Authority:** The task's **Lead finding L1** at `.agent/tasks/PHASE1-S3b-payment-methods-screen.md:294` explicitly corrects lead ruling 8 and requires case-only comparison. S3a's cited Handoff specifies the partial unique index on `lower(name)`. DESIGN-018's artifact also uses lowercase equality for the holder marker. This confirms L1 rather than charging the builder for following the original ruling.

**Proposed fix:** Apply L1's `a.toLowerCase() === b.toLowerCase()` comparison and correct the comment. Keep the collator for sorting. Test case equivalence, accent distinction and leading-zero distinction, and assert that only the actual holder receives the marker.

## What I ran and what I did not

**Observed verification:** `npm run verify` passed: typechecking completed, **120 test files passed and 4,480 tests passed**, exit 0. I also ran `npx vitest run --project client`: **87 files and 3,730 tests passed**, exit 0. `git diff --check development...HEAD` passed.

**Tree stability:** Before and after the green runs, `git diff --stat` was empty and the branch and development hashes were unchanged. The branch diff remained 15 files, 2,959 insertions and 48 deletions. Before writing this report, `git status --short --branch` showed only `## agent/phase1-s3b`.

**Additional runtime evidence:** Read-only `node --import tsx --input-type=module -e` probes exercised the unchanged model and the existing jsdom screen harness with controlled response timing. F1 was reproduced both in the model and through actual rail clicks. F2 was reproduced through the form and its rendered holder markers. These were observations against the submitted implementation, not source mutations. An initial Node harness attempt failed because the standalone JSX setup lacked React; after providing React, the probes completed successfully. No temporary test file was created.

**Not run:** I did not independently rerun `npm run test:e2e:all`, perform browser screenshots or viewport inspection, or repeat the builder's mutation proofs. The task's lead verification records **78 browser tests passed** in Chromium and WebKit; that is attributed evidence, not my own run. I inspected the new browser spec: it enters through manager sign-in and the rail, sends commands through the page, and checks persisted methods through the domain functions. jsdom results do not establish native top-layer behavior, visual layout or browser inertness. Artifact comparison here was by HTML, JavaScript, CSS and the reviewed Handoff, not rendered screenshots.

## Cleared

- The shared screen model has one command slot, one work-guard registration and one departure decision. Both parts' openers check the command slot, including after a pending save is discarded. The tests exercise production screen and session wiring rather than mounting an isolated methods panel.
- Commands carry the required bodies, apply authoritative records, and have no automatic resend path. Unknown outcomes retain uncertainty; a matching reread is not treated as command success. The gate is rechecked after the unknown-outcome reread, and held results retain that read for presentation without another request. Immediate duplicate presentation follows the lead's explicit acceptance at task line 288.
- Cash and Card are fixed copy with empty action cells whenever the table is drawn. Custom names equal to those labels are allowed. Custom rows sort active first, with natural ordering and stable ties; counts exclude fixed kinds.
- Local validation trims, counts code points and checks empty, length and control characters in order. Field errors, accessible descriptions, focus targets, inactive rename behavior and the four result sentences match the cited design.
- Settings and methods reads are independent. Authoritative answers survive older successful and failed reads; the F4 composition keeps known rows and the answer, withholds counts and offers a read-only retry. F1 concerns the refresh notice's separate boolean, not that record reconciliation.
- The session tests cover retained method drafts and decisions for the same manager, destruction for a different manager, session refusals, held answers and the unknown-reread gate. The five ConfigApi entries and fixture refusals are present; existing test changes are additive and scoped as declared.
- FR-B7 is implemented through the existing server routes. B-24 is respected by custom configuration rather than a seeded production method list. No tendering, money arithmetic, order mutation or audit behavior was added, so the method screen introduces no B-5 or B-20 violation. Source and copy follow DESIGN-018's method states subject to the task's explicit exclusions and the two findings above.
