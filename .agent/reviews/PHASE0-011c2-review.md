# PHASE0-011c2 review

## 1. Verdict

**findings** — three findings, including one high-priority session-state defect with two reproduced paths. Reviewed `agent/phase0-011c2` at `4b26f6fea3b216ee34c8ddaa406c304100f7038d` against `development` at `69f289b8f4ea50e7e6db9cae587f504ecc8980fc`, the task specification and its later rulings, the cited contract and architecture, the upstream transport Handoff, and the reviewed POS-01 artifact.

## 2. Findings

### F1 — High: a successful session read can undo invalidation or Release

**Location:** `apps/pos/src/session/realSession.ts:209` (the unconditional `toSignedIn` at line 211), with the actor-change handler at line 253 and Release at line 333.

Every successful `me` response enters the signed-in state, even when the store has become signed out while that read was pending or while the core processed its response. The common success handler is correct for initial recovery and same-person refresh, but hides the states in which adopting its result is forbidden.

I reproduced both of these sequences against the unchanged real session implementation and transport core, using an in-memory loader, stubbed transport and a jsdom document:

1. Start signed in as Cashier A. Another tab signs in as Manager B. Make this tab visible and answer its ordinary `me` with B's view. The core emits `actor-changed`; the store publishes `signed-out / invalidated`, then immediately publishes `signed-in / Manager B` when `readSession` consumes the same successful result. A subsequent pointer event sends `POST /api/pos/auth/activity` and extends B's deadline. No PIN was entered in this tab. The existing test at `apps/pos/test/session-store.test.tsx:198` covers the different CSRF-recovery path, which returns `session-gone`, so it does not exercise this failure.
2. Start signed in as A, begin a visibility `me`, and hold its response. Press Release and leave the Release request pending. The store initially becomes `signed-out / resting`, with `busy: true`. Deliver the older `me` response naming A. The store becomes signed in again, and a subsequent pointer event sends activity while Release is still pending. The existing Release tests do not overlap Release with a session read. The core advances its release generation when the release settles, so it cannot reject this earlier-settling read on the client's behalf.

**Authority:** Task *Lead rulings* 3 requires an actor change to show POS-01 invalidated and stop activity until a sign-in in this tab. ARCH-014 question 5's Release row and the task's rule 4 require POS-01 whatever Release answers; DESIGN-015's “POS-01 after Release” row requires removal of the on-screen actor even with no response. FR-A2 establishes explicit release as an end of the POS actor context. These are client defects; they do not require changing the merged core's documented interface.

**Proposed fix:** Give reads a local session revision, or an equivalent validity guard, that is invalidated by Release and by core events that end or invalidate the displayed session. Apply a read's result only if it still belongs to the permitted local state. Initial lookup may recover a session, while a refresh must not restore one that has since been released or invalidated. Add regressions for both ordinary `me` actor replacement and a delayed `me` overlapping a pending Release; assert that the protected route remains absent and subsequent input sends no activity.

### F2 — Medium: the lock screen calls cash change a negative outstanding balance

**Location:** `apps/pos/src/PosRoutes.tsx:130`, particularly the subtraction passed to `formatAmount` at line 133.

The tender-draft notice calculates outstanding as order total minus the sum of tender amounts. That works for partial and exact payment, but cash may exceed the balance. The existing `settlementPosition` function already separates zero outstanding from positive change; this new calculation bypasses it.

I mounted `PosRoutes` with a real session at `/pos/settlement?state=change`, then returned `SESSION_IDLE` to activity. Before the lock, settlement showed `Balance 0`, `Change due 44.075`, an order total of `155.925`, and cash tendered of `200.000`. After the lock the actual notice was: “Payment in progress on this tabOrder · T1 — −44.075 outstanding, 1 tender drafted. Sign in to continue. Nothing has been recorded yet.” The same calculation applies to a cash draft entered through the normal settlement controls. The existing draft-retention test covers only the partial-card state.

**Authority:** DESIGN-015's “Tender draft waiting” row requires the actual outstanding amount; ARCH-014 question 5 requires its figures to come from the payment store. FR-G4 distinguishes cash change from the remaining balance. This is a display error, not evidence of incorrect recorded revenue or a corrupted draft.

**Proposed fix:** Derive the notice's outstanding amount from `settlementPosition(total, tenderAmounts).balance`, as settlement does. Keep the approved notice wording. Add a regression that locks with excess cash and expects zero outstanding while preserving the cash draft and its change on re-entry.

### F3 — Medium: adding a POS route does not require a POS client declaration

**Location:** `apps/pos/src/session/realSession.ts:90` and its direct route calls, for example line 207; `apps/pos/src/session/activity.ts:24`.

The POS uses the generic `ApiClient` directly and has no exhaustive mapping of its surface's route paths to client functions. The core's `SPECS` map is exhaustive, but that only requires the transport schema to be declared. It does not require this client to wire the new route or replace its stand-in. The Handoff's claim that a new interactive route fails the POS compile until declared is therefore not established by the implementation.

I checked this with the TypeScript compiler API using `apps/pos/tsconfig.json`. The unchanged program had zero diagnostics. I then overrode two file reads in memory: added an interactive `POST /api/pos/orders` entry to `packages/contracts/src/routes.ts`, and added its response specification to `packages/api-client/src/specs.ts`. With every POS file unchanged, compilation still had zero diagnostics. No file was edited for this experiment.

**Authority:** ARCH-014 question 3, mechanism 3, copied into the task at lines 172–179, explicitly requires each client's API module to map every route of its surface through an exhaustive mapped type. The task's boundary section also requires the client module to expose only its own surface's entries. This is the promised integration check, beyond the core's existing route-table exhaustiveness.

**Proposed fix:** Add the POS-owned, surface-restricted exhaustive route adapter and send this client's calls through it. Preserve the single core instance and input-only activity dispatch. Prove that adding a POS route and its core schema leaves a compile error in the POS adapter until its client declaration is supplied, and correct the Handoff's claim accordingly.

## 3. What I ran and what I did not

I ran `npm run verify` myself. Typechecking completed successfully; **78 test files and 3,490 tests passed**, with exit code 0. Against the task's recorded baseline of 74 files and 3,425 tests, this is four additional files and 65 additional tests. The run printed the existing Vite configuration warning about ESM syntax loaded as CommonJS. I also ran `git diff --check development...agent/phase0-011c2`, which returned no errors.

The tree was stable around the green run: `git diff --stat` was empty before verification and after it, and both `HEAD` and `development` retained the full hashes recorded above. The worktree was initially clean. All additional reproductions operated in memory; the only file written by this review is this report.

The verification run included the two self-building bundle tests, under production and development `NODE_ENV`, and their execution of the built entry script in jsdom. I inspected the branch diff, the real and fixture entry paths, the changed assertions, and the state/copy mappings. For F1 I observed store transitions and outgoing calls, rather than a browser-rendered race. For F2 I observed the mounted React route and rendered notice in jsdom. For F3 I observed compiler diagnostics with and without the in-memory additions. These experiments used synthetic identities and responses, not real credentials or a live authenticated server.

I did not perform a live-browser HTTPS sign-in, visual screenshot review, or real-cookie multi-tab exercise. I did not rerun each new test file three times alone or repeat the builder's five claimed red-proof mutations. Those remain Handoff evidence, not independently observed review runs. The F3 compiler experiment is the only source mutation I performed, and it existed solely in the compiler host's in-memory reads.

## 4. Cleared

The compile-time fixture switch is based on the Vite command, and the built-bundle tests pass in both environments. The real lock ignores POS-01's fixture query state. The fixture session's sign-in, input and Release send no requests. The retained business fixtures are permitted by the owner's recorded 2026-10-13 ruling.

Ordinary sign-in, initial unauthenticated lookup, invalid credentials, cooldown expiry, failed initial lookup and explicit retry have the specified state and copy mappings. The pad requires six digits on the real path, clears submitted digits, and disables entry during a real cooldown. The recursive source scan and PIN tests pass. Transport remains in one core instance construction module, with the bound fetch reference expressly allowed by the task's later ruling.

The countdown uses the core's monotonic deadline and does not itself end the session. Activity has no body, reads no event data, and is sent only by capture-phase input listeners with a leading-edge limit. Idle and unauthenticated responses on the tested activity path remove the protected route. The order book and payment sessions remain above the route gate, and the partial tender draft survives the tested lock and sign-in cycle. The approval pad unmounts and clears its digits; the fresh URL-driven fixture prompt after sign-in is explicitly accepted by the later task ruling.

Release is present in the floor and closed-order actor groups. The POS-03 actor-group omission and the settlement/incidents Release omissions are identified in the Handoff and covered by the task's scope rulings. The test changes that exclude header buttons are disclosed; they retain checks against a stray Release outside the actor group. No source, tests, task file or repository memory was changed by this review, and nothing was committed or pushed.
