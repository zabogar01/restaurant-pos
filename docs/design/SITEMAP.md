# Sitemap — POS client and Back-office client

Status: **confirmed by the product lead.** Conflicts C-1 to C-7 and implied items
I-1, I-3, I-5, I-9 are ruled on; the rulings are folded into the structure below and
built in [prototype/](prototype/).

Owner findings from [DESIGN-002](../../.agent/tasks/DESIGN-002-wireframe-review.md)
added rulings **I-12** (per-line removal on POS-03) and **I-13** (prefilled tender
amount on POS-04).

**What changed, stated precisely.** No *navigable or overlay topology* changed:
no route, modal, or sheet was added, removed, or retyped, so the count of 7 POS
screens, 13 back-office screens, and 6 modals still holds and every destination
is the destination it was. What was added is **seven `[INLINE]` nodes** — five
under POS-03 and two under POS-04 — and `[INLINE]` *is* a node type in §1, so
"nothing structural changed" would be too broad a claim. An `[INLINE]` node is a
state of a screen, not a place you can navigate to, which is why the screen list
is unaffected. They are recorded here because this document already carries
`[INLINE]` affordance rulings of the same kind, and a brief that omits them
would drift.

**Retyped 2026-09-14, applying the owner's ruling of 2026-09-10.** The three
tender pads under POS-04 — cash, card, custom — are `[INLINE]`, not `[SHEET]`.
The tender pad is a persistent panel occupying the right column of the
settlement screen: it does not enter from an edge, is never dismissed, and
choosing another method replaces its content in place; leaving it means
leaving POS-04. The prototype has drawn it that way since DESIGN-002 pass 1
and this document lagged. Overlay semantics change; the count of 7 POS
screens, 13 back-office screens and 6 modals does not, because M-4 keeps its
number in the inventory as a retyped node. Applied in SCREEN-INVENTORY.md and
EXTERNAL-HANDOFF.md in the same change (DESIGN-004, finding 2).

**One `[INLINE]` node added under BO-03 on 2026-09-14** by the lead's ruling
in [DESIGN-005](../../.agent/tasks/DESIGN-005-a7-three-missing-states.md)
(finding 4): the category modal's refusal of an empty name. A state of an
existing screen, recorded the way the seven `[INLINE]` nodes above were; no
route, modal or sheet added, removed or retyped, so 7 POS screens, 13
back-office screens and 6 modals still hold. Applied in SCREEN-INVENTORY.md
in the same change.

One further change is a **variant, not a node**: the line-editor sheet now has
a table form and a quick-sale form, exactly as POS-03 itself has two variants.
They differ only in where leaving them returns to — the quick form must never
return to a workspace carrying a fire control (C-2, FR-E5). If the product lead
prefers to count that as two distinct sheet nodes, it is a one-line change here
and the modal count becomes 7.
Derived from [PRD.md](../PRD.md). Constrained by [BOUNDARIES.md](../BOUNDARIES.md).
Companion document: [SCREEN-INVENTORY.md](SCREEN-INVENTORY.md).

Two applications. One server. Nothing in this document is shared between the
two client trees except the API beneath them.

---

## 1. Node types

The distinction below is the whole point of this document. A downstream design
tool that flattens these into "pages" will produce a wrong prototype, because
the difference between a route and an overlay is the difference between a
back button and an approval that cannot be escaped by navigating away.

| Tag | Meaning | Route? | Back-stackable? | Dismissible? |
|---|---|---|---|---|
| `[SCREEN]` | Full-viewport destination with its own route | Yes | Yes | n/a |
| `[MODAL]` | Blocking overlay above a screen. Owns focus. Screen beneath is inert | No | No | Yes, explicitly |
| `[SHEET]` | POS-only. Large touch panel entering from an edge, above the screen but not obscuring the order context | No | No | Yes, explicitly |
| `[INLINE]` | A state of the parent screen. No overlay, no route, no dismissal | No | No | No |
| `[GLOBAL]` | Persistent chrome present on every screen of that client | No | No | Per-node |

Two hard rules that follow from the PRD:

- **A `[MODAL]` never changes the route.** Manager approval (FR-A6) is an
  overlay over whatever triggered it, in whatever client triggered it. It is
  never a screen, never a step in a wizard, and never a mode you enter and
  leave. If a designer draws an approval *page*, B-14 has been broken in the
  structure before a line of code exists.
- **A `[SCREEN]` is reachable by URL and survives reload.** A `[MODAL]`,
  `[SHEET]`, and `[INLINE]` state do not survive reload — with one stated
  exception, the tender draft (FR-G9), which is tab-local client state and
  survives actor-session expiry within the same tab.

Markers used below:

- `[RULED IN]` — required by the requirements but never named by them; the
  product lead has ruled it into the MVP. See SCREEN-INVENTORY §"Implied — rulings".
- `[MY CALL]` — a structural choice the requirements leave open, made by the
  designer and flagged as such rather than presented as a requirement.
- `[FR-…]` — the requirement that drives the node's existence.

---

## 2. POS client — `/pos/`

Tablet landscape, 1280×800. Touch. Standing cashier. 90-second idle expiry
(FR-A2). Visitor mode: Operate.

```
/pos/
│
├── [GLOBAL] POS chrome ......................................... FR-E3, E6, A2
│   ├── [GLOBAL] Kitchen print emergency banner ................. FR-E3
│   ├── [GLOBAL] Receipt print warning chip .................... FR-E6
│   ├── [GLOBAL] Actor identity + release control .............. FR-A2
│   └── [GLOBAL] Idle countdown / expiry takeover .............. FR-A2
│
├── POS-01 [SCREEN] Lock / PIN entry ........................... FR-A2, A5, A7
│   ├── [INLINE] Throttle cooldown (LOGIN class, 5 min) ........ FR-A5
│   ├── [INLINE] Session invalidated by back office ............ FR-B3
│   └── [INLINE] Resume interrupted tender draft ............... FR-G9
│
├── POS-02 [SCREEN] Floor — tables and quick sale ............... FR-D1, D2, C8
│   ├── [INLINE] Table occupied / open-order badge ............. FR-D1
│   ├── [MODAL] Open table order confirm-and-name ............... FR-D1
│   └── [INLINE] Table has no open order — empty state ......... FR-D1
│
├── POS-03 [SCREEN] Order workspace ........... FR-D3–D6, C1–C7, E1–E4, F1–F8
│   │   One screen, two variants: type=table and type=quick_sale.
│   │   Variants differ in affordances, never in layout family.
│   ├── [INLINE] Menu browser: categories → items ............... FR-C1
│   ├── [INLINE] Order line list, grouped by round .............. FR-E1, E2
│   ├── [INLINE] Totals panel (subtotal/discount/tax/svc/total) . FR-M4
│   ├── [INLINE] 86'd item DISABLED IN PLACE, never removed (≤3s) C-3, FR-C5, C6
│   ├── [INLINE] Fire blocked — pending line holds 86'd item .... FR-E4
│   ├── [INLINE] CATALOG_CHANGED refresh notice ................. FR-C7
│   ├── [INLINE] Settlement lock — YOUR draft, you can undo it .. FR-G12, C-5
│   ├── [INLINE] Settlement lock — ANOTHER client's lease ....... FR-G13, C-5
│   │   ├── [INLINE] Lines READ-ONLY under either lock: no remove
│   │   │       control, no void path, every slot empty ........ FR-G12, G13, H1, AC-3
│   │   └── [INLINE] Menu browser ABSENT under either lock —
│   │             add-line is blocked and it holds nothing to read FR-G12, G13, AC-21, AC-29
│   ├── [INLINE] PENDING line held while a draft/lease is active
│   │             (FR-G10 refuses the close, not the draft) ..... FR-G10, G12, G13
│   ├── [SHEET] Item configuration — variant + modifiers ........ FR-C2, C3
│   │   └── [INLINE] Item 86'd mid-selection; choices kept,
│   │                Add disabled, reason shown ................. FR-C6
│   ├── [INLINE] PENDING line — remove control in the trailing slot
│   │             (one tap, no prompt, nothing written) .......... FR-H2, AC-3, I-12
│   ├── [INLINE] FIRED line — the same slot RESERVED AND EMPTY;
│   │             the row body opens the void sheet ............. FR-H4, B-16, I-12
│   ├── [SHEET] Line editor — quantity, remove pending line ..... FR-D5, M5, H2
│   │   ├── [INLINE] table form — returns to the table workspace
│   │   └── [INLINE] quick form — returns to the QUICK workspace,
│   │             which carries no fire control ................. C-2, FR-E5
│   ├── [SHEET] Discount picker — presets ....................... FR-F2, F5
│   │   └── [SHEET] Free-form discount entry ................... FR-F3
│   │       └── [MODAL] Manager approval ....................... FR-A6, F3
│   ├── [SHEET] Remove / replace existing discount .............. FR-F8
│   │   └── [MODAL] Manager approval (whole-transition gate) ... FR-F8, A6
│   ├── [SHEET] Void fired line — reason required ............... FR-H4
│   │   └── [MODAL] Manager approval ........................... FR-A6, H4
│   ├── [SHEET] Void whole order ............................... FR-H3, H4
│   │   ├── [INLINE] Unfired order — no approval path .......... FR-H3
│   │   └── [MODAL] Manager approval (order holds FIRED line) .. FR-H4
│   └── [INLINE] Fire result — ticket printed / FAILED / UNKNOWN  FR-E3
│
├── POS-04 [SCREEN] Settlement .......................... FR-G1–G14, M5
│   │   Its own route, not a sheet over POS-03. Entering it acquires the
│   │   CheckoutLease (FR-G13); re-authentication preserves this tab's draft.
│   │   DESIGN-006 adds 13 fixture states inside the existing nodes below:
│   │   ceiling-single; zero-pending; pending-paid; error-keyed/partial/
│   │   settled/removed; cancel-empty/multi; cashsplit/partialcash/
│   │   exactcashsplit; change-mixed. See SCREEN-INVENTORY POS-04.
│   │   34 Frost settlement states; no node added or retyped. Counts unchanged.
│   │   Round 2 adds source-preserving cancel=1 and takeover ack=1 fixture
│   │   parameters within the existing modals, not additional named states.
│   ├── [INLINE] Balance remaining / fully allocated ............ FR-G5
│   ├── [INLINE] Draft tender list (client-side, unstored) ...... FR-G9
│   ├── [INLINE] Tender amount PREFILLED with the remaining
│   │             balance, editable in place. No split mode ..... FR-G2, G3, B-5, I-13
│   ├── [INLINE] Cash tender pad — persistent right-column panel,
│   │             never dismissed; choosing a method swaps it .... FR-G4, M5
│   │   └── [INLINE] Above cash limit — change or single-tender cap ..... FR-M5
│   ├── [INLINE] Card tender pad — same panel, card rules ....... FR-G3
│   │   └── [INLINE] Above remaining balance — rejected, max shown FR-G3
│   ├── [INLINE] Custom named tender — same panel ............... FR-G1
│   ├── [INLINE] Change due ................................... FR-G4, G6
│   ├── [INLINE] Zero-total settlement — no tenders needed ..... FR-G11
│   ├── [INLINE] Close blocked — table order has PENDING lines . FR-G10
│   ├── [MODAL] Re-authenticate to close (draft outlived actor) . FR-G9, A2
│   ├── [MODAL] Cancel payment — releases the lease, ungated .... C-5/I-5, FR-G13
│   ├── [MODAL] Lease lost / displaced by manager takeover ...... FR-G14
│   └── [MODAL] Manager lease takeover — external-charge ack .... FR-G14
│
├── POS-05 [SCREEN] Closed orders ................ [RULED IN] FR-G7, H5, H7
│   │   Search by table, time and amount. Never by receipt number — the
│   │   numbering format is an open product question (I-1).
│   └── [INLINE] Empty — no closed orders this business day
│
├── POS-06 [SCREEN] Closed order detail ......... [RULED IN] FR-G7, H5, H6, H7
│   ├── [INLINE] Receipt reprint result ........................ FR-G7, G8
│   ├── [SHEET] Refund — allocation editor + reason ............. FR-H5
│   │   └── [MODAL] Manager approval ........................... FR-A6, H5
│   ├── [INLINE] Zero total — Refund action ABSENT, not disabled  C-1, FR-G11
│   ├── [INLINE] Already REFUNDED — refund unavailable ......... FR-H6
│   └── [INLINE] Business day closed — void/refund blocked ..... FR-H7
│
└── POS-07 [SCREEN] Print incidents ........................... FR-E3, E6
    ├── [INLINE] Kitchen work / cancellation — emergency class .. FR-E3, H4
    ├── [INLINE] Receipt — lower-urgency class ................. FR-E6
    ├── [INLINE] Reprint result ............................... FR-E3
    └── [INLINE] Empty — no incidents

[MODAL] Manager approval — global to the POS client ........... FR-A6, A2c, A5
    Appears above POS-03, POS-04, and POS-06 wherever a gated action fires.
    Never a route. Never a mode. Never satisfied by a back-office session.
    ├── [INLINE] Wrong PIN — attempts remaining
    ├── [INLINE] MANAGER_APPROVAL throttle cooldown (5 min) .... FR-A5
    └── [INLINE] Cancelled — no partial state written .......... B-20, FR-J3
```

### POS screens the MVP deliberately does not have

- **No kitchen screen.** Kitchen is non-authenticating with no application
  commands (FR-A1). Paper only.
- **No settings, menu editing, user management, reporting, audit viewer, or
  end-of-day.** All back office (FR-B preamble, FR-I preamble, principle 8).
- **No "manager mode".** Approval is a modal at the moment of action (B-14).
- **No shared void/refund control.** POS-03 owns void, POS-06 owns refund;
  they never appear on the same screen (B-19, FR-H1).

---

## 3. Back-office client — `/back-office/`

Web, desktop, 1440 wide. Seated manager, dense tables. 30-minute idle,
8-hour absolute (FR-A2b). Visitor mode: Operate; Read characteristics in
reports and audit.

```
/back-office/
│
├── [GLOBAL] Back-office chrome ........................... FR-E3, E6, A2b
│   ├── [GLOBAL] Primary navigation (persistent sidebar)
│   ├── [GLOBAL] Kitchen print emergency banner ............ FR-E3
│   ├── [GLOBAL] Receipt print warning chip ................ FR-E6
│   ├── [GLOBAL] Business-day indicator ................... FR-I1
│   └── [MODAL]  Re-authenticate — idle timeout, form state kept  FR-A2b
│
├── BO-01 [SCREEN] Login .................................. FR-A2b, A5, A7
│   └── [INLINE] LOGIN throttle cooldown (5 min) .......... FR-A5
│
├── BO-02 [SCREEN] Today ......................... [MY CALL] FR-I1, E3, I2
│
├── Menu ................................................. FR-B4, C1–C5
│   ├── BO-03 [SCREEN] Items and categories ............... FR-B4, C1, B6
│   │   ├── [INLINE] 86 toggle per item row ............... FR-B6, C5
│   │   ├── [INLINE] 86 rejected — item on a leased order . FR-G13
│   │   ├── [MODAL] Category create / edit ................ FR-B4
│   │   ├── [INLINE] Category create refused — empty name . FR-B4
│   │   └── [INLINE] Empty — no items yet ................. FR-B4
│   └── BO-04 [SCREEN] Item editor ................... FR-B4, C1–C4, C7, C8
│       ├── [INLINE] Variants — single-select, ± delta .... FR-C2
│       ├── [INLINE] Modifiers — multi-select, ≥0 delta ... FR-C3
│       ├── [INLINE] No nested modifier groups ........... FR-C4
│       └── [MODAL] Archive item — snapshots unaffected ... FR-C8, B-8
│
├── BO-05 [SCREEN] Tables ................................ FR-B2, C8
│   ├── [MODAL] Table create / edit ...................... FR-B2
│   └── [INLINE] Deactivate rejected — table holds OPEN order  FR-C8
│
├── BO-06 [SCREEN] Users ................................. FR-B3, A1, A3, A4
│   ├── [MODAL] User create / edit — role assignment ..... FR-B3, A1
│   ├── [MODAL] Set / reset PIN ......................... FR-B3, A3, A4, J4
│   │   └── [INLINE] PIN not unique — rejected ........... FR-A4
│   └── [MODAL] Deactivate — invalidates POS session ..... FR-B3
│
├── BO-07 [SCREEN] Discount presets ...................... FR-B5, F5
│   ├── [MODAL] Preset create / edit .................... FR-B5
│   └── [MODAL] Deactivate — stays readable on orders ... FR-F5, C8
│
├── BO-08 [SCREEN] Settings ......................... FR-B1, M1, G1
│   ├── [INLINE] Currency + precision locked after first order  FR-B1, M1
│   ├── [INLINE] Custom payment methods (configuration) ...... [RULED IN] I-9, G1
│   ├── [MODAL] Payment method create / edit ................ [RULED IN] I-9
│   └── [MODAL] Rate change — applies to future orders only  FR-B1
│
├── BO-09 [SCREEN] End of day ............................ FR-I2, I3, I4
│   ├── [INLINE] Refused — list of still-OPEN orders ..... FR-I2
│   ├── [MODAL] Confirm close — irreversible ............ FR-I3, B-9
│   └── [INLINE] Already closed — report reprintable .... FR-I4
│
├── BO-10 [SCREEN] Reports — business day list ........... FR-I3, I4, I5
│   └── [INLINE] Empty — no closed day yet
│
├── BO-11 [SCREEN] Report detail — immutable snapshot .... FR-I5, I4
│   └── [INLINE] Reprint result ........................ FR-I4
│
├── BO-12 [SCREEN] Audit viewer .......................... FR-J1, J2, J3
│   ├── [INLINE] Filter by actor / action / order / day .. FR-J2
│   ├── [MODAL] Entry detail — before/after amounts ...... FR-J2
│   └── [INLINE] Empty — no entries match
│
├── BO-13 [SCREEN] Print incidents ....................... FR-E3, E6
│   ├── [INLINE] Kitchen work / cancellation — emergency . FR-E3
│   ├── [INLINE] Receipt — lower urgency ................ FR-E6
│   └── [INLINE] Reprint result ........................ FR-E3
│
└── BO-14 — Security telemetry viewer .......... DEFERRED, ruling I-3
      Cut from the MVP. FR-A5/J3 keep the store separate from the audit log and it
      is written to this release; nothing reads it. Recorded so the gap is visible.
```

### Back-office screens the MVP deliberately does not have

- **No order entry, tender, fire, void, or refund.** Configuration commands
  never mutate order or tender state (FR-G12). The back office observes
  orders; it never operates them.
- **No approval-granting surface.** A back-office session never satisfies a
  POS approval (FR-A2c, AC-27). There is no "approve remotely" control.
- **No kitchen display.**
- **No security-telemetry viewer.** Deferred by ruling I-3.

---

## 4. Cross-client nodes

Two things appear in both trees and must be structurally recognisable as the
same object without being the same component (NFR-5: touch and data-table
components stay independent).

| Node | POS | Back office | Requirement |
|---|---|---|---|
| Kitchen print emergency | `[GLOBAL]` banner + POS-07 | `[GLOBAL]` banner + BO-13 | FR-E3, AC-33 |
| Receipt print warning | `[GLOBAL]` chip + POS-07 | `[GLOBAL]` chip + BO-13 | FR-E6, AC-33 |

The two urgency classes must never share a visual weight, a placement, or a
dismissal behaviour, in either client (FR-E6, AC-23). In greyscale that is
carried by size, position, persistence, and whether an explicit action is
required to clear it — not by colour, which is out of scope for this
prototype.

## 5. Cross-client handoffs the structure must show

1. **86 → POS.** BO-03 toggle → POS-03 menu browser reflects it within 3s
   (FR-C6, AC-12). Not navigation; a live data effect the prototype must fake
   visibly.
2. **Kitchen print failure → both clients.** One incident, two surfaces
   (FR-E3, AC-33).
3. **End-of-day refusal → POS.** BO-09 lists open orders; the manager settles
   or voids them at POS-03/POS-04, then retries (FR-I2). The prototype must
   walk this, even though the two clients do not link to each other.
4. **User deactivation → POS.** BO-06 deactivate → POS-01 shows the
   session-invalidated state on the next authenticated request (FR-B3, AC-32).
5. **Lease → back office.** An active CheckoutLease on a quick-sale order
   causes BO-03's 86 toggle to be rejected, naming the order (FR-G13, AC-29).
