---
id: PHASE1-S9
title: POS-03 draws the actor group, with Release going to POS-01 as on the floor and POS-05 and POS-06 (plan S9, PHASE0-011c2 ruling 2)
category: ui
touches: [identity]
depends_on: []
owns: [apps/pos/src/OrderPanel.tsx, apps/pos/src/ActorChip.tsx, apps/pos/src/pos.css, apps/pos/test/**, e2e/tests/identity.spec.ts, e2e/support/**]
status: complete
cycles: 0
---
# PHASE1-S9 — POS-03's actor group and Release

**Written** 2026-11-10 by the lead. Sources:
- slice **S9** of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md:393-404`);
- **PHASE0-011c2's task file** (`.agent/tasks/PHASE0-011c2-pos-sign-in.md`), its *Ruling on the BLOCKED question*,
  rulings 1 and 2 (`:556-566`): ruling 1 put Release on the floor, POS-05 and POS-06; ruling 2 left POS-03 out because
  it drew no actor, and named the gap this slice closes;
- the **Frost artifact** `docs/design/visual-directions/frost/pos/order.html`, its bar at **`:130-144`** (the plan's
  `:77` is stale; the artifact has grown since), with the actor group at `:139-143`;
- **ADR-011** (`docs/decisions/ADR-011-browser-clients.md`), rule 19 (one cookie-changing request at a time per tab,
  `:656-667`) and rule 22 (POS release goes to POS-01 whatever the server answers, `:711-731`);
- `docs/design/SCREEN-INVENTORY.md:101` (*POS Release*) and `docs/design/SITEMAP.md:118` (the actor identity and
  release control are POS chrome, FR-A2).

No consult: this places a reviewed drawing on a built mechanism, as PHASE0-011c2 did. Where this file and the merged
code disagree, or the code cannot do what this file says, stop and write `BLOCKED: <question>` in the Handoff.

## Objective

When a cashier or manager is signed in, the routed POS-03 (the order workspace at `/pos/order`) shows, at the right
end of its bar, the same actor group the floor, POS-05 and POS-06 show: the person's name and role, the idle seconds
left, and **Release**. Pressing Release sends the release request once and shows POS-01 resting at once, whatever the
server answers or if it does not answer, exactly as Release does on the floor today. Nothing else on POS-03 changes.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **The existing code:** `apps/pos/src/ActorChip.tsx` (the actor group, already used by the floor, POS-05 and POS-06
   with `release`, and by POS-04 and the incidents screen without it); `apps/pos/src/OrderPanel.tsx`, the
   `ControlledOrderScreen` bar at `:316-325` and the `showFloorLink` prop at `:121-127`; `apps/pos/src/FloorScreen.tsx:205-209`,
   `ClosedOrdersScreen.tsx:103-111` and `ClosedOrderScreen.tsx:153-163` (how the other screens place the group);
   `apps/pos/src/pos.css` (`.order-screen__bar` `:297`, `.order-screen__bar--floor` `:2389`, `.floor-actor` `:2412`,
   `.floor-idle` `:2421`, `.floor-action` `:2428`); `apps/pos/src/PosRoutes.tsx:128-160` (POS-01 is drawn in place of
   the route on `signed-out`, without changing the URL; the order book and payment sessions are not gated);
   `apps/pos/src/session/realSession.ts:367-380` (`release()`: refuses while a cookie-changing request is in flight or
   when not signed in, goes to POS-01 first, then sends).
3. **The tests beside them:** `apps/pos/test/floor.test.tsx:125-140`, `closed-orders.test.tsx:140-155`,
   `closed-order.test.tsx:700-745` (how Release in the actor group is asserted today), `session-fixture.test.tsx`
   (fixture mode: a Release makes no `fetch`), `session-store.test.tsx` *20. Release* (`:260` on) and
   `session-harness.tsx` (the real store against a fake transport).
4. **The browser harness:** `e2e/tests/identity.spec.ts`, `e2e/tests/premises.spec.ts:95-115` (`expectBodiless` for
   Release), `e2e/support/catalog.ts:146` (`openPosOrder`, which signs a cashier in on `/pos/order`).
5. The contract, for meaning only: PRD FR-A2; BOUNDARIES B-13 and B-24; ADR-011 rules 19 and 22.

## Decided: do not reopen

- **Release's behaviour is built and settled** (PHASE0-011c2; ADR-011 rule 22; SCREEN-INVENTORY `:101`): the screen
  goes to POS-01 resting whatever the answer (204, an error, no response), with no notice and no retry; the on-screen
  actor is removed at once. This slice reuses `ActorChip` with `release` and changes nothing in the session store.
- **One cookie-changing request at a time** (ADR-011 rule 19) is enforced by the store (`cookieChanging`); a second
  press is impossible because the screen has already left for POS-01.
- **What happens after Release is what happens after the idle lock today:** POS-01 is drawn in place of the route, the
  URL stays `/pos/order…`, and the tab-local order book, its pending lines and any payment session survive (ARCHITECTURE
  §6.4, `PosRoutes.tsx:129-147`). If a payment session is active, POS-01 shows its draft notice. The next sign-in, by
  anyone, returns to the route. Do not change any of this.
- **Every name and number in the group comes from the session store** (B-24), as `ActorChip` already does.

## Lead rulings (2026-11-10)

1. **Where.** The group goes in the **routed** bar only, the one `ControlledOrderScreen` draws when `showFloorLink` is
   true (`PosRoutes` passes it). Place it after `← Floor` as `<div className="floor-actor"><ActorChip
   idleClassName="floor-idle" release /></div>`, exactly as the floor, POS-05 and POS-06 do; `.floor-actor`'s
   `margin-left: auto` puts it at the bar's right end, as the artifact draws it. The standalone bar
   (`showFloorLink` false: the bare `aria-hidden` bar every direct component test renders) stays exactly as it is,
   with no actor and no Release: an `aria-hidden` region must not hold a button.
2. **The look is the other screens' look, not the artifact's inline values.** Release uses `ActorChip`'s default
   `floor-action` class and the idle chip `floor-idle`, as on the floor and POS-05 and POS-06. The artifact's
   `btn btn--sm` with `width:110px` is a mockup value that no built screen uses; one actor group across the POS is the
   rule. Add CSS only if the bar needs it to lay the group out (for example a gap), using Frost tokens from
   `pos.css`'s existing custom properties, never a literal. If the bar's height cannot hold the group without a
   literal or a layout change to the bar, stop and ask.
3. **Inert with the rest of the frame.** The bar already takes the frame's `inert` while a sheet, the approval prompt,
   the discount sheets, a void or M-2 is open (`OrderPanel.tsx:300`). Release must be unreachable then too; that comes
   from putting the group inside the existing bar, and a test proves it. While POS-03 is locked by a payment session in
   this tab (FR-G12), Release stays live: the artifact draws it in the `lock-draft` and `lock-lease` states, and POS-01
   handles the draft.
4. **Nothing else in the bar.** The artifact's bar also draws the order's title as `h1` and a `DINE IN`/`COUNTER` tag;
   the built screen shows the title in the panel (`order-panel__title`) and draws neither in the bar. Adding them is
   out of scope (it is layout and heading structure, not this slice). Say so in the Handoff under *Found and not fixed*;
   the lead queues it.
5. **`ActorChip.tsx`**: change only its comment, if at all, to cite `order.html:139` instead of `:77`. No behaviour
   change to the component.
6. **One browser case**, in `e2e/tests/identity.spec.ts`: a cashier signed in on POS-03 (through `openPosOrder`)
   presses Release; the request is bodiless and answered 204 (as `premises.spec.ts`'s `expectBodiless` checks; copy the
   helper into the spec or add one beside the others in `e2e/support/`, do not move the existing one); `#root`'s
   `data-session` is `signed-out` and POS-01 is resting; then a reload of the page still shows POS-01, which proves the
   server ended the session and the tab did not merely hide it. Assert state, accessible names and request facts,
   never copy. Record every PIN the spec types as the other specs do (the credential scan's ledger).
7. **Test first, for every criterion:** write the test; run it against the merged code and record the failing
   assertion **before** changing production code; then write the code; then apply the criterion's *Red* to the
   finished code and record that failure too. Both records go in the Handoff.

## Acceptance criteria, each with its red proof

1. **The group is drawn.** Routed POS-03 in fixture mode, signed in as the fixture cashier: the bar's `.floor-actor`
   text is `Ana R. · Cashier90sRelease`, the same string the floor's test asserts, and the bar holds exactly one
   button named Release. Also for a quick sale (`?state=quick-new`) and for a locked order (a payment session active).
   *Red:* drop `release` from the new `ActorChip`; the test fails on the missing button.
2. **Release goes to POS-01 whatever the answer.** With the real store on the fake transport (`session-harness.tsx`),
   signed in on routed POS-03, pressing Release sends exactly one `/api/pos/auth/release`, and POS-01 resting is shown
   before the answer arrives, for a 204, a 500 and no answer. A second press is impossible (the button is gone).
   *Red:* make the button call nothing; the test fails on the request count.
3. **The order survives, as after the idle lock.** With a pending line on the order (and, separately, a payment session
   active), Release then a sign-in in this tab shows POS-03 again on the same URL with the same lines; with the payment
   session, POS-01 showed the draft notice in between. *Red:* this criterion pins existing behaviour; mutate
   `PosRoutes.tsx`'s signed-out branch in your working copy to replace the URL with `/pos/floor` (do not commit it) and
   record the failure, then restore the file and show `git status` clean for it.
4. **Inert under a sheet.** With M-2 (or any sheet the screen opens) open, the Release button is inside an `inert`
   region. *Red:* move the group out of the bar into an element without `inert`; the test fails.
5. **The standalone bar is unchanged.** `OrderScreen` (no `showFloorLink`) renders the bare `aria-hidden` bar with no
   actor text and no button, signed in or not. *Red:* draw the group in both bars; the test fails.
6. **Fixture mode makes no request.** In fixture mode, a Release on POS-03 makes zero `fetch` calls (as
   `session-fixture.test.tsx` proves for the floor). *Red:* not needed beyond criterion 2's; say so.
7. **In the browser** (ruling 6): the case passes on Chromium and WebKit. *Red:* skip the click (so nothing is sent);
   the case fails on the request wait.
8. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions** only; a change to an existing helper's
  behaviour is a change to every spec: stop and ask. No change to `packages/`, `apps/server`, `apps/back-office`,
  `db/`, `docs/`, the session store or `PosRoutes.tsx` (criterion 3's mutation is temporary and never committed).
- **Create and change files with the Write and Edit tools only,** never with shell heredocs, `python3` or `sed`: they
  have stopped builders on approval prompts for over an hour. One simple command per shell call.
- Every visible word is one the screens already draw; every style value is a Frost token already in `pos.css`.
- Browser-test rules as in the other specs: random credentials drawn as `people.ts` draws them; requests made by the
  page; assertions on state, accessible names and request facts; no screenshots or artefacts committed.
- Server-backed tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config.

## Tests expected to change

- **None of the existing assertions, except** any that enumerates every button or the whole bar of the **routed**
  POS-03 (rendered through `PosRoutes` on `/pos/order`): such a list gains Release, or filters the actor group out as
  `refund-screen.test.tsx:266` does (`!b.closest('.floor-actor')`). Prefer the filter where the test is about the
  screen's own actions. Name each changed assertion in the Handoff with its reason.
- New tests under `apps/pos/test/` (for example `order-actor.test.tsx`) and the one new case in
  `e2e/tests/identity.spec.ts`.
- Nothing else should change: the floor, POS-05, POS-06, POS-04, incidents, session-store and session-fixture tests,
  every other e2e spec. A weakened assertion is not acceptable.

## Baseline

`development` at `c89e11b` (S8c2 #178 merged): `npm run verify` 177 files, 6229 tests (the lead ran it on that commit,
2026-11-10); `npm run test:e2e:all` 150 passed (S8c2's tree; no spec has changed since). Run `npm run db:migrate`
before the server tests (nothing should be pending). Confirm the baseline before you start and state the new counts in
the Handoff. Run `npm run test:e2e:all` yourself before you finish.

## Out of scope

- The order title and the `DINE IN`/`COUNTER` tag in the bar (ruling 4). Release on POS-04 or the incidents screen.
- Any change to what happens after Release (where the next sign-in lands, the order book, the draft notice).
- The closed-day banner's clearing at session end (queued separately since 2026-09-30).
- Any server, contract, migration, back-office or design-document change.

## Commit and report

Commit on `agent/phase1-s9` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose:
- what was done (paths, commits);
- what was decided and on what evidence;
- tests changed and why, each changed assertion named;
- for each criterion, **both** failures (before the change, and the *Red* on the finished code);
- what was found and not fixed (ruling 4's title and tag at least);
- the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verification, 2026-11-10 (before review)

The lead's evidence for what the reviewer cannot reach (the database and a browser).

- **Branch:** `f882cb2` (task file), `75b0eda` (the change). Changed paths: `apps/pos/src/OrderPanel.tsx` (+4),
  `apps/pos/src/ActorChip.tsx` (comment only), `apps/pos/test/order-actor.test.tsx` (new), `e2e/tests/identity.spec.ts`
  (+29). All inside `owns`; no existing test file's assertions changed, as *Tests expected to change* allows.
- **`npm run verify`** in the worktree, run by the lead: `Test Files 178 passed (178)`, `Tests 6243 passed (6243)`.
- **`npm run test:e2e:all`**, run by the lead: `152 passed (2.2m)`, Chromium and WebKit; B12 included.
- **Layout, headless Chromium at the device's 1280×800, fixture mode** (`vite` on the worktree; screenshots in
  `../restaurant-pos-wt/evidence/PHASE1-S9/`): on `/pos/order` and `/pos/order?state=quick-new` the actor group's box is
  `x 1022.8, y 7.5, 237.2 × 48` and Release's `x 1178.0, 81.95 × 48`, identical to the floor header's on `/pos/floor`.
  The group sits at the bar's right end in the 64 px bar and crowds nothing. `← Floor` sits at the top of the bar rather
  than centred; that is the existing link's styling (`settlement-back`), unchanged by this slice, and is noted, not
  owed here.
- The look on a real tablet remains the owner's.

## Handoff

**What was done.** Routed POS-03 now draws the actor group at the right end of its bar. In `apps/pos/src/OrderPanel.tsx` the `showFloorLink` bar gains `<div className="floor-actor"><ActorChip idleClassName="floor-idle" release /></div>` after `← Floor`, plus the `ActorChip` import. The standalone bar (no `showFloorLink`) is untouched. `apps/pos/src/ActorChip.tsx` changed only its comment, `order.html:77` to `order.html:139`. No CSS was needed: `.floor-actor` already carries `margin-left: auto` and its own gap, and `.order-screen__bar--floor` is already a flex row. New tests are in `apps/pos/test/order-actor.test.tsx` (14 tests) and one new case, `B12`, in `e2e/tests/identity.spec.ts`. No production code outside OrderPanel's bar changed, and the session store, `PosRoutes.tsx` and the e2e support files were not touched.

**What was decided, and on what evidence.**
- Placement and classes follow ruling 1 and 2 exactly, as the floor, POS-05 and POS-06 do (`FloorScreen.tsx:205-209` and the others).
- Inert and the locked state needed no code: the group sits inside the bar that already takes `{...inert}`, and `ActorChip` is not gated on `locked`. Tests 4 and 1 (locked) prove both.
- The e2e case copies the bodiless checks inline from `premises.spec.ts` rather than moving that helper, and imports the existing `openPosOrder` from `e2e/support/catalog.ts` (no support change). It uses `world.people.cashier()` as the other specs do, so the credential scan's ledger records the PIN. It also asserts exactly one Release POST reached the wire, and that after `pos.reload()` the page is still signed out at `resting`, which shows the server ended the session.
- Criterion 5's test types only the fixture cashier signed in. Signed out, `ActorChip` returns null, so a second case would test nothing. I renamed the test title from "signed in or not" to say what it covers.
- Criterion 3 in fixture mode: the "payment session" case goes Table 1, Settle, back to Order, which makes a real in-tab payment session; POS-01 then shows `data-lock-state="draft"`. The pending-line case adds a Burger to the free Table 2.

**Existing tests changed.** None. No existing test enumerated the routed POS-03 bar or its buttons, so nothing needed Release added or filtered. The pre-existing suites (floor, POS-05, POS-06, session-store, session-fixture and the other e2e specs) pass unchanged.

**Each criterion: failure before the change, then the Red on the finished code.**
1. *Before:* with the new tests written and `OrderPanel.tsx` unmodified, the three `the group is drawn` cases and the locked-by-payment-session case failed with `TypeError: Cannot read properties of null (reading 'textContent')` (no `.floor-actor` in the bar). *Red:* removed `release` from the new `ActorChip`; the three bar cases failed with `expected 'Ana R. · Cashier90s' to be 'Ana R. · Cashier90sRelease'`.
2. *Before:* the three `sends one request` cases failed on `expected [] to have a length of 1 but got +0` (no Release button). *Red:* changed `ActorChip`'s `onClick` to `() => undefined`; the three cases failed on `expected undefined to be 'resting'`. This fails on resting rather than on the request count, but the no-op button sends nothing and reaches neither assertion; both would fail. The test asserts the count after the answer is settled.
3. *Before:* both survival cases failed with `Cannot read properties of undefined (reading 'click')` (no Release button). *Red:* inserted `window.history.replaceState(null, '', '/pos/floor')` at the top of `PosRoutes.tsx`'s signed-out branch; both cases failed with `expected '/pos/floor' to be '/pos/order?state=default'`. I restored the file with `git checkout -- apps/pos/src/PosRoutes.tsx`, and `git status` afterwards showed it clean (only my three intended files modified).
4. *Before:* the sheet cases failed with `Cannot read properties of undefined (reading 'closest')`. *Red:* removed `{...inert}` from the routed bar; both the M-2 and the approval-prompt cases failed with `expected null not to be null`. The control case (nothing open, Release not inert) stays green under that mutation, as it should.
5. *Before:* passes, since this pins existing behaviour (the standalone bar was never changed). *Red:* drew the group in the standalone bar as well; the test failed with `expected 'Ana R. · Cashier90sRelease' to be ''`.
6. A Release on POS-03 in fixture mode makes zero `fetch` calls. *Before:* failed like the others (no button). *Red:* not needed beyond criterion 2's, as the ruling says.
7. *Before:* the production change was already in when I wrote the e2e case, so there is no recorded failing run of it against unmodified code; the unit tests carry the before-record. *Red:* replaced `.click()` with `.hover()` on the Release button; the case failed at `page.waitForRequest` (timeout, nothing sent). Restored afterwards. The case passes on Chromium and WebKit.

**Found and not fixed.**
- Ruling 4: the Frost artifact's bar also draws the order title as an `h1` and a `DINE IN`/`COUNTER` tag. The built screen shows the title in `order-panel__title` and draws neither in the bar. Out of scope here; the lead queues it.
- Release is drawn in the routed bar with `ActorChip`'s default `floor-action` class, not the artifact's `btn btn--sm` with `width:110px` (ruling 2). I did not check the rendered layout in a browser for visual fit, only the CSS: the bar is a flex row of `--frost-pos-header-height` with `align-items: center`, the same container shape as the floor's header. I used no screenshot and no visual check; a look at `/pos/order` at tablet width would settle whether the group fits beside `← Floor` without crowding.
- `npm run test:e2e:all` rebuilds `apps/*/dist`; the dist output is not tracked, so it does not appear in `git status`.

**Verify output (real).** `npm run verify`: typecheck clean, then `Test Files 178 passed (178)` and `Tests 6243 passed (6243)` (baseline 177 files, 6229 tests: +1 file, +14 tests). `npm run test:e2e:all`: `152 passed (2.3m)` on Chromium and WebKit (baseline 150: the new B12 on each browser). `npm run db:up` and `build:clients` were run first; nothing was pending to migrate. No formatter touched any file.

**What the next agent needs.** Nothing blocked. I have no browser access in this session beyond Playwright's headless runs, so no human-visual check was done (see above).

DONE
