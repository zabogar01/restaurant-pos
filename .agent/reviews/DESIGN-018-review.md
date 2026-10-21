# DESIGN-018 review — BO-08 Settings and payment methods (Frost)

**Reviewer:** `design018-review`, Claude Opus 5.5, hand-opened under the owner's one-time exception recorded in the task
file (the designer was also Claude Opus). Reviewed on 2026-10-21 at `7fc8c0a` on `agent/design-018`, against
`development` (`git diff development...HEAD`, 16 files). The tree was clean and at the same commit before the verify run
and after the last check.

## 1. Verdict

**findings** — two findings, one medium and one low. Neither changes a rule in the Handoff or in `D`; both are about
what the registered drawings show compared with what the walks and the Handoff say. The rate field, the length guards,
the stale-draft behaviour, the two-forms rule, the payment methods and the Part C changes hold up against ADR-012, C1,
C2, `D` and the cited requirements and boundaries.

## 2. Findings

### F1 (medium) — The version facts line names a version that is no longer in force in the registered `stale`, `stale-reauth` and `unknown-changed` drawings, and the walk shows something else

**Location.** `docs/design/visual-directions/frost/back-office/settings.js:175` (the `stale` branch of
`finishSettings` returns without re-rendering), `:179` (the `unknown-changed` branch, the same), `:147-155` (*Keep my
changes* and *Use current settings* do not re-render), and `:443` and `:467` (the direct-state block calls
`finishSettings` and then only `renderOpeners()`). `#version-facts` is written only in `renderSettings`
(`settings.js:63`).

**What is wrong.** The lead's verify note asks about this line. The `#version-facts` text comes from `current`, the
settings this page last read or was answered. `finishSettings` rereads (`settings.js:168`), so `current` becomes
version 5. But neither the stale branch nor the unknown-with-newer-version branch re-renders, so the line keeps the
text written when the form opened: "Version 4 · In force since 12 Oct 2026, 14:05 · Saved by M. Iqbal". The notice
under it says that version 5 is now in force. The two paths then disagree:

- **Interactive walk** (Save → *Save new rates* → the fixture answers `stale`): `finish()` calls `renderAll()` after
  `finishSettings` (`settings.js:298`), so the line reads "Version 5 · In force since 21 Oct 2026, 14:32 · Saved by
  Ratna Ayu", the same version the notice names.
- **Registered state** (`?state=stale`, `stale-reauth`, `unknown-changed`): the line reads Version 4, which
  contradicts the notice. These are the drawings the gallery shows, the reviewer screenshots, and the builder copies.
- **After *Keep my changes*, starting from a registered state:** the notice says "Your changes now build on version 5"
  while the line still says Version 4. It corrects itself only on the next `renderAll`, for example when Save sends.

**Which reading is honest (the lead's question).** The line says "In force since", so it can only honestly name the
current version, the one last read. The Handoff's copy table (the row *Settings part / Version facts*) withholds the
line when the reread fails, and the new `D` rule says why: "withhold the version facts (nothing may claim to be
current)". Both treat the line as a claim about what is current. Under that reading:

- In `stale`, naming version 5 is honest. The notice already explains that the draft was built on an older version,
  and the "Now in force" lines show what differs.
- In `unknown-changed`, version 5 "Saved by M. Iqbal" is honest. It states who saved the record, not that this save
  succeeded, and the notice says only "It may be this save".
- After *Keep my changes*, the in-force version and the base version are the same (5), so the line agrees with the
  notice.

Reading the line as "the version the draft builds on" is not honest in any of the three states. In `stale` and
`unknown-changed`, version 4 is not in force "since 12 Oct", and after *Keep* the draft no longer builds on version 4
either. So the interactive walk is right and the registered drawings are wrong. Nothing in the Handoff says which
version the line names while a draft is stale, so a builder copying the `stale` drawing would build the wrong one.

**Authority.** ADR-012 rule 2: the current version is the highest number, and `created_at` is kept "for display ('in
force since')". The line therefore names the current version. `D` *Configuration forms — DESIGN-018 additions*, the
unknown-outcome rule: the version facts are withheld when "nothing may claim to be current", which treats the line as
a claim of currency. `D` *Configuration forms — DESIGN-017*, *Command results*: "never claim it is current" where the
page has not established it. ADR-011 rule 24 makes the builder copy the drawing, which is why the drawing must be
right.

**Failing scenario.** Open `settings.html?state=stale` at 1440×900. The facts line reads "Version 4 · In force since
12 Oct 2026, 14:05 · Saved by M. Iqbal". The notice directly below reads "Nothing was saved. Version 5 was saved by
Ratna Ayu on 21 Oct 2026, 14:32, after you started." The lead saw this in the `stale` screenshot. `design018.cjs`
asserts the notice text in its stale walk (`design018.cjs:113`) and the facts line only in `saved`, `first-run` and
`unknown-read-failed` (`:99`, `:105`, `:133`). Nothing asserts the facts line in `stale`, `stale-reauth`,
`unknown-changed` or after *Keep*, so the suite stays green with the two paths disagreeing.

**Proposed fix.**

1. In `settings.js`, re-render the settings part whenever `current` changes while the form stays open: call
   `renderAll()` (or just the facts line) at the end of `showStale`, and in the *Keep my changes* and *Use current
   settings* handlers. The registered states then match the walk.
2. Add one sentence to the Handoff's copy-table row for the facts line, and to `D`'s stale-draft rule: "The facts line
   always names the version most recently read or answered, the one in force, never the version the draft builds on.
   In the stale and unknown-with-newer-version states it names the newer version, as the notice does."
3. In `design018.cjs`, assert that the facts line starts with "Version 5" in the registered `stale`, `stale-reauth` and
   `unknown-changed` states, in the walk at `:113`, and after *Keep my changes*. The check should be red against the
   current file (it is, by the trace above) and green after step 1.

### F2 (low) — The registered state "Settings changed — after M-6" does not go through M-6

**Location.** `settings.html:5` and `manifest.js` register `['stale-reauth','Settings changed — after M-6']`.
`settings.js:443` draws it as `otherSave(ME)` followed by an ordinary stale answer.

**What is wrong.** The task (Part A item 1) asks for the stale-draft refusal "once from an ordinary save and once
**after M-6**", reachable by `?state=`, and acceptance criterion 4 asks for both to be shown. The `stale-reauth`
drawing does not involve M-6: it is the ordinary stale state with version 5 saved by M. Iqbal, which is the
same-manager-in-another-tab variant the Handoff mentions. The after-M-6 walk itself (edit, idle expiry, another
manager saves, resume, Save, refusal with the draft kept) exists only in `design018.cjs:120-124`. A reviewer opening
the gallery state labelled "after M-6" sees a different scenario under that label. ADR-012 *Consequences* expects the
after-M-6 case to be the common one, and most often another manager will have saved.

**Authority.** The task file, Part A item 1 and acceptance criterion 1 (every Part A state reachable by `?state=` and
registered). DESIGN-011 P1 (subject-correct drawings: a state shows what its label says).

**Failing scenario.** Open the gallery, choose "Settings changed — after M-6". The screen shows no sign of a resumed
session, and the notice names M. Iqbal, the signed-in manager, as the saver. The ordinary `stale` state shows the
after-M-6 composition more faithfully than the state carrying that label.

**Proposed fix.** Either relabel `stale-reauth` to what it draws ("Settings changed — saved by you in another tab")
and add a registered state that runs the after-M-6 walk in its direct-state block (open the form, `expire('idle')`,
`otherSave()`, `resume(true)`, submit), or make `stale-reauth` itself run that walk with another manager as the saver
and keep the same-manager copy as a note in the Handoff. The composition does not change; only what the label points
at does.

## 3. What I ran and what I did not

**Observed.**

- `npm run verify` at `7fc8c0a`: typecheck green; **104 test files, 3,934 tests passed**. Nothing under `apps/`,
  `packages/`, `db/`, `e2e/` or `docs/design/tokens/` changed, so this confirms that nothing outside `docs/` moved; it
  does not test the artifact.
- `git status --porcelain` was empty and `git rev-parse HEAD` returned `7fc8c0ae9fcef196bba33c2687c815fc54b407e4`,
  both before verify and after my last check. The tree did not move.
- `git diff --stat development...HEAD`: 16 files, all inside `docs/design/**`, `docs/DESIGN.md` or the task file.
- I read `F/settings.html`, `settings.css`, `settings.js` and `design018.cjs` in full, along with the diffs of
  `office.js`, `menu.html`, `report-detail.html`, `tables.html`, `manifest.js`, `index.html`, `design014.cjs`, `D`,
  `I` and `S`, and I grepped `P/settings.html` for the removed and added text.

**Inferred from reading the code, not observed in a browser.** F1's two paths come from tracing `settings.js`, as noted
at each line cited. The lead's screenshot of `stale` (Version 4 in the facts line) agrees with the direct-state trace.
I did not see the interactive walk's Version 5 rendered; it follows from `finish()` calling `renderAll()` at
`settings.js:298`. As instructed, I launched no browser and ran none of the design check scripts. For those, the lead's
verify note is my evidence: `design018.cjs` 702/702 and slices A, B, C, I and E1 passing. I made no mutation run and I
edited no file other than this report.

**Not checked.** Pixel measurements and screenshots (the Handoff's tables and the lead's runs are the only evidence),
the Impeccable detector output, and visual contrast.

## 4. Cleared

- **The rate field against `rateFromPercent`.** `parseRate` (`settings.js:42-53`) matches the Handoff's table and the
  check's accept/refuse vectors. The normalisation it describes (`,` to `.`, leading zeros dropped, an empty whole part
  becomes `0`, an empty fraction is dropped) produces exactly the shape `rateFromPercent`'s regex accepts
  (`packages/money/src/index.ts:25`). Refusing `10.00000` "as typed" is stricter than `rateFromPercent`, which strips
  trailing zeros, and that is a deliberate, documented client rule. The upper bound is checked after conversion, as
  `rateFromPercent` has none. No float is used. Zero is accepted and nothing is pre-filled at the first run (owner Q2;
  FR-M5; ADR-012 rule 7).
- **Lengths and charsets** match C1 §1.1, except the two documented departures (phone adds `/`, NPWPD has no charset),
  each with a reason, as the task allows. Control characters are checked with `\p{Cc}`, with the line feed exempt for
  the address only (ADR-012 rule 8). A phone number with a control character is refused by its charset, so no separate
  message is needed.
- **Currency and precision** (owner Q5; FR-B1; FR-M1; ADR-012 rule 5): plain `dt`/`dd` text in the read view, the form
  and the first run. They are not an input and have no Change action, and they are withheld while the read is loading
  or has failed. The check asserts that no input matches them in all 128 state/viewport combinations.
- **First run** (ADR-012 rule 1; B-24): no version, empty fields, the first save creates version 1 with no
  confirmation, and Cancel leads to a plain *Enter settings*.
- **The confirmation** (FR-B1; B-8; B-9): names each changed rate from and to, says that only orders opened afterwards
  are affected and that closed orders and day reports never change, and offers no "apply to open orders" option.
  Leaving it out for detail-only saves is argued in the Handoff, and the form's standing context sentence carries the
  same rule.
- **`SETTINGS_CHANGED` and unknown outcomes** (ADR-012 rule 3; ADR-011 rule 20; C2 §6): nothing is resent. The base
  version moves only on success, unchanged, or the manager's explicit choice. Save is disabled with a visible reason
  until the manager chooses. "It may be this save" never claims success. After a failed reread, Try again repeats the
  read only.
- **Unchanged** (ADR-012 rule 4) is told apart by the answered version number, which ADR-012 rule 15 guarantees the
  answer carries.
- **Two forms and one command per screen**: consistent with `D`'s command rule and C2 §6, and the departure copy stays
  BO-05's verbatim. Log out and the rail stay live (DESIGN-012 F1). The rate confirmation and the departure decision
  follow `D`'s working-area rule under M-6 and BO-01. No `beforeunload` prompt.
- **Payment methods** (FR-B7; C2 §4 and §8; owner OQ1): cash and card are fixed rows with no controls. Each custom row
  carries `{ name, active }` only. `DUPLICATE` is handled for create, rename and reactivation, with the holder marked;
  renaming an inactive method stays inactive; no refusal is drawn for a custom name equal to Cash or Card; there is no
  tendering refusal. F4's wording change is argued and offered to BO-05 as a follow-up, not applied to it.
- **B-3 and B-4** (one tax rate, tax-inclusive, service charge untaxed, no tax groups); **B-13** (a real name in "Saved
  by" and in the top bar); **B-1** (no float).
- **Part C.** Settings resolves to Frost in `office.js` and in the two authored links. `design014.cjs` changes only
  its two expected counts (35→34, 6→5), which match the removed lines. `I` and `S` BO-08 follow the rulings. The
  wireframe points to Frost and no longer shows precision 2 or the lock.
- **Part B.** The `D` additions are labelled behaviour or BO-08 copy, and no existing rule is altered.
