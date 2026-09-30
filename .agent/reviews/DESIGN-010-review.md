# DESIGN-010 review

**Reviewer:** Claude (Opus 5.5), reviewing the designer's work (Codex `gpt-6-astra`).
**Date:** 2026-09-30.
**Reviewed branch:** `agent/design-010` at `e2c92c8f12b315151736bf099bd95381e642a28a`.
**Base:** `development` at `b0f7de4210c45539209d971da698deaee442cf46`, which is also the merge base.
**Task:** `.agent/tasks/DESIGN-010-closed-order-tokens-and-fixture.md`.

## 1. Verdict

**findings**: two low-severity findings, and no finding against the money behaviour the task exists to correct. The two tokens are registered with exactly the ruled values, the two files agree, the stand-ins are gone, and every refund state now derives its allocation from the selected order's own tenders. Both findings concern how the change is described or scoped. Neither shows a wrong tender or a wrong sum.

One limit applies to the whole report. In this session I could not execute the fixture: inline `node -e` needs approval that an unattended run cannot give, writing a script outside the worktree was refused, and Playwright is not installed in the worktree. Everything I say about the rendered states below comes from a line-by-line trace of `closed.js`, not from a browser or JSDOM run. Section 3 separates what I observed from what I inferred.

## 2. Findings

### F1 — Low: `docs/DESIGN.md` still describes every source-shaped token as a value read at its cited location, and its count is now wrong

**Location:** `docs/DESIGN.md:3` (frontmatter `description`) and `docs/DESIGN.md:486–496` (the *Tokens* paragraph), read with the two new registry entries at `docs/design/tokens/frost.tokens.json:1926–1946`.

**What is wrong.** The *Tokens* paragraph says that "168 tokens were read from a reviewed artifact and carry `source` with a path, line, selector, property and the authored value", and the frontmatter says "168 tokens trace to a reviewed Frost artifact". Before this task the registry held 172 entries (168 source-shaped and 4 designed), so both statements were true. It now holds 174. I counted 174 entries in the JSON, 174 declarations in `frost.css` and 4 `"source": null`, which leaves 170 source-shaped entries. Both statements are therefore stale.

The two new entries also do not fit the paragraph's description of the source shape. Every other source-shaped entry cites a location where its value can be read. For `--frost-focus-ring`, for example, the authored value `0 0 0 6px var(--focus)` resolves to the registered value. The two new entries cite `closed.css:12` and `closed.css:17`, whose authored values are `var(--frost-closed-list-columns)` and `var(--frost-allocation-field-width)`. Each is the token referring to itself, so neither 88/172/180px nor 180px can be read at the cited location. The values' real lineage is not recorded anywhere in the registry or in `DESIGN.md`. They were first authored in DESIGN-009 round 1 at commit `06f3a25`, `closed.css:12` and `:17`, through the borrowed tokens `--frost-pin-key-height` (88px), `--frost-category-width` (172px) and `--frost-receipt-reprint-width` (180px). The DESIGN-009 supplement at `DESIGN.md:1075` also calls these artifacts "design fixtures awaiting review", while the source shape is defined as "read from a reviewed artifact".

**Authority.** The task's Part A item 2 requires provenance that "follows `docs/DESIGN.md`'s rule, one shape per token, never mixed", and the rule at `DESIGN.md:488–496` defines what a source-shaped entry asserts. The designer followed the task's instruction to cite the consuming artifact, and I do not dispute that choice. The issue is that the document stating the rule was not updated to match what the registry now contains.

**Failing scenario.** F4e, or a later token audit, follows `frost.tokens.json` → `--frost-closed-list-columns` → `closed.css:12` to confirm where 88px came from. It finds only `var(--frost-closed-list-columns)`, a circular reference, and `DESIGN.md` says there are 168 such entries when there are 170.

**Proposed fix (designer-owned files; the lead decides whether it is worth a cycle).** In `DESIGN.md:3` and `:489`, change 168 to 170. After the sentence ending "and the authored value" at `:490`, add: "Two of them, `--frost-closed-list-columns` and `--frost-allocation-field-width`, were registered by DESIGN-010 after the fact. Their source cites the declaration that consumes them, so the authored value there is the token itself; the values were first authored in DESIGN-009 round 1 (`06f3a25`, `closed.css:12` and `:17`) and approved by the lead's ruling on round 2's question 4." Optionally, record the same origin in the DESIGN-009 supplement at `:1078–1079`, which currently says only "first authored in DESIGN-009".

### F2 — Low: the named state `refund-error-cash` lets `order=` replace its subject

**Location:** `docs/design/visual-directions/frost/pos/closed.js:90`.

**What is wrong.** `selected` is computed as `params.get('order') || (requested==='refund-error-cash'?'cash':null) || …`. An explicit `order=` parameter therefore overrides the named example. `closed-order.html?state=refund-error-cash&order=default` renders the split sale, and `…&order=quick` renders the quick sale, while the gallery chip labelled "Cash-only refund failed · AC-25" is highlighted (`mockup.js:54–56` marks the chip from `state=` alone). This is the shape the review method warns about: one value (`order=`) takes precedence across all states and hides the one state whose whole meaning is a fixed subject.

**Authority.** Part B item 3 of the task asks for a cash-only failure example, and Part B item 1 says an incompatible `order=` "must not change the state's subject". That sentence is written for restricted states, but the named example exists only to picture a fixed subject, so the same reasoning applies.

**Failing scenario.** A builder writing the F4e failure-recovery test copies a URL from a note or history that still carries `order=default`, opens `?state=refund-error-cash&order=default`, sees Card 100.000 · Cash 55.925 under the cash-only label, and takes the wrong expectation. No generated link produces this combination: the state chips drop `order=`, and no artifact links to `refund-error-cash`. Only a hand-edited URL reaches it, which is why the severity is low.

**Proposed fix.** Give the named state precedence: `const selected=requested==='refund-error-cash'?'cash':params.get('order')||(…existing map…)`. Alternatively, keep the current behaviour and say in the Handoff and the DESIGN-009 supplement that `order=` overrides it.

## 3. What I ran and what I did not

### Observed

- `git status --porcelain` was empty before I started and again after my green verify run. HEAD remained `e2c92c8` throughout. The tree did not move. This report is the only file I wrote.
- `npm run verify`: typecheck passed (`tsc` for server, money and pos), and Vitest reported **32 test files passed, 2256 tests passed**. The designer's Handoff says verify could not run in their session (`tsc: command not found`). It runs in this worktree now, and the result matches the task's expectation that adding two custom properties changes no test. `packages/tokens/test/tokens.test.ts` checks only the re-export and that the package declares no property of its own, so the two additions cannot affect it.
- `git diff --stat development...agent/design-010` lists ten files. Seven are the designer's, in commit `87e2da3`. `.agent/STATE.md` and `.agent/journal/2026-09-30.md` come from the lead's wrap-up commits `d18bfc8` and `f5c9622`, which are on this branch but not on `development`, and the task file comes from the lead's `2f97b1f` and `e2c92c8`. The lead should expect those two lead commits to travel with this branch when it merges.
- Registry: both entries have exactly `88px 172px minmax(0,1fr) 180px` and `180px` in `frost.tokens.json` and `frost.css`. They are appended last in both files, consistent with insertion-order generation. JSON and CSS both hold 174 tokens. Both use the source-object shape with no `designed` block. Their cited lines are correct: `closed.css:12` is the `.co-listhead,.co-row` rule, and `closed.css:17` holds `.co-allocation .co-field{width:…}`.
- `closed.css`: the list stand-in `minmax(0,1fr) minmax(0,1fr) minmax(0,3fr) minmax(0,1fr)` and `repeat(2,minmax(0,1fr))` are both gone (read in the diff). `grep -c -E "[0-9]px"` returned 0. `grep -c -E "#[0-9a-fA-F]{3}|rgb|hsl|font-weight: ?[0-9]"` returned 0. The only new `--frost-*` references in the diff are the two new tokens, and both are defined. I did not re-enumerate the other references in the file; the DESIGN-009 review established all 84 as defined, and the diff adds no other.
- `grep -r "prototype/" docs/design/visual-directions/frost/pos` returned nothing.
- `refund-error-cash` is declared in `closed-order.html` and in `manifest.js` at the same position, between `refund-error` and `day-refusal`. Both pages declare `utf-8`, so the literal `·` in the new label, where neighbours use `·`, renders the same.
- `mockup.js:53–57` builds every state chip as `?state=<id>` only, so the gallery and state bar never carry `order=` into a state.

### Inferred by tracing `closed.js`, not executed

I traced `defaults()` (`closed.js:98`) and the edit block (`:102–113`) for each of the six states against the fixture rows at `:14–19`. The trace agrees with every one of the 30 cells in the Handoff's table, including the long order, which falls back to `rows[0]` but takes its allocation from `[['Card',1559250]]`. In particular:

- Tender names always come from `order.tenders`, or from the long order's single Card, in their original order and with repeated names kept. No edit adds or removes a row, so O1 holds by construction.
- Multi-tender `sheet-edited`, `refund-error` and `day-refusal` move `min(first row, 20.000)` from the first row to the last. `sheet-zero` and multi-tender `approval-edited` move the whole first row to the last. All of these preserve the order total. `sheet-invalid` removes 20.000 from the first row, and `drawSheet` (`:149`) states the shortfall with the order's own total.
- Single-tender `sheet-edited`, `approval-edited`, `refund-error` and `day-refusal` keep the default allocation. `edited()` (`:114`) is then false, so M-1 carries no ALLOCATION EDITED tag. Single-tender `sheet-zero` shows its sole row at 0 with the full shortfall, and Continue is disabled by `difference` (`:151`). The Handoff states both behaviours, as Part B item 1 requires.
- AC-5: `?state=refund-error&order=cash` and `?state=refund-error-cash` both select Table 7. The allocation stays at the default Cash 200.000 − 44.075 = 155.925. *Review refund* (`:127`, `:159`) opens the sheet with one Cash row, and *Continue* opens M-1 reading *Money back: Cash 155.925* with no tag.
- The new guard `!order.zero&&!refunded&&!closedDay` at `:102` leaves F6 gating unchanged, because `refundable()` (`:119`) and the overlay reset (`:118`) are untouched. It also fixes a defect the task did not name: previously `?state=refund-error&order=refunded` (and the other five states with `order=refunded`) listed *Money returned: Card 80.000 · Cash 75.925* for a cash-only refunded order, and it now lists Cash 155.925. That falls within the Handoff's item 3 ("the six refund states when opened with a non-split order").
- `day-refusal` sets `closedDay` only at `:178`, after the edit block has run, so its retained draft is derived correctly and never shown. This matches the Handoff.

### Not run

- No browser or JSDOM run. I did not re-measure 88 / 172 / 752 / 180px, the 180px allocation fields, the 1.559.250 figures, or the `flex:1` outputs. Those numbers are the designer's measurements, not mine. An arithmetic cross-check agrees with them (1280 − 2 × 20 padding − 3 × 16 gap − 440 = 752; with a border-box field, 14px padding and a 1px border, a 180px field has about 150px of content, which comfortably holds `1.559.250` at 20px). By the role's rules that is not a measurement.
- I did not re-run the 160-state link crawl (AC-6). The only new declared state is `refund-error-cash`, and the diff adds no links.
- One caveat on the designer's evidence, for the lead's information and not a finding. Playwright launches headless Chromium with scrollbars hidden, so the measurement "every rendered row 88 / 172 / 752 / 180px" in POS-05 `overflow` was taken without a scrollbar. On a device with classic scrollbars, the rows inside `.co-scroll` lose the scrollbar's width while the header `.co-listhead` outside it does not, so the right-aligned row totals would sit that much left of the *Total* heading. The layout is unchanged from DESIGN-009, which had the same property, and a touch tablet normally uses overlay scrollbars. F4e may want `scrollbar-gutter` or a header inside the scroller.

## 4. Cleared

- **Part A:** both values exactly as ruled; JSON and CSS agree; one shape per token; stand-ins replaced; the amount-filter and allocation-editor outputs keep `flex:1` (`.co-totalrow .co-field` is unchanged, and the width rule is scoped to `.co-allocation .co-field`); the DESIGN-009 supplement no longer says the columns are flexible pending tokens. Subject to F1.
- **Part B:** all six states × {default, cash, custom, quick, long} keep only the order's tenders with the stated sums (traced). F6 gating is unchanged. The cash-only failure example is declared, in the manifest, and reachable from the gallery. Subject to F2.
- **Constraints:** nothing under `apps/`, `packages/` or `db/`; no product document or ADR touched; no other artifact touched; no new value without a token. The appearance changes named in the Handoff match the diff.
- **Boundaries and contract:** O1 to O3 and FR-H5 (original tender types only, exact sum, zero rows not refunded) hold in every derived state; B-23 (full order only) holds because every sheet still refunds the whole order total; B-9 and B-10 hold because closed-day and refunded orders never reach the edit block or a refund control.
- **Verify:** green, with the counts above.
