---
id: FE-029
title: Render the settlement screen's cancel, reauth and leaselost modals inside the device frame
category: quick
touches: []
depends_on: []
owns: [apps/pos/src/SettlementScreen.tsx, apps/pos/test/settlement.test.tsx]
status: complete
cycles: 0
---
# FE-029 — Settlement modals inside the device frame

**Why this task exists.** It is the owner's chosen pilot for the dispatcher
(KIT-004, DECISIONS.md 2026-09-29, "candidate A"): a small, fully specified
change with an existing design ruling, run through `dispatch.sh` while the
owner watches.

## Objective

On POS-04 (settlement, `apps/pos/src/SettlementScreen.tsx`), the
`CancelPaymentModal`, `ReauthModal` and `LeaseLostModal` render inside the
`.pos-device` element, beside `TakeoverModal`, so that each modal and its
scrim are positioned against the 1280×800 device frame instead of against
the page.

## Required inputs

- **The defect, as it stands.** In `SettlementScreen`'s returned JSX (around
  lines 1005–1013 at `development`), `TakeoverModal` renders inside
  `<div className="pos-device">`, with a comment saying why. The other three
  render after that `</div>`, as siblings of the device:
  ```tsx
        {state === 'settle-takeover' && <TakeoverModal … />}
      </div>
      {state === 'reauth' && <ReauthModal onLeave={leavePayment} />}
      {state === 'leaselost' && <LeaseLostModal onBackToFloor={…} />}
      {cancelOpen && (<CancelPaymentModal … />)}
      {import.meta.env.DEV && <SettlementFixtureStates current={state} />}
  ```
- **Why position decides it.** `apps/pos/src/pos.css`: `.pos-device` is
  `position: relative` with `overflow: hidden`; `.modal-scrim` is
  `position: absolute; inset: 0` and `.modal` is `position: absolute; top:
  50%; left: 50%; transform: translate(-50%, -50%)`. Inside the device they
  cover and centre on the frame. Outside it they resolve against the next
  positioned ancestor, which is the page. They fit today only because the
  browser viewport and the frame happen to be close in size.
- **Precedent.** The same move was made for `TakeoverModal` in F3 after a
  browser walk found its Cancel button at y=841, below the 800px frame. Its
  test is `apps/pos/test/settlement.test.tsx` around line 1277 ("the modal
  sits inside the device frame…"): it asserts `modal.closest('.pos-device')`
  and the scrim's `closest('.pos-device')` are not null. The design artifact
  draws every POS-04 modal inside the frame.
- **Inertness is unchanged.** The screen already sets `inert` on the
  settlement header and main while any of the four modals is open
  (`overlayOpen`). Moving the modals must not put them inside an inert
  element: they go directly inside `.pos-device`, as siblings of the header
  and `main`, like `TakeoverModal`.

## Constraints

- Change placement only. No copy, behavior, state, focus, props, class names
  or CSS changes. The modal components themselves are not edited.
- `SettlementFixtureStates` (the dev-only fixture nav) stays outside the
  device, where it is now.
- Update the comment above `TakeoverModal` so it covers all four modals.
- No boundary is involved: this is layout. `reauth` and `leaselost` are
  fixture states with no live identity or lease behavior (their component
  comments say so); nothing about sign-in or leases changes.

## Tests expected to change

None. No existing test asserts that these three modals are outside the
device (checked by the explorer and the lead). You **add** tests to
`apps/pos/test/settlement.test.tsx`; you do not modify existing ones.

## Acceptance criteria

1. For each of `reauth` (direct visit to `/pos/settlement?state=reauth`),
   `leaselost` (`?state=leaselost`) and the cancel-payment confirmation
   (opened from the pending notice, as the existing cancel-payment tests do),
   a new test asserts that the open `.modal` and its `.modal-scrim` each have
   `closest('.pos-device')` not null, following the Takeover test's shape.
2. Each new test goes red on today's placement: move the modal back outside
   the device, run the test, read the failure, revert. Say in the Handoff
   that you did this for each of the three, and quote one failure message.
3. A new or extended assertion shows that no open modal sits inside an
   `inert` element (`modal.closest('[inert]')` is null) for the three states.
4. `SettlementFixtureStates` still renders outside `.pos-device` in dev
   (unchanged; do not add a test for it unless one is trivial).
5. `npm run verify` is green, and the Handoff quotes the real counts
   (typecheck result, tests passed and files).

## Out of scope

- Any other screen's modals or sheets, and any CSS change.
- A browser walk: the lead walks the three states in a real browser at
  verification. If you have no browser, say so once in the Handoff.
- The other housekeeping items in the same backlog (P3s, Prettier).

## Handoff

**What I did.** In `apps/pos/src/SettlementScreen.tsx` I moved `ReauthModal`, `LeaseLostModal` and `CancelPaymentModal` inside `<div className="pos-device">`, directly after `TakeoverModal` and as siblings of the header and `main`, so `inert` never reaches them. `SettlementFixtureStates` stays after the device, in dev only. I rewrote the comment above the modals to cover all four. Nothing else changed: no copy, props, state, class names or CSS, and the modal components are untouched. In `apps/pos/test/settlement.test.tsx` I added one `describe`, "FE-029: every POS-04 modal sits inside the device frame", with three tests: `reauth`, `leaselost` and the cancel-payment confirmation opened from the pending notice. Each asserts that the `.modal` and the `.modal-scrim` have a non-null `closest('.pos-device')` and a null `closest('[inert]')`.

**Red proof.** I wrote the tests before the source change and ran them against the original placement. All three failed, one per modal, at the `closest('.pos-device')` assertion: `AssertionError: expected null not to be null` (for example in "FE-029: every POS-04 modal sits inside the device frame > reauth"). Then I moved the modals, and they went green. This is the real defect path, not a synthetic mutation: the original placement is the defect. I did not separately re-break the code after the fix. The `[inert]` assertions passed on both placements, since the modals were never inside the inert header or main. They guard the move against a future wrong placement, but I did not prove them red.

**Existing tests changed.** None. I only appended to `settlement.test.tsx`.

**Found, not fixed.** Nothing. No test for the dev fixture nav (criterion 4, optional).

**Verify.** `npm run verify`: typecheck clean (server, money, pos), vitest 32 test files passed (32), 2256 tests passed (2256). No formatter was run.

**Browser.** No browser was available, so the layout in a real browser is not walked. The lead walks the three states.

**Commit.** See the branch `agent/fe-029`, one commit on top of 4261433.

DONE
