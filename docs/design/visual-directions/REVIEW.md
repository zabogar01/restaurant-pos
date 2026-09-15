# Visual direction finish review

## Disposition

**Ship for visual comparison.** Both material findings below were corrected and independently rechecked. No rebuild or further visual correction is indicated. This is a review of six screens in each light direction, not approval of a design system or application readiness.

Reviewed against [the direction brief](../VISUAL-DIRECTION-BRIEF.md), the supplied Customer.io reference, the existing behavioral fixtures, and the Impeccable craft floor. Evidence includes the 34 full-size PNG captures and four contact sheets in [the review directory](../../../.impeccable/review/pos-light/), source inspection, and a browser check of the selected navigation hover state.

## Material findings with evidence

1. **Resolved — Frost selected back-office navigation lost contrast on hover.** Initial browser verification on Menu produced white text on `rgb(226, 244, 255)` after hover. The selected-hover rule now preserves both colors. Independent browser recheck on Menu and Reports returned white text on `rgb(3, 33, 37)` during hover. This issue was absent from resting screenshots.
2. **Resolved — the lock-screen incident fixture bypassed its depicted PIN step.** The inherited “Sign in to view” link led straight to incident details. Independent browser recheck in both directions confirms that it now stays on the lock screen at `#pin-entry`, with that panel focused; the existing Continue fixture links to incidents. This depicts the PIN step without implementing authentication.

No further material visual defect was found in the inspected screenshots. The supplied [layout scan](../../../.impeccable/review/pos-light/layout-scan.json) records 34 captures with no measured text-width clipping or page JavaScript errors. The builder's [verification record](../../../.impeccable/review/pos-light/verification.json), read during this review, covers 146 fixture states with no reported errors. This is scoped evidence, not a general accessibility or behavior certification.

## Contract coverage

| Requirement | Evidence and assessment |
|---|---|
| Six screens, two light iterations | Paper and Frost each provide order, settlement, lock/PIN, print incidents, menu administration, and stored report detail. Both contact-main sheets show all six. |
| Established geometry | POS captures are 1280×800; back-office captures are 1440px wide. Category rail, order panel, persistent tender panel, navigation and action placement remain recognizable and unchanged in structure. |
| Pending, fired and void lines | `*-pos-order-linecontrols.png` shows the 56px pending remove target and empty fired trailing slots. `*-pos-order-overflow.png` shows a readable struck-through void line with an empty trailing slot. |
| Locked order states | `*-pos-order-lock-draft.png` and `*-pos-order-lock-lease.png` retain legible order content, omit menu/category controls and removal affordances, and show distinct explanations and recovery actions. Disabled actions remain readable. |
| Unavailable and counter states | `*-pos-order-eightysix.png` keeps the unavailable tile grey in its original place. `*-pos-order-quick.png` has the existing settle action and no separate fire action. |
| Emergency versus receipt warning | `*-pos-incidents-default.png` gives kitchen failure a solid red surface and prominent recovery action; receipts use a pale amber surface and smaller action. The distinction also uses text and placement. |
| Privacy and approval presentation | `*-pos-lock-incident.png` reveals the existence of a kitchen problem without order details. `*-pos-order-approval.png` retains the manager PIN overlay over the current task. Corrected lock fixture navigation was independently rechecked. |
| Money and tender presentation | IDR groups are labeled, figures use zero decimals and aligned numerals. `*-pos-settlement-card.png` shows the balance prefilled; cardsplit, exactsplit, change and zero captures show the existing alternatives without introducing a split mode. |
| Reference translation | Cream/white Paper and blue/white Frost use spruce text/actions, flat 2px surfaces and pill buttons. Frost’s stronger selected fills make it visibly distinct while preserving the same workflow. |

## Accepted tradeoffs

- The pinned product geometry takes precedence over marketing layout conventions and generic craft-detector recommendations. The menu grid, report panels, navigation sections and modal topology are retained deliberately.
- The pre-correction detector’s 259 findings include repeated small tags, tight label leading, edge-aligned layout wrappers, cream surfaces and the chosen fallback font. They do not establish 259 independent defects. Round labels were raised from 9px to 10px in the final pass. The smallest tags supplement larger readable labels; their actual terminal legibility should be revisited during hardware trials.
- Helvetica Neue is an explicitly permitted substitute. The deliverable makes no claim to contain Saans. No photography, decorative illustration, dark theme or motion is needed for this brief.
- Report detail reaches about 946px high at 1440px wide. The brief fixes back-office width, not height; ordinary vertical scrolling is appropriate and content remains accessible.

## Remaining limitations

- These are query-state fixtures. PIN verification, payment processing, persistence, printing and live locking are not implemented or certified by this review. Existing inert wireframe controls remain outside scope.
- Screenshot review covers the twelve primary compositions and the listed stress states. It is not exhaustive keyboard, screen-reader, touch-hardware, browser or responsive testing.
- The review does not approve the product’s monetary arithmetic or resolve outstanding product/architecture gates. Neither visual direction becomes binding until the owner chooses it.
- The final order and lock captures were inspected after the correction batch; they retain the intended composition. The hover correction was verified in a browser because resting screenshots cannot prove it.
