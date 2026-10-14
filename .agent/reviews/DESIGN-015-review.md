# DESIGN-015 review — round 3 (supersedes rounds 1 and 2)

**Reviewer:** Claude Opus 5.5 (the other family from the Codex and OpenCode
designers).
**Reviewed:** branch `agent/design-015` at `7054030`, on 2026-10-14. The
round-3 design commit is `afd72ff`. I read the diff `92cc841..7054030` (round
2's head to now) against the lead's *Round 3* rulings and the Handoff's
*Round 3* section.

The earlier reports are in history: round 1 at `9e20b33` (eight findings) and
round 2 at `e40ef43` (two findings). All ten are closed. They are accounted
for under *Cleared*.

## 1. Verdict

**clean** — no findings.

Both round-2 findings are fixed as the lead ruled. Round 3 introduces no new
defect that I could find. With the round-1 and round-2 closures, the POS half
is clear for PHASE0-011c and the back-office half is clear for PHASE0-011d.
Two owner questions about the idled manager's draft are still open. The
delivery draws around them as ruled, and they block neither builder (see
*Open, not findings*).

## 2. Findings

None.

## 3. What I ran and what I did not

**Ran and observed.**

- `npm run verify` at `7054030`: exit 0, typecheck clean, **70 test files and
  3,365 tests passed**, matching the Handoff. As in earlier rounds, this suite
  does not exercise `docs/design/`. It shows that nothing outside the design
  tree broke, and it is not evidence about the screens.
- Tree stability: `git status --porcelain` was empty and `HEAD` was
  `7054030` before and after the verify run. The only file I wrote is this
  report.
- A scan of `docs/design` and `docs/DESIGN.md` for stale claims and for the
  logout cooldown sentence (`attempts? remaining`, `installation-wide`, "To
  sign in as someone else", the removed `otherUsername` cache, "Waiting here
  keeps your draft"). The only attempt-count hits are the two in the rejected
  Paper direction, as in every round. The cooldown sentence now appears in
  exactly three places: its inventory row (`SCREEN-INVENTORY.md:1100`), the
  fixture (`shell.js:44`), and the fixed-form check (`design012.cjs:49`).
- Read the whole round-3 diff: `DESIGN.md`, `SCREEN-INVENTORY.md`, `shell.js`,
  `design012.cjs` and the task file. I traced every caller of
  `logoutCooldown()` and every path that writes `#manager` in `shell.js`.

**Did not run.**

- **No browser run.** Browser runs are the owner's to approve, and none was
  approved for this review. The designer reports `design012.cjs` at **272
  checks**, 52 states, with no errors and no failures. I have not reproduced
  that. What I say below about fixture behaviour comes from reading the code.
- No mutation run.

**About the Handoff.** As in round 2, the dispatch asked me to update the
task file's Handoff. The reviewer role (`.agent/roles/reviewer.md`) says to
write only this report and never to edit the task file, and I followed the
role. The Handoff's last line is already `DONE`, written by designer15b in
its *Round 3* section.

## 4. Cleared

### Round 3

- **R2-1 (logout cooldown sentence keyed to the displayed account): closed.**
  - The inventory row (`SCREEN-INVENTORY.md:1100`) and the Handoff's copy
    table now trigger the sentence only on logout from the fixed-username
    form, key the wait to the idled account, and say "from the other-manager
    form append nothing, even if either account has a wait". DESIGN.md says
    the same.
  - In the fixture, `logoutCooldown()` computes
    `reauthRequired && !other ? remaining(idled) : 0` and empties the text
    when there is no wait (`shell.js:42-45`). I traced its two callers:
    - `askLogoutOrLeave()` runs before any `render()`, so `other` still
      describes the form the user left.
    - The once-a-second `cooldown()` tick, running in the other form,
      recomputes to zero and leaves the note hidden.

    The value that hid the wrong state in round 2, a lookup keyed on
    whatever username was in `#manager`, is gone from this path.
  - The checks cover both scenarios from round 2: the idled account cooling
    down, and the submitted account cooling down (`design012.cjs`, the two
    "other-manager logout omits" assertions).
  - The discard confirmation itself keeps its existing wording ("Log out and
    discard your changes?") when opened from the other form. My round-2
    report left that wording to the designer, and the lead's ruling made it
    optional. The plain confirmation promises neither disposal nor recovery,
    so it stays within the ruling. Whether "your changes" should read
    differently for the person at the desk is worth noting for slice B. It is
    not a defect against this task.
- **R2-2 (prefilled and remembered username): closed.**
  - `render()` now sets the editable Username to empty whenever the form is
    entered from outside it (`shell.js:57`).
  - Back clears both fields (`:138`), and nothing caches the last username
    typed. The inventory row and the copy table both say the field starts
    empty and that `r.ayu` is only a typed sample.
  - Deep links to the other form's response states open the empty form
    first, then fill `r.ayu` as a typed sample (`:150-153`). The fixture no
    longer suggests a starting value.
  - Account waits are still kept per normalised username, so typing a locked
    username again restores its remaining wait. That matches BO-01's
    username-editing rule.

### Rounds 1 and 2, re-confirmed at this head

- **POS-01:**
  - no attempt count;
  - no *permission-denied*;
  - the session-ended copy claims only that the session ended;
  - a short PIN is stopped exactly where the shared schema stops it;
  - both general states are present;
  - the incident confirmation goes to `incidents.html`.
- **M-1:** one refusal that does not tell a cashier's PIN from an unknown
  one, and no count.
- **M-6:**
  - the other-manager choice is present and keyboard-reachable, including
    during the idled account's cooldown, as `.agent/DECISIONS.md:113` (the
    2026-10-06 refinement) requires;
  - an acknowledgement comes first, with initial focus on staying;
  - the other form sends an ordinary sign-in, counted on the submitted
    account;
  - Back keeps the draft and the waits;
  - Log out is kept;
  - no passage cites the ruling for a Log-out-only route.
- **BO-01:**
  - local checks are exactly the shared schema: non-empty, and at most 256
    and 1024 UTF-16 units (`packages/contracts/src/auth.ts:26-31`);
  - the throttled title names the username's scope, and the editing rule
    matches the server's normalisation;
  - the retained-draft sentence is deferred and not placed in Phase 0.
- **Requests that carry no secret** (lookup, back-office logout, POS
  release) each have a row. Release follows ARCH-014 question 5. The logout
  row cannot loop, because the server's logout route answers 204 to any
  session (`apps/server/src/http/routes/back-office-auth.ts:81-87`).
- **Duration:** zero parts are omitted, and zero ends the cooldown.
- **SITEMAP `:108`** names no cause.
- **Scope:** no new token, value, route or contract change in any round. Only
  owned design paths and the task file are touched.

## Open, not findings

The two owner questions the lead raised on 2026-10-14 are still unanswered.

1. When a different manager signs in from M-6, is the idled manager's draft
   destroyed or kept for them?
2. After the eight hours, does the same manager signing in again get the
   draft back?

Both are listed in the inventory and in the Handoff's round-2 *Questions*.
No sentence in the delivery promises either answer.

PHASE0-011d can place everything here without them: Phase 0's content pane
holds no draft. The next task that designs draft retention or recovery needs
the answers first.
