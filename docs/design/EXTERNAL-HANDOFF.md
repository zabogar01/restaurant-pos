# External design handoff — Restaurant POS

**Give this document to the design tool.** It is written to be pasted whole
into Lovable, Claude Design, or handed to a human designer. It is
self-contained: nothing in it requires reading the rest of this repository.

Companion material to supply alongside it:

- The wireframes in `docs/design/prototype/` — open `index.html` for a
  launcher listing every screen and state.
- Your own design reference. **This is the source of visual authority.**

---

## Read this first

You are being asked for a **visual direction**, not a product.

The structure, navigation, screens, and states are already decided and tested.
They are not a starting suggestion. Your job is to give this interface a
visual identity — colour, typography, spacing, component treatment — while
leaving what it does exactly as it is.

Three things this tool will be tempted to do, all of which are wrong here:

1. **Invent a palette from the wireframes.** They are greyscale on purpose.
   The visual direction comes from the reference supplied with this document,
   not from the wireframes and not from your defaults.
2. **Add screens.** Especially a kitchen display, a dashboard, or a settings
   page. The screen list below is complete. A kitchen display is deliberately
   excluded — kitchen staff have no screen at all in this product.
3. **Improve the workflow.** Several things below look odd and are deliberate.
   Each one is explained. Changing them breaks the product.

---

## What this product is

A point-of-sale system for a single restaurant that serves customers at tables
**and** over a counter. One order model handles both.

It is **two separate applications** sharing one server:

| | POS | Back office |
|---|---|---|
| Device | Tablet, **1280×800 landscape** | Desktop, **1440 wide** |
| Used by | Cashier, standing, on a busy floor | Manager, sitting, at a desk |
| Posture | Fast, one-handed, interrupted, mid-conversation | Deliberate, reading dense tables |
| Session | Expires after **90 seconds** idle — shared device | 30 minutes idle, 8 hours absolute |
| Contains | Order entry, firing, discounts, payment, voids, refunds | Menu, staff, tables, settings, reports, audit, end-of-day |

These are not two views of one app. They are separately built, separately
styled if that serves them, and share no navigation.

**Money is Indonesian Rupiah at zero decimal places.** Whole numbers, no
decimal separator. If your reference shows cents, adapt it.

---

## The people

**Cashier.** Works standing up, at speed, often while talking to a customer.
Will not read a confirmation dialog — will dismiss it reflexively. Reaches for
the same tile in the same place by muscle memory. An error here costs money or
food. Design for interruption: they will be pulled away mid-order and come
back.

**Manager.** Sits down to do this work. Reads tables of numbers and needs to
reconcile a till against them. Also walks to the POS to approve things,
entering a PIN each time.

**Kitchen.** Not a user. No screen, no login. Receives printed paper tickets.
Do not design anything for them.

---

## Screens

Twenty screens. Six carry every hard problem — **style those first**, and the
rest follow from them.

### The six that matter

| Screen | File | Why it is hard |
|---|---|---|
| POS order workspace | `pos/order.html` | The densest screen in the product. Menu grid, running order, variants, modifiers, unavailable items, and fire-round state all at once |
| POS settlement | `pos/settlement.html` | Split payment, cash change, exact-settlement rule, locked state |
| POS lock screen | `pos/lock.html` | PIN pad, plus an alert that must be unmissable without revealing anything |
| POS print incidents | `pos/incidents.html` | Two urgency levels that must be distinguishable across a room |
| Back office menu | `back-office/menu.html` | The dense desktop counterpart: tables, editing, availability toggles |
| Back office report detail | `back-office/report-detail.html` | Pure numeric hierarchy a manager reconciles cash against |

### The rest

**POS:** floor plan, closed orders list, closed order detail.

*The screen list above is complete and unchanged.* A wireframe review in
September 2026 changed several affordances inside the order and payment screens
— see the rules below on the trailing slot, the read-only locked order, and the
prefilled amount — but added and removed no screens, routes, or overlays. The
one addition is a second **form** of the line-editor overlay for counter sales,
which differs from the table form only in where closing it returns to.

**Back office:** login, today, item editor, tables, users, discount presets,
settings, end-of-day, reports list, audit log, print incidents.

**Overlays** — these are *not* pages and must never become pages: the manager
approval prompt, item configuration, discount selection, the tender pad,
refund allocation, and back-office re-authentication.

---

## Rules you must not break

Each of these looks like something to fix. None of them is.

**The manager approval prompt appears over whatever screen triggered it.** It
asks for a PIN at that moment and authorises exactly one action. It is never a
page, never a mode, never something you are "logged into". Making it a route
breaks the security model — you must not be able to navigate away from it or
reach it directly.

**Void and refund are different actions and must never share a screen or a
control.** Void cancels an unpaid order. Refund reverses a paid one. They look
similar and are not. Merging them is how money leaves without a record of
which case it was.

**A failed kitchen ticket is an emergency. A failed receipt is not.** Both
appear on both applications. They must be distinguishable *at a glance,
without reading*, because a missed kitchen ticket means food never cooked and
a table waiting indefinitely. A missed receipt means someone reprints it. Do
not give them the same treatment.

**The locked POS shows that a kitchen problem exists, but not what it is.**
Presence is visible before anyone signs in; detail requires a PIN. It must be
impossible to miss and impossible to read from across a room.

**An unavailable item is greyed in place, never removed.** When the kitchen
runs out of something, the manager marks it unavailable and it goes grey
within three seconds — *in its existing position*. Removing it would reflow
the grid under a finger already travelling toward a target, and the cashier
hits the wrong item. This is the single most likely thing for a design tool to
"improve" incorrectly.

**A counter sale has no "send to kitchen" button at all.** Paying sends it. A
table order has one, because it is sent in rounds as the meal progresses. One
control that means "send to kitchen" on one order type and nothing on another
teaches the cashier the button is unreliable.

**Nothing from the back office appears on the POS.** No reports, no
configuration, no history. The POS stays small deliberately.

**This screen can say nothing was recorded. It can never say nothing was
taken.** There is no card terminal or gateway wired into this product — every
payment is typed in by hand — so the software genuinely does not know whether
money moved. Copy that promises the customer has not been charged is a promise
the product cannot keep.

**On the payment screen the amount is already filled in.** Every payment
method arrives with the whole remaining balance in the field, so the ordinary
sale is: pick the method, add, close — nothing typed. Style that field as a
value that is *there and replaceable*, never as an empty box waiting for
input. Splitting a bill is not a separate mode or tab: typing a smaller
number is the split, and the rest stays on the balance. Do not add a split
toggle.

**An order line's trailing slot means one thing only.** A line not yet sent to
the kitchen has a remove control there — one tap, no confirmation. A line
already sent has that slot **reserved and empty**; cancelling it needs a
manager and a reason, and is reached by tapping the row itself. Do not fill
the empty slot with a disabled control, a different icon, or a second
meaning: the two acts must never share a position.

While a payment is being collected on an order, **that order becomes
read-only**: the menu disappears entirely, no line can be removed, no sent line
can be cancelled, every trailing slot is empty and no row is tappable. The
lines themselves stay fully legible — reading is never blocked, and the cashier
still needs to see what is on the order — but the menu goes, because it is
nothing but a way to add and there is nothing in it to read. Do not grey the
rows out, and do not add a lock badge to each one; the reason is stated once
per group heading, and the two reasons a lock can exist never use the same
words.

---

## What to deliver

Style the six key screens at their stated device sizes, then give the values
explicitly. A value that has to be eyedropped from a screenshot has not been
specified.

**Colour** — as roles, not swatches: surface, elevated surface, text, muted
text, border, primary action, destructive action, and — kept separate —
**emergency** versus **warning**, since those two carry the incident
distinction above.

**Type** — family, weights, sizes actually used. Say whether POS and back
office differ.

**Spacing scale** and **radius scale**.

**Touch targets for the POS**, as numbers. No smaller than the wireframes.

**Component treatments** for: primary and destructive buttons; the menu item
tile in available, selected, and unavailable states; the order line in its
three states — pending (remove control present), fired (slot reserved and
empty), voided (struck through and inert) — plus the fire-round group header;
the tender amount field in its prefilled and hand-keyed states; the overlay;
the PIN pad key; the data table row; and the incident banner in both
urgencies.

**Light and dark**, or an explicit decision that only one ships. A tablet on a
restaurant floor and a desktop in a back room are different lighting
situations — worth deciding deliberately rather than by default.

---

## Out of scope

No application code. No backend. No new screens or features. No changes to
navigation, screen structure, or what any control does. No kitchen display. No
animation or motion.

If the visual work suggests a structural change is genuinely needed, **say so
as a note** rather than making it. Structure is confirmed and changing it here
would go unnoticed until it broke something.
