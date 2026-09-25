# DESIGN-008 — Floor and print incidents, independent design review

**Verdict: request changes. Two P2 findings.** The incident cards have separate reprint results, the cancellation remains visibly a correction, and the Clear buttons use focusable `aria-disabled` controls. Floor navigation still loses the selected order's identity, and the new quick-sale entry opens a populated order.

Reviewer: Codex (`design-reviewer4`). Date: 2026-09-25. Read the DESIGN-008 task and both handoffs, the uncommitted diff and new floor source, SCREEN-INVENTORY POS-02/POS-07, PRD, and BOUNDARIES. This is a source review; I did not independently run a browser or rely on the designer's temporary measurements as proof of 1280×800 geometry. I edited only this report and made no commit.

## Findings, most severe first

### 1. P2 — Three occupied tables open Table 1's order

**Location:** `docs/design/visual-directions/frost/pos/floor.html:62,64,67,89,91,94`.

Table 7 advertises payment in progress, 382.725 total and 155.925 outstanding; Table 9 advertises one fired round and five items; Table 12 is a separate open table. All three links go to `order.html?state=default`, whose heading and order contents identify Table 1. This is one shared result for distinct occupied controls. A cashier selecting Table 7, 9, or 12 is shown a different table and amount. The Round 2 handoff acknowledges the fixture gap, but the task requires an occupied tile to open *that* order, and POS-02/FR-D1 make this the floor's central action.

**Fix:** Provide matching, named POS-03 fixture states for those occupied tables, or limit the floor's selectable occupied examples to orders with matching existing states. Keep each tile's identity, amount, and progress consistent with its destination. Record any necessary POS-03 scope change in the handoff.

### 2. P2 — “New quick sale” opens a sale that already has lines

**Location:** `docs/design/visual-directions/frost/pos/floor.html:51`; `docs/design/visual-directions/frost/pos/order.html:216–230`.

The floor's New quick sale link goes to `order.html?state=quick`. That fixture already shows Burger and Soda order lines, so the result of the create action is a pre-existing sale. The handoff names this gap, but FR-D2 and the task require the entry to open a quick-sale order, and the visible result contradicts “New.” The same destination is used across every floor state, including the no-tables state.

**Fix:** Give the creation entry an empty quick-sale fixture that keeps the existing quick-sale behavior and no fire control. Keep the populated `quick` fixture for continuing an existing order, with a distinct entry if needed.

## Review notes

- The accepted lead rulings are reflected: there is no open-table confirmation, no open table is marked deactivated, and clearing audit remains an explicit owner question rather than a claimed rule.
- The five reprint actions target separate `data-result` boxes within their own incident cards. The cancellation card says stop work and never labels its reprint a fire. Receipt results have no kitchen instruction. `reprint-printed` is explicitly labeled as a server-confirmed answer; ordinary reprints say only “Reprint sent.”
- All three kitchen Clear controls are native buttons with `aria-disabled="true"`, remain in tab order, and have a click guard while off. Receipt Dismiss is a separate, always available action. The diff names the altered incident states and the floor destinations in the handoff.
- Source inspection confirms the floor grid has a scroll container and token-sized tiles. The designer reports a 1280×800 browser measurement for all 21 states, but I did not independently verify clipping or physical touch behavior. No link to a nonexistent named state was found in the reviewed floor and incident destinations.
