# FE-002 — Apply the three A7 states to `apps/pos`

**Status:** Done 2026-09-16, lead-verified. Awaiting the owner's look.
**Roadmap item:** A9
**Branch:** `agent/phase-0-foundations`
**Assigned:** `builder4`

---

## Why this task exists, and why it is smaller than it looks

A7 (`DESIGN-005`) designed the three states Frost did not contain: a pressed
state for touch, an invalid field, and a 13px tag on a round-group heading.
They exist as four tokens and one stylesheet **on `agent/design-direction`
only**. The code branch has never seen them — its token registry is the 169-token
pre-A7 version, and `packages/tokens/frost.css` re-exports that registry, so
today the POS cannot reference a pressed state even if it wanted one.

A9 as written on the roadmap says "apply the three states to `apps/pos`". The
lead checked what `apps/pos` actually contains before writing this task, and
**only one of the three has a surface to land on**:

| State | Surface in `apps/pos` today | This task |
|---|---|---|
| Pressed ring | 12 PIN keys, Continue, the emergency-banner action | **Apply it** |
| Field invalid | There is no field. The PIN pad is dots and keys, not a text input | **Do not apply.** Lands in F3 |
| 13px round tag | No round-group heading exists. That is the order panel | **Do not apply.** Lands in F2 |

Do not invent a surface for the other two. A7 itself is the precedent here: its
designer needed a state to demonstrate the invalid field, invented one, then
**reverted it and asked** — and the lead granted a state on an existing screen.
Inventing a field on the lock screen to justify a token is the failure that
process exists to prevent. The tokens arriving unused is the correct outcome;
they are consumed by the screens that have the controls.

So this task is: **bring the registry across, wire the pressed ring into the
controls that exist, and make the hover rule enforceable rather than advisory.**

---

## Objective

`apps/pos` runs on the 172-token registry, every enabled boxed control on the
lock screen draws the pressed ring while a finger or pointer is down, and a test
fails if any future hover rule in `apps/pos/src` is written outside
`@media (hover: hover)`.

---

## Required inputs

Read these before writing anything.

1. **`docs/design/visual-directions/frost-states.css`** — on
   `agent/design-direction`, in the worktree at `../restaurant-pos-design`.
   128 lines, and the comments carry the reasoning, not just the rules. Read the
   whole file. The rule is *selection fills; pressing strokes*.
2. **`.agent/tasks/DESIGN-005-a7-three-missing-states.md`** — same branch, same
   worktree. It is **not on this branch**; do not go looking for it here.
3. **`.agent/tasks/FE-001-pos-shell-and-lock-screen.md`** — on this branch.
   Its handoff section *"Pressed / active state (A7) — none added"* is the
   reasoning you are now superseding, and it explains why the lock screen
   survived without one.
4. **`apps/pos/src/pos.css`** and **`apps/pos/test/no-invented-values.test.ts`**.

---

## What to build

### 1. Bring the A7 artifacts onto this branch

Three paths, from `agent/design-direction`:

```
docs/design/tokens/frost.css
docs/design/tokens/frost.tokens.json
docs/design/visual-directions/frost-states.css
```

`git checkout agent/design-direction -- <those three paths>` is the way. It is
clean: **this branch has never modified `docs/design/tokens/`** (verified by the
lead with `git log agent/design-direction..agent/phase-0-foundations -- docs/design/tokens/`,
which is empty), so nothing of this branch's is overwritten.

**Bring across only those three paths.** The design branch is also ahead on
`docs/DESIGN.md`, `SITEMAP.md`, `SCREEN-INVENTORY.md`, the prototype, three Frost
fixtures, and the Phase 0 plan. Those are the owner's merge to make, not this
task's. The consequence to accept knowingly: this branch will carry a
`docs/DESIGN.md` that is 360 lines behind its own token registry. No test
couples the two, and the owner's merge resolves it. Say so in the handoff rather
than fixing it.

Expected after: `grep -c -- '--frost' docs/design/tokens/frost.css` returns
**172**, and `--frost-pressed-ring`, `--frost-invalid`, `--frost-invalid-border`
and `--frost-round-tag-size` are all present.

### 2. Apply the pressed ring

In `apps/pos/src/pos.css`, on the **enabled boxed** controls only:

- `.key` — all twelve
- `.key--continue`
- `.emergency-banner__action`

Use `box-shadow: var(--frost-pressed-ring)` on `:active`. Never retype
`inset 0 0 0 2px currentColor` — `no-invented-values.test.ts` will fail you for
the `2px`, and correctly.

`currentColor` is the whole design: one rule reads as an ink ring on a cream key
and a white ring on the spruce Continue, with no new colour value. Do not
substitute a named colour.

**`.key--continue-disabled` gets no ring.** A disabled control's press did
nothing, so nothing should say it did. `frost-states.css` states this explicitly
for the `--off` variants.

### 3. The focus-ring collision — handle this deliberately

`pos.css:39-43` already sets `box-shadow: var(--frost-focus-ring)` on
`:focus-visible`. `box-shadow` is a single property: a later `:active` rule
**replaces** the focus ring rather than adding to it. A keyboard user pressing
Space on a focused key would watch their focus ring vanish at the moment of the
press.

`frost-states.css` says the inset ring "never collides with the keyboard focus
ring (outside, green)" — that is true of the *geometry*, and it is only true of
the *rendering* if both shadows are in one declaration. So:

```css
.key:focus-visible:active { box-shadow: var(--frost-focus-ring), var(--frost-pressed-ring); }
```

or an equivalent that demonstrably draws both. **Prove it in a browser**, not by
reading the cascade. A screenshot of a focused-and-pressed key showing both
rings is the evidence.

### 4. Make the hover rule enforceable

`pos.css` contains **no `:hover` rule today**, so there is nothing to scope yet.
That is exactly why this is the moment to make it a test rather than a comment.

Add a check — `apps/pos/test/hover-scoped.test.ts` or a case inside the existing
no-invented-values suite — that **fails if any `:hover` selector in
`apps/pos/src` sits outside an `@media (hover: hover)` block**.

The reason, in full, because it is the most expensive thing A7 learned: touch
browsers synthesise `:hover` on tap and **hold it after the finger lifts**.
Frost's tile hover is the ink selected fill. Without scoping, a tapped tile is
left looking selected once the pressed ring goes — the exact confusion the
pressed state was designed to prevent. A7's designer saw this and wrote a
*comment* saying an implementation should gate hover. `design-reviewer` rejected
that: a comment fixes nothing and hands the bug to whoever writes the code.

F2 builds the menu grid, which is where this bites. The test must exist before
F2 starts, and it must be red-then-green — write a throwaway unscoped hover rule,
watch it fail, delete it.

### 5. Update the stale comment

`pos.css:9-13` currently reads "Pressed / active touch state: deliberately
none." It is no longer true. Replace it with what is now true and why, including
that the disabled Continue is excluded.

---

## Constraints

- **`packages/tokens/frost.css` declares nothing.** It is a one-line `@import`
  and `packages/tokens/test/tokens.test.ts` fails if a declaration appears in it.
  That is the anti-drift mechanism. Do not add the new tokens there; they arrive
  through the registry.
- **No literal values in `apps/pos/src`.** `no-invented-values.test.ts` forbids
  any colour, any length other than `1px`, and any numeric font size, weight,
  line height or tracking. It also fails on any `var(--frost-*)` absent from the
  registry.
- **Do not edit `docs/design/visual-directions/frost-states.css`** once it is
  across. It is a reviewed design artifact. If a rule in it cannot be applied as
  written, say so in the handoff — do not adjust the artifact to fit the code.
- **Do not touch contract documents.** `PRODUCT.md`, `PRD.md`, `docs/ROADMAP.md`
  and `BOUNDARIES.md` are the owner's.
- **Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.** Write this file's
  handoff section and nothing else under `.agent/`.
- **One slice.** This is the lock screen. An implementer that starts the order
  workspace has ended its task and should say so.

---

## Acceptance criteria

1. The registry on this branch has 172 tokens, including the four A7 tokens.
2. `apps/pos` builds and runs; `npm run dev -w apps/pos` serves
   `http://127.0.0.1:5173/pos/`.
3. Every enabled key, Continue, and the emergency action draws a 2px inset ring
   in its own text colour while pressed. **Verified in a browser**, not inferred.
4. The disabled Continue (`?state=throttled`) draws no ring when pressed.
5. A focused key that is then pressed shows **both** the focus ring and the
   pressed ring.
6. The hover test exists and has been seen to fail on an unscoped hover rule
   before passing.
7. `npm run verify` passes — all existing tests plus the new one. FE-001 left
   114 tests across 8 files; state the new count.
8. Typecheck clean.
9. No invalid-field styling and no round-tag styling was added. Their absence is
   deliberate and stated in the handoff.

---

## Out of scope

- The order workspace, the menu grid, the tender panel — F2 and F3.
- Any invalid-field or round-tag CSS.
- Merging anything to `main`, or merging `agent/design-direction`.
- Bringing `docs/DESIGN.md` or any other design-branch document across.
- Backend tasks 3–12. Still paused.

---

## Known trap for F2, flag it forward, do not solve it here

`frost-states.css:58` applies the pressed ring to an order line with
`margin: -8px; padding: 8px` so the ring clears the text without moving it.
Those are literal lengths with no token, and `no-invented-values.test.ts` will
reject them in `apps/pos/src`. The order line does not exist yet, so this is not
your problem — but **name it in your handoff** so F2 meets it having been warned.
It needs either a registry token or a reasoned exemption, and that is a lead
ruling, not an implementer's workaround.

---

## Handoff

Write your handoff here when the work is done. State the command and the URL the
owner opens to see it. Name anything you found and did not fix. If a check was
skipped, say which and why — "should work" is not a result, and `git log` is how
the lead verifies that a commit you report actually exists.

### 2026-09-16 — implementer (claude, Opus 5)

**Not committed.** Nothing was committed, per instruction; `git log` will show
nothing from this task. Working tree on `agent/phase-0-foundations`:
`M apps/pos/src/pos.css`, `?? apps/pos/test/hover-scoped.test.ts`, and the three
A7 paths, which `git checkout agent/design-direction -- <paths>` left **staged**
(`M docs/design/tokens/frost.css`, `M …/frost.tokens.json`,
`A …/visual-directions/frost-states.css`). `.agent/MEMORY.md` and
`.agent/ROADMAP.md` were already modified when I started; I did not touch them.

#### What the owner opens

```
npm run dev -w apps/pos        # http://127.0.0.1:5173/pos/
```

Press and hold any key, Continue, or (at `?state=incident`) *Sign in to view*.
`?state=throttled` for the disabled Continue. Tab onto a key and hold Space for
focused-and-pressed. A Vite for this checkout's `apps/pos` was **already
listening on 5173** when I started (pid 31567, cwd `apps/pos`, not mine); I used
it and left it running. My own `npm run dev` failed on the port for that reason.

#### Done

1. **Registry across.** Exactly the three paths. `grep -c -- '--frost'
   docs/design/tokens/frost.css` → **172**. Present:
   `--frost-pressed-ring: inset 0 0 0 2px currentColor`, `--frost-invalid`,
   `--frost-invalid-border`, `--frost-round-tag-size`.
   `packages/tokens/frost.css` untouched; its test passes. `frost-states.css`
   not edited.
2. **Pressed ring** in `apps/pos/src/pos.css`:
   `.key:active:not(.key--continue-disabled), .emergency-banner__action:active
   { box-shadow: var(--frost-pressed-ring) }`. `.key` covers all twelve,
   including `.key--continue`.
3. **Focus collision.** A second rule,
   `.key:focus-visible:active:not(.key--continue-disabled),
   .emergency-banner__action:focus-visible:active { box-shadow:
   var(--frost-focus-ring), var(--frost-pressed-ring) }`.
4. **Hover test** `apps/pos/test/hover-scoped.test.ts`: walks every `.css` under
   `apps/pos/src` (recursive), fails on any selector containing `:hover` without
   an ancestor `@media (hover: hover)` (optionally `and (…)`). `not`, `(hover:
   none)`, and comma lists containing `(hover: hover)` do **not** count as
   scoped. It also carries detector self-tests on inline CSS, so it cannot pass
   vacuously while `pos.css` has no hover rule.
5. **Stale comment** at the top of `pos.css` replaced: the ring and why, the
   disabled-Continue exclusion, and the hover rule pointing at the test.

**Not applied, on purpose:** no invalid-field CSS and no round-tag CSS. The lock
screen has no field and no round-group heading. `--frost-invalid`,
`--frost-invalid-border` and `--frost-round-tag-size` arrive unused; F3 and F2
use them.

#### How it was verified

**Red then green, hover.** Added `.key:hover { background:
var(--frost-selected); }` unscoped at the end of `pos.css` → `× pos.css: every
:hover sits inside @media (hover: hover)`, received `[".key:hover"]`, `1 failed |
5 passed`. Wrapped the same rule in `@media (hover: hover)` → 6 passed. Deleted
it → 6 passed, `git diff` on `pos.css` empty (back to where it started) before
the real edits.

**Browser: real Chrome, real held input.** The Claude in Chrome tool can only
click (press and release together), so it cannot hold `:active` long enough for
a screenshot. Instead I ran the installed Google Chrome (headless=new) over the
DevTools Protocol against the dev server: `Input.dispatchMouseEvent
mousePressed` or `Input.dispatchKeyEvent keyDown Space` stays held, then
`getComputedStyle`, `el.matches(':active')`, `el.matches(':focus-visible')` and
a clipped `Page.captureScreenshot`, then release. Focus came from a real Tab
key event. I looked at the screenshots myself. Viewport 1400×900, DPR 2.
Results while held:

| Control | `:active` | computed `box-shadow` |
|---|---|---|
| Keys 1–9, Delete, 0 (each on a fresh load) | true | `rgb(3, 33, 37) 0 0 0 2px inset` — ink on cream `rgb(255,252,246)` |
| Continue (enabled) | true | `rgb(255, 255, 255) 0 0 0 2px inset` — white on ink `rgb(3,33,37)` |
| Emergency action (`?state=incident`) | true | `rgb(161, 38, 34) 0 0 0 2px inset` — brick on white |
| Continue, `?state=throttled` | true | **`none`** |
| Key 5, Tab-focused, Space held | true, focus-visible true | `rgb(171, 255, 174) 0 0 0 6px, rgb(3, 33, 37) 0 0 0 2px inset` |
| Emergency action, focused + Space | true / true | focus ring + brick inset |
| Continue, focused + Space | true / true | focus ring + white inset |
| Throttled Continue, focused + Space | true / true | focus ring only |

After release every ring returns to `none`, or to the focus ring alone. The key
5 screenshot shows the green 6px halo, the 2px dark outline and the ink inset
ring all at once.

**Negative control, collision.** I removed the combined rule and reran: key 5
focused + Space computed only `rgb(3, 33, 37) 0 0 0 2px inset`, and the
screenshot shows the green halo gone (outline only). Same for the emergency
action and Continue. Restored from a byte copy, then reran the whole browser
pass on the final file with the results above.

Evidence files (script `press.mjs`, `shots/*.png`, `shots/results.json`,
`neg/`) are in this session's scratchpad
(`/private/tmp/claude-501/…/scratchpad/`). That is temporary, and **not in the
repo**. Say if they should be kept.

**`npm run verify`** (typecheck on server, money, pos including `test/`, then
vitest): **9 files, 120 tests passed.** That is 114 before, plus 6 new: 4
detector self-tests, 1 "finds the stylesheets", 1 per stylesheet (`pos.css`).
`npm run build -w apps/pos` succeeds, and the built CSS contains
`--frost-pressed-ring`.

Precondition to know about: the baseline `npm run verify` first failed 7 tests
in `apps/server/test/migrate.test.ts` with `connect ECONNREFUSED ::1:5433`,
because Postgres was not running. I ran `npm run db:up` (container
`restaurant-pos-db-1`, healthy), then baseline passed 114/114. **The container
is still running.**

#### Not checked

- **A real touch device or finger.** Chrome with a mouse and a synthesised
  keyboard only. Whether a finger tap holds `:active` long enough to see on the
  target tablet is still a device-test question, as DESIGN-005 already lists.
- **Headed Chrome.** The screenshots are from headless Chrome, the same binary.
  I did not open the owner's browser for this.

#### Found, not fixed

1. **`docs/DESIGN.md` is behind its registry on this branch.** 288 insertions and
   72 deletions separate it from `agent/design-direction`, and it names none of
   the four A7 tokens. Accepted by the task; the owner's merge resolves it.
2. **Order-line trap for F2** (`frost-states.css:58`): `a.line__t:active {
   border-radius: 2px; margin: -8px; padding: 8px; }` uses literal lengths that
   `no-invented-values.test.ts` rejects. Note for the lead's ruling:
   DESIGN-005's own "What the frontend implementer needs" already gives a token
   form, `margin: calc(-1 * var(--frost-space-2)); padding:
   var(--frost-space-2); border-radius: var(--frost-radius-surface)`. The
   registry has `--frost-space-2: 8px` and `--frost-radius-surface: 2px`, and
   `calc(-1 * …)` has no unit for the length regex to catch. So a registry route
   may already exist. Whether an 8px *space* token may carry a ring offset is
   the lead's call; I did not decide it.
3. **The task calls Continue "spruce"; it renders ink.** `--frost-key-continue:
   #032125`, the same value as `--frost-selected`, with a spruce `#0b363b`
   border. The white ring is correct either way, and the `pos.css` comment says
   "ink".
4. **The disabled exclusion depends on a class, not on `aria-disabled`.** The
   throttled Continue is a live `<button aria-disabled="true">`, so `:active`
   still matches it, and only `:not(.key--continue-disabled)` suppresses the
   ring. A future disabled variant with a different class would ring. I kept the
   class form the task specified.
5. **Line references drifted.** The task's `pos.css:39-43` focus rule is now at
   `pos.css:48`, because the header comment grew.

---

### Lead verification, 2026-09-16

Run and read, not taken from the handoff above.

- **`npm run verify`: 9 files, 120 tests passed**, typecheck clean over server,
  money and pos. Matches the claim exactly.
- **172 tokens**, all four A7 names present at the lines claimed.
- **The three design artifacts are byte-identical to `agent/design-direction`**
  — `git diff agent/design-direction --` on those paths is empty. The artifact
  was brought across, not adjusted to fit the code.
- **`packages/tokens` untouched.** `git status` on it is clean, so the
  anti-drift mechanism still holds and the new tokens arrived through the
  registry as intended.
- **The hover detector was tested by the lead, not trusted.** Appending
  `.key:hover { background: var(--frost-selected); }` to `pos.css` turned the
  suite red — `1 failed | 5 passed`, reporting `[".key:hover"]` — and removing
  it turned it green. The detector catches what it claims to catch.
- **Two screenshots opened and looked at.** `key5-focused-pressed.png` shows the
  green focus halo, the dark outline and the ink inset ring together, which is
  the collision fix working. `continue-throttled-pressed.png` shows the dashed
  disabled Continue under a held press with **no ring at all**.

**On the browser evidence.** The implementer could not hold `:active` through
the Chrome tool, which only clicks, so it drove the same installed Chrome over
the DevTools Protocol and held the press while reading computed style and
capturing. It then ran a **negative control** — removed the combined rule and
confirmed the focus halo disappears. Proving a fix by also proving its absence
breaks things is the standard A7's review set, and it was met here without being
asked for.

**The evidence is in a session scratchpad and is not in the repository.** It
will not survive. The screenshots are not being kept: the claims they support
are recorded above, and the suite plus the detector are the durable check.

Four things carried forward rather than fixed, all in the handoff: `DESIGN.md`
trailing its own registry (the owner's merge resolves it), the F2 order-line
trap (ruled below in MEMORY.md), the disabled exclusion keying off a class
rather than `aria-disabled`, and Continue rendering ink where this task's text
said spruce.
