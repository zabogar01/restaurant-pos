# DESIGN-006 — POS-04 settlement, independent design review

**Verdict: request changes. Three P2 findings and one P3 finding.** A1–A3, A5, and B2–B6 are drawn with correct figures and the required visible states. A4 has the PIN composition but lacks a distinct acknowledgement before PIN entry. B1's zero and pending composition is valid, including its Burger fixture. Shared navigation still drops the pending order or shows the wrong cancel draft count.

Reviewer: Codex (`design-reviewer2`). Date: 2026-09-24. Reviewed the uncommitted `git diff` on `agent/design-direction`, plus new `frost-settlement.css` and `DESIGN-006-settlement-corrections.md`. Read the task, designer handoff, and lead measurement as claims. Applied `docs/BOUNDARIES.md` and `docs/PRD.md` from `../restaurant-pos/docs/`, then `docs/design/SCREEN-INVENTORY.md` POS-04 (including **Must not invent**), `docs/DESIGN.md` and the Frost registry, the task, and the handoff.

## Findings, most severe first

### 1. P2 — Switching tender method loses the pending order and its close guard

**Locations:** `docs/design/visual-directions/frost/pos/settlement.html:91–95,186–191,230–241,301–308`; the state switch in `docs/design/visual-directions/mockup.js:5–24`.

In **`pending`**, the screen correctly shows Steak, total/balance/prefill **382.725**, and an inert Close. Its shared **Card** link goes to `?state=card`, which displays the baseline **155.925** with no pending notice. Add card then goes to `exact`, whose Close is live. The same Card link from **`pending-paid`** discards its 382.725 draft and pending guard. Method links from the changed-order **`error*`** states and the large-order **`ceiling-single`** state similarly reset to the baseline. These are fixture links, not evidence of a server-side close, but they make the task's pending and correction walks untruthful when followed.

**Authority:** PRD FR-G10 forbids closing a table order with a PENDING line; FR-G9 and B-20 require the draft to survive a correction without partial state. SCREEN-INVENTORY POS-04 requires the changed order's balance and a refused Close until exact settlement. DESIGN-006 A2/B2 require the Steak figures and guard to persist.

**Recommended correction:** preserve order, draft, and pending/rejection context when a method is selected. Draw the needed method variant or make a fixture link inert with clear status until it has a truthful destination. Check every shared method link from all 34 states.

### 2. P2 — Shared Cancel link shows the wrong draft count and background

**Locations:** `docs/design/visual-directions/frost/pos/settlement.html:116–168,174–177,341–359`.

Only `empty` and `exactsplit` route to their matching cancel fixtures. **`pending`**, **`cashsplit`**, **`ceiling-single`**, and **`zero-pending`** have zero drafts but reach `cancel`, whose background shows Card 155.925 and says **one** line will be discarded. **`error-partial`**, **`exactcashsplit`**, and **`change-mixed`** have two drafts but also reach that one-line modal. **`overflow`** shows six drafts and likewise reaches it; `cancel-multi` is fixed at two. This is the task's shared-control shape defect in an unchanged part of the artifact.

**Authority:** DESIGN-006 B4 calls for the 0, 1, and 2+ draft cases; PRD FR-G9 and SCREEN-INVENTORY POS-04 make the drafted lines client-side state that the cancel decision must describe accurately. The task's shape check requires examining every state.

**Recommended correction:** route Cancel from every state to a modal that keeps its actual draft list and count, including zero and overflow, and make Keep collecting return to that same source state. A count-parametrized fixture is also acceptable if the displayed draft and links remain truthful.

### 3. P2 — Takeover lacks a separate acknowledgement before PIN entry

**Locations:** `docs/design/visual-directions/frost/pos/settlement.html:379–407`; `docs/design/SCREEN-INVENTORY.md:337–340`.

In **`takeover`**, the warning says that entering a PIN and continuing acknowledges the external-charge risk. The only advancing control is the PIN pad's **Continue**, which also executes the takeover fixture. The earlier explicit **“I understand — take over”** control is gone. The manager can therefore enter the PIN and submit without a distinct acknowledgement step before PIN entry. The audit requirement makes the precise action and its identified actor material; the caption alone cannot establish which warning was accepted.

**Authority:** PRD FR-G14 requires acknowledgement *before* takeover, FR-J3 audits the takeover, and B-13 identifies the actor. DESIGN-006 A4 specifically places the external-charge acknowledgement before PIN. SCREEN-INVENTORY POS-04 says manager takeover requires acknowledging the possible external charge.

**Recommended correction:** require an explicit **I understand** action after the warning and before enabling PIN entry; then Continue submits the PIN for that one takeover. The takeover audit can record the identified actor and outcome without recording any PIN value (B-12). Keep the existing twelve-key PIN composition.

### 4. P3 — Pending notice points to a locked order without the release step

**Locations:** `docs/design/visual-directions/frost/pos/settlement.html:91–95,198–200,335`; `docs/design/SCREEN-INVENTORY.md:315–325`.

The shared notice in **`pending`**, **`pending-paid`**, and **`zero-pending`** tells the cashier to send or void the pending item by leaving payment. Its **Back to the order** link goes to `order.html?state=lock-draft`, where those edits remain blocked. In the zero-draft states, that lock label also implies a draft that does not exist. The new sentence **“payment in progress blocks both”** is factually broad enough, but the adjacent action does not complete the instruction it gives.

**Authority:** PRD FR-G12–G13 block fire and void during a draft or CheckoutLease and permit the holder to release its own lease; FR-G10 still blocks close until the pending line is resolved. SCREEN-INVENTORY POS-04 treats Cancel payment as the ungated release action and distinguishes the draft from the lease.

**Recommended correction:** explain that the cashier must cancel/release settlement before editing the order; in `pending-paid`, say that cancel discards the cash draft. Link that instruction to the matching cancel state or another truthful release path. Preserve the pending notice after method changes.

## Lead's three questions

1. **Burger in `zero-pending`: accept.** PRD FR-G10–G11 and SCREEN-INVENTORY POS-04 specify the PENDING guard and zero-total behavior, not the item identity. The Frost POS-03 `zero` composition uses a 165.000 subtotal with Burger and Soda, so a pending Burger is internally coherent after a 100% comp. The code's Steak/405.000 fixture is a different valid zero-total example; the lead should choose one example before asking code and design to match, but this does not make the design arithmetic wrong.
2. **Changed pending notice wording: accept the sentence, correct its route as finding 4.** “Payment in progress blocks both” holds for the active lease even with no tender draft (PRD FR-G13), whereas “a draft blocks both” was false in `zero-pending`. PRD FR-G12–G13 and SCREEN-INVENTORY POS-04 still require a usable release path and accurate draft/lease explanation.
3. **Takeover acknowledgement folded into Continue: reject.** FR-G14 calls for acknowledgement before takeover, and FR-J3 makes the identified takeover action auditable. A warning caption plus a generic Continue does not provide the explicit, prior acknowledgement required by DESIGN-006 A4; see finding 3.

## Rules and claims cleared

- **A1:** accepted the lead's Chrome measurement: 29 tender-pad states show eleven 88×72 controls, both active PIN modals show twelve 72×72 controls, and the named notices and fields are unclipped at 1280×800. I did not repeat that measurement.
- **A2–A3, A5:** `pending` and `pending-paid` consistently show Steak's 382.725 total; Leave payment targets `lock-draft`; `ceiling-single` shows the binding 99.999.999 single-tender cap, invalid 100.000.000 field, correct notice and inert Add. **A4** clears only for masked dots and the complete PIN keypad; acknowledgement remains open.
- **B1–B6 as named drawings:** zero plus pending notice and inert Close; pending paid at zero with its own Close name and `aria-describedby`; partial-error notice at 27.800, cleared at settlement and absent after removal; zero/one/two-draft cancel modal snapshots; cash split caption and two cash rows; mixed tender revenue sentence. Findings 1–2 concern reachability and cross-state truth, not absence of those snapshots.
- **Independent arithmetic, whole IDR and half-up:** baseline 165.000 − 16.500 = 148.500, service 7.425, total 155.925, tax 148.500/11 = 13.500. Steak order 405.000 − 40.500 = 364.500, service 18.225, total 382.725, tax 364.500/11 → 33.136. Error order 205.000 − 20.500 = 184.500, service 9.225, total 193.725, tax 184.500/11 → 16.773; 193.725 − 155.925 − 10.000 = 27.800. Large order 100.000.000 − 10.000.000 = 90.000.000, service 4.500.000, total 94.500.000, tax 90.000.000/11 → 8.181.818. Zero comp makes net/service/tax/total zero. Cash maxima are min(55.925 + 9.999.999, 99.999.999) = 10.055.924 and min(94.500.000 + 9.999.999, 99.999.999) = 99.999.999. Card 100.000 + Cash 100.000 − change 44.075 = revenue 155.925. No arithmetic discrepancy found.
- `visual.css`, `structure.css`, `frost-states.css`, and the Frost token registry are unchanged. The new sheet uses existing Frost dimensions, spacing, colors, and keyed/invalid treatments; no new token or unmarked designed value was found. `git diff --check` passed.
- The HTML declares **34 states**: 21 existing plus 13 added. SCREEN-INVENTORY and SITEMAP both say 34; the additions stay within POS-04's existing screen and overlay nodes, so the published **7 POS / 13 back-office / 6 modal** counts remain honest under DESIGN-002's state-versus-node precedent.

## Verification and limits

I read every state's shared value/control groups and followed the relevant fixture hrefs against the state switcher. I recomputed all order variants with integer/Decimal half-up arithmetic. I did not run a new browser geometry pass, operate a physical touch device or screen reader, or test the POS implementation/server. Fixture navigation demonstrates the drawing's behavior only; it does not prove a live money write or lease takeover. I edited only this report and made no commit.
