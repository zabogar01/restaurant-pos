# FE-030 review

## 1. Verdict: clean

Reviewed `agent/fe-030` at `6eb408e277a19660a65f2a91b74741bc7a59d4a2` against `development` at `1f4fac83a6b3e52463c2ea2d981cc229ebb61db8`, the FE-030 task including its lead verification and Round 2 instructions, and the cited design and contract material. There are no actionable findings. Independent browser measurement was unavailable; the limits below qualify the visual coverage.

## 2. Findings

None.

## 3. What I ran and what I did not

**Observed verification.** I ran `npm run verify` in this worktree. It exited successfully: server, money and POS typechecks passed; Vitest reported **33 test files passed and 2,340 tests passed**, with no failed tests. I also ran `git diff --check development...agent/fe-030`; it exited successfully without diagnostics.

**Tree stability.** Immediately before and after the green verification run, `git diff --stat` was empty and the branch and development hashes were unchanged. I additionally captured and compared the complete `git diff development -- apps/pos .agent/tasks/FE-030-closed-orders-list.md` output: both captures were 96,015 characters and were identical. The tree was clean before writing this report. The only existing test changed by the branch is the authorized Closed orders placeholder test in `floor.test.tsx`; the remaining test change is the new `closed-orders.test.tsx` file.

**Coverage inspected.** I read the changed source and tests, the list branch of `closed.js`, `closed-orders.html`, `closed.css`, the eleven manifest states, the cited DESIGN-009 rules and Round 2 corrections, DESIGN-010's token requirement and Handoff, POS-05 and ruling I-1 in the screen inventory, FR-G11, FR-H6, the restaurant time-zone rule, and the boundaries. I traced the list through `PosRoutes`, the order book, the close result, the floor fixtures, `followClientSide` and `SheetFrame`.

The passing Table 1 and quick-sale tests enter through `PosRoutes`, operate the floor and order controls, add a tender in settlement, close, and then follow Closed orders without remounting the application. They therefore exercise the production navigation path and retained book, rather than supplying a synthetic book directly to the list. The zero-total test separately uses a cold settlement fixture; I do not treat that test as proof of the full production comp-approval flow.

**Visual limits.** A Chrome surface was available, but starting the worktree's Vite server on `127.0.0.1:5190` failed with `listen EPERM`. Opening the cited artifact by its local `file:` URL was separately rejected by browser URL policy. I did not circumvent either restriction. I inspected the artifact's source, but did not render it or the application, measure touch targets or scrollbar alignment, or visually verify the three filter sheets. The lead's measurements recorded in the task are prior evidence, not measurements I performed.

The current CSS and passing structural tests support the intended Round 2 stacking correction: the sticky heads have no positive z-index, while the positioned sheet and scrim follow the scroller. They also place heads and rows inside the same scroller with the same column token and padding. This is source and structural evidence, not a browser paint assertion. The lead's requested post-fix sheet walk remains the visual check. I ran no mutation experiment and do not claim to have reproduced the builder's recorded red runs. I did not run Prettier, commit or push.

## 4. Cleared

- All eleven declared list states have matching source compositions and automated coverage. The six fixture rows, overflow generation, messages, tags and detail queries follow the artifact, including its abbreviated overflow payment labels. Release and all order-mutating actions are absent as scoped by FE-030.
- The live rows select closed book entries and read their own tenders, change, total, identity and closing instant. Amounts remain bigint through display and exact filtering (B-1); change is separate from the total (B-6). Zero-total orders remain listed (FR-G11). Fixture REFUNDED rows remain distinctly tagged, and the list adds no transition from terminal states (FR-H6, B-10).
- WIB formatting explicitly selects `Asia/Jakarta` and a 24-hour clock, with passing tests across process zones and midnight. Live orders sort by closing instant. The task's expressly accepted treatment of live rows above fixtures and validation of the displayed padded time are preserved.
- I specifically checked the shared Apply and Reset controls across normal, no-match, filter and both closed-day states. Drafts remain separate from applied filters; filters combine; invalid ranges leave the list unchanged; inclusive bounds work. Reset preserves the initial closed-day context, and group-specific empty results do not incorrectly replace a matching group with the global no-match state.
- Closed-day rows retain `state=dayclosed`; the new-day quick sale retains `list=dayclosed`. Both floor entry and exit preserve their closed-day context (FE-030 criteria 9–10; DESIGN-009 Round 2 F3). The list provides no edit, refund or dismissal path around B-9 or the recorded session-end banner ruling.
- Search remains table, closing time and exact amount only, without receipt numbers or older-day lookup (ruling I-1 and POS-05 scope). Client-side anchors, modified-click handling, dialog focus, `aria-modal`, inert background, Cancel and Escape are covered by the passing suite and the shared implementations.
