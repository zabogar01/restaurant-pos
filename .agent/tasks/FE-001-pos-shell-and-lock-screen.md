# FE-001 — POS shell and lock screen

**Status:** Active
**Owner:** `builder3`
**Depends on:** [PHASE0-001](PHASE0-001-monorepo-postgres-migrations.md) (the workspace root)

## Why this task exists, and why it is this small

The owner has re-sequenced the work: **frontend first, reviewed by the owner,
and only then the backend behind it.** The Phase 0 plan is written
backend-first — ten server tasks, then the clients — and that order is now
suspended rather than followed. See the sequencing note in
[ROADMAP.md](../ROADMAP.md).

The second instruction matters as much: **tasks are to be small enough to
finish inside one session with room to spare, and the owner reviews between
them.** A task that runs out of context halfway leaves a half-built screen and
a handoff nobody can trust. This task is deliberately one screen.

So: the smallest thing that is genuinely reviewable. A POS bundle that builds
and runs, the Frost tokens wired in, and one screen — the lock screen — drawn
at its real device target with its real touch sizes. If the design system does
not survive contact with real code, this is where we find out, before anything
larger is built on top of it.

## Objective

`apps/pos` builds and serves a POS client at **1280×800 landscape** showing the
lock screen, styled from the Frost tokens, with the PIN pad at the sizes
`docs/DESIGN.md` states. The owner can open it in a browser and judge it.
Nothing behind it is real: no server call, no session, no PIN verification.

## Required inputs

| Input | Path | What it gives you |
|---|---|---|
| Visual authority | [docs/DESIGN.md](../../docs/DESIGN.md) | Frost as values. 169 tokens, each with the file and line it came from |
| The tokens | `docs/design/tokens/frost.css`, `frost.tokens.json` | CSS custom properties. **Import them; do not retype them** |
| The screen, styled | `docs/design/visual-directions/frost/pos/lock.html` | What it should look like. Open it in a browser first |
| The screen, specified | [docs/design/SCREEN-INVENTORY.md](../../docs/design/SCREEN-INVENTORY.md) POS-01 | Every state that must exist and what each one means |
| Structure | [docs/design/SITEMAP.md](../../docs/design/SITEMAP.md) | Where this screen sits and what it may reach |
| Requirements | [docs/PRD.md](../../docs/PRD.md) `FR-A1`–`FR-A5`, `FR-E3b` | Identity, throttling, and the pre-authentication incident indicator |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) | `B-12` especially — a PIN never reaches a log, an audit row, or an error message |
| The plan's Task 11 | [the Phase 0 plan](../../docs/superpowers/plans/2026-09-08-phase-0-foundations.md) | Names `apps/pos/{package.json,vite.config.ts,index.html}` and `src/{main.tsx,App.tsx,PinPad.tsx}`. Use those paths; its **token values are superseded** by `docs/DESIGN.md` |

## What to build

- **`apps/pos`** — a Vite + React + TypeScript bundle in the existing npm
  workspace, at the plan's paths, with a `dev` script the owner can run.
- **`packages/tokens`** — the Frost custom properties made importable by both
  clients. Generate or re-export from `docs/design/tokens/frost.css`; do not
  hand-copy values, because a hand-copied token drifts and the registry exists
  precisely so it cannot.
- **The lock screen**, at 1280×800, including:
  - the PIN pad at its stated touch sizes — **88px keys, 3 columns**, from
    `docs/DESIGN.md`, not from your judgement of what looks right;
  - the entry display that shows *how many digits have been entered* and never
    the digits themselves;
  - the **unresolved kitchen incident indicator** (`FR-E3b`), which must be
    unmissable while revealing nothing about any order — the reason it exists
    is that the screen faces a room;
  - the states POS-01 declares, driven by a fixture or a query string as the
    wireframe does, so the owner can walk them without a server.

## Constraints

- **Fixtures only. No network call, no session, no PIN verification, no
  throttling logic.** Those are real behaviour with boundaries attached and
  they are not this task. A PIN typed here is compared against nothing.
- **`B-12`: a PIN never reaches a log, an error message, or a stored value** —
  including `console.log` in a mock, including React state you dump while
  debugging. The habit is what matters; the habit is what survives into Task 9.
- **No invented design values.** Every colour, size, weight and space comes
  from `docs/DESIGN.md` or its registry.
- **The pressed / active touch state is a known gap** — Frost does not contain
  one, it is tracked as `A7`, and the PIN pad is exactly where its absence
  hurts. If the screen needs one to be usable, **use a treatment already
  sourced in the registry, mark it provisional in a code comment and in your
  handoff, and tell me.** Do not mint a new colour.
- **Do not touch `apps/server`, `db/`, or anything backend.** Do not start the
  back office.
- **Do not touch the worktree at `../restaurant-pos-design`.** A designer is
  working there.
- **Do not edit** the contract documents, `docs/ARCHITECTURE.md`,
  `docs/decisions/`, `docs/DESIGN.md`, `.agent/MEMORY.md`, or
  `.agent/ROADMAP.md`.
- **Branch `agent/phase-0-foundations`.** Never `main`.
- **Stop when the screen is reviewable.** If you find yourself starting a
  second screen, the task has ended and the rest is mine to assign.

## Acceptance criteria

1. `npm run dev -w apps/pos` serves the lock screen, and your handoff states
   the exact command and URL the owner should open.
2. `npm run verify` still passes — including Task 1's migration tests and
   whatever `builder2` lands for money — and its verbatim output is in your
   handoff.
3. The PIN pad's keys measure 88px at the stated grid, verified by measuring
   the rendered page rather than by reading the CSS.
4. No PIN digit appears in any log, any DOM attribute, or any error path.
   Say how you checked.
5. Every value used traces to `docs/DESIGN.md` or the token registry, except
   anything you flagged as provisional under the pressed-state gap.
6. The screen renders correctly at 1280×800 and you say what you inspected it
   in.

## Out of scope

- The back-office client. The order workspace. Every other screen.
- Authentication, sessions, session expiry (`FR-A2`), throttling (`FR-A5`),
  and the manager approval prompt. All real behaviour, all later.
- Server routes, database work, and the remaining Phase 0 backend tasks.
- A dark palette, a pressed state designed from scratch, and the other `A7`
  gaps.

## Handoff

Written by `builder3`. What was built with paths, what was decided and on what
evidence, what was found and not fixed, what the next implementer needs, the
verbatim verification output, and **the exact command the owner runs to see
it**. A handoff that says only "done" has failed.

### Handoff — builder3, 2026-09-14

**See it.** From the repository root:

```sh
npm install
npm run dev -w apps/pos
```

Open **http://127.0.0.1:5173/pos/** in a browser window at least 1280×800.
The screen is the top-left 1280×800 frame. Below it, outside the frame and in
development only, is a row of links to every fixture state. Direct URLs:

| State | URL |
|---|---|
| Resting | http://127.0.0.1:5173/pos/ |
| Verifying | http://127.0.0.1:5173/pos/?state=loading |
| Wrong PIN | http://127.0.0.1:5173/pos/?state=error |
| Deactivated user | http://127.0.0.1:5173/pos/?state=permission-denied |
| LOGIN cooldown | http://127.0.0.1:5173/pos/?state=throttled |
| Session invalidated | http://127.0.0.1:5173/pos/?state=invalidated |
| Tender draft waiting | http://127.0.0.1:5173/pos/?state=draft |
| Kitchen printer emergency | http://127.0.0.1:5173/pos/?state=incident |

The port is fixed (`strictPort`); if 5173 is taken the command fails loudly
rather than moving to another URL.

#### What was built

- **`packages/tokens`** — `@pos/tokens/frost.css`, a one-line `@import` of
  `docs/design/tokens/frost.css`. It declares nothing of its own;
  `packages/tokens/test/tokens.test.ts` fails if it ever does.
- **`apps/pos`** — Vite 8 + React 18 + TypeScript. Plan paths:
  `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`,
  `src/App.tsx`, `src/PinPad.tsx`. Added: `src/pos.css` (all styling),
  `src/fixtures.ts` (the POS-01 states and their copy), `src/icons.tsx` (the
  three of Frost's four icons this screen uses, paths from `mockup.js`).
- **Tests** in `apps/pos/test/`:
  - `pin-pad.test.tsx` (jsdom) — 12 keys in order; dots count entries and cap
    at six; delete and Continue; keypad withdrawn while verifying; Continue
    inert under cooldown; and three B-12 tests below.
  - `no-invented-values.test.ts` — every file in `src/` has no literal colour,
    no length except a `1px` border, no literal font size/weight/line height,
    and every `var(--frost-*)` it uses exists in the registry.
  - `console-free.test.ts` — no `console.`, storage, cookie, `fetch`, XHR or
    beacon anywhere in `src/`.
- **Root `package.json`** — `typecheck` now also runs `tsc -p apps/pos`;
  `jsdom@^29.1.1` added to root devDependencies (see decisions).
  `package-lock.json` changed by additions only.

#### What was decided, and on what evidence

- **Versions: Vite 8, `@vitejs/plugin-react` 6, React 18.3.** The plan names
  Vite 5 and plugin-react 4. vitest 4 (ruled 2026-09-14) already installs
  Vite 8.3.0; Vite 5 would have put two Vites in one tree, and plugin-react 6
  is the release whose peer range is Vite 8. React stays at the plan's 18.
- **jsdom at the root, version 29.** vitest resolves its environment package
  from its own location, so jsdom nested under `apps/pos` failed with
  `Cannot find package 'jsdom'`. jsdom 30's engines field excludes Node 25 (this
  machine runs 25.2.1); 29 accepts `^22.13 || >=24`.
- **Build output stays in `apps/pos/dist`** (gitignored), not the plan's
  `../server/public/pos`, because this task does not touch `apps/server`.
  `base: '/pos/'` is kept so the URL shape already matches the plan.
  `npm run build -w apps/pos` succeeds.
- **The PIN lives only in a `useRef`.** React state holds the *count*; the DOM
  renders the count. `onSubmit(pin)` clears the ref before calling out. In
  `App.tsx` the fixture handler is `() => {}` — the PIN is compared against
  nothing and goes nowhere.
- **Continue clears the entry** in every state except cooldown. It navigates
  nowhere, because every destination the artifact links to is another screen.
- **Verifying shows all six dots filled**, because verification only follows a
  full entry. The artifact's static fixture shows three filled in every state;
  that is a drawing convenience, not a claim about the state.
- **The fixture state links sit outside the frame and only in development**
  (`import.meta.env.DEV`); they are absent from the production build.
- **The *Sign in to view* action focuses the PIN entry box**, which is what the
  reviewed artifact's script does after the REVIEW.md fix.

#### Pressed / active state (A7) — none added

No pressed treatment exists in Frost, and **this screen does not use one,
provisional or otherwise.** Reasoning: every key already produces a visible
change in the entry display — a digit fills a dot, delete empties one,
Continue empties all of them — so a cashier is never left wondering whether a
tap landed. The one tap with no visible result is Continue with nothing
entered. Stated in a comment at the top of `src/pos.css`. On the order and
tender screens a tap will *not* always change something nearby, and A7 will
bite there; it should be settled before F2.

#### How the three checks were verified

**88px keys on a 3-column grid — measured in the rendered page.** Chrome
(Claude in Chrome), window resized to a 1440×823 viewport, DPR 1, dev server
running, `getBoundingClientRect()` on every `.keypad > .key`:
12 keys, every one `88x88`; three column x-positions `498, 596, 694`; four row
y-positions `313.625, 411.625, 509.625, 607.625`; column and row gaps both
`10`; computed `grid-template-columns: 88px 88px 88px`. Device frame
`1280x800`; banner `1280x80`.

The same measurement on the reviewed artifact
(`docs/design/visual-directions/frost/pos/lock.html`, served locally) returns
the same numbers: lock box `430,184.38 420×511.25` in both; keys at the same
x/y; in `?state=throttled` both put the box at y `90.92` height `618.14` and
the notice at `430,220.17 420×90.89`; in `?state=loading` both put the box at
y `300.67` height `198.64`.

**B-12 — four ways.**
1. `pin-pad.test.tsx`: entering `123456` and `987650` in fresh renders produces
   **byte-identical `innerHTML`**.
2. Same file: every attribute containing a numeral is recorded at rest
   (`tabindex`, SVG geometry, `aria-label=0 of 6 digits entered`); after
   entering `480719` the only change is the count label. The dot container's
   text is empty.
3. Same file: after typing, Continue, and typing again, spies on
   `console.log/info/warn/error/debug/trace` were never called;
   `localStorage` and `sessionStorage` are empty; URL unchanged; title has no
   digit. (Node 25's own experimental `localStorage` global shadows jsdom's
   under vitest; the test re-installs jsdom's storage so a write would land
   where the test can see it.)
4. In Chrome, after four real taps (2, 9, 5, 4): no fragment of the sequence
   in `outerHTML`; the only numerals in any attribute under `#root` were
   `tabindex -1`, `aria-label 4 of 6 digits entered`, `viewBox` and the two
   icon paths; the console held only Vite's connect messages and React's
   DevTools notice.

**The tests can fail.** Three deliberate mutations, each reverted:
adding `console.log(pin)` in `submit` failed 2 tests; adding
`data-d={digits.current[i]}` to the dots failed 2 tests; retyping
`background: #fffcf6; height: 88px;` in `pos.css` failed 2 tests.

**Inspected in:** Chrome via Claude in Chrome, all eight states screenshotted
at 1280×800, keyboard focus ring checked on *Sign in to view* and on a key.

#### Flagged — provisional, or needing a decision

1. **`permission-denied` copy is mine, and provisional.** SCREEN-INVENTORY
   POS-01 declares the state; the reviewed artifact never drew it. Wording:
   *"This account is deactivated" / "Ask a manager to restore your access in
   the back office."* Comment in `src/fixtures.ts`. Also worth a product look:
   a distinct message for a deactivated user's PIN tells a guesser that the PIN
   they typed *is* a real PIN. That is a contract question, not mine.
2. **The *Sign in to view* action is narrower than the artifact** (121px
   measured against 180px). The artifact sets 180px inline in `lock.html`, and
   that value is **not in the registry**. `--frost-receipt-reprint-width` is
   also 180px, but it is sourced from *Reprint receipt* on `incidents.html`;
   borrowing it would tie two unrelated controls together. The action is sized
   by `--frost-button-padding` until the designer registers the width.
3. **The verifying treatment is inherited, not reviewed** (DESIGN.md Open item
   8). Colour and sizes map to tokens; the structure sheet's `.1em` label
   tracking has no token and is omitted; the skeleton bar is `60%` wide, a
   structural percentage copied from `.skel--w60`. Commented in `pos.css`.

#### Found and not fixed

- **The tender-draft notice shows a table and an amount on a locked screen**
  (*"Table 7 — 155.925 outstanding, 2 tenders drafted"*). POS-01's resting
  state says "no order context leaked on screen" and FR-E3b says "order
  information is never shown to a room". The copy is the reviewed artifact's
  and I kept it verbatim, but the contract appears to forbid it. Owner/lead
  decision; not changed.
- **The plan's Task 11 Step 4 PinPad is superseded in more than its token
  values**: it renders `'•'.repeat(pin.length)` (fine) but keeps the PIN in
  React state and its keys are 72px tall. Whoever resumes Task 11 should start
  from `apps/pos/src/PinPad.tsx`, not the plan's listing.
- Digits cannot be typed on a physical keyboard; only Tab/Enter reach the
  on-screen keys. The artifact has no keyboard entry either.

#### What the next implementer needs and does not have

- A registered width for *Sign in to view* (item 2 above), and a pressed state
  decision before the order workspace.
- The server side of Task 11 (serving `dist/` at `/pos/`) is untouched.
- `PinPad` has the interface the auth task will want (`onSubmit(pin)`,
  `verifying`, `continueDisabled`); nothing calls a server.

#### Verification output

`npm run verify`, run 16:07:58 with the database container up, verbatim:

```
> verify
> npm run typecheck && npm run test:unit


> typecheck
> tsc -p apps/server --noEmit && tsc -p packages/money --noEmit && tsc -p apps/pos


> test:unit
> vitest run


 RUN  v4.1.11 /Users/fajars/Work/Dev/POS System/restaurant-pos


 Test Files  8 passed (8)
      Tests  114 passed (114)
   Start at  16:07:58
   Duration  893ms (transform 135ms, setup 0ms, import 432ms, tests 805ms, environment 457ms)
```

Baseline before this task: `4 passed (4)` files, `79 passed (79)` tests. The
35 new tests are all in `apps/pos/test` and `packages/tokens/test`.

**Stopped here.** One screen. Nothing else in the POS was started.
