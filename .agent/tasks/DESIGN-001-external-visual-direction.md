# DESIGN-001 — External visual direction

**Status:** Active
**Owner:** Product owner, working with an external tool
**Depends on:** none

## Objective

Turn the confirmed behavioral structure of this product into a visual
direction, using an external design tool and the owner's own design reference,
and return something this repository can convert into a design system.

This repository deliberately owns no visual authority. The wireframes under
`docs/design/prototype/` are greyscale on purpose: structure, hierarchy,
density, and affordance only. Choosing colour, typography, and component
styling is this task, and it happens outside the repository.

The tool is expected to be Lovable, possibly Claude Design, possibly something
else. The inputs below are written to work with any of them.

## Required inputs

Everything an external tool needs, and nothing it should be free to reinvent.

| Input | Path | Why it goes |
|---|---|---|
| Navigable structure | [docs/design/SITEMAP.md](../../docs/design/SITEMAP.md) | Distinguishes screens from modals, sheets, and inline states. A tool that flattens these produces a wrong prototype |
| Screens and states | [docs/design/SCREEN-INVENTORY.md](../../docs/design/SCREEN-INVENTORY.md) | Every state that must exist, and the decisions the PRD already fixed |
| Behavioral wireframe | [docs/design/prototype/](../../docs/design/prototype/) | 20 screens as clickable HTML. Honest touch-target sizes |
| Users and principles | [docs/PRODUCT.md](../../docs/PRODUCT.md) | Who stands at each client and in what state of mind |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) | A visual choice that breaks one of these is wrong however good it looks |
| The owner's design reference | Held by the owner | The actual source of visual authority for this task |

Device targets: **POS at 1280×800 landscape**, **back office at 1440 wide**.
Both are the design targets, not merely tested sizes.

## Behavioral constraints

The external tool may restyle anything. It may not change what the interface
does. Each constraint below traces to a requirement, and each exists because
a designer without this list would plausibly get it wrong.

- **The kitchen is not a user.** No kitchen screen exists. Kitchen staff work
  from paper work tickets and paper cancellation tickets.
- **Manager approval is an inline prompt over whatever screen triggered it**,
  requiring a PIN at that moment. It is never a mode, a session, or a separate
  page. (`FR-A6`, `B-14`)
- **Void and refund are different actions** with different preconditions and
  must never share a screen or a control. (`FR-H1`, `B-19`)
- **A failed kitchen ticket is an emergency; a failed receipt is not.** They
  appear on both clients and must never be presented with equal urgency.
  (`FR-E3`, `FR-E6`)
- **An unresolved kitchen incident is visible on the locked POS**, its detail
  behind a PIN. (`FR-E3b`)
- **An 86'd item is disabled in place, never removed.** Removing it reflows
  the grid under a finger already moving. (`AC-12`)
- **A quick sale has no fire control at all.** Settling fires it. (`FR-E5`)
- **A table order is fired in rounds**, and each ticket carries only lines not
  previously fired. (`FR-E2`, `B-16`)
- **The back office owns all configuration, audit, reporting, and the
  end-of-day close.** None of it appears on the POS. (`PRODUCT.md` principle 8)
- **POS sessions expire in 90 seconds; back-office sessions last 30 minutes
  idle.** The POS is a shared device left unattended between uses, and its
  visual design should assume interruption. (`FR-A2`, `FR-A2b`)
- **Money is displayed in IDR at precision 0** — whole rupiah, no decimal
  separator. Any reference showing cents needs adapting.

## Representative screens

A full set of 20 is more than a visual direction needs. These six carry every
hard problem; if the direction works here, it will extend.

1. **POS — order workspace** (`prototype/pos/order.html`). The densest screen
   in the product: menu grid, running order, variants, modifiers, 86'd items
   disabled in place, and fire-round state all at once. The hardest and the
   most important.
2. **POS — settlement** (`prototype/pos/settlement.html`). Split tender, cash
   over-tender and change, exact-settlement rule, and the lease state.
3. **POS — lock screen** (`prototype/pos/lock.html`). The PIN pad, plus the
   pre-authentication incident indicator that must be unmissable without
   leaking order data to a room.
4. **POS — print incidents** (`prototype/pos/incidents.html`). Emergency
   versus low-priority urgency, expressed visually. Getting these to read
   differently at a glance is a visual-design problem, not a copy problem.
5. **Back office — menu management** (`prototype/back-office/menu.html`). The
   dense desktop counterpart: tables, editing, and the 86 toggle whose effect
   must reach the POS within three seconds.
6. **Back office — report detail** (`prototype/back-office/report-detail.html`).
   Gross, reversal, and net figures a manager reconciles a till against. Pure
   numeric hierarchy.

## Expected external-tool outputs

Whatever the tool produces, this is what the repository needs back:

- **Styled versions of the six representative screens**, at the stated device
  targets, with structure preserved.
- **A colour palette** with stated roles, not just swatches: surface,
  elevated surface, text, muted text, border, primary action, destructive
  action, and — separately — emergency versus warning, since those two must be
  distinguishable at a glance across a room.
- **A type scale** with the family, weights, and sizes actually used, and the
  POS-versus-back-office distinction if they differ.
- **A spacing scale and a radius scale.**
- **Touch-target sizing for the POS**, stated as numbers.
- **Component treatments** for at least: primary and destructive buttons,
  the menu-item tile in its available, selected, and 86'd states, the order
  line, the modal, the PIN pad key, the data table row, and the incident
  banner in both urgencies.
- **Both light and dark, or an explicit decision that only one ships.** A
  POS on a floor and a back office at a desk are different lighting
  situations, and picking one for both is a decision worth making deliberately.

Files, screenshots, or a link all work. Fidelity of the artifact matters less
than the palette, scale, and component decisions being explicit enough to
transcribe.

## Acceptance criteria

1. All six representative screens exist in the returned direction, at their
   stated device targets.
2. Every behavioral constraint above still holds in the styled result. The
   quickest check: an 86'd tile is still in its original position, and there
   is no fire control on a quick sale.
3. Emergency and low-priority incidents are visually distinguishable at a
   glance, without reading the text.
4. Colour, type, spacing, and radius are each stated as values, not implied by
   a picture. A value that has to be eyedropped from a screenshot has not been
   specified.
5. POS touch targets are stated numerically and are no smaller than the
   wireframe's.
6. Money renders as whole rupiah.
7. No boundary in `docs/BOUNDARIES.md` is broken by a visual choice.
8. The direction is complete enough that `docs/DESIGN.md` and a token set can
   be written from it without inventing values.

## Out of scope

- Application code. This task produces a direction, not an implementation.
- Any change to `docs/PRODUCT.md`, `docs/PRD.md`, `docs/ROADMAP.md`, or
  `docs/BOUNDARIES.md`. If the visual work argues one of these is wrong, that
  is a finding to raise, not an edit to make.
- Any change to the sitemap or screen inventory. Structure is confirmed. A
  proposed structural change comes back as a finding.
- New screens or features. A tool that invents a dashboard, a settings page,
  or a kitchen display has exceeded the brief.
- The kitchen display screen specifically. It is deferred and is a common
  thing for a POS-literate tool to add unasked.
- Motion and animation.
- Deciding the tax model, the stack, or anything else in
  [MEMORY.md](../MEMORY.md) under unresolved work.

**A note worth carrying into the tool:** an AI app builder will try to design
*and* build, and will happily invent a palette from the greyscale wireframes
if not told otherwise. State plainly that the visual direction comes from the
owner's reference, or the returned work will need undoing rather than
applying.

## Handoff

**2026-09-10 — product lead.** The handoff package is written:
[docs/design/EXTERNAL-HANDOFF.md](../../docs/design/EXTERNAL-HANDOFF.md).

It is self-contained and meant to be pasted whole into the tool. It needs no
other repository file to make sense, which matters because a tool given six
linked documents will read one of them.

It opens by naming the three things an AI app builder will otherwise do
wrong — invent a palette from the greyscale wireframes, add screens the
product does not have (a kitchen display especially), and "improve" the
workflow. Each behavioral rule is stated with the reason it exists, because a
rule without a reason gets optimised away.

**To run this task:** open `docs/design/prototype/index.html` to see the
wireframes, then give the tool `EXTERNAL-HANDOFF.md` plus your own design
reference. The reference is the visual authority; the handoff says so
explicitly.

Still open:

- The tool is expected to be Lovable but is not settled. The package is
  written to work with Lovable, Claude Design, or a person.
- The wireframe prototype has not been reviewed screen by screen by the
  product lead. It is usable as input either way, since this task restyles
  confirmed structure rather than validating it.
- Nothing has been returned yet.
