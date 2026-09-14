---
name: Restaurant POS — Frost
description: The Frost light direction, chosen 2026-09-14, stated as values an implementation can consume. 168 tokens trace to a reviewed Frost artifact; four (pressed ring, invalid, invalid border, round-tag size) were designed under DESIGN-005, are marked designed in the registry and here, and await review.
colors:
  surface: "#fafafa"
  elevated: "#ffffff"
  text: "#032125"
  muted: "#354d51"
  border: "#ebebeb"
  control-border: "#718487"
  primary: "#0b363b"
  primary-text: "#ffffff"
  primary-hover: "#032125"
  selected: "#032125"
  selected-text: "#ffffff"
  group: "#e2f4ff"
  pending-surface: "#eafde8"
  pending-text: "#032125"
  destructive: "#9b352c"
  destructive-soft: "#fff2ee"
  destructive-hover: "#822b24"
  emergency: "#a12622"
  emergency-text: "#ffffff"
  emergency-secondary: "#fff2ee"
  warning: "#83611c"
  warning-surface: "#fff5da"
  focus: "#abffae"
  unavailable: "#ebebeb"
  unavailable-text: "#60696b"
  unavailable-border: "#90999a"
  unavailable-tag-surface: "#60696b"
  disabled-border: "#c2c8c9"
  void-surface: "#fafafa"
  lock-surface: "#fffcf6"
  key-surface: "#fffcf6"
  key-continue: "#032125"
  invalid: "#83611c"
typography:
  body-pos:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  body-office:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  title:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "20px"
    fontWeight: 500
    letterSpacing: "-0.2px"
  headline:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "30px"
    fontWeight: 500
    letterSpacing: "-0.4px"
  overlay-heading:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "18px"
    fontWeight: 500
  group-label:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0"
  table-header:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.06em"
  overlay-heading-office:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "16px"
    fontWeight: 500
  body-office-modal:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  tag:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.025em"
  round-tag:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0"
  field-message:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "12px"
    fontWeight: 400
  key:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "26px"
    fontWeight: 400
  figure-total:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "24px"
    fontWeight: 500
  figure-balance:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "32px"
    fontWeight: 600
rounded:
  flat: "0"
  surface: "2px"
  button: "9999px"
  indicator: "50%"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "20px"
  s6: "24px"
  s8: "32px"
  s10: "40px"
  s12: "48px"
  keypad-gap: "10px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "72px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-text}"
  button-secondary:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "72px"
  button-secondary-hover:
    backgroundColor: "{colors.group}"
    textColor: "{colors.text}"
  button-compact:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "48px"
  button-destructive:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "72px"
  button-destructive-hover:
    backgroundColor: "{colors.destructive-soft}"
    textColor: "{colors.destructive}"
  button-destructive-final:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "72px"
  button-destructive-final-hover:
    backgroundColor: "{colors.destructive-hover}"
    textColor: "{colors.primary-text}"
  button-disabled:
    backgroundColor: "{colors.unavailable}"
    textColor: "{colors.unavailable-text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "72px"
  button-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "56px"
  button-office:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 14px"
    height: "36px"
  button-office-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.button}"
    padding: "0 14px"
    height: "36px"
  button-office-small:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 9px"
    height: "28px"
  menu-tile:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "12px"
    width: "150px"
    height: "96px"
  menu-tile-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-text}"
    rounded: "{rounded.surface}"
    padding: "12px"
    width: "150px"
    height: "96px"
  menu-tile-unavailable:
    backgroundColor: "{colors.unavailable}"
    textColor: "{colors.unavailable-text}"
    rounded: "{rounded.surface}"
    padding: "12px"
    width: "150px"
    height: "96px"
  category-row:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.flat}"
    padding: "0 16px"
    width: "172px"
    height: "72px"
  category-row-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-text}"
    rounded: "{rounded.flat}"
    padding: "0 16px"
    width: "172px"
    height: "72px"
  order-line:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.flat}"
    padding: "10px 16px"
  order-line-void:
    backgroundColor: "{colors.void-surface}"
    textColor: "{colors.unavailable-text}"
    rounded: "{rounded.flat}"
    padding: "10px 16px"
  order-line-remove:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.surface}"
    width: "56px"
    height: "56px"
  order-line-remove-hover:
    backgroundColor: "{colors.destructive-soft}"
    textColor: "{colors.destructive}"
  round-header:
    backgroundColor: "{colors.group}"
    textColor: "{colors.muted}"
    typography: "{typography.group-label}"
    rounded: "{rounded.flat}"
    padding: "0 16px"
    height: "32px"
  round-header-pending:
    backgroundColor: "{colors.pending-surface}"
    textColor: "{colors.pending-text}"
    typography: "{typography.group-label}"
    rounded: "{rounded.flat}"
    padding: "0 16px"
    height: "32px"
  pin-key:
    backgroundColor: "{colors.key-surface}"
    textColor: "{colors.text}"
    typography: "{typography.key}"
    rounded: "{rounded.surface}"
    width: "88px"
    height: "88px"
  pin-key-continue:
    backgroundColor: "{colors.key-continue}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.surface}"
    width: "88px"
    height: "88px"
  tender-key:
    backgroundColor: "{colors.key-surface}"
    textColor: "{colors.text}"
    typography: "{typography.key}"
    rounded: "{rounded.surface}"
    width: "88px"
    height: "72px"
  approval-key:
    backgroundColor: "{colors.key-surface}"
    textColor: "{colors.text}"
    typography: "{typography.key}"
    rounded: "{rounded.surface}"
    width: "72px"
    height: "72px"
  amount-field-prefilled:
    backgroundColor: "{colors.group}"
    textColor: "{colors.text}"
    typography: "{typography.key}"
    rounded: "{rounded.surface}"
    padding: "0 14px"
    height: "56px"
  amount-field-keyed:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    typography: "{typography.key}"
    rounded: "{rounded.surface}"
    padding: "0 13px"
    height: "56px"
  field:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "0 14px"
    height: "56px"
  field-small:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "0 14px"
    height: "40px"
  field-invalid:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "0 14px 0 13px"
    height: "56px"
  field-small-invalid:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "0 14px 0 13px"
    height: "40px"
  field-message:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.invalid}"
    typography: "{typography.field-message}"
    rounded: "{rounded.flat}"
    padding: "4px 0 0"
  modal:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    typography: "{typography.body-pos}"
    rounded: "{rounded.surface}"
    padding: "20px"
    width: "560px"
  modal-office:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    typography: "{typography.body-office-modal}"
    rounded: "{rounded.surface}"
    padding: "20px"
    width: "640px"
  data-table-header:
    backgroundColor: "{colors.group}"
    textColor: "{colors.muted}"
    typography: "{typography.table-header}"
    rounded: "{rounded.flat}"
    padding: "12px 12px"
  data-table-row:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    typography: "{typography.body-office}"
    rounded: "{rounded.flat}"
    padding: "15px 12px"
  data-table-row-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  data-table-row-tight:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    typography: "{typography.body-office}"
    rounded: "{rounded.flat}"
    padding: "9px 12px"
  card:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "20px"
  incident-emergency:
    backgroundColor: "{colors.emergency}"
    textColor: "{colors.emergency-text}"
    rounded: "{rounded.surface}"
    padding: "16px"
  incident-warning:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning}"
    rounded: "{rounded.surface}"
    padding: "12px"
  emergency-banner:
    backgroundColor: "{colors.emergency}"
    textColor: "{colors.emergency-text}"
    rounded: "{rounded.flat}"
    padding: "12px 20px"
  warning-chip:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning}"
    rounded: "{rounded.surface}"
    padding: "4px 10px"
  tag:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    typography: "{typography.tag}"
    rounded: "{rounded.surface}"
    padding: "2px 5px"
  tag-solid:
    backgroundColor: "{colors.group}"
    textColor: "{colors.text}"
    typography: "{typography.tag}"
    rounded: "{rounded.surface}"
    padding: "2px 5px"
  tag-86:
    backgroundColor: "{colors.unavailable-tag-surface}"
    textColor: "{colors.primary-text}"
    typography: "{typography.tag}"
    rounded: "{rounded.surface}"
    padding: "2px 5px"
  nav-item:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    typography: "{typography.body-office}"
    rounded: "{rounded.flat}"
    padding: "10px 24px"
  nav-item-hover:
    backgroundColor: "{colors.group}"
    textColor: "{colors.text}"
  nav-item-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-text}"
    typography: "{typography.body-office}"
    rounded: "{rounded.flat}"
    padding: "10px 24px"
  notice:
    backgroundColor: "{colors.group}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "12px 16px"
  notice-soft:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "12px 16px"
  empty-state:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.surface}"
    padding: "40px"
---

# Design System: Restaurant POS — Frost

**Status.** Frost is the product's visual direction, chosen by the owner on
2026-09-14 from the two light directions built under
[DESIGN-001](../.agent/tasks/DESIGN-001-external-visual-direction.md). This
document converts that direction into values. It carries no visual authority
of its own: every value below was read from a Frost artifact — **except the
four designed under DESIGN-005**, which are marked as designed at every
mention — and the token files under [design/tokens/](design/tokens/) record
the exact file, line, selector and property each read value came from, and
`source: null` for the four that were not read anywhere.

**Sources, in order of authority.** Plus one that is not a source at all,
listed last so it cannot be mistaken for one.

1. `docs/design/visual-directions/visual.css` — the reviewed Frost stylesheet,
   scoped as `html[data-direction="frost"]` over a shared `:root`.
2. `docs/design/visual-directions/structure.css` — the geometry the direction
   was styled over. It is byte-identical to the behavioral wireframe's
   `prototype/wireframe.css`, so every size here is also the wireframe's size.
3. The six Frost screens under `docs/design/visual-directions/frost/` and
   `mockup.js`, for the handful of values authored inline.
4. `docs/design/visual-directions/DESIGN.md` — the comparison document's
   frontmatter and prose. Where it disagrees with the stylesheet, the
   stylesheet wins, because the stylesheet is what was reviewed. Each
   disagreement is listed in the DESIGN-003 conversion note.
5. `docs/design/visual-directions/frost-states.css` — **designed, not
   reviewed.** Three states the Frost artifacts do not contain (pressed on
   touch, field invalid, the round-heading tag at a legible size), designed
   under [DESIGN-005](../.agent/tasks/DESIGN-005-a7-three-missing-states.md)
   on 2026-09-14 and awaiting `design-reviewer`. The Frost fixtures load it
   after `visual.css`, which stays byte-identical to what was reviewed.

**Tokens.** `docs/design/tokens/frost.tokens.json` is the registry;
`docs/design/tokens/frost.css` is generated from it. Every `--frost-*` name in
this document exists in both under that name. **Two provenance shapes, never
mixed.** 168 tokens were read from a reviewed artifact and carry `source`
with a path, line, selector, property and the authored value. Four were
designed under DESIGN-005 — `--frost-pressed-ring`, `--frost-invalid`,
`--frost-invalid-border`, `--frost-round-tag-size` — and carry `source: null`
and a `designed` block naming the task, the date, the author, the review
status, the stylesheet that holds the rule, the fixture states that show it,
and why. A designed token never cites a file and line as if it had been read
there; a null is the honest answer. The frontmatter above is the
same values in the portable DESIGN.md schema, for tools that read it. That
schema has no *minimum* height, so the order line (72px minimum) and the
emergency banner (80px minimum) carry no `height` there at all; the minimums
are stated in Layout and Components and in the registry. A fixed height on
either would clip a long item name or shrink the banner's coverage.

**Completeness, stated honestly.** This system is complete for the six
reviewed screens: every value they use is here, read from the artifacts. For **Phase 0's two client
shells** it now also carries the pressed/active touch state and the field
invalid state they need — designed under DESIGN-005, shown in the fixtures,
and **not yet reviewed**: an implementation may apply them, and `A7` closes
when `design-reviewer` passes them. The portable frontmatter above cannot
express the pressed ring (its schema has no stroke or shadow field), so that
state exists only as the token, the stylesheet rule and the prose in
*Elevation & Depth*. The list at the end says what else is inherited,
unreviewed, or absent.

**What this document does not decide.** Behavior, structure and copy belong to
[design/SITEMAP.md](design/SITEMAP.md) and
[design/SCREEN-INVENTORY.md](design/SCREEN-INVENTORY.md). Anything the Frost
artifacts do not contain is listed at the end under
*Open — not present in the Frost artifacts* rather than filled in.

## Overview

**Creative North Star: "Spruce ink on paper"**

The direction translates the owner's Customer.io reference — spruce ink, calm
sans type, flat surfaces, narrow corners, pill actions — onto an operating
interface whose geometry was already fixed. Frost is the cooler of the two
readings: a light neutral canvas, white chrome for navigation and action
bands, pale blue for grouping, and a solid dark ink for whatever is selected.
It is built for a room, not a screenshot. A cashier reads pending work and a
remaining balance while standing; a manager reconciles unchanged numeric
tables while sitting. Nothing moves, nothing casts a shadow, and colour is
spent almost entirely on state.

Two alerts carry the only saturated colour in the system, and they are
deliberately unequal. A kitchen ticket that did not print is an emergency: a
solid red field with white text, the largest recovery control on the screen.
A receipt that did not print is a customer-service matter: amber text on a
pale amber field with a compact control. They must be tellable apart across
a room without reading a word, and the treatment is sized so they are.

**Key Characteristics:**
- Flat surfaces separated by 1px rules and background changes; no shadows, no
  motion.
- Two corner languages only: 2px on surfaces, full pill on actions.
- Selection is a solid ink fill with white text, never a tint.
- Emergency and warning differ in coverage, size, and hue at once.
- Figures are tabular lining numerals in whole rupiah, aligned right.
- The POS is 15px and 72px-tall; the back office is 14px and 36px-tall. The
  two clients share type identity and differ in density.

## Colors

Cool neutrals, one dark spruce for action and selection, one bright green
reserved for focus, and two alert hues that never share a treatment.

### Primary
- **Spruce** (`--frost-primary`, #0b363b): filled primary actions and their
  1px border, links, overlay boundaries, the keyboard-focus outline, the
  filled PIN dot, and report total figures. Hover on a filled primary deepens
  to **Ink** (`--frost-primary-hover`, #032125). Text on spruce is white
  (`--frost-primary-text`).
- **Ink** (`--frost-selected`, #032125): the selected category, the selected
  navigation item, the selected payment method and the selected menu tile,
  all with white text (`--frost-selected-text`). It is the same value as body
  text; selection in Frost is text colour turned inside out. The Continue key
  on the PIN pad uses it too (`--frost-key-continue`).

### Neutral
- **Canvas** (`--frost-surface`, #fafafa): the POS body, the menu area, the
  category rail's parent, the back-office content area, overlay heads and
  feet, soft notices, empty states, and table row hover.
- **White** (`--frost-elevated`, #ffffff): working panels, tiles, tables,
  cards, buttons at rest, overlays, and — specific to Frost — the POS header,
  the category rail, the action band, the back-office navigation and top bar.
- **Text** (`--frost-text`, #032125): primary text and figures.
- **Muted** (`--frost-muted`, #354d51): secondary descriptions, labels,
  round-group headings, the POS actor, tile prices. Measured contrast on
  canvas is 8.6:1.
- **Divider** (`--frost-border`, #ebebeb): quiet 1px structural rules. It
  reads as a rule, not a stroke, at 1.1:1 against canvas.
- **Control border** (`--frost-control-border`, #718487): the visible 1px
  edge of inputs, tiles, keys, buttons at rest, tags, and the order panel's
  left edge.
- **Grouping** (`--frost-group`, #e2f4ff): fired-round headings, table
  headers, the prefilled tender amount, the grand-total band, solid tags,
  standard notices, and hover on secondary buttons and navigation items.
- **Pending** (`--frost-pending-surface`, #eafde8 with `--frost-pending-text`
  #032125): the pending-round heading only. Shared with Paper; not a Frost
  override.
- **Cream** (`--frost-lock-surface` and `--frost-key-surface`, #fffcf6): the
  lock screen canvas and every numeric key. The one warm surface in Frost.
- **Unavailable** (`--frost-unavailable` #ebebeb, `--frost-unavailable-text`
  #60696b, dashed `--frost-unavailable-border` #90999a): the 86'd tile. The
  86 tag itself is filled `--frost-unavailable-tag-surface` #60696b with
  white text. Struck-through void lines use the same grey text on
  `--frost-void-surface` #fafafa.
- **Disabled control** (`--frost-unavailable` on `--frost-unavailable-text`,
  dashed `--frost-disabled-border` #c2c8c9): a button with no enabled action.

### Destructive
- **Brick** (`--frost-destructive`, #9b352c): text and 1px border of remove
  and void controls on a white fill. Hover fills `--frost-destructive-soft`
  #fff2ee. A *final* destructive action may fill brick with white text; its
  hover is `--frost-destructive-hover` #822b24. Ordinary cancel and back are
  not destructive.

### Emergency and warning — separately
- **Emergency red** (`--frost-emergency`, #a12622, text
  `--frost-emergency-text` white, supporting text `--frost-emergency-secondary`
  #fff2ee): the solid field of a kitchen-ticket incident and the locked-screen
  presence banner. Controls inside it are white with red text.
- **Warning amber** (`--frost-warning`, #83611c on `--frost-warning-surface`
  #fff5da, with a 1px amber border): a receipt-print warning. Text and border
  are amber; the field is pale. Controls inside it are outlined amber on the
  pale field.

**The Two Alarms Rule.** Emergency is a *solid* saturated field with light
text; warning is *dark text on a pale field*. Coverage differs (a red block
versus an amber outline), size differs (an 80px minimum banner with an 18px
title, and a 72px reprint action in the incident block, versus a chip-sized
marker and a 48px action), and hue
differs (red at 7.2:1 against canvas versus amber at 5.2:1 on its own field).
Any one of the three tells them apart; the treatment uses all three. A
receipt warning never inherits the red field, and a kitchen incident is never
reduced to an outline.

**Invalid — designed under DESIGN-005.** A refused field value uses the same
amber as warning under its own name, `--frost-invalid` (#83611c): a 2px
border on a white field and a one-line message beneath it. It is *not* the
receipt warning — the field never takes the pale amber fill, so it is never a
warning chip — and it is not brick, because brick means an action destroys
something and a refused keystroke destroys nothing. Red stays the kitchen's.
5.69:1 on white.

- **Focus** (`--frost-focus`, #abffae): the outer 6px ring of keyboard focus
  and the text-selection background. It appears nowhere else.
- **Scrollbar** (`--frost-scrollbar`, #a1c2c6 thumb on a transparent track):
  the reference's pale spruce, kept off text.

### Measured contrast

Computed from the token values during conversion, not certified by the Frost
review. Text pairs are listed for the reader who has to decide whether a
smaller size is safe.

| Pair | Ratio |
|---|---|
| Text on canvas / on white | 16.1 / 16.8 |
| Muted on canvas / on white / on grouping | 8.6 / 9.0 / 8.0 |
| White on spruce / on ink | 13.1 / 16.8 |
| Brick on white | 7.1 |
| White on emergency red | 7.5 |
| Emergency secondary (#fff2ee) on red | 6.8 |
| Amber on amber surface | 5.2 |
| Unavailable text on unavailable surface | 4.7 |
| White on the 86 tag | 5.6 |
| Control border against white (non-text) | 3.9 |
| Invalid amber on white / on canvas (designed) | 5.7 / 5.5 |
| Invalid 2px border against white (non-text) | 5.7 |
| Pressed ring — ink on white / on cream / on grouping (designed) | 16.8 / 16.4 / 14.9 |
| Pressed ring — white on spruce / on ink / on brick | 13.1 / 16.8 / 7.1 |
| Pressed ring — brick on white (outlined destructive) | 7.1 |
| Round tag at 13px — muted on grouping / ink on pending | 8.0 / 15.8 |

### Inherited mapping inside the six screens

Only six screens were styled and reviewed, and only they load `visual.css`.
The other fourteen wireframes load `wireframe.css`
(`prototype/pos/floor.html:5`) and render greyscale; nothing restyles them.
Within the six, `visual.css` remaps the wireframe's greyscale variables so
that every rule written for the structure sheet renders in Frost's palette
(`visual.css` lines 24–35): `--ink` →
text, `--ink2` and `--ink3` → muted, `--ink4` → #60696b, `--line` → control
border, `--line2` and `--line3` → divider, `--bg` → white, `--bg2` → canvas,
`--bg3` → grouping, `--bg4` → pending, `--bg5` → #a1c2c6. That is how the
skeleton bars, the category modal's text field and the inline fixture rules
get their colour. The mapping is sourced; what it produces was not
individually reviewed. An unstyled screen that later loads `visual.css` will
inherit the same way, and that is a starting point, not a specification.

## Typography

**Family:** `"Helvetica Neue", Helvetica, Arial, sans-serif`
(`--frost-font`) for everything. Helvetica Neue is the explicitly permitted
substitute for the reference's Saans, which the repository does not have and
does not claim. There is no monospace face; figures use
`font-variant-numeric: tabular-nums lining-nums` (`--frost-numeric-variant`)
on the body, so every numeral in every face is tabular.

**Weights:** 400 regular (`--frost-weight-regular`) carries reading; 500
medium (`--frost-weight-medium`) carries item names, actions, headings and
table first columns; 600 semibold (`--frost-weight-semibold`) carries emphasis,
selected navigation, notice titles, the emergency title, and report
reconciliation totals (`--frost-weight-regular`, `-medium`, `-semibold`). No
rendered text uses 700: the stylesheet coerces the fixtures' inline 700 to
600, so the balance, change-due and incident titles that read as bold are
600.

**Character:** plain, even, and quiet. The type does no branding work; the
density of the two clients is the only difference between them.

### Hierarchy

Line height is 1.45 (`--frost-leading-body`) unless stated. POS body is 15px
(`--frost-text-15`); back-office body is 14px (`--frost-text-14`).

| Role | Size | Weight | Tracking | Where |
|---|---|---|---|---|
| Settlement balance | 32px `--frost-text-32` | 600 | normal | The remaining balance on POS-04; its label sits at 18px 400 |
| Lock headline, back-office page headline | 30px `--frost-text-30` | 500 | −0.4px `--frost-tracking-headline` | "Enter PIN"; "Items" |
| Numeric key, tender amount | 26px `--frost-text-26` | 400 | normal | PIN, tender and approval keys; the amount field |
| Order grand total | 24px `--frost-text-24` | 500 | normal | The total band of the order panel |
| Change due | 22px `--frost-text-22` | 600 | normal | Its label at 16px 400 |
| POS page title, back-office app title, base numeric field | 20px `--frost-text-20` | 500 | −0.2px `--frost-tracking-title` on the POS title | Header `h1`; brand block; `.field` |
| Overlay heading, card title, emergency title, report section | 18px `--frost-text-18` | 500; emergency title 600 | normal | Card titles are spruce in Frost |
| Kitchen-incident title inside a detailed block | 17px `--frost-text-17` | 600 | normal | POS-07 only |
| Order-panel heading, back-office modal heading | 16px `--frost-text-16` | 500 | normal | |
| POS body, tile name and price, order line name/quantity/amount, standard buttons | 15px `--frost-text-15` | 400 reading; 500 names, amounts, buttons | normal | |
| Back-office body, table cells, navigation items, POS totals and notices | 14px `--frost-text-14` | 400; first table column 500 | normal | |
| POS actor, compact POS actions, back-office top bar, report figures, page subtitle | 13px `--frost-text-13` | 400; compact actions 500 | normal | Back-office modal body is also 13px |
| Modifiers, field labels, secondary totals, idle chip, report notes, small office actions | 12px `--frost-text-12` | 400 | normal | Report notes at 1.5 `--frost-leading-report-note` |
| Round-group heading, table column header, navigation section label | 11px `--frost-text-11` | 500 | round 0 `--frost-tracking-round`; table 0.06em `--frost-tracking-table` uppercase `--frost-table-head-case`; nav 0.04em `--frost-tracking-nav` | Round headings are sentence case; table headers are uppercase; nav sections are as authored |
| Tag | 10px `--frost-text-10` | 500 | 0.025em `--frost-tracking-tag`, 1.3 `--frost-leading-tag` | Inside a round heading a tag loses its tracking and its border, and is set larger — see the next row |
| Round-heading tag (designed, DESIGN-005) | 13px `--frost-round-tag-size` | 500 | 0, 1.3 | *MANAGER TO VOID*, *REMOVE FREELY*, *FINISH PAYMENT FIRST*, *ANOTHER CLIENT* — the one statement of what a tap on the rows below does |
| Field message (designed, DESIGN-005) | 14px `--frost-text-14`; 13px `--frost-text-13` in a back-office modal | 500 | normal | The one line under an invalid field naming the rule and the limit |

**The Supplement Rule.** The 10px and 11px sizes label things that are
already readable at a larger size beside them — a round heading over 15px
lines, a column header over 14px cells. They are not a licence to set
critical text small. Nothing a cashier must act on is below 13px. The one
exception the Frost screens carried — the 10px `MANAGER TO VOID` tag, the
only visible statement that a fired row opens a PIN-gated path because the
trailing slot is deliberately empty — is closed by DESIGN-005: every tag
inside a round heading is 13px (`--frost-round-tag-size`), so the tag now
outweighs the 11px heading it sits in. That is the right order — the heading
names the group, the tag tells the hand what it may do — and it holds ruling
`I-12` intact: no control enters the slot and the row's affordance is not
state-conditional. Designed, not sourced; awaiting review.

### Money

Whole rupiah, precision 0, period thousands grouping, no fractional digits:
`155.925`, `1.183.500`. Currency is labelled once per monetary group — the
grand-total row reads `Total · Rp`, the menu price column reads `Price · Rp`,
the report top bar carries `· IDR` — and is not repeated before every aligned
figure. Figures are right-aligned in tabular numerals so a column of them can
be reconciled downward. A negative adjustment uses the minus sign: `−16.500`.
On the tender keypad the position a decimal key would occupy is blank, not
removed, so the keypad does not rearrange.

## Layout

Fixed operating surfaces at two device targets. Nothing here is responsive;
the brief fixes the geometry and the direction was reviewed at exactly these
sizes.

**POS — 1280×800 landscape** (`--frost-pos-width`, `--frost-pos-height`).
A 64px header (`--frost-pos-header-height`); a 172px category rail
(`--frost-category-width`) of 72px rows (`--frost-category-height`); a menu
grid of four 150px columns (`--frost-menu-columns`) with 8px gaps
(`--frost-menu-gap`) inside 12px padding (`--frost-menu-padding`), tiles
150×96px (`--frost-tile-height`) in fixed slots; a 460px running-order panel
(`--frost-order-panel-width`) with a 56px head (`--frost-order-head-height`),
32px round-group bands (`--frost-round-height`), lines at a 72px minimum
(`--frost-line-min-height`) with `10px 16px` padding (`--frost-line-padding`)
and 12px internal gap (`--frost-line-gap`), a 28px quantity column
(`--frost-line-quantity-width`), and a 56×56px trailing slot
(`--frost-line-slot-width`, `--frost-line-slot-height`) that grows the line to
76px when it holds a control. Totals and the action band use `12px 16px`
(`--frost-totals-padding`, `--frost-actions-padding`) with an 8px gap between
actions (`--frost-actions-gap`).

**Settlement.** A 560px left summary panel (`--frost-settlement-summary-width`)
holds the totals and the balance; the tender panel is the remaining width on
the right and is persistent, never a sheet. Payment-method and Add actions
are 56px (`--frost-tender-action-height`); the numeric keys are 88×72px
(`--frost-tender-key-height` in the 88px keypad columns); the keypad gap is
10px (`--frost-keypad-gap`), the one retained exception to the spacing scale.
The amount-and-keypad region scrolls when a long error message needs the
height, so no key shrinks.

**Overlays.** The scrim covers the screen (`--frost-scrim`). The manager
dialog is 560px wide (`--frost-modal-width`) over the triggering screen; its
keypad is three 72px columns (`--frost-approval-columns`) of 72px keys
(`--frost-approval-key-height`). The item sheet sits below the 64px header
(`--frost-sheet-top`) and leaves the 460px order panel uncovered
(`--frost-sheet-right`); its head is 64px (`--frost-sheet-header-height`).
Overlay heads and feet use `16px 20px` (`--frost-overlay-head-padding`,
`--frost-overlay-foot-padding`); bodies use 20px
(`--frost-overlay-body-padding`).

**Lock screen.** A 420px centred box (`--frost-lock-box-width`) on the cream
canvas; PIN keys 88×88px in three 88px columns (`--frost-pin-key-height`,
`--frost-pin-columns`); PIN dots 20px (`--frost-pin-dot-size`).

**Back office — 1440 wide** (`--frost-office-width`). A 220px navigation
(`--frost-office-nav-width`) with a 64px brand block
(`--frost-office-header-height`), items at `10px 24px`
(`--frost-nav-item-padding`) and section labels at `20px 24px 6px`
(`--frost-nav-section-padding`); a 64px top bar; 24px content padding
(`--frost-office-content-padding`); cards at 20px (`--frost-card-padding`);
report detail in two columns (`--frost-report-columns`) with a 16px gap
(`--frost-report-column-gap`); the back-office modal 640px
(`--frost-office-modal-width`). The back office has no fixed height: the
review gallery framed it at 900px, that value is not a product limit and no
token carries it; the report reaches about 946px and scrolls.

**Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48px (`--frost-space-1`,
`--frost-space-2`, `--frost-space-3`, `--frost-space-4`, `--frost-space-5`,
`--frost-space-6`, `--frost-space-8`, `--frost-space-10`, `--frost-space-12`). Marketing-scale section gaps and a content
max-width from the reference are not applied; these are fixed frames.

### POS touch targets

Logical pixels at actual size. Identical to the wireframe's, because the
stylesheet the direction was built on is the wireframe's stylesheet.

| Target | Size |
|---|---|
| Primary / standard action | 72px high (`--frost-action-height`); width as laid out |
| Compact POS action | 48px high (`--frost-action-compact-height`) |
| Payment-method / Add action | 56px high (`--frost-tender-action-height`) |
| Menu tile | 150×96px |
| Category row | 172×72px |
| Pending-line remove | 56×56px |
| Reserved fired / void / locked slot | 56×56px, empty, **not a target** |
| Lock-screen PIN key | 88×88px |
| Tender numeric key | 88×72px |
| Manager-approval key | 72×72px |
| Header back link | 48px minimum height, 64px minimum width |

Inline text links inherited from the wireframe are not certified for
production touch use. They are retained as wireframe affordances pending
device testing, and nothing is moved or merged to compensate.

## Elevation & Depth

No shadows (`--frost-overlay-shadow: none`) and no motion. Depth is carried by
1px rules and by background steps: canvas, white, grouping. The order panel
stands off the menu by a 1px control-border rule on its left; the totals block
by a 1px control-border rule on its top; everything else by divider rules.
Overlays sit on a scrim of `rgb(0 25 28 / 38%)` (`--frost-scrim`) and are
bounded by a 1px spruce line (`--frost-overlay-border`), not a shadow.

**Strokes:** `--frost-control-stroke` (1px #718487) for anything a hand or a
cursor acts on; `--frost-divider-stroke` (1px #ebebeb) for structure. The
amount field, once keyed by hand, thickens to a 2px spruce border
(`--frost-amount-keyed-border`) and pulls its left padding to 13px
(`--frost-amount-keyed-padding-left`) so the text does not shift.

**Keyboard focus:** `outline: 2px solid #0b363b; outline-offset: 2px;
box-shadow: 0 0 0 6px #abffae` (`--frost-focus-outline`,
`--frost-focus-offset`, `--frost-focus-ring`). The dark outline is the visible
boundary on light surfaces; the green ring is emphasis. Links underline at a
3px offset (`--frost-link-underline-offset`).

**Touch pressed — designed under DESIGN-005.** On the POS the finger covers
what it presses, so the proof that a tap landed has to be visible outside the
contact patch. While a finger is down, every enabled **boxed** control — a
tile, button, key, rail row, nav item, order-line body or remove control, or
the header back link, anything with a border, a fill or a reserved box — draws
a **2px ring inside its own edge in its own text colour**
(`--frost-pressed-ring`: `inset 0 0 0 2px currentColor`). *Selection fills;
pressing strokes.* The ring is a stroke so it cannot be read as the solid ink
fill that means selected; it is inside the edge so it never collides with the
keyboard focus ring, which is outside and green, and so it moves no layout;
and it takes `currentColor` so one rule reads on every ground — ink on a
cream key, a white tile, a white button and a white rail row; white on the
spruce primary, the ink selected fill and the brick final action; brick on an
outlined destructive button — and the ring's contrast is the text's contrast,
already measured. No fill change, no shadow, no scale, no transition, because
a pressed state that is only a transition does not exist on a slow device.
Its lineage is the keyed amount field, whose 1px→2px spruce thickening
already means *a hand touched this*. On an order line the ring encloses only
the tap target — quantity, name, amount — drawn 8px out from the text inside
the row's own padding, and stops short of the trailing slot, which is a
sibling (`I-12`): the ring shows exactly what was pressed. A disabled or 86'd
control has no pressed state, because nothing happened. Inline text links —
a tender line's *Remove*, the totals' *change*, links inside notices — get no
ring: they are not certified as touch targets (open list, item 8), and an
inset ring on an unboxed run of text would hug the glyphs and mean nothing;
whatever device testing makes of them will be a box, and the box will ring.
The rule applies to PIN keys too; the lock screen was not blocked on it because every key there
already reports through the dots (FE-001), so applying it there is a
follow-up, not a fix.

**Hover is a mouse fact.** Touch browsers synthesise `:hover` on tap and
hold it after the finger lifts, and Frost's tile hover is the ink selected
fill — so a tapped tile would be left looking selected once the ring goes,
the exact confusion the pressed state exists to prevent. `frost-states.css`
therefore puts every hover rule in `visual.css` and `structure.css` back to
its rest appearance under `@media (hover: none), (pointer: coarse)`, with
selected things staying selected; `visual.css` is not edited. An
implementation writes its own hover rules inside `@media (hover: hover)` and
needs no such block.

**The Flat Floor Rule.** A surface never lifts. State is shown by fill and
stroke, never by shadow, scale, or transition.

## Shapes

Three radii and one circle (`--frost-radius-flat` 0, `--frost-radius-surface`
2px, `--frost-radius-button` 9999px, `--frost-radius-indicator` 50%).

- **0** for structural bands: headers, rails, round-group headings, order
  lines, table rows, the emergency banner.
- **2px** for every surface a person reads or touches as a rectangle: tiles,
  keys, fields, cards, overlays, tags, notices, the pending-line remove
  control, incident blocks, the idle chip.
- **Pill** for action buttons on both clients, filled or outlined.
- **Circle** only for semantic indicators: the 20px PIN dot and the 10px
  receipt-warning marker. The emergency marker is a 28px 2px-radius square
  (`--frost-emergency-marker-size`), so the two alert marks differ in shape
  as well as colour.

Borders are 1px everywhere; the keyed amount field's 2px spruce border is the
one designed exception. Three anonymous inline `2px solid var(--ink)` rules
survive in the settlement fixture (summary panel right edge, below the
balance block, and the close band of the tender panel), shared by Paper and
Frost alike and overridden by neither. They are wireframe residue that the
stylesheet's own boundaries — every named one normalised to 1px — did not
reach, not a Frost decision; an implementation draws them at 1px control
border. Dashed borders mean *not available*: the 86'd tile, the disabled
button, the empty state.

Icons are inline SVG on a 24 grid, `stroke="currentColor"`, stroke width 1.8
(`--frost-icon-stroke`), round caps and joins, drawn at 20px
(`--frost-icon-size`) or 24px inside keys and the remove control
(`--frost-key-icon-size`). Four exist: arrow (Continue), back arrow
(delete last digit), close (remove line), and alert (emergency mark).

## Components

Each entry names the frontmatter component and the tokens that compose it.
Behavior and copy are the screen inventory's; only presentation is stated.

### Buttons (POS)
- **Shape:** pill, 1px border, 500 weight, 15px, `0 16px` padding
  (`--frost-button-padding`), 72px high. Compact actions are 48px at 13px.
- **Primary** (`button-primary`): spruce fill, white text, spruce border.
  Hover: ink fill.
- **Secondary** (`button-secondary`): white fill, text colour, control border.
  Hover: grouping fill, spruce border.
- **Destructive** (`button-destructive`): white fill, brick text and border.
  Hover: soft brick fill. Applied to *Void order*, *Cancel payment*, *Remove
  line*. A **final** destructive action (`button-destructive-final`) fills
  brick with white text; hover deepens to #822b24.
- **Selected** (`button-selected`): ink fill, white text, spruce border — the
  chosen payment method.
- **Disabled** (`button-disabled`): grey fill, grey text, dashed #c2c8c9
  border; carries `aria-disabled`.
- **Inside an emergency field:** white fill, red text, white border.
- **Inside a warning field:** amber text and border on the pale field.
- **Pressed** (designed): any of the above with `--frost-pressed-ring`; the
  ring is white on primary, selected and final-destructive fills, ink on a
  secondary, brick on an outlined destructive. Never on disabled.

### Buttons (back office)
- `button-office`: pill, 36px high (`--frost-office-action-height`), `0 14px`
  (`--frost-office-button-padding`), 13px text, white fill, control border.
- `button-office-primary`: spruce fill, white text.
- `button-office-small`: 28px (`--frost-office-action-small-height`),
  `0 9px` (`--frost-office-button-small-padding`), 12px text — the row-level
  *86* and *Put back on* actions.
- Hover and disabled as the POS.

### Menu tile
- **Available** (`menu-tile`): white, 1px control border, 2px corners, 12px
  padding (`--frost-tile-padding`), 150×96px. Name 15px 500 in text colour at
  the top; price 15px 400 in muted at the bottom. Hover applies the selected
  treatment.
- **Selected** (`menu-tile-selected`): ink fill, white name *and* price,
  spruce border. Same box.
- **Pressed** (designed): the available tile with an ink ring inside its
  edge (`--frost-pressed-ring`); the selected tile with a white one. The
  tile does not fill on press — a fill is selection.
- **Unavailable / 86'd** (`menu-tile-unavailable`): grey fill, grey name and
  price, dashed #90999a border, a filled grey `tag-86` reading *86*. Same
  150×96px box, same grid position, `aria-disabled`. It is never removed and
  never reflows.

### Category row
- 172×72px, 15px 400, `0 16px`, divider rule below, on the white rail.
  Selected (`category-row-selected`): ink fill, white text, 600 weight.

### Order line
- **Geometry, all signatures:** 72px minimum, `10px 16px`, 12px gaps, a 28px
  quantity column, name 15px 500, modifiers 12px at 1.45, quantity 15px muted,
  amount 15px 500 no-wrap, and a **56×56px trailing slot that is always a
  sibling of the tap target, never its child**. The tap target has a 52px
  minimum height (`--frost-line-body-min-height`); hover underlines the name.
- **Pending** (`order-line` + `order-line-remove`): white line; the trailing
  slot holds a 56×56px 2px-radius control, white fill, 1px brick border, a
  24px close icon in brick at line-height 1 (`--frost-leading-remove`).
  Hover: soft brick fill. It removes with no prompt.
- **Fired** (`order-line`): identical reading hierarchy; the trailing slot is
  present, the same size, and **empty** — no border, no fill, no icon. Void is
  reached from the row's own action, behind the manager PIN.
- **Pressed** (designed, pending or fired): the tap target alone takes the
  ink ring, 8px out from its text and short of the slot; the pending remove
  control, when pressed, takes a brick ring of its own.
- **Voided** (`order-line-void`): canvas-grey fill, name and amount struck
  through in #60696b, modifiers #60696b, empty slot, inert.
- **Locked order** (payment in progress, or another client holds the lease):
  every row keeps normal contrast, no row is a control, every trailing slot
  is empty, the menu and category rail are absent, and the round heading
  carries the reason as a tag: *FINISH PAYMENT FIRST* or *ANOTHER CLIENT*.

**The Empty Slot Rule.** The trailing slot carries exactly one meaning, and
that meaning is *remove now, unrecorded*. Where that is not what the slot
would do, it is empty — not disabled, not relabelled, not an icon for a
different action.

### Round-group heading
- 32px band, `0 16px`, 11px 500 muted, sentence case, no tracking, divider
  below. Fired groups on grouping blue (`round-header`); the pending group on
  pale green with ink text (`round-header-pending`). A trailing tag inside the
  band is **13px** (`--frost-round-tag-size`, designed under DESIGN-005; it
  was 10px) with `2px 4px` padding (`--frost-round-tag-padding`), no border,
  no tracking, colour inherited from the band; 23px tall, it fits the band.
  Meaning appears once per group, never as per-line badges.

### Order totals
- Rows at 14px with `3px 0` between; the grand total 24px 500 with a divider
  above, and in Frost a grouping-blue band bleeding 8px past the row on each
  side (`--frost-grand-total-bleed`). The *includes tax* row is 12px muted.
  The label reads `Total · Rp`.

### PIN pad key
- `pin-key`: 88×88px, cream fill, 1px control border, 2px corners, 26px 400
  numeral. Delete-last-digit is the same key with a 24px back icon.
- `pin-key-continue`: ink fill, white 24px arrow icon, spruce border.
- **Pressed** (designed): cream keys take an ink ring, Continue a white one.
- PIN dots: 20px circles, 1px control border; filled spruce when entered.
- The same key on the tender pad is 88×72px (`tender-key`) and on the
  approval dialog 72×72px (`approval-key`), both cream.

### Numeric field
- `field`: 56px (`--frost-field-height`), 1px control border, 2px corners,
  white, `0 14px` (`--frost-field-padding`), 500 weight, 20px. `field-small`:
  40px (`--frost-field-small-height`), 14px.
- **Tender amount — prefilled** (`amount-field-prefilled`): the same field at
  26px on grouping blue with a 1px spruce border; the balance is already in
  it and remains editable in place.
- **Tender amount — keyed** (`amount-field-keyed`): white, 2px spruce border,
  13px left padding, with the existing *KEYED BY HAND* label.
- **Invalid** (`field-invalid`, `field-small-invalid`, designed under
  DESIGN-005): the field holds a value the system refused. White fill, 2px
  `--frost-invalid` border (`--frost-invalid-border`), left padding 13px
  (`--frost-amount-keyed-padding-left`) so the figure does not shift, and a
  **message** (`field-message`) directly under it: one line, 14px 500 in
  `--frost-invalid`, 4px above (`--frost-space-1`); 13px inside a
  back-office modal. The message names the rule and the limit — *Card
  maximum 155.925* — so `AC-6` is met at the field, not only in a notice.
  Three cases that are not the same: an **empty required field on submit**
  is invalid with a message naming what is missing (*Enter a name*); a
  **rejected value** is invalid with the limit; a **fine value whose action
  failed** is *not* invalid — the field stays keyed or prefilled and the
  failure is a `notice` beside it, because the field is not wrong. A field at
  rest that happens to be empty is at rest. The existing notice above the
  tender field is kept; the field's own line is the short form.

### Modal and sheet
- White, 2px corners, 1px spruce boundary, no shadow, on the 38% scrim. Head
  and foot on canvas with a divider between; heading 18px 500
  (`overlay-heading`), body at POS size. The 640px back-office modal is 13px
  (`body-office-modal`) with a 16px 500 heading (`overlay-heading-office`).
  `modal` 560px; `modal-office` 640px. The item sheet occupies the region left of the order panel and below
  the header, and scrolls its body. Modals carry `role="dialog"`,
  `aria-modal`, and are labelled by their heading.

### Data table
- `data-table-header`: 11px 500 muted, uppercase at 0.06em, `12px 12px`
  (`--frost-table-head-padding`), grouping-blue fill, 1px control-border rule
  below.
- `data-table-row`: white, 14px at 1.45, `15px 12px`
  (`--frost-table-cell-padding`), first column 500, numeric columns
  right-aligned and no-wrap, divider between rows. Hover: canvas fill.
  Links in cells are 500.
- `data-table-row-tight`: `9px 12px` (`--frost-table-cell-tight-padding`) for
  the overflow fixture.

### Report figures
- 13px tabular, `2px 12px` grid gap (`--frost-report-figure-gap`), `8px 0` row
  padding (`--frost-report-figure-padding`), 11px sentence-case headers on a
  control-border rule, values right-aligned. A section total is 600 with 14px
  top padding (`--frost-report-total-padding-top`) and a control-border rule;
  the total *figure* is spruce. Gross, reversal and net stay separate rows.
- **Card** (`card`): white, 1px divider border, 2px corners, 20px padding,
  18px 500 spruce title with 16px below. The page's first card is a flat
  header: canvas fill, no border, a divider rule under it, 24px below.

### Incident banner and incident block
- **Emergency banner** (`emergency-banner`): solid red, white text, 80px
  minimum (`--frost-emergency-min-height`), `12px 20px`
  (`--frost-emergency-padding`), 1px red rule below; 18px 600 title, #fff2ee
  supporting text, a 28px white square mark with a red alert icon, and a
  white compact 48px action at the trailing edge (180px *Sign in to view* on
  the lock screen, 200px *Open incidents* on the order screen). The 72px
  recovery action belongs to the incident block, not the banner. On the
  locked POS the banner announces that a kitchen problem exists and shows no
  table, round, amount or line.
- **Emergency block** (`incident-emergency`): solid red, 2px corners, 16px
  padding, 17px 600 title, #fff2ee detail, a white 200px
  (`--frost-incident-reprint-width`) 72px *Reprint ticket* action. A nested
  confirmation notice inside it is white with text colour.
- **Warning block** (`incident-warning`): pale amber, 1px amber border, 2px
  corners, 12px padding, amber text at body size, a 10px amber circle
  (`--frost-warning-marker-size`) as its mark, and an outlined amber 180px
  (`--frost-receipt-reprint-width`) 48px *Reprint receipt* action.
- **Warning chip** (`warning-chip`): pale amber, amber text and 1px border,
  `4px 10px` (`--frost-warning-chip-padding`), for the inline receipt
  warning on the POS.

### Tags and chips
- `tag`: 10px 500 at 0.025em, `2px 5px` (`--frost-tag-padding`), 1px control
  border, 2px corners, white. `tag-solid`: grouping fill. `tag-86`: #60696b
  fill, white text. The idle chip (`--frost-idle-chip-padding`, `4px 8px`) is
  12px on white with a divider border.

### Navigation (back office)
- White rail, divider rule on the right, 64px brand block at 20px 500 with a
  divider below. Section labels 11px 500 muted at 0.04em. Items 14px at
  `10px 24px`, no left accent bar. Hover: grouping fill. Selected
  (`nav-item-selected`): ink fill, white text, 600, and it **keeps** both
  colours on hover — the finding the review corrected.
- The POS header is white with a divider below, 20px 500 title at −0.2px, the
  actor in muted 13px, and a back link of 48px minimum height.

### Notices and empty states
- `notice`: grouping fill, 1px control border, 2px corners, `12px 16px`, 600
  title. `notice-soft`: canvas fill. `empty-state`: canvas, dashed control
  border, muted text, 40px padding (60px in the fixtures' larger empties).

## Do's and Don'ts

### Do:
- **Do** keep emergency and warning different in coverage, size and hue at
  once: solid red with a 72px action against pale amber with a 48px action.
- **Do** keep the trailing slot of every order line the same 56×56px, and
  leave it empty wherever its one meaning does not apply.
- **Do** keep an 86'd tile at its exact coordinates in its exact box, greyed,
  dashed, and tagged.
- **Do** set every figure in tabular lining numerals, whole rupiah, period
  grouped, right-aligned, with the currency labelled once per group.
- **Do** use 72px for a standard POS action, 88px for a PIN key, 56px for a
  tender method — never smaller than this table.
- **Do** fill spruce only for the one terminal action of a surface — the
  control that ends the task the surface exists for: *Close order & print
  receipt*, *Settle*, *Add to order*, *Apply*, *Remove line* in the line
  editor, *Continue* on a PIN pad, *Sign in*, *Create*. Every other
  state-changing control is outlined: *Send to kitchen*, *Add card*, *Add
  cash*, *Discount*, *Void order* on the action band, and both *Reprint*
  commands. Ink, not spruce, fills what is selected.
- **Do** keep the POS chrome white, the canvas #fafafa, and the lock screen and
  keys cream.
- **Do** show a press as a 2px inset ring in the control's own text colour, on
  every enabled boxed touch control, and write every hover rule inside
  `@media (hover: hover)`.
- **Do** mark a refused value on the field itself — 2px amber border, white
  fill, one amber line under it naming the limit — and leave a field whose
  value was fine alone when the action fails.

### Don't:
- **Don't** add a shadow, a transition, or a hover that moves anything.
- **Don't** fill a control to show it is pressed, or ring one to show it is
  selected. Selection fills; pressing strokes.
- **Don't** paint an invalid field brick or red, or give it the pale amber
  fill of a receipt warning.
- **Don't** use a radius other than 0, 2px or pill on a rectangle, or a circle
  on anything but the PIN dot and the warning marker.
- **Don't** let a receipt warning take the red field, or reduce a kitchen
  incident to an outline.
- **Don't** put a control in a fired, voided or locked line's trailing slot,
  or make a void reachable from the position a remove occupies.
- **Don't** use 700 weight, a monospace face, or a font the repository does
  not have.
- **Don't** repeat the group's meaning as a badge on each line.
- **Don't** render a decimal, a currency symbol per figure, or a
  non-tabular numeral anywhere money appears.
- **Don't** read the frontmatter of the comparison document
  (`design/visual-directions/DESIGN.md`) as authority; it is superseded here.

## Open — not present in the Frost artifacts

Three different claims, kept apart because they are different: **absent**
(no Frost artifact contains it), **inherited** (it renders in a Frost screen
only through rules written for the greyscale wireframe), and **unreviewed**
(it exists but the finish review did not cover it). Each is a question for
the owner or the lead, not a gap for an implementer to fill. **Accounting for
DESIGN-005:** this list held eleven items on 2026-09-14 and holds nine. The
two removed were the pressed/active touch state and the field invalid state.
The third gap DESIGN-005 closed — the 10px round-heading tag — was never an
item here; it was recorded as the one exception under the Supplement Rule,
and is closed there. All three are now *designed and unreviewed*, a fourth
claim beside absent, inherited and unreviewed, and are marked as such
wherever they appear.

1. **Dark palette.** Light only was delivered, deliberately. Whether a dark
   palette ships is an open product decision (ROADMAP Track A, item A5). No
   dark value exists and none is proposed here.
2. **Form controls beyond the numeric field — mostly absent, one inherited.**
   Select, checkbox, and any toggle are absent. A 40px text field *is*
   rendered in the Frost category modal (`frost/back-office/menu.html:142`,
   `field-small`) through the shared `.field` rules — inherited, and the
   modal was not a reviewed screen. The back-office 86 switch is a row-level
   pill button plus a tag; the item editor and settings screens are absent.
   The login form (Phase 0) exists only in the greyscale wireframe, which
   loads `wireframe.css`, not `visual.css`: two 40px `field-small` boxes and
   a full-width primary button, in greyscale. Its invalid state is
   specified (`field-small-invalid`: the 56px treatment at 40px) but not
   demonstrated — no reviewed state holds a refused small field, and
   DESIGN-005 was not licensed to add one; its resting look is still the
   inherited `.field` rule.
3. **Success and informational colour.** There is no success green and no
   neutral informational hue; confirmations are grouping-blue notices. If a
   confirmed close or a successful reprint needs its own colour, none is
   sourced.
4. **Icons beyond the four.** Arrow, back, close and alert are the entire set.
   The lock screen's *Sign in to view* and the rest of the product have no
   icon vocabulary.
5. **Screens outside the six — absent.** Floor plan, closed orders, closed
   order detail, and the eleven remaining back-office screens exist only as
   greyscale wireframes loading `wireframe.css`; no Frost file styles them.
   Their geometry is the wireframe's; their colour is not specified. The
   sheets and modals *inside* the six screens — item configuration, line
   editor in both forms including the quick-sale form
   (`frost/pos/order.html`, state `quick-line`), discount picker and
   free-form entry, void line, void order, manager approval, re-auth,
   cancel, lease lost, takeover — are rendered in Frost and were among the
   146 fixture states the finish review's verification covered.
6. **Loading and skeleton treatment — inherited.** `.skel` and
   `.loadinglabel` render in the Frost order and lock screens through the
   structure sheet's rules and the variable remap (skeleton bars in
   grouping blue, label in muted). Nothing in `visual.css` addresses them;
   they were not restyled and not called out in review.
7. **Printed output — absent, and load-bearing.** Kitchen tickets,
   cancellation tickets and receipts are paper. Nothing in Frost designs
   them. `B-16` requires a cancellation ticket to be unmistakable from a new
   work ticket, and that is a property of the printed artifact, so this
   system cannot claim `B-16` is met. Printed output must be designed and
   reviewed before Phase 3 prints anything.
8. **Inline text links as touch targets.** Retained from the wireframe,
   explicitly not certified. Device testing decides them.
9. **Assistive-technology, dim-floor and real-device checks.** The finish
   review certified screenshots and two browser hover checks, nothing
   physical. The contrast table above is arithmetic on the token values,
   not a measurement on hardware. The three DESIGN-005 states were checked
   the same way — rendered in Chrome at actual size and measured — and not
   on a touch device; whether a 2px ring is enough under a real finger on
   a real floor is a device-test question.
