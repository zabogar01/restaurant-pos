# PHASE1-S7a review

## Verdict: clean

No actionable defects found in `agent/phase1-s7a` at `55c9e89002892b070964849d4461fb8226bb6339`, compared with `development` at `3d030677c8eb943eef7c8c459f17117e8603659d`.

The code and test review is complete. Independent full-suite verification was limited by the review sandbox's database restriction, as detailed below. This verdict does not claim that I obtained a green `npm run verify` run.

## Findings

None.

## What I ran and what I did not

### Observed directly

- I ran `npm run verify`. All seven TypeScript checks completed, and the command entered `vitest run`. It then produced no test results. A separate, bounded TCP connection check to `127.0.0.1:5433` returned `EPERM`. I interrupted the stalled verification command; it exited with code 130 and emitted no completed test counts. I did not classify this as a failing product assertion.
- I ran `npm run test:unit -- --project client` successfully: **114 test files and 4,584 tests passed**. This project includes the contracts, API client, money package, and both clients. It covers the new POS catalog schema tests and the added route-table contract assertion.
- `git diff --check development...HEAD` passed.
- `git diff --stat` was empty before the full verification attempt, immediately before the successful client run, and after that run. The branch and development commit IDs were unchanged at the final check. The reviewed tree was stable; the report is the only file I subsequently wrote.
- I inspected the entire branch diff, including the task and Handoff, the cited S7 plan and C4 server decisions, the relevant PRD requirements, all boundaries, and the binding HTTP, client, money, and versioned-configuration rules. I traced the new routes through the existing registration, session guard, client-instance hook, transaction helper, response schemas, transport specifications, and POS API mapping.

### Evidence supplied by the task, not independently reproduced

The task's lead-verification section records **151 files and 5,497 tests passed** for `npm run verify`, and **108 browser tests passed** for `npm run test:e2e:all`, at `e0b812c`. I checked `git diff e0b812c HEAD --stat`: only the task document changed after that commit, so the recorded run covers the same source and tests reviewed here. These remain the lead's results, not mine.

I did not rerun the database integration cases, browser tests, or any mutation experiment successfully in this review. I assessed the mutation evidence recorded in the Handoff and the lead's separate availability-filter mutation. The builder explicitly records writing implementation before tests, contrary to the task's red-first instruction. Later mutation runs provide the recorded regression evidence; they do not establish a red-first workflow. There is no source change that can repair that historical sequence.

The ordering tests exercise display order, natural name ordering, and category grouping. They do not separately demonstrate every final ID tie-break or equal-creation-time preset tie. Those final tie-breaks are present in the comparator and SQL; my assessment of those exact ties is by inspection.

## Cleared

- **Access and idle behavior:** Both production routes declare `ACTIVE`, `POS`, and `interactive: false`, and both route-table entries agree. Registration places them inside the real API hooks. The existing session resolver uses its read branch for these requests, so polling does not update the activity stamp. The new tests exercise actual sign-in and production routes, including missing sessions, a back-office cookie, unchanged activity timestamps, and expired POS sessions. This satisfies the implementation requirements of FR-A2c, AC-27, AC-28, and ADR-011 rule 1.
- **Shared controls across states:** I specifically checked the shared access object and the distinction between `is_active` and `is_available`. Archive filters apply to categories, items, options, and presets in SQL. Availability does not filter items: an active 86'd item remains present with `isAvailable: false`, while an archived item is absent even when also 86'd. The projection does not use category grouping to silently discard incorrectly loaded items. This matches task criteria 4 and 5 and supplies the data required by AC-12; it does not claim to implement B-17's later add/fire enforcement.
- **Snapshot integrity and revision cost:** The menu starts one `REPEATABLE READ READ ONLY` transaction, reads the version first, and reads categories, items, both option tables, and presets through the same client. The concurrency test commits the competing price and version update after the first read statement and checks both the original snapshot and a later read. The revision path performs one catalog-row query without loading the menu. These follow ADR-012 rules 9–12 and task criteria 7 and 9; Phase 2's AC-31 command refusal remains outside this slice.
- **Money and wire shape:** Prices remain PostgreSQL strings until converted to `bigint`; wire values use the shared money and rate encoders. No new price arithmetic or floating-point conversion is introduced. Strict response objects reuse the existing price, rate, preset, and version schemas, and omit management-only fields. Both new transport specifications use the corresponding response schemas. This follows B-1, FR-M2, ADR-004, and task criteria 4 and 8.
- **Ordering, empty data, and presets:** Categories, items within categories, and options use display order, the specified English numeric/base collator, then ID. Presets use creation time and ID. Empty categories remain in the projection, and an empty catalog returns its current version with empty arrays. Presets remain descriptive data rather than automatically applied discounts, consistent with B-21, B-22, B-24, and the task's projection contract.
- **Poll-specific behavior:** Only revision opts out of the client-instance hook and sets its route logger threshold to `warn`; menu retains the hook and ordinary request logging. The integration tests separately assert these differences and capture a revision failure through the application's real error handler. The Handoff records the librarian consultation and its limitations. I found no change to ADR-010's error envelope or logging allow-list.
- **Scope and test path:** Only the two required unused mappings were added to POS source. There is no new screen, polling loop, catalog mutation, audit action, migration, or alternate transport. Existing tests were not weakened. The server tests use `buildServer` and real route registration, rather than a test-only handler standing in for the production path. Browser presentation and the three-second propagation proof belong to S7b and are not established by this slice's green schema tests.
