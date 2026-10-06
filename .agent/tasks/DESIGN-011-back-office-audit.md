---
id: DESIGN-011
title: Audit the back-office design and propose the design tasks it needs
category: docs
touches: []
depends_on: [DESIGN-009]
owns: [.agent/reviews/DESIGN-011-back-office-audit.md]
status: complete
cycles: 0
---
# DESIGN-011 — Back-office design audit

**Status:** Written 2026-10-05 by `lead`.
**Owner:** a designer on the model in agents.yaml `roles.designer` (Codex `gpt-6-astra`,
effort high), opened by hand in its own pane by the lead (Herdr `design011`).
**Place:** the lead's worktree `../restaurant-pos-kit`. This is a **read-only audit**: you write
one report, `.agent/reviews/DESIGN-011-back-office-audit.md`, and touch nothing else. Do not
commit; the lead commits the report.

## Objective

The POS's seven screens are designed in Frost, reviewed, and built. The back office's 13
screens (BO-01 to BO-13) are not. Only two have Frost artifacts (`menu.html` for BO-03 and
`report-detail.html` for BO-11, both 2026-09-14); the other eleven exist only as the wireframe
prototype, which renders in Frost only through a variable remap that nobody has reviewed. The
back-office frontend (QUEUE 10) will be built against fixtures from Frost artifacts, the way the
POS was. When this audit is done, the lead knows, screen by screen, what exists, what is missing
or wrong against the behavioral authority and the Frost system, and how to slice the design work
into tasks small enough to review one at a time.

## Required inputs

Everything you need is here or cited.

1. The behavioral authority, which wins over any drawing: `docs/design/SITEMAP.md` §3 (the
   back-office client, `:231-322`) and §4-5 (cross-client nodes and handoffs), and
   `docs/design/SCREEN-INVENTORY.md` from `:532` (BO-01 to BO-13, M-6, the rulings table from
   `:985`, including I-2, I-3, I-6, I-8, I-9 and C-4, and the deferred BO-14 at `:1062`).
2. The visual system: `docs/DESIGN.md` (Frost), in particular the back-office sizes (`:553`,
   `:710-730`), layout (`:801-809`, 1440 wide, 220px navigation, 640px modal), the back-office
   buttons (`:963`), and the *Tokens* section with its provenance rule.
   `docs/design/tokens/frost.tokens.json` and `frost.css` are the registry.
3. What exists: `docs/design/prototype/back-office/` (13 wireframe pages),
   `docs/design/visual-directions/frost/back-office/menu.html` and `report-detail.html`, and the
   gallery `docs/design/visual-directions/index.html` with `manifest.js`.
4. For the pattern a finished screen meets: the seven POS artifacts in
   `docs/design/visual-directions/frost/pos/`, and how DESIGN-009 drew POS-05 and POS-06
   (`.agent/tasks/DESIGN-009-closed-orders-and-refund.md`, its brief and Handoff).
5. The contract, for what a screen must show: `docs/PRD.md` (the requirements each BO screen in
   SCREEN-INVENTORY cites, FR-A2b, FR-E3, FR-I, FR-J) and `docs/BOUNDARIES.md`.

## What to report

1. **Per screen, BO-01 to BO-13 and M-6:** what exists (wireframe only, Frost artifact, both);
   every state SCREEN-INVENTORY requires and whether any drawing shows it; anything a drawing
   shows that the inventory does not authorise; where the wireframe or the remap breaks Frost
   (raw values, wrong sizes, missing tokens, the POS's touch geometry used on a desktop
   screen); and the open rulings that touch it (I-8 on BO-13, for example).
2. **The two Frost artifacts:** a review of `menu.html` and `report-detail.html` against the
   inventory and DESIGN.md as it stands now (DESIGN.md has changed a lot since 2026-09-14), and
   the 51 links into the wireframe (`menu.html` 40, `report-detail.html` 11): where each should
   point once the screens it names exist in Frost.
3. **Shared pieces:** the navigation, top bar, re-authentication (M-6), tables, forms, modals,
   empty, loading and error states that every screen reuses, and which ones DESIGN.md already
   specifies.
4. **Tokens:** every value the back office will need that the registry lacks. Propose; do not add.
5. **Questions:** anything the documents do not decide, each with a proposed answer and whose it
   is (the designer's call, the lead's, or the owner's because it is product or contract).
6. **The slicing:** an ordered list of design tasks, each one reviewable in a session (one to
   three screens, or the shared shell first), with its screens, its dependencies, and what it
   would let the back-office frontend build. Say which slice should run first and why.

## Constraints

- **Read only.** Write only the report. Do not edit any artifact, token, DESIGN.md, the
  sitemap or the inventory, and do not commit.
- **No contract edits and no rulings.** Do not reopen a ruling in SCREEN-INVENTORY's table or
  DESIGN.md. If one looks wrong, say why in *Questions*.
- **Look in a browser if you can**, at 1440 wide, and say what you measured and how. The owner
  approved headless Chrome through Playwright for DESIGN-009 on the same terms: scripts and
  screenshots outside the repository, nothing committed. If you cannot run it, say so; do not
  claim a measurement you did not make.
- Run no shell command that writes inside the repository.

## Acceptance criteria

1. The report has one section per screen (BO-01 to BO-13, M-6), each listing the inventory's
   states with *drawn* or *missing*. Red if a screen or a required state is skipped.
2. Every finding cites its authority (an inventory line, a DESIGN.md line, a requirement or
   boundary ID) and the file and line of the drawing.
3. The 51 wireframe links are accounted for by count and by target.
4. The slicing names every screen exactly once, and the first slice is justified.
5. Every question names whose call it is.

## Out of scope

- Drawing, fixing or re-pointing anything. The design tasks this audit proposes do that.
- The POS artifacts, except as the pattern to compare against.
- BO-14 (deferred by I-3), and anything PRD §9 leaves open (receipt content, post-close
  corrections, the permitted rate range), beyond naming where a screen depends on it.

## Reporting

Write `.agent/reviews/DESIGN-011-back-office-audit.md` in full prose. Then run exactly one of:

    herdr agent prompt lead "design011: DESIGN-011 done — .agent/reviews/DESIGN-011-back-office-audit.md"
    herdr agent prompt lead "design011: BLOCKED — <question>"

## Handoff

*(Written by the designer in the report itself; this section stays empty.)*
