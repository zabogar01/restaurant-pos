# F3 — POS-04 settlement, independent review

**Verdict: request changes. Three P2 findings and one P3 finding.** The represented tender arithmetic, exact-close guard, pending-line guard, zero-total path, and draft retention through the intended POS-03 round trip hold under the checks below. Routed browser history can present an unlocked order at a lease-locked URL; the seeded PIN pad can submit non-digits; and a partially corrected rejected close loses its notice. No actual close, Tender write, receipt, or server lease exists in this F3 range, so a live money commit cannot be claimed or tested here.

Reviewer: Codex (`f3-reviewer`). Date: 2026-09-23. Reviewed `c180a87..d2d07eb` under `apps/` on `agent/phase-0-foundations`, including F3a `cda4d4e`, F3b `be5051c`, F3c `aa435c9`, and F3d `61ac68f`. Read FE-015–FE-018 and their handoffs as claims. Applied `docs/BOUNDARIES.md` > `docs/PRD.md` > the confirmed design worktree's `frost/pos/settlement.html` and `docs/design/SCREEN-INVENTORY.md` POS-04 (including **Must not invent**) > task > handoff. The branch's settlement artifact was not used as authority.

## Findings, most severe first

### 1. P2 — Same-route browser Back can expose Settle at a lease-locked URL

**Locations:** `apps/pos/src/PosRoutes.tsx:39–44,59–67`; `apps/pos/src/OrderPanel.tsx:67–93,135–143`; missing routed history coverage in `apps/pos/test/settlement.test.tsx`.

`PosRoutes` rereads the URL on `popstate`, but the mounted `OrderScreen` keeps its first `view` in `useState(initial)` and disables its own listener whenever `onLocationChange` is supplied. I reproduced this in JSDOM through the real `PosRoutes` and browser Back control:

1. Put `/pos/order?state=lock-lease` below `/pos/order?state=default` in browser history and mount on `default`.
2. Press browser **Back**. The URL is now `?state=lock-lease`.
3. The panel remains unlocked (`data-lock` absent), and **Settle** remains present. Pressing it opens `/pos/settlement`, although a direct visit to `lock-lease` draws the other-client lease lock.

This is a route-state guard failure against FR-G13 and SCREEN-INVENTORY POS-03's lease-locked workspace. It does not prove a server lease bypass: no lease command or close transaction exists in F3. The two-store shape increases the risk: routed POS-03 renders `suppliedStore ?? localStore`, creating a second `useOrderStore` whose result is discarded, while `shownOrder(view)` still supplies fixture data to sheets. The stale-view reproduction is new to F3's routed path; the older fixture-versus-live-sheet derivation predates this range and is not charged as another F3 finding.

**Recommended correction:** make the routed `OrderScreen` consume the route's current view on every navigation, including `popstate`, and have one order-store owner for routed and direct rendering. Add a `PosRoutes` history test that returns to `lock-lease`, checks the lease notice and absent Settle action, and presses an available control. Keep server-side lease enforcement as a separate required gate when close is implemented.

### 2. P2 — Seeded PIN dots become non-numeric submitted PIN characters

**Locations:** `apps/pos/src/PinPad.tsx:49–52,61–77`; use at `apps/pos/src/SettlementScreen.tsx:377` (`ReauthModal`); missing seeded-submit coverage in `apps/pos/test/pin-pad.test.tsx`.

I mounted the submitted `PinPad` with `seed={2}`, pressed keys **1**, **2**, **3**, **4**, then **Continue**. Its `onSubmit` received `••1234`. The two visual placeholder dots occupy two positions in the digit ref, so the pad stops accepting input after four real digits. This confirms the lead's observation. It does **not** breach B-12: no PIN digits appeared in DOM or logs in this check, and the current reauthentication handler is a no-op. It does violate PRD FR-A1's six-digit numeric PIN contract at the component boundary and undermines FE-018's claim that `seed` sets only a visual count.

**Recommended correction:** never put display placeholders in the PIN value. For this fixture, render seeded dots independently of the entered PIN, or remove the fake prefill. A seeded pad must accept six real digits and submit only those digits; add a control-driven test of that contract.

### 3. P2 — A rejected-close notice disappears before the corrected balance is covered

**Locations:** `apps/pos/src/SettlementScreen.tsx:533–543,593–596,655–657`; missing partial-correction coverage in `apps/pos/test/settlement.test.tsx:642–672`.

I reproduced this through `PosRoutes` and actual tender controls:

1. Open `/pos/settlement?state=error`. The changed order is **193.725**, the retained Card draft is **155.925**, the balance is **37.800**, and **Close was rejected** is visible.
2. Choose **Card**, key **10.000**, and press **Add card**.
3. The two drafts remain and the balance correctly becomes **27.800**, but the rejection notice vanishes. `addDraft` rewrites the URL to bare `/pos/settlement`, and `showErrorNotice` depends on `state === 'error'` as well as the still-positive balance.

FE-017 rule 8 explicitly keeps the rejected-close notice while a balance is owing and removes it once that balance reaches zero. SCREEN-INVENTORY POS-04's error state requires the surviving draft and correction path; B-20 requires the rejected command to leave no partial order state. The tender figures themselves remain correct in this reproduction, so this is misleading recovery state, not a proved wrong charge.

**Recommended correction:** retain a rejection context with the payment session until the corrected balance is fully covered, the draft is deliberately reset, or the payment is canceled. Derive the notice's current balance from the order and drafts, and test a partial corrective Add before the final one.

### 4. P3 — The floor placeholder adds unapproved product copy

**Locations:** `apps/pos/src/PosRoutes.tsx:72–83`; route assertion at `apps/pos/test/settlement.test.tsx:907–919` checks the destination but not this copy.

Open `/pos/settlement?state=leaselost`, press **Back to floor**, and `/pos/floor` renders **“POS-02 (the floor) is not built yet.”** I also rendered `/pos/floor` directly through `PosRoutes` in JSDOM and confirmed the sentence. FE-018 rule 9 authorizes a placeholder route and asks the implementer to state what renders; it does not approve this customer-facing sentence. The confirmed POS-02 screen inventory defines the floor's purpose and states without this copy. This confirms the lead's item as an invented composition, with no money effect.

**Recommended correction:** keep the placeholder route, remove the invented sentence, and obtain floor placeholder wording or composition from design before displaying it to cashiers.

## Rules and claims cleared

- **Tender bounds and money display, for represented controls:** `tenderMaximum`/`mayAddTender` reject card over the remaining balance and cash above the lower of the change and single-tender ceilings. At zero balance neither method can Add. `settlementPosition` uses integer `bigint` sums, caps the displayed balance at zero, and separates change from the order-total revenue figure. The existing card, cash-over, split, ceiling, remove-draft, and one-minor-unit-short tests passed. I found no ordinary-control sequence in the represented order flow that drafts an over-balance non-cash amount, exceeds FR-M5's change limit, or makes Close live below exact balance (B-5, B-6, B-18, B-20; FR-G2–G6, M5).
- **Pending and zero close guards:** `closeRefusal` checks table PENDING lines before balance. The routed tests cover paying the 382.725 table with Steak still pending, then removing Steak and settling 155.925; they also cover zero total both with and without Steak. The quick-sale type is exempt from the table PENDING block. Add stays available while only Close is blocked by a pending line (FR-G10–G11).
- **Draft lifecycle in the intended route:** the session is held above POS-03 and POS-04; Back to the order retains drafted rows and shows the own-tab lock, while Cancel discards them and unlocks the order. The lead's refused-`?gone=` then re-ask sequence is covered by both route and store tests. No Tender record or revenue write occurs on Add in this frontend slice (FR-G9, G12, B-20).
- **F3c red-case power, independently mutation-run:** I used a temporary Vite transform that changed source **in memory**, without editing source files. Suppressing the pending check made AC-1 fail at `settlement.test.tsx:541` (`BUTTON` instead of `SPAN`). Changing the zero-composition trigger to `state === 'zero'` made AC-6a fail at `:605` (zero notice absent after live removal). Ignoring the injected `closeRule` made AC-10 fail at `:691` (`BUTTON` instead of `SPAN`). All three mutations were detected by the submitted focused tests; none relies only on the handoff's account. AC-6b's pending-at-zero assertion also passed unmutated.
- **Design artifact checks:** the confirmed design worktree still displays **155.925** in `pending` while naming Steak as pending; the code correctly derives **382.725** for that live order. The artifact's *Leave payment* href targets `order.html?state=default`; the routed code instead preserves the draft and returns to locked POS-03. The takeover artifact draws manager PIN dots without a keypad; F3d copies that composition and keeps its takeover action inert, rather than pretending a manager can authenticate. For `cardover` and `ceiling`, the artifact adds notices above the keypad and the implementation's `.tender-entry__body` uses `overflow: hidden`; this confirms the clipping mechanism. I did not independently measure the lead's reported clipped pixel counts or run a visual browser capture.

## Verification and limits

I ran **`npm run verify`: exit 0, typecheck clean, 22 test files and 1,327 tests passed**. Four temporary JSDOM interaction tests passed for findings 1–4, using actual rendered buttons and browser Back where applicable. The three focused mutation runs each failed at the expected existing assertion. The scratch test and temporary mutation config were then deleted.

I did not test a real close command, Tender persistence, receipt printing/reprinting, printer failure, lease acquisition/renewal/takeover, actor reauthentication, or custom tender methods: these are not implemented by F3 and a passing fixture suite is not proof of FR-G7–G8 or server-side FR-G9, G13–G14. I did not replay the implementers' browser sessions or independently measure touch clipping. Browser-history setup for finding 1 used two same-route entries before pressing real Back; it proves the routed popstate defect but does not claim that F3's own same-screen controls push that exact history pair.

Only this report remains from my review work. `.agent/MEMORY.md` and `.agent/ROADMAP.md` were already modified at review start; I did not edit either. No source or permanent test file was edited, and I did not stage or commit anything.
