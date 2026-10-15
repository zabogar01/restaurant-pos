# PHASE0-011c2 re-review

## 1. Verdict

**clean** — zero open findings. All three findings from the first review are resolved. This re-review covers the task’s Round 2 lead rulings and Round 3 Handoff, including the fix commit `7a00a9a`, on `agent/phase0-011c2` at `3b97b8fa4daf6cedb71cf3544ba282969ed0523a`, against `development` at `69f289b8f4ea50e7e6db9cae587f504ecc8980fc`. The first review remains available in Git history.

## 2. Findings

None. The fixes satisfy the three accepted findings within the task’s scope. The previously disclosed live-browser verification limitation remains; this verdict does not claim a real-cookie multi-tab or visual-browser acceptance run.

## 3. What I ran and what I did not

I ran `npm run verify` during this re-review and read its completed output: typechecking succeeded, **78 test files and 3,494 tests passed**, and the command exited with code 0. This is four files and 69 tests above the task’s recorded development baseline of 74 files and 3,425 tests. The existing Vite warning about ESM configuration loaded as CommonJS was printed. `git diff --check development...agent/phase0-011c2` also completed without errors.

The tree was stable before and after that green run: `git diff --stat` was empty, and HEAD and development retained the full hashes above. After the usage-limit interruption, I checked again: the worktree was still clean and both hashes were unchanged. I therefore retained the completed verification evidence rather than reporting a new run that did not happen. Only this report was subsequently written.

I independently exercised the unchanged real session implementation and transport core through an in-memory TypeScript loader, with a jsdom document, synthetic session views and stubbed transport. A visibility read naming another actor left the store signed out and invalidated. A held visibility read overlapping Release left it signed out and resting in both completion orders: Release before the read, and the read before Release. In the latter order it remained resting while Release was pending and after it settled. Subsequent pointer events sent zero activity requests in all three probes. These were observed store transitions and outgoing calls, not real-browser cookie tests.

I also repeated the route-coverage proof using the TypeScript compiler API and the POS tsconfig. The unchanged program had zero diagnostics. Overriding file reads in memory to add an interactive `POST /api/pos/orders` route and its core response specification produced exactly the expected TS2741 diagnostic at `apps/pos/src/session/api.ts:19`: the new route was missing from `PosApi`. No source file was edited for this experiment.

The full suite included the new mounted-route regressions for both session races and excess cash, as well as both self-building bundle tests. The cash regression uses the real session provider and `PosRoutes`, checks zero outstanding after locking, and compares the settlement screen before and after sign-in to establish draft retention. I inspected these paths rather than treating standalone fixture rendering as proof of production session behavior.

I did not repeat the builder’s historical red runs against `90cb743`, its working-tree route mutation, or its cash-subtraction mutation. Those remain Handoff evidence. I independently re-proved the route mutation only in memory. I did not run a live HTTPS sign-in, a real-cookie multi-tab exercise, a screenshot review, or three isolated repetitions of every new test file.

## 4. Cleared

**F1: session reads cannot undo Release or invalidation.** At `apps/pos/src/session/realSession.ts:218`, each read captures the local revision. The checks at lines 224–225 reject obsolete results and prevent refreshes from restoring a signed-out tab. Release and displayed-session invalidation advance that revision through `toSignedOut`; successful refreshes only refresh the existing actor’s countdown. The two new “19b” regressions cover the ordinary visibility-read path that the old CSRF-recovery test missed, including removal of the protected route and suppression of further activity. This satisfies Round 2 ruling 1, original lead ruling 3, and the Release behavior specified by ARCH-014 question 5 and DESIGN-015, consistent with FR-A2. The independent completion-order probes described above also passed.

**F2: excess cash shows zero outstanding.** `apps/pos/src/PosRoutes.tsx:132` now obtains the balance from `settlementPosition`, as required by Round 2 ruling 2. The shared outstanding value was checked across partial payment, exact payment and cash change: the helper keeps change separate from the nonnegative balance, consistent with FR-G4 and the DESIGN-015 tender-draft notice. Test “23b” passes with the excess-cash fixture, rejects both minus-sign forms, and confirms that re-entry preserves the draft and change. The approved notice copy is unchanged.

**F3: the POS route adapter is exhaustive.** `apps/pos/src/session/api.ts:13` maps every POS path and health to a required function with route-specific arguments and results. The store and activity listener use this adapter over the single core instance. The in-memory compile failure now proves the missing-entry behavior required by Round 2 ruling 3 and ARCH-014 question 3, mechanism 3. The Handoff’s earlier claim is explicitly corrected. The adapter exposes no back-office keys; the input listener remains the only activity caller.

The prior review’s cleared behavior remains covered by the passing suite: fixture isolation in ordinary and development-environment builds, initial lookup and retry, short PIN rejection, cooldown behavior, PIN handling, input-only activity, deadline reads, tender retention, and approval-pad unmounting. The changes add no new product copy, persistence, credential channel or approval state. The documented POS-03 actor-group omission remains outside this task under the lead’s explicit ruling.

I changed only this review report. I did not edit the task file or Handoff, commit, or push.

DONE
