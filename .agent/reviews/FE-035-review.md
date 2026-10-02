# FE-035 review

## Verdict: findings

There is one finding. I reviewed `agent/fe-035` at `440df586620ea952fa176cb4778b723b1796a1bd` against `development` at `493ba493b9070400a53d70b7176947abeaa68b55`, the task, its cited discount requirements and boundaries, and the specified Frost artifact blocks.

## Findings

### 1. P2 — Validate the resolved preset value before writing its snapshot

**Location:** `apps/pos/src/discountChange.ts:84`.

The validity check runs only for a `free-form` request. A preset request resolves an active preset and writes its snapshot without checking the value. Consequently, the operation can return success and put an invalid discount on the order, after which total calculation throws. The current hard-coded presets are valid, so ordinary choices from today's picker do not trigger this; the defect is in the operation's promised validation of its supplied preset facts.

**Authority:** FE-035 R3 requires an `invalid-value` refusal; R4 requires a parsable percent no greater than 100% or a nonnegative fixed amount specifically to prevent later total calculation from throwing; R8 requires validation before writing. PRD FR-M5 imposes the discount bounds without distinguishing presets from free-form values.

**Observed failing scenario:** I loaded the actual operation and arithmetic modules in memory and supplied one active preset with id `test`. For each of `{ kind: 'percent', percent: '100.0001' }`, `{ kind: 'percent', percent: 'ten' }`, and `{ kind: 'fixed', amount: -1n }`, asking for that preset through `direct` returned success and a different order object. Calling `orderTotals(405000n, result.order.applied)` then threw, respectively, `a discount is at most 100%`, `invalid rate: "ten"`, and `a discount is never negative`. No source mutation was involved.

**Proposed fix:** After resolving the snapshot and handling `unknown-preset`, validate every non-removal snapshot's value before deciding the manager gate or writing either field. Return `invalid-value` with the original order object for an invalid preset as well as an invalid free-form request. Add preset-input cases for these invalid values, including precedence over `needs-manager`, and retain the accepted fixed amount above the subtotal case.

## What I ran and what I did not

- I ran `npm run verify` from the worktree root. Typechecking passed for the server, money package, and POS. Vitest reported **39 test files passed and 2,638 tests passed**, with exit status 0. The output contained no `Not implemented` line. I did not separately run database setup, migration integration checks, or an end-to-end browser suite.
- The tree was stable across that green run: `git diff --stat` was empty before and after it, and both `HEAD` and `agent/fe-035` remained `440df586620ea952fa176cb4778b723b1796a1bd`; `development` remained `493ba493b9070400a53d70b7176947abeaa68b55`. The comparison remained 11 files, 1,725 insertions and 113 deletions. I checked these again after the additional probes, before writing this report.
- I ran the invalid-preset reproduction described above through Vite's in-memory module loader. I did not rerun the builder's reported source mutations and do not claim their red runs as my own evidence.
- I also mounted the real `PosRoutes` in jsdom, removed the discount from `sheet-remove`, and then injected a same-document history change and `popstate` back to `sheet-remove`. The change sheet threw because the live order no longer carried a discount. This is **not an additional finding**: the probe injected navigation, while the actual fixture links perform full document navigation and the ordinary Discount button selects the picker correctly. I did not establish a normal production path to that failure.
- I attempted `npm run dev -w apps/pos -- --host 127.0.0.1 --port 5178` for a browser check. The sandbox refused the listening socket with `EPERM`, so I did not visually inspect the live screen or independently verify native browser focus and inert behavior. The design comparison was source-based; interaction evidence comes from the passing suite and the explicitly described jsdom probe.
- `git diff --check development...agent/fe-035` reported only a new blank line at the end of the task file, line 479. I did not treat that as a behavioral finding or edit it.

## Cleared

- The panel-opened sheet reads the live order, subtotal, and application note. The routed Table 2 test opens from the floor and adds a Burger before choosing a discount. The settlement and closed-order tests also use `PosRoutes`; they do not establish their results solely through the standalone `OrderScreen` wrapper.
- The shared preset controls correctly change their gate when the applied discount changes from a preset to free-form. The pure operation independently checks all eight FR-F8 transitions through both doors. The shared value validation, however, is where finding 1 exposes a source-dependent gap.
- Closed and locked orders are refused, including the active payment-session guard and draft/lease fixture locks. The store re-reads call-time facts, advances its book reference for consecutive discount calls, and leaves the order unchanged on refusal. The same-tick removal test passes.
- Apply, replace, and remove update the single discount field and clear the old application note together. Cancellation preserves the order and typed entry. The manager prompt requires six digits, has a parameterless submit handler, passes the `manager-prompt` literal only there, and mounts fresh for another attempt. No client audit, actor, approver, approval flag, or time is added; O2 remains an explicit stand-in rather than proof of server authentication or audit acceptance criteria.
- Discount arithmetic still uses the existing exact-money functions. Fixed discounts above a reduced subtotal remain unchanged and are capped for calculation. The closed-order reader labels a free-form 100% discount from its own snapshot while retaining the Comp preset's existing label. No per-line discount or stacking was introduced.
- The changed files respect the task's implementation scope. The existing monetary functions retain their behavior; the protected close, fire, tender, refund, and package files have no diff. The Handoff records the server obligations and deliberately deferred work. I made no source or test edits, and did not commit or push.
