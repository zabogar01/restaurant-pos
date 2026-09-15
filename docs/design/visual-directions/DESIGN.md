---
name: Restaurant POS — Paper and Frost
description: Two proposed light visual directions for the confirmed restaurant POS interface.
colors:
  paper: "#fffcf6"
  frost-canvas: "#fafafa"
  elevated: "#ffffff"
  text: "#032125"
  muted: "#354d51"
  border: "#ebebeb"
  control-border: "#718487"
  primary: "#0b363b"
  selected-paper: "#eafde8"
  selected-frost: "#032125"
  group-paper: "#f0f4f1"
  group-frost: "#e2f4ff"
  destructive: "#9b352c"
  destructive-soft: "#fff2ee"
  emergency: "#a12622"
  warning: "#83611c"
  warning-surface: "#fff5da"
  focus: "#abffae"
  unavailable: "#ebebeb"
  unavailable-text: "#60696b"
typography:
  body-pos:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.45
  body-office:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  title:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: 30px
    fontWeight: 500
    letterSpacing: -0.4px
rounded:
  flat: 0px
  surface: 2px
  button: 9999px
spacing:
  s1: 4px
  s2: 8px
  s3: 12px
  s4: 16px
  s5: 20px
  s6: 24px
  s8: 32px
  s10: 40px
  s12: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.elevated}"
    rounded: "{rounded.button}"
    padding: 0px 16px
    height: 72px
  button-destructive:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.button}"
    height: 72px
  menu-tile:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: 12px
    width: 150px
    height: 96px
---

# Restaurant POS — light visual directions

## Overview

**Two proposals for comparison, not an approved production design system.** Open [the comparison gallery](index.html) to switch between all six screens and their existing states.

Both iterations translate the supplied Customer.io reference—spruce ink on cream paper, calm sans typography, flat surfaces, narrow corners and pill actions—into the confirmed POS and back-office wireframes. They share layout and behavior. Paper emphasizes warm surfaces and quiet selection; Frost emphasizes white surfaces and stronger selection contrast.

| Iteration | Visual emphasis | Where to begin |
|---|---|---|
| Paper | Cream canvas, white working panels, pale green selection, spruce actions | [Order](paper/pos/order.html?state=linecontrols) · [Settlement](paper/pos/settlement.html?state=card) · [Lock](paper/pos/lock.html?state=incident) · [Incidents](paper/pos/incidents.html) · [Menu](paper/back-office/menu.html) · [Report](paper/back-office/report-detail.html) |
| Frost | White navigation, light neutral canvas, pale blue grouping, solid spruce selection | [Order](frost/pos/order.html?state=linecontrols) · [Settlement](frost/pos/settlement.html?state=card) · [Lock](frost/pos/lock.html?state=incident) · [Incidents](frost/pos/incidents.html) · [Menu](frost/back-office/menu.html) · [Report](frost/back-office/report-detail.html) |

**Light only in this delivery.** Warm light supports the requested first review and legibility in a lit restaurant; white working panels support desk reconciliation. A dim-floor dark version needs its own reviewed contrast and incident treatment. Neither iteration contains a theme toggle or promises a dark implementation.

The mockups contain illustrative fixtures, not application code, a backend, configured menu seed data or a working POS. Existing inert wireframe controls remain inert. The gallery is a review tool outside the product frame. Links to screens outside these six open the original wireframes.

## Colors

The colors below are roles, with exact values. [visual.css](visual.css) contains the matching custom properties.

| Role | Paper | Frost | Application |
|---|---|---|---|
| Surface | `#fffcf6` | `#fafafa` | Main canvas; Frost navigation is white and its lock canvas remains cream |
| Elevated surface | `#ffffff` | `#ffffff` | Working panels, tiles, tables, overlays |
| Text | `#032125` | `#032125` | Primary text and figures |
| Muted text | `#354d51` | `#354d51` | Secondary descriptions and labels |
| Divider border | `#ebebeb` | `#ebebeb` | Quiet structural rules, 1px |
| Control border | `#718487` | `#718487` | Visible input/tile/button edges, 1px |
| Primary action | `#0b363b` / white | Same | Commit actions; hover fill `#032125` |
| Selection | `#eafde8` / `#032125` | `#032125` / white | Selected category, navigation, payment method and item tile |
| Grouping surface | `#f0f4f1` | `#e2f4ff` | Fired-round headings and table headers; Frost also highlights totals |
| Pending group | `#eafde8` / `#032125` | Same | Existing pending-round header |
| Destructive action | `#9b352c` | Same | Outline/text for remove and void; filled at final destructive action |
| Destructive hover | `#fff2ee` | Same | Outline action hover; filled action hover `#822b24` |
| **Emergency** | **`#a12622` / white** | Same | Solid kitchen-incident field and locked-screen presence banner |
| Emergency secondary text | `#fff2ee` | Same | Supporting text on emergency red |
| **Warning** | **`#83611c` on `#fff5da`** | Same | Receipt warning text/border on a pale amber field |
| Focus accent | `#abffae` | Same | Outer focus ring; paired with a dark outline |
| Unavailable surface/text | `#ebebeb` / `#60696b` | Same | Tile remains legible and fixed in position; dashed `#90999a` border |
| Disabled control | `#ebebeb` / `#60696b` | Same | Dashed `#c2c8c9` border; no enabled action |

Reference adaptations are deliberate. Pale spruce `#a1c2c6` is not body text on a light background; the darker muted role carries reading. The reference gives conflicting green versus spruce primary-fill advice: these mockups use its explicit spruce filled-action treatment and reserve bright green for focus. Emergency red is a necessary semantic extension; the amber warning role adapts the reference's mustard. Neither alert relies on color alone: solid coverage, size, wording and recovery-control prominence reinforce urgency.

## Typography

**Both applications use `"Helvetica Neue", Helvetica, Arial, sans-serif`.** Helvetica Neue is an explicitly permitted reference substitute. Saans was not supplied; it is neither bundled nor claimed. The reference's variable 475 weight is adapted to available 400 regular, 500 medium and 600 semibold. No rendered text uses 700 after the final correction.

All figures use `font-variant-numeric: tabular-nums lining-nums`. There is no separate monospace face. Default line-height is **1.45**; tags use **1.3**, report explanatory text **1.5**. Most tracking is normal; POS title tracking is **−0.2px**, the 30px headings **−0.4px**, navigation section labels **0.04em**, table headers **0.06em**, and regular tags **0.025em**. Round headings and their tags use no extra tracking.

| Size | Actual use |
|---|---|
| 10px | Compact tags, including round action/restriction labels |
| 11px | Round headings, table column labels, back-office navigation section labels |
| 12px | Item modifiers, field labels, secondary totals, report notes, smaller office actions |
| 13px | POS actor labels, compact POS actions, report figures and office top bar |
| 14px | Back-office body and menu data, POS totals and notices |
| 15px | POS body, menu tiles/prices, order lines, standard POS buttons |
| 16px | Order-panel heading and selected fixture labels |
| 17px | Kitchen incident title inside the detailed incident block |
| 18px | Overlay headings, report section titles, emergency-banner title |
| 20px | POS page title and back-office app title; base numeric fields |
| 22px | Change-due figure and existing emphasized fixture values |
| 24px | Order total |
| 26px | PIN/numeric keys and tender amount |
| 30px | Lock headline and back-office Items headline |
| 32px | Settlement balance |

Weight 400 carries reading; 500 carries item names, actions and headings; 600 carries emphasis, selected navigation, and report reconciliation totals. The applications differ in density rather than type identity. Small tags supplement larger context; they are not a model for making future critical text smaller.

**Currency:** whole IDR, period thousands grouping, no fractional digits. Currency is labeled at the total, price column or report context rather than repeated before every aligned figure. The sample `165.000 − 16.500 + 7.425 = 155.925` includes `13.500` tax within the price. A split is `100.000 + 55.925`; `200.000` cash yields `44.075` change. These are illustrative mockup values. A blank position replaces the irrelevant decimal key without rearranging the keypad.

## Layout

| Surface | Dimensions and retained structure |
|---|---|
| POS | **1280×800** landscape; 64px header; 172px category rail; four 150px tile columns; 460px running-order panel |
| Menu grid | 12px outside padding; 8px gaps; 150×96px tiles remain in fixed slots |
| Settlement | 560px left reconciliation panel; persistent tender panel on the right; closing control remains at the bottom. The existing amount/keypad region scrolls when a long error message uses its height, keeping every full-size key reachable. |
| Back office | **1440px wide**; 220px navigation; 64px top bar; 24px content padding; two report columns with 16px gap |
| Report | About 946px of document height at the specified width; vertical scrolling in the 900px review window keeps the full report accessible |

Spacing scale: **4, 8, 12, 16, 20, 24, 32, 40, 48px**. The existing **10px keypad gap** is an explicit retained exception. Order rows use **10px 16px** padding; order totals and action regions use **12px 16px**; report cards use **20px**; overlay bodies use **20px**. Marketing-reference 96px section gaps and 1200px max-width are not applied to these fixed operating surfaces.

POS target sizes below are logical pixels at actual size, before the gallery scales the preview. The gallery's fit scale does not redefine product touch targets.

| Target | Delivered size |
|---|---|
| Primary / standard action | 72px high; existing width retained |
| Compact POS action | 48px high |
| Payment-method / Add action | 56px high |
| Menu tile | 150×96px |
| Category row | 172×72px region |
| Pending-line remove | **56×56px** |
| Reserved fired/void/locked slot | **56×56px**, empty, not a target |
| Lock-screen PIN key | **88×88px** |
| Tender numeric key | **88×72px** |
| Manager approval key | **72×72px** |

The inherited small inline text links are retained as wireframe affordances; this visual proposal does not certify them for production touch use. Device testing should assess them without moving or combining actions.

## Elevation & Depth

Flat surfaces use 1px rules and color changes, with **no drop shadows or motion**. The overlay scrim is **`rgb(0 25 28 / 38%)`**. Overlays use a 1px spruce boundary; the item sheet leaves the order readable.

Keyboard focus uses **`outline: 2px solid #0b363b; outline-offset: 2px; box-shadow: 0 0 0 6px #abffae`**. The dark outline provides the visible boundary on light surfaces; the outer green is emphasis. Text selection uses `#abffae` with `#032125` text. Scrollbar thumb color is `#a1c2c6` on transparent track.

## Shapes

Radius scale: **0px** for structural bands, **2px** for surfaces/tiles/fields/overlays/tags, **9999px** for pill action buttons. The pending remove control stays a **2px** square. PIN dots remain **20px circles** with a 1px border; the small warning marker remains circular. These semantic indicators are exceptions to rectangular surface corners.

## Components

| Component | Presentation and states |
|---|---|
| Primary button | Spruce fill, white 500-weight label, 1px matching border, pill radius, 72px POS height. Hover deepens to `#032125`. Disabled uses the neutral disabled treatment. |
| Destructive button | White fill, `#9b352c` text/border. Final destructive action may fill red with white text. Ordinary cancel/back is not automatically destructive. Pending remove retains its separate square slot. |
| Menu tile — available | White, 1px control border, 2px corners, 12px padding. Name and price remain in their original locations. |
| Menu tile — selected | Paper pale green with spruce text; Frost spruce with white text; spruce border. Existing item-configuration fixture carries selected styling, and hover provides the same feedback. |
| Menu tile — unavailable | Grey background/text, dashed border and 86 tag. Same 150×96px box and grid position, never removed or reflowed. |
| Order line — pending | White, readable name/modifiers/quantity/amount; 56px remove control at the trailing edge. One-tap removal remains the existing fixture action. |
| Order line — fired | Same reading hierarchy, trailing 56px slot completely empty. Existing row action reaches the reason/approval path; the slot gains no substitute icon. |
| Order line — voided | `#fafafa` surface; name and amount struck through in `#60696b`; empty trailing slot; inert. |
| Locked order | Rows retain normal reading contrast. No row actions or remove controls; every trailing slot is empty. Menu and category rail are absent. Group labels retain distinct “FINISH PAYMENT FIRST” and “ANOTHER CLIENT” reasons. |
| Fire-round group | 32px band; 11px text and 10px supplementary tag. Fired groups use the iteration's group tint; pending groups use pale green. Meaning appears once per group, never as repeated line badges. |
| Tender amount — prefilled | 56px field, 26px tabular number, 1px spruce border. Pale green in Paper, pale blue in Frost. Existing “already filled in” wording reinforces that the amount is present and replaceable. |
| Tender amount — keyed | Same geometry; white surface with 2px spruce border and existing “KEYED BY HAND” label. No split toggle or separate split page. Numeric interaction is represented by existing fixture states, not implemented input logic. |
| Overlay | White, 2px radius, 1px spruce boundary, no shadow. Manager dialog is 560px wide over the triggering screen. Item sheet occupies the left region and leaves the 460px order panel visible. It is not an added page. |
| PIN key | Flat 2px rectangle, 1px control border, 26px number. Paper keys are white; Frost keys are cream. Continue is spruce with a drawn arrow. The incident CTA focuses the existing PIN panel before its Continue fixture opens detail. |
| Data-table row | White surface; 14px body, medium item name, right-aligned tabular price; 15px 12px cell padding and a 1px divider. Compact overflow fixture uses 9px 12px. Headers use 11px text, 12px padding and group tint. |
| Report numeric groups | 13px tabular figures, 12px column gaps, right-aligned values. Gross/reversal/net remain separate. Semibold totals and rules provide emphasis without replacing any number with a chart. |
| Emergency banner / incident | Solid `#a12622`, white text; 80px minimum presence banner and 18px heading. Detailed incidents use a large solid block with prominent 72px reprint action. Locked presence contains no table, round, amount or order detail. |
| Receipt warning | `#fff5da` background, `#83611c` text and 1px border; smaller marker and 48px recovery action. It never inherits the emergency's solid red field. |
| Selected navigation | Paper pale green/spruce; Frost spruce/white. Both preserve selected foreground and background during hover. |

## Do's and Don'ts

- **Do** keep kitchen emergencies and receipt warnings distinct in coverage, size and color.
- **Do** preserve the reserved trailing slot and the unavailable tile's exact coordinates.
- **Do** keep prices, balances and report columns legible, using whole IDR and tabular figures.
- **Do** retain the separate POS/back-office navigation and existing overlays.
- **Don't** convert these fixture links into a claim of implemented PIN security, payment processing or printer behavior.
- **Don't** add a kitchen screen, a split mode, motion, or new navigation to demonstrate this direction.
- **Don't** treat this specification as human approval of either iteration.

Handoff: the twelve HTML files, [shared visual tokens](visual.css), [comparison gallery](index.html) and this document are the proposal. [REVIEW.md](REVIEW.md) records the independent visual review and its limits. Two sentence-final currency corrections and the error-panel overflow correction followed that review and were checked by the main agent. The original wireframe files were verified unchanged. The owner next needs to choose or steer Paper/Frost; later implementation must preserve the confirmed behavior and pass the repository's implementation gate. Physical touch, dim-floor, assistive-technology and real-device checks remain unperformed. The documenter subagent stopped at its usage limit, so the final specification was extracted and completed by the main agent.
