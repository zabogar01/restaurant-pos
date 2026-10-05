# DESIGN-011 — Back-office design audit

Written by design011 on 2026-10-05. This is a read-only audit and a proposed work breakdown, not a design approval or a product ruling.

## Recommendation

Do not hand the back office to a builder as a complete Frost specification yet. All thirteen wireframe pages exist, but only BO-03 and BO-11 have Frost artifacts. Required states, editable form behavior, preservation through re-authentication, and incident recovery remain incomplete. Start with the shared desktop shell and M-6, then deliver the screen slices below. Preserve the existing desktop density and report structure; the work does not require another visual direction.

Two input assumptions need correction. The eleven pages without Frost artifacts are actually greyscale: each imports only `../wireframe.css`, whose root palette is greyscale. Neither `wireframe.js` nor the gallery injects Frost into those pages. The variable remap is in `visual-directions/visual.css:24–47`, used by the two Frost artifacts, not the eleven prototype pages. Also, I-8 is no longer an accurate account of the PRD: current FR-J3 explicitly includes back-office kitchen-ticket reprints in the audit list. The inventory and BO-13 annotation still say otherwise. This report flags that conflict; it does not settle gating or edit the contract.

The most consequential gaps are the absent global incident compositions, the lack of a demonstrated preserved form behind M-6, the menu's misleading row actions and non-sticky overflow header, the report's omitted zero figures, and the audit viewer's missing current FR-J3 outcomes. The 51 authored links from the two Frost pages into the prototype are confirmed and mapped below.

## Evidence and reading convention

The following abbreviations make the file-and-line citations shorter without changing their meaning:

| Abbreviation | Repository path |
|---|---|
| `I` | `docs/design/SCREEN-INVENTORY.md` |
| `D` | `docs/DESIGN.md` |
| `S` | `docs/design/SITEMAP.md` |
| `P/<file>` | `docs/design/prototype/back-office/<file>` |
| `F/<file>` | `docs/design/visual-directions/frost/back-office/<file>` |
| `W` | `docs/design/prototype/wireframe.css` |
| `V` | `docs/design/visual-directions/visual.css` |
| `T` | `docs/design/tokens/frost.css` |

“Drawn” means that a visible composition exists, including a state embedded in the normal page. It does not mean the interaction works or the composition meets Frost. “Missing” means no composition demonstrates the requirement; a note promising it is not evidence. An inventory state explicitly marked n/a remains n/a, rather than becoming invented design work. Missing states cite the page's state declaration and the inventory that requires them. P1 findings need resolution before the affected frontend slice; P2 findings need correction in that slice. These priorities concern design readiness, not a claim about defects in a built back-office application.

I read the role and task, the cited inventory and sitemap sections, the relevant PRD requirements and all boundaries, the Frost system and token registry, all thirteen back-office wireframes, both Frost pages, their imported styles/runtime, the gallery and manifest, and the DESIGN-009 brief and Handoffs. The seven POS artifact entry points and their relevant shared patterns were inspected for comparison, particularly the walkable closed-order fixtures and per-incident recovery. POS work is not re-audited here.

### Browser inspection

Headless installed Chrome through Playwright ran at a 1440×900 viewport after sandbox escalation was approved. One batched crawl visited **67 prototype states and 12 Frost states, 79 total**, with zero page JavaScript errors. It recorded computed styles, bounding rectangles, visible text, controls and links. Screenshots were captured for every default and the selected modal, overflow, empty-day and cancellation states. I visually inspected the two Frost defaults, the Frost category-invalid modal, and the prototype settings, staff editor, re-authentication and cancellation screens. There was no stylesheet injection or alteration of the source pages.

The script is `/private/tmp/design011-audit.cjs`; measurements and screenshots are in `/private/tmp/design011-evidence/`, including `measurements.json`. These are temporary evidence, not committed deliverables. Prototype screenshot widths include the annotation rail: its device rectangle measured 1440px, while the whole authoring document measured 1852px. That outer authoring scroll is not reported as a product overflow defect. All inspected device interiors had zero horizontal scroll-width excess; that does not prove long text or larger monetary values fit.

| Measured property | Prototype pages | Frost artifacts | Authority and interpretation |
|---|---|---|---|
| Device width | 1440px | 1440px | Both meet `D:801`. |
| Navigation width | 220px | 220px | Both meet `D:801–804`. |
| Brand height | 48.84px | 64px | Prototype differs from `D:802`; `W:287` versus `V:166`. |
| Top bar | 52px | 64px | Prototype differs from `D:805`; `W:294` versus `V:172`. |
| Content padding | 20px | 24px | Prototype differs from `D:805–806`; `W:295` versus `V:173`. |
| Office body | 13px | 14px | Prototype differs from `D:710`; `W:285` versus `V:164`. |
| Standard / small buttons | 34px / 26px | 36px / 28px | Prototype differs from `D:963–970`; `W:306–309` versus `V:177–178`. |
| Small fields | 40px | 40px | The inherited geometry already agrees with `D:1044–1046`. |
| Office modals | 640px, 3px border, square | 640px, 1px border, 2px radius | Width agrees; prototype treatment differs from `D:1068–1075`. |
| Frost menu overflow | — | 1058.16px document height, 20 rows | Scrolling is real, but the header is static. |
| Frost report default | — | 945.91px document height | Ordinary vertical scrolling is allowed by `D:809–811`. |

The Frost menu overflow header moved from y=165.42 to y=7.42 when the document scrolled 158px, and computed `position` was `static`. It does not stick. Pressing Tab after opening `category-invalid` focused the background Today link. Selected Menu navigation retained ink `rgb(3,33,37)` and white text on hover, correctly preserving `D:1187–1193`. None of the 79 rendered device states contained an `input`, `select`, or `textarea`; all apparent back-office fields are static boxes.

No application tests or `npm run verify` were run: this task changes only this report. No assistive-technology, physical-device, production performance, or application integration certification is claimed. The Impeccable context loader and audit guidance were used; its generic detector was not run. Direct source inspection and the browser crawl supplied the task-specific evidence. Light-only and desktop-only are explicit requirements, so absent dark/mobile variants and desktop controls below 44px are not findings (`D:758–760`, `D:963–970`, `D:1265`).

## Shared findings that apply to the screen sections

**S1 — P1: the authenticated shell has no complete global state model.** `S:240–246` requires persistent navigation, the kitchen emergency banner, receipt warning chip, business-day indicator and M-6. Only `P/today.html:38–51` demonstrates both alert classes; most pages, including `F/menu.html:38` and `F/report-detail.html:36–38`, have only a local title/subtitle. Those are not demonstrations that a kitchen failure remains visible while configuring or reading another page. The Today emergency sits inside scrolling content and uses a generic banner. Add shared normal, kitchen, receipt, combined and re-authenticated compositions in the first slice, with the same incident identity across routes. Do not add POS operation or remote approval controls (`S:310–319`, FR-A2c, FR-E3/E6).

**S2 — P1: the greyscale wireframe is not a Frost fallback.** The measured differences above originate at `W:285–324`. Navigation also retains an accent border, uppercase widely tracked sections and grey fill; tables use 13px cells and `9px 10px` padding, and cards have 14px bold titles and 16px padding. Their Frost authorities are `D:707–730`, `D:801–811`, `D:1138–1157` and `D:1187–1193`. Every prototype page cites this issue through its `:5` stylesheet link. No existing back-office page was found using 72px or 88px POS actions. The problem is obsolete desktop styling, not actual imported POS touch geometry. Keep the independently specified 36px/28px desktop actions.

**S3 — P1: static fields and generic links do not demonstrate configuration.** The browser found no native form controls. Examples are `P/item-editor.html:54–59`, `P/users.html:81–87`, `P/settings.html:49–59`, and `F/menu.html:143–152`. DESIGN already specifies field rest/invalid treatment and labelled dialogs (`D:1043–1075`), but neither the prototype runtime (`docs/design/prototype/wireframe.js:24–43`) nor Frost runtime (`docs/design/visual-directions/mockup.js:24–43,112–115`) implements editing, field-error recovery, focus placement, focus containment, or return focus. The category modal has dialog semantics in Frost, yet keyboard focus escapes to Today. Future artifacts need walkable local fixtures for save, refusal, cancel and preserved draft, following DESIGN-009's fixture standard rather than implementing real services.

**S4 — P1: prototype monetary fixtures predate this installation.** Decimal money appears in `P/today.html:83–85`, `P/menu.html:77–102`, `P/item-editor.html:58–59,86–122`, `P/tables.html:40,56–60`, `P/presets.html:56`, `P/end-of-day.html:51–53,71–72`, `P/reports.html:51–60`, `P/report-detail.html:65–108`, `P/audit.html:69–87,132–134` and `P/incidents.html:83`. `P/settings.html:57–59` explicitly sets IDR precision to 2. All must use whole-rupiah fixtures at precision 0 under PRD §4/FR-M1 and `D:745–754`, with bare aligned figures and currency context once per group where specified. This is not permission to scale every stale number mechanically: construct coherent fixtures and document their arithmetic, as DESIGN-009 does at `:457–472`.

**S5 — P2: raw values are evidence to migrate, not automatically missing tokens.** The old Frost artifacts intentionally depend on raw extraction sources, `V` and `structure.css`; BO-03 additionally imports `frost-states.css`. Their raw values are not proof the registry lacks those values. `D:486–506` and `frost.tokens.json:5` require honest provenance. New screen-specific styling should consume the registry; reuse the existing office sizes, colors and spacing instead of copying inline values or borrowing POS-specific semantic tokens. The concrete remaining proposals are listed under Tokens below.

## BO-01 — Login

**Exists:** `P/login.html` only; no Frost artifact. State authority: `I:539–560`. Its declaration is `P/login.html:6–8`.

| Required state | Coverage |
|---|---|
| Empty / resting | **Drawn**, `default`, `P/login.html:38–43`; this is a populated example, not an editable blank form. |
| Loading | **Drawn**, `loading`, `:34–36`. |
| Wrong credentials | **Drawn**, `error`, `:20–23`. |
| Permission denied: cashier PIN | **Drawn**, `denied`, `:24–28`. |
| Overflow | Not applicable in the inventory (`I:549`). |
| LOGIN throttle | **Drawn**, `throttled`, `:29–33,42–43`. |

**P1.** Loading keeps the Sign in link live because its only exclusion is `throttled` (`:42`). The new fixture needs a pending state whose action cannot falsely navigate to Today before verification, and an editable entry/retry path. This follows the meaning of `I:547` loading and FR-A2b/A5; it is not a new authentication policy. S2 and S3 apply. The 420px panel and 18px bold “Back office” at `:15–16` have no reviewed login composition; use the desktop type hierarchy in `D:715–725`, not the POS PIN keypad.

The staff-number field at `:38–39` is an assumption not specified by FR-A2b or `I:539–560`; it is not established solely because a wireframe contains it. Question Q4 asks the owner to confirm the credential identifier. Keep the manager-only denial, shared LOGIN cooldown and session separation. No separate approval gate or security-telemetry viewer is authorized (FR-A2c, I-3).

## BO-02 — Today

**Exists:** `P/today.html` only. State authority: `I:564–578`; declaration `P/today.html:6–8`.

| Required state | Coverage |
|---|---|
| Empty | **Drawn**, `empty`, `:58,61,66,79`. |
| Loading | **Missing**, no declared or conditional composition. |
| Error | **Missing**, no declared or conditional composition. |
| Permission denied | Not applicable (`I:571`). |
| Overflow | **Missing**; the only open-order table has three rows (`:80–87`). |
| Business day open | **Drawn**, `default` and `ready`, `:38,57–72`. |
| Open orders outstanding | **Drawn**, `default`, `:57–59,80–87`. |
| Emergency incident present | **Drawn**, `incident`, `:44–51`; not Frost. |

**P1.** The emergency is a 15px generic bordered banner in scrolling content (`:42–51`), not the persistent solid-red Frost emergency at `D:1159–1171`. The receipt chip at `:39–40` is a useful structural distinction to preserve, but S1 requires it across the shell. S2 and S4 apply. The 32px counters (`:57–66`) are a design choice supported by an existing size token, not a missing font token.

The page correctly observes orders without offering settle, fire, void or refund (`:80–89`; `I:577–578`). I-2 is **kept**, not pending: the annotation's “If it is cut” at `:121–122` is obsolete against `I:985`. The closed-order count and ready state are supporting information within that existing landing purpose, not authorization for a new analytics dashboard. Day-boundary language depends on Q2.

## BO-03 — Items and categories, including the Frost menu review

**Exists:** both `P/menu.html` and `F/menu.html`. State authority: `I:588–610`. Declarations: `P/menu.html:6–8`, `F/menu.html:6–8`.

| Required state | Prototype | Frost |
|---|---|---|
| Empty | **Drawn**, `:67–71` | **Drawn**, `:69–73` |
| Loading | **Drawn**, `:61–62` | **Drawn**, `:63–64`; inherited skeleton |
| Error | **Drawn**, `:64–65` | **Drawn**, `:66–67` |
| Permission denied | Not applicable | Not applicable (`I:589–590`) |
| Overflow | **Drawn**, `:106–132`, incomplete | **Drawn**, `:108–134`, incomplete |
| Item 86'd | **Drawn**, `:46–51,83–85` | **Drawn**, `:48–53,85–87` |
| Quick-sale lease rejection naming the order | **Drawn**, `:39–44` | **Drawn**, `:41–46` |
| Item archived | **Drawn**, retained Winter Stew row, `:101–102` | **Drawn**, `:103–104` |
| Category-invalid | **Missing** | **Drawn**, `:138–152`; recovery is missing |

**P1.** Overflow promises a sticky header (`F/menu.html:133`) but has no sticky rule, as measured. It also removes every row's 86 action (`:108–132`) although BO-03's purpose and FR-B6 apply to a long menu too. Keep the availability action, sticky column names, complete prices and availability; use a real long fixture rather than changing the task the table supports (`I:584,590–593`). The heading says 34 items but the overflow table has 20 rows (`:57,111–130`), with no paging explanation. Empty still says eight items and four categories (`:57,69–73`). These are P2 fixture inconsistencies to correct in the same work.

**P1.** Row identity is not preserved. Burger, Wings, Fish, Salad, Fries and Soda all navigate to the state announcing “Steak is now marked 86” (`F/menu.html:49,80,83,92,95,98,101`); all Edit links open the default Burger editor; Winter Stew's View does the same (`:104`, `P/item-editor.html:36,54`). A usable fixture must carry the clicked item through toggle, edit, archive, cancel and return. This is a failure to draw FR-B4/B6 and the archived state, not an invitation to add a new product feature. The 30 editor destinations are mapped individually by row below.

**P1.** The category-invalid appearance is correct in Frost: 40px field, 2px amber invalid border, “Enter a name”, and disabled Create (`:144–152`; `D:1052–1066`). However, no text can be entered to enable it, and the ordinary Create does not lead through the empty-name refusal. The fixture only pictures the final refusal. Category edit and a category-management entry are missing altogether; only New category exists (`:59,138–152`, `P/menu.html:57,136–149`), despite `S:256–257` and FR-B4. Add category create/edit and validation within this screen, not an unauthorized extra page.

The Frost default's measured geometry meets the current 14px body, 30px heading, 220px rail, 64px top bar, 36px/28px actions and table spacing. Its selected navigation hover is correct. Money is whole rupiah and `mockup.js:118` supplies the group currency label. It still inherits the skeleton from `structure.css:84–86`, and its modal fails the keyboard test in S3. The inline widths at `F/menu.html:76–77,109` need screen-specific layout decisions under S5, not indiscriminate token creation.

The Frost 86 explanation correctly says disabled in place (`:50`); the prototype says “disappears” (`P/menu.html:48`), contradicting C-3 (`I:1006`) and AC-12. Keep C-4's quick-sale-only rejection (`I:1007`); do not extend it to table settlement. The present wording “Try again once that order is closed” (`F/menu.html:45`) is narrower than FR-G13's “while the lease holds”: a released lease also removes that cause. Propose “Try again when payment is no longer in progress.” There is no new open product ruling on BO-03; the missing category workflow and token adoption are design work.

The cross-client 86 handoff is described, not demonstrated: `F/menu.html:48–53` changes local copy, while the shared fixture runtime only hides and reveals the current document's elements (`mockup.js:24–43`). `S:342–344` requires a visible simulated POS effect. The menu slice should pair its changed item with the matching POS unavailable state as review evidence, without introducing a product navigation link between clients or claiming a real three-second integration test.

## BO-04 — Item editor

**Exists:** `P/item-editor.html` only. State authority: `I:614–639`; declaration `:6–8`.

| Required state | Coverage |
|---|---|
| Empty / new item | **Drawn**, `new`, `:54–59,98,124`. |
| Loading | **Missing**. |
| Validation error | **Drawn**, `error`, `:40–43`; offending field is missing. |
| Permission denied | Not applicable (`I:622`). |
| Overflow | **Drawn**, `overflow`, `:90–97,114–123`; measured device height 1021.97px. |
| Unsaved changes | **Drawn**, `unsaved`, `:37,44–47`; restoration through M-6 is **missing**. |
| Immutable currency context | **Missing** in the device. Only the annotation at `:172–173` mentions it. |

**P1.** Add variant and Add modifier merely set `unsaved`; Remove uses `href="#"`; there is no editable option row (`:86–128`). The error says a delta contains “twelve”, but every visible delta remains numeric (`:42,85–88`). Draw the actual editable field and its inline error, using `D:1052–1066`, and preserve the single-select variant / nonnegative multi-select modifier distinction from FR-C2/C3. S2–S4 apply.

**P1.** New item still offers Mark 86 and Archive item (`:65–77`) and opens “Archive Burger?” (`:143`). Those controls imply a saved item exists when it does not. The editor must preserve the subject received from BO-03, and its archive confirmation must return a visibly archived subject while preserving historical snapshots (`I:623–625`, FR-B4/C8, B-8). Archive itself is authorized by `S:263`; the defect is its context, not the presence of the confirmation. The existing Mark 86 shortcut is broader than the inventory's editor nodes but supported by FR-B6; the designer should either keep it subject-correct or concentrate availability on BO-03. No stock, nested modifiers or ex-tax fields were found. M-6 and Q3 must resolve the unproved preserved-draft behavior.

## BO-05 — Tables

**Exists:** `P/tables.html` only. State authority: `I:643–659`; declaration `:6–7`.

| Required state | Coverage |
|---|---|
| Empty | **Drawn**, `empty`, `:48–51`. |
| Loading | **Missing**. |
| Error | **Missing** as a general request/save failure; the specific deactivation refusal is separate. |
| Permission denied | Not applicable (`I:650`). |
| Overflow | **Missing**. |
| Deactivation rejected for OPEN order | **Drawn**, `rejected`, `:38–42`. |
| Deactivated table retained for history | **Drawn**, Terrace 1 row, `:66–67`. |

**P1.** The Table 3 refusal names Table 1, and every Edit or New table opens the populated Table 2 editor (`:46,57–61,79–80`). Successful Deactivate merely returns to the unchanged list (`:59,63,65`). Give each row a subject-correct create/edit/refusal/success walk. Naming the blocked order is required by `I:656–658`, FR-C8 and AC-32. Keep inactive tables free of OPEN orders; the existing inactive example does comply.

S2 and S4 apply. The static count says twelve active and two inactive while six rows are drawn, including one inactive (`:44,56–67`); the empty state keeps that count. This is P2 fixture inconsistency. Seats (`:54,80`) and Reactivate (`:67`) are not expressly specified by `I:643–659` or FR-B2; Q5 separates owner confirmation of these affordances from the required create/edit/deactivate work. No merge, transfer or split controls were found.

## BO-06 — Users

**Exists:** `P/users.html` only. State authority: `I:663–685`; declaration `:6–8`.

| Required state | Coverage |
|---|---|
| Empty | **Drawn**, `empty`, `:42–45`. |
| Loading | **Missing**. |
| Error | **Missing** as general load/save failure; PIN collision is separately drawn. |
| Permission denied | Not applicable (`I:669`). |
| Overflow | **Missing**. |
| PIN not unique | **Drawn**, `pinclash`, `:105–111`. |
| Deactivation invalidates POS session on next request | **Drawn** as advance warning, `deactivate`, `:130–138`; completed deactivation/cross-client outcome is **missing**. |
| Kitchen staff without PIN | **Drawn**, `:60–65`, with no Reset PIN action. |

**P1.** Every staff row's Edit, Reset PIN and Deactivate uses the same generic route and Ana R. subject (`:51–65,78–87,103,130`). A kitchen-row deactivation therefore pictures an authenticating cashier and a PIN effect that cannot apply to that kitchen classification. Add person also opens Ana, and Set PIN always leads to collision (`:40,122`). Draw subject-correct new/edit, role change, reset success, collision recovery and deactivation result, preserving the next-authenticated-request timing of FR-B3. Use field-level refusal styling for the PIN collision (`D:1052–1066`), without revealing any PIN value (FR-J4, B-12).

S2/S3 apply. The explanatory line about kitchen staff making “shifts and audit trails” make sense (`:70–71`) implies capabilities outside this classification: FR-A1 grants kitchen no commands, and labor reporting is out of scope in PRD §8. Replace it with the already-supported no-sign-in explanation. The empty state tells a manager to add the first manager (`:44`); its entry conditions are unspecified in a manager-only session. Q4 covers identity/bootstrap, and Q5 covers Reactivate (`:67`). No waiter, PIN reveal, or approval-granting surface was found.

## BO-07 — Discount presets

**Exists:** `P/presets.html` only. State authority: `I:689–711`; declaration `:6–7`.

| Required state | Coverage |
|---|---|
| Empty | **Drawn**, `empty`, `:42–46`. |
| Loading | **Missing**. |
| Error | **Missing**, including invalid percentage/fixed-amount examples. |
| Permission denied | Not applicable (`I:695`). |
| Overflow | **Missing**. |
| Deactivated preset hidden from picker, retained on orders | **Drawn** as inactive row and confirmation explanation, `:60–61,92–100`; a completed transition is **missing**. |

**P1.** All create/edit/deactivate paths show Staff meal regardless of the clicked subject (`:40,53–59,75–77,92`); fixed-amount editing is not demonstrated. The kind controls are static spans, and Save cannot validate the 0–100% rule or nonnegative bounded amount (`:76–84`). Draw both kinds, inline validation and preserved values through error/cancel under FR-B5, FR-M5 and `D:1052–1066`. S2–S4 apply. Reactivate (`:61`) needs Q5 rather than silently expanding FR-B5. The page appropriately omits scheduling, auto-apply and stacking; keep I-11's back-office confirmations without turning preset configuration into a POS approval gate.

## BO-08 — Settings

**Exists:** `P/settings.html` only. State authority: `I:715–738`; declaration `:6–8`.

| Required state | Coverage |
|---|---|
| Empty / first run | **Drawn**, `firstrun`, `:53,59,67–70`; populated fixture, not a blank installation walkthrough. |
| Loading | **Missing**. |
| Validation error | **Drawn**, `error`, `:39–42`; no offending field or correction is demonstrated. |
| Permission denied | Not applicable (`I:723`). |
| Overflow | Not applicable in the inventory (`I:724`); growing custom methods still need a bounded layout. |
| Currency and precision locked | **Drawn**, `default`, `:49–65`, but the precision value is wrong. |
| New rate version affects future orders only | **Drawn** as confirmation copy, `ratechange`, `:126–141`; saved new rate/version is **missing**. |

**P1.** IDR precision 2 at `:57–59` contradicts PRD §4/FR-M1. Both rate Change links open “Change the tax rate”, including the service-charge row (`:78,81,129`). Both custom Edit links and Add payment method open Meal voucher (`:99–104,151`). Deactivate and Save return to unchanged settings (`:99–101,121,140,163`). Draw subject-correct rate and method flows and field-local errors. FR-B7 now explicitly authorizes custom method create, rename and deactivate; I-9 is settled, not a request to invent names on the POS. No new payment integration is warranted.

S2/S3 apply. The 120px rate fields contain six decimal places in a percent representation (`:77,80`), and the tax field visibly wraps its percent sign. One part per million is precision of the fractional rate; six decimal places of a displayed percent would imply finer precision if all accepted. Propose at most four decimal places in percent display/input, converted exactly to ppm, with the allowed range left open (FR-M5; Q6). The 120/160px widths are unreviewed layout values, not registry defaults.

The receipt business fields at `:112–115` are illustrative. Their mandatory status and fiscal completeness are not decided by FR-B1; PRD §9 leaves receipt content open. Name that dependency without specifying a fiscal form. Rate range and receipt content are owner questions; neither should block drawing the already-decided locked currency and future-orders-only states.

## BO-09 — End of day

**Exists:** `P/end-of-day.html` only. State authority: `I:742–772`; declaration `:6–8`.

| Required state | Coverage |
|---|---|
| Empty | Not applicable; a business day is always open (`I:749`). |
| Loading / closing | **Drawn**, `loading`, `:78–82`. |
| Command error | **Missing**. |
| Permission denied | Not applicable (`I:753`). |
| Overflow refusal list | **Missing**; refusal contains three rows (`:48–55`). |
| Refused: OPEN orders | **Drawn**, `refused`, `:40–61`. |
| Ready to close | **Drawn**, `default`, `:64–75`. |
| Closed, report stored, next day open | **Drawn**, `closed`, `:84–94`. |
| Already closed, second close rejected | **Drawn**, `already`, `:96–103`. |

**P1.** Check again always navigates to ready, and the confirm action jumps directly to closed (`:57,118`). That does not demonstrate the authoritative refusal if an order appears between readiness and close, nor failure/recovery during the transaction (`I:750–758`, FR-I2). Add distinct error and long refusal compositions and a fixture path through loading that can reach a refreshed refusal. Keep the selected business-day identity through confirm, error, already closed and report links; do not accidentally close the next day when retrying a previous result (FR-I3/I4).

S2/S4 apply. The 28px monetary figures at `:70–72` are not an existing Frost type size; use the registered 30px headline or 32px figure role after review rather than introducing an incidental 28px type token. I-6 already forbids links into POS (`I:989`): the current separate-client instruction and Check again are correct. I-10 rules out bulk void; I-11 supports the irreversible-close confirmation. No force close, bulk void, adjustment or post-close correction control was found. Q2 is necessary because current PRD day-boundary statements disagree; post-close corrections remain outside this task.

## BO-10 — Reports list

**Exists:** `P/reports.html` only. State authority: `I:776–788`; declaration `:6–7`.

| Required state | Coverage |
|---|---|
| Empty: no closed day | **Drawn**, `empty`, `:39–43`. |
| Loading | **Missing**. |
| Error | **Missing**. |
| Permission denied | Not applicable (`I:783`). |
| Overflow | **Missing**; four rows and no pagination (`:45–63`), despite the annotation at `:81–82`. |

**P1.** Rows for different days open the same default 9 September report (`:50–61` and `P/report-detail.html:35,47`). The 7 September row says six closed orders but opens “no orders” (`P/reports.html:56–58`, `P/report-detail.html:52–55`). Carry the stored day identity and consistent count/figures across list/detail/return, following FR-I3/I5 and B-9. S2/S4 apply. Pagination is needed to realize `I:782–783`; it must browse stored snapshots, not become a recomputed date-range report. The existing Open action is read navigation and does not violate the no-order-operation boundary. No new report types were found.

## BO-11 — Report detail, including the Frost artifact review

**Exists:** both `P/report-detail.html` and `F/report-detail.html`. State authority: `I:792–823`; declarations `:6–7` in both files.

| Required state | Prototype | Frost |
|---|---|---|
| Empty day with stored report | **Drawn**, `:52–56`, incomplete | **Drawn**, `:53–57`, incomplete |
| Loading | **Missing** | **Missing** |
| Error | **Missing** | **Missing** |
| Permission denied | Not applicable | Not applicable (`I:799`) |
| Overflow with complete figure set | **Missing** as a stress fixture | **Drawn** by default vertical overflow, `:59–116`; long names/large aggregates remain untested |
| Reprint result | **Drawn**, `:40–44` | **Drawn**, `:41–45`; outcome coverage incomplete |

The Frost default retains the full FR-I5 structure: sales gross/refund/net, the three tax/service/discount columns, tender movement by method, separate closed/refunded counts, whole-order void count/value, and both fired-line snapshot value and actual total reduction (`F/report-detail.html:63–109`). Its rows reconcile additively: 2.483.500 minus 155.925 equals 2.327.575; tender gross and net sums equal the sales rows. Values are bare whole rupiah, tabular and right-aligned; the runtime adds IDR once (`mockup.js:119–120`). The measured 945.91px height is allowed, not a reason to compress the figures into 900px (`D:809–811`). These are strengths to retain.

**P1.** Empty day hides every figure and replaces them with a paragraph claiming zero (`F/report-detail.html:53–59`; prototype `:52–58`). FR-I5 and `I:804–822` require the whole figure set, including a day with no orders. Draw actual zero rows with the same headings, tender interpretation and printable stored-report identity. Reprinting that empty day currently opens the populated default report (`F/report-detail.html:38`), another B-9 identity failure.

**P1.** Reprint says a failed report appears under Printing “at receipt urgency” (`F/report-detail.html:43–44`, prototype `:42–43`). FR-I4 grants reprinting and B-15 prevents print failure from gating the day, but neither FR-E6 nor `I:868–883` defines a report-print incident class. This is an unratified extension of BO-13; Q7 asks the owner for the policy. Meanwhile draw request pending, sent, known failure and unknown outcome without claiming sent means printed, preserving the report and day. This follows the separate sent/server-result pattern in DESIGN-009's Handoff `:424–435` without deciding the incident category.

**P2.** The leading metadata card does not receive the flat header treatment that `D:1154–1157` specifies. `V:189–190` uses `.bocontent > .card:first-child`, but the first child is the hidden reprint banner (`F/report-detail.html:41`), so the card at `:47` stays white and bordered even in default. Give the metadata header an explicit role/class rather than relying on sibling position. S1 and S5 also apply. Report figures are CSS-grid divs (`:63–109`), so the shared work should specify semantic row/column associations for assistive reading, not just visual alignment.

**P2.** Labels “included tax 10%” and “service charge 5%” (`:67–68`) suggest one rate for the entire day, while FR-B1 allows settings versions during the day. Use “Included tax” and “Service charge” for aggregates unless a stored snapshot expressly supports a single-rate label. The source order dataset is absent, so row arithmetic alone is not AC-16 verification. The final slice must supply coherent stored fixtures and verify aggregation instead of recomputing a report from current settings. Day identity/time labels also depend on Q2. No hourly, item or labor breakdown is present, correctly respecting `I:823`.

## BO-12 — Audit viewer

**Exists:** `P/audit.html` only. State authority: `I:827–856`; declaration `:6–8`.

| Required state | Coverage |
|---|---|
| Empty: no entries yet | **Drawn**, `empty`, `:54–57`. |
| Empty: no filter match | **Drawn**, `nomatch`, `:58–62`. |
| Loading | **Drawn**, `loading`, `:49–50`. |
| Error | **Drawn**, `error`, `:51–52`. |
| Permission denied | Not applicable (`I:834`). |
| Overflow / paging / filtering | **Drawn**, `overflow`, `:39–46,92–116`, but not walkable. |
| Approved action: one actor-and-approver entry | **Drawn**, `:68–70,74–82`. |
| Failed approval, approver null | **Drawn**, overflow row `:102`. |
| Cancelled approval, approver null | **Drawn**, `:71–73,98`. |
| Entry detail: before/after and business reason | **Drawn**, `entry`, `:121–147`. |

**P1.** Current FR-J3/AC-18 require approved-then-REFUSED refund outcomes, refusal code and no money fields, plus back-office kitchen reprint entries naming actor, order and round. Neither is drawn in `:64–116,121–147`; the supposedly exhaustive action annotation at `:159–161` is stale. Add these cases without merging them with failed/cancelled approval or login telemetry. Preserve I-3's deferred BO-14 and the append-only restriction. The inventory's own exhaustive list at `I:845–848` also needs lead reconciliation against the current PRD; it is not permission to omit current audited actions.

**P1.** Every Open shows the same refund even when the row is a cancelled approval or a void (`:70–88,124–134`). Overflow removes Open entirely, and Older links to itself (`:94–116`). Draw subject-correct read-only detail and working page/filter context. Before/after discount rows currently show preset names/percentages instead of monetary context (`:80–84`), and the refund detail labels the order total after refund as zero (`:132–133`). FR-J2 requires intelligible before/after amounts, while the stored charge must remain historical (B-8; FR-H5/H6). Q8 asks for precise display semantics; do not invent an order-total rewrite to illustrate a refund.

S2–S4 apply. The detail timestamp has seconds (`:125`), conflicting with the current display convention HH:MM WIB in PRD §9. The native filter interactions and their semantics are not demonstrated by static boxes (`:41–45`). The existing two empties, named human actors, absent mutation menus and absence of PIN values are correct and should survive the Frost conversion.

## BO-13 — Print incidents

**Exists:** `P/incidents.html` only. State authority: `I:860–883`; declaration `:6–8`.

| Required state | Coverage |
|---|---|
| Empty | **Drawn**, `empty`, `:43–46`. |
| Loading | **Drawn**, `loading`, `:39`. |
| Error | **Drawn**, `error`, `:40–41`. |
| Permission denied | Not applicable (`I:869`). |
| Overflow | **Missing**; only one kitchen and one receipt row are shown. |
| Emergency: kitchen work | **Drawn**, `default`, `:54–64`. |
| Emergency: cancellation | **Drawn**, `cancel`, `:65–73`. |
| Warning: receipt | **Drawn**, `:75–87`. |
| UNKNOWN versus FAILED | **Drawn**, `:63,68,72–73,84`; receipt UNKNOWN is **missing**. |
| Reprint result | **Drawn**, `reprint`, `:49–52`, but tied to the wrong subject on some paths. |

**P1.** All reprints use `?state=reprint` (`:64,69,85`). Reprinting a cancellation replaces it with the work-ticket row; a receipt reprint gets a kitchen-specific confirmation. Preserve incident and class through every result, including multiple simultaneous incidents. A cancellation must never turn into new work (B-16; FR-H4); UNKNOWN cannot be presented as known failure. The heading claims “The kitchen has not seen this work” even in the UNKNOWN cancellation state (`:56` versus `:72–73`); use uncertainty-preserving wording.

**P1.** There is no explicit kitchen acknowledgement/clear path, no receipt dismiss path, and no demonstrated cross-client resolution. The empty copy “Every ticket and receipt has printed” (`:45`) would also be false when nothing remains because a warning was dismissed. `S:333–338` requires the classes to differ in dismissal behavior, and the established POS artifact has explicit checked kitchen clearance and a separate receipt dismissal (`docs/design/visual-directions/frost/pos/incidents.html:73,87,107–115`). Draw the desktop counterpart of that meaning, not its 72px touch cards. The two existing tables do honor `I:880–881`'s desktop data-table structure, but equal 26px recovery actions and greyscale borders (`:58,64,69,79,85`) have no reviewed Frost urgency treatment. Preserve emergency coverage, section priority and lower receipt urgency under FR-E3/E6 and `D:539–544`, then review the desktop recovery sizes (Q9).

**P1.** The annotation at `:110–113` says ungated and unaudited because FR-J3 does not list the action. Current FR-J3 does list it. Q1 is a document-conflict handoff, not a designer ruling on audit or gating. No remote POS approval surface should be added. S1/S2/S4 apply, and Q7 covers whether report-print failures belong here at all.

## M-6 — Back-office re-authentication

**Exists:** one prototype modal inside `P/today.html:94–108`; no independent page and no Frost artifact. `I:970–974` specifies one load-bearing condition rather than a standard state list.

| Required condition | Coverage |
|---|---|
| Idle timeout opens an overlay over work in progress | **Drawn**, `today.html?state=reauth`, `:94–108`. |
| Unsaved form remains behind the overlay | **Missing**; Today has no editable form, and `reauth` hides its ordinary open-order rows/count (`:57–61,80`). |
| Successful re-authentication resumes the preserved work | **Missing**; Continue reloads `today.html` (`:105`). |
| Separate loading, wrong PIN, denied and throttle variants | Not enumerated for M-6 in the inventory; **missing** as supporting authentication designs required for a usable FR-A2b/A5 flow. They must be specified in the shell slice, not miscounted as existing inventory states. |

**P1.** The promise “Anything you were editing is still here” (`:99–100`) is not demonstrated. Build a fixture with changed form values, validation and selection preserved before and after the overlay, rather than navigating away to BO-01 for idle expiry. Define keyboard focus, background inertness, pending verification and correct error recovery; reuse desktop fields and 640px modal geometry from `D:1043–1075`. S2/S3 apply. Explicit logout and absolute expiry remain separate session events. Q3 asks the owner to clarify the apparent mismatch between inventory absolute-expiry routing and FR-A2b's unqualified preservation wording, and whose session may resume a draft. A back-office re-authentication must never serve as POS approval (FR-A2c).

## The 51 prototype links and their future Frost destinations

This is a count of authored `href` attributes containing `prototype/`, including links in hidden state markup, not the number visible in one screenshot. The confirmed totals are **40 in `F/menu.html` and 11 in `F/report-detail.html`**. The future relative destinations below are all from the same `frost/back-office/` directory. They are proposed migration destinations once those files and subject states exist; this audit changes none of them.

| Current target beneath `prototype/back-office/` | Menu source lines / count | Report source lines / count | Future relative Frost destination and meaning |
|---|---|---|---|
| `today.html` | 19 / 1 | 17 / 1 | `today.html`, BO-02 landing. |
| `end-of-day.html` | 20 / 1 | 18 / 1 | `end-of-day.html`, BO-09 for the current business day. |
| `reports.html` | 22 / 1 | 20, 36 / 2 | `reports.html`, BO-10; the detail's back link preserves list/page context. |
| `audit.html` | 23 / 1 | 21 / 1 | `audit.html`, BO-12. |
| `tables.html` | 26 / 1 | 24 / 1 | `tables.html`, BO-05. |
| `users.html` | 27 / 1 | 25 / 1 | `users.html`, BO-06 Staff. |
| `presets.html` | 28 / 1 | 26 / 1 | `presets.html`, BO-07. |
| `settings.html` | 29 / 1 | 27 / 1 | `settings.html`, BO-08. |
| `incidents.html` | 31 / 1 | 29 / 1 | `incidents.html`, BO-13; preserve current incident state. |
| `login.html` | 34 / 1 | 32 / 1 | `login.html`, BO-01 after explicit logout, never M-6. |
| `item-editor.html?state=new` | 60 / 1 | — / 0 | `item-editor.html?state=new`, a genuinely new item. |
| `item-editor.html` | 29 attributes listed below / 29 | — / 0 | Subject-specific BO-04 editing or archived view. |
| **Total** | **40** | **11** | **51** |

The 29 plain editor links must not all become the same default Burger editor. Use an item identity parameter or equivalently named fixture states in the future artifact. The exact parameter spelling is the designer's choice in the menu/editor slice. This complete row ledger accounts for each attribute:

| Menu source line(s) | Count | Promised subject in BO-04 |
|---|---:|---|
| 81, 111 | 2 | Burger, normal-list and overflow Edit. |
| 84, 113 | 2 | Chicken Wings, normal-list and overflow Edit. |
| 87, 90, 114 | 3 | Steak; preserve 86 status in the 86 branch and overflow example. |
| 93, 115 | 2 | Fish & Chips. |
| 96, 116 | 2 | Caesar Salad. |
| 99, 119 | 2 | Fries. |
| 102, 123 | 2 | Soda. |
| 104 | 1 | Winter Stew, an archived read view matching “View”, not editable Burger. |
| 112 | 1 | Cheeseburger. |
| 117 | 1 | Soup of the Day. |
| 118 | 1 | Pasta. |
| 120 | 1 | Onion Rings. |
| 121 | 1 | Garlic Bread. |
| 122 | 1 | Side Salad. |
| 124 | 1 | Coffee. |
| 125 | 1 | Tea. |
| 126 | 1 | Beer. |
| 127 | 1 | House Wine. |
| 128 | 1 | Cheesecake. |
| 129 | 1 | Ice Cream. |
| 130 | 1 | Brownie. |
| **Total** | **29** | |

The row ledger implements the designer-role rule that captions must reach what they name and FR-B4/C8; it does not authorize restore/unarchive operations. Existing local Menu links and `report-detail.html?state=reprint` are outside the 51 count but still need state-preservation verification. The runtime-generated, hidden “All screens” link points to nonexistent `frost/index.html` (`mockup.js:60`); fix the back-office gallery return during shell work without counting it as a 52nd prototype link.

### Gallery readiness

`manifest.js:307–344` registers eight BO-03 states, omitting the artifact's ninth `category-invalid` (`F/menu.html:8`). BO-11's three states are registered at `manifest.js:347–364`; the missing loading/error designs cannot be reached because they do not exist. The gallery still labels itself “six screens” (`index.html:7,15,18`) while the manifest includes later POS additions. Its `review.js:23–24` loads the selected direction's file; it does not remap greyscale prototype links. Add each new back-office artifact and every supported state in its own slice, with a final consolidated link/state check. Paper is rejected and must remain untouched. The fixed 900px gallery frame is a preview viewport, not a product height limit (`D:809–811`).

## Shared pieces: what is specified and what still needs design

| Piece | Already specified | Remaining design obligation and source evidence |
|---|---|---|
| Navigation | 220px white rail, 64px brand, text/padding/selection/hover in `D:801–805,1187–1193`; registry `T:103–104,120,151`. | Apply it to every route, retain subject/context on navigation, and register shell states. All prototype pages import the obsolete shell at `:5`; Frost navigation in `F/menu.html:16–36` is a useful starting composition. |
| Top bar and global status | 64px and 13px type, `D:725,805`; emergency/warning semantics in `S:240–246,325–349`. | Compose current business day, actor/logout, page identity and unequal alerts consistently. Neither `F/menu.html:38` nor `F/report-detail.html:36–38` demonstrates global incident coexistence. |
| Re-authentication | 640px office dialog, 16px heading, 13px body, 40px fields; `D:1043–1075`. | M-6's preserved draft, verification outcomes, focus, session identity and route return are not drawn by `P/today.html:94–108`. |
| Tables | Header/cell/tight padding, type, alignment, colors and hover in `D:1138–1147`. | Sticky headers and scroll ownership, named row actions, page navigation, long text and complete money are not specified by those tokens. `F/menu.html:108–134` and `P/audit.html:92–116` show the gaps. |
| Forms | Resting small field and invalid variants exist (`D:1043–1066`). | Native text, secret PIN, select, radio choice, multiline content if justified, readonly/disabled, labels and error associations need reviewed desktop examples. `D:1267–1280` explicitly distinguishes inherited text fields from absent controls. Do not build unnecessary switches: BO-03 already uses a pill plus tag. |
| Modals | Color, scrim, border, typography, padding and width exist (`D:787–795,1068–1075`). | Define focus containment/return, viewport-limited body scrolling, loading, cancel and subject preservation. Prototype modals use absolute page-centered geometry (`W:246–255`), so long pages need an explicit viewport behavior. |
| Empty states | Canvas, dashed border and muted text; `D:1196–1199`. | Counts and actions must match the empty facts, e.g. `F/menu.html:57,69–73`; distinguish audit's two empties and zero-valued reports from missing reports. |
| Loading | `structure.css:84–86` provides inherited bars/label; `D:1301–1305` explicitly calls it unreviewed. | Draw load versus mutation-pending states without hiding context, keeping false-success navigation or treating unknown outcome as definite rejection. Missing per-screen states are listed above. |
| Errors and results | Grouping-blue notices, soft notices, amber field validation; `D:1052–1066,1196–1199`. | Separate invalid input, failed read, definite command refusal and unknown command outcome. Reuse existing neutral colors; no new success green is required. `P/item-editor.html:40–43` and `F/report-detail.html:41–45` illustrate incomplete distinctions. |
| Destructive office actions | Office dimensions and the system's destructive palette already exist (`D:605–610,963–970`). | Show a desktop destructive confirmation with correctly named subject. `P/users.html:130–138` and `P/presets.html:92–100` currently use ordinary primary buttons. Do not copy POS PIN gates; I-11 keeps the clients' protection patterns distinct. |
| Incident recovery | Domain classes and persistence are specified; Frost POS provides an established meaning (`S:325–349`, FR-E3/E6). | Review a desktop table/emergency composition, checked kitchen clearance, separate receipt dismissal, multiple incidents, and results by incident. Do not silently choose audit/gating policy from stale `P/incidents.html:110–113`. |

## Tokens: proposals only

The registry contains **174 entries**, matching the current 170 sourced plus four designed description. No token was added. Colors, ordinary type sizes, office widths, 36px/28px actions, 40px fields, 640px modal, table padding, report outer columns/gap, focus, invalid borders and spacing already exist in both JSON and CSS. They must not be reported as missing simply because a prototype uses raw values.

The table below inventories concrete unsourced geometry or component values needed to replace the current back-office raw rules and fill the observed gaps. Names and values are **proposals to review in the named slice**, not accepted additions. Where existing tokens can be composed, that is preferable. Any genuinely new value starts with `source: null` and a `designed` record; extraction provenance is appropriate only after a reviewed artifact supplies real evidence (`D:486–506`, `frost.tokens.json:5`). Do not register a 900px back-office height.

| Need / proposed name | Proposed value or reuse | Evidence and scope |
|---|---|---|
| Desktop login panel, `--frost-office-login-width` | 420px, if the current centered width survives review. Do not alias the POS lock-box token merely because it matches. | `P/login.html:14–16`; BO-01 is absent under `D:1273–1275`. |
| Form label/value grid, `--frost-office-form-columns` | `minmax(0, 1fr) minmax(0, 2fr)` as the initial desktop proposal; stack labels above fields in constrained regions. | `W:315` hard-codes `220px 1fr`; `P/audit.html:127` overrides 180px. Neither is an office-form token. Validate text and control widths before recording a fixed alternative. |
| Login/PIN/narrow numeric field width | Prefer fill of a reviewed form column; add a semantic width only if a measured need remains. | Raw 200px PIN at `P/users.html:111`; 120px/160px rates at `P/settings.html:51–59,77–80,131`; 140px preset value at `P/presets.html:77`. The registry's 180px refund-allocation token is not an office input-width policy. |
| Menu column layouts, `--frost-office-menu-columns` and tight variant | Proposed normal fractions `minmax(0,3fr) minmax(0,1fr) minmax(0,2fr) minmax(0,1fr) max-content max-content max-content`; reduce option detail only if it remains accessible, retaining availability actions. | `F/menu.html:76–77,109`; raw 32%/30%, 130px/70px/60px cannot all be lifted unchanged. `I:590–593` requires complete price and availability. |
| Read/configuration table column policies | Use intrinsic `max-content` for time, amounts and actions and flexible wrapping subject/reason/name columns. Register per-screen column recipes only where measured fixed geometry is necessary. | `P/tables.html:54`, `P/users.html:48–49`, `P/presets.html:49–50`, `P/reports.html:46–48`, `P/audit.html:65–66,94`, `P/incidents.html:59–60,80–81`; current 16–28% and 60–220px widths are unreviewed. |
| Report internal figure grids | `--frost-report-figures-columns: minmax(0,1fr) repeat(3,max-content)`; count-only `minmax(0,1fr) max-content`; void grid `minmax(0,1fr) repeat(2,max-content)`. | `structure.css:320`, `F/report-detail.html:78,102`. Existing `--frost-report-columns` is the outer two-column layout, not these three internal grids. |
| Sticky table offset and layer | Offset 0 within a table scroll region; use the existing 64px office header token if headers stick under the page top bar. Propose a documented layer scale 0 content / 1 sticky / 2 scrim / 3 dialog. | `F/menu.html:133` promises stickiness without a rule; `D:801–811` does not decide scroll ownership. Select one shell behavior before registration. |
| Modal maximum height / viewport gutter | `calc(100dvh - 2 * var(--frost-space-6))`, with scrolling body and retained head/footer; use the same existing 24px spacing for placement. | `W:246–255` has no maximum or overflow strategy; `D:1068–1075` fixes width, not tall-content containment. No fixed office-height token is needed. |
| Select affordance and choice controls | Reuse 40px field, existing colors/focus/border and 20px icon size. If custom choice marks are needed, propose `--frost-office-choice-size: 16px`, and show selected/unchecked/disabled/invalid states before adding it. | `P/users.html:84–87`, `P/presets.html:76`, `P/item-editor.html:56–57`; `D:1267–1272`. Native controls may avoid a custom glyph token entirely. |
| Multiline field minimum | Reuse three 40px field rows (120px) only if a required field needs multiline entry; otherwise do not add. | Business address at `P/settings.html:113` is currently one static line. PRD §9 has not settled receipt field requirements. This is conditional, not a demand for a new textarea. |
| Skeleton bar height and widths | Reuse 12px space token for height, 8px spacing; keep 40%/60%/80% as reviewed fixture proportions, or register a loading component recipe if reused. | `W:84–86`; `D:1301–1305`. Review the inherited pattern; avoid borrowing a tag or PIN dimension. |
| Large empty padding | Prefer existing 48px spacing; register `--frost-empty-large-padding: 60px` only if preserving the current larger composition is justified. | `F/menu.html:69`, `F/report-detail.html:53`; `D:1199` acknowledges 60px but the spacing registry has no 60px value. |
| Office emergency/receipt recovery dimensions | Proposed desktop emergency action 36px and receipt row action 28px, with solid-red coverage, persistent priority and stronger heading doing the remaining urgency work. Reuse office tokens; introduce an office-specific emergency minimum only if browser review shows it is needed. | `P/incidents.html:64,69,85` currently makes both small. `D:1159–1179` specifies POS 72px/48px controls, while `D:553,963–970` defines desktop density. Q9 must confirm the desktop application of these rules. |
| Office destructive states, readonly fields and status marks | Compose existing destructive, unavailable, disabled, border and office-action tokens. No new color value is needed. | `P/users.html:138`, `P/settings.html:51–59`; `T:20–21,27–28,35,38,138–145`. These need component examples, not a parallel palette. |
| Header/card spacing and ordinary gaps | Compose existing 4/8/12/16/20/24/32/40/48px tokens; replace incidental 6/10/14px gaps only after comparing the reviewed result. | `F/menu.html:32,70,133`, `P/tables.html:40–44,56`, `P/end-of-day.html:56`, `V:189–197`. A new token for every historical inline literal would preserve drift. |

No 28px typography token, success palette, custom payment icon set, date-range analytics control or POS keypad is needed by the observed back-office requirements. The 28px end-of-day type is an unreviewed exception to replace; the existing 28px office button height is unrelated. Values depending on new content beyond this audit must be raised by their slice instead of being given fabricated reviewed provenance.

## Questions and proposed answers

Each entry identifies who may decide it. Nothing here reopens I-2, I-3, I-6, I-9, C-4 or I-11.

| ID | Question, evidence and proposed answer | Whose call |
|---|---|---|
| Q1 | How should I-8 and the exhaustive audit lists be reconciled with current FR-J3? `I:991`, `I:845–848` and `P/incidents.html:110–113` say kitchen reprint is unaudited/open; PRD FR-J3 now includes it. **Proposed:** use the current PRD audit requirement in BO-12/BO-13 briefs, have the lead locate the owner's recorded decision and synchronize design authority, and retain no extra PIN gate unless the owner has granted one. | **Lead** reconciles recorded authority; **owner** decides any unresolved gating or audit-policy change. |
| Q2 | What does a business day mean in the displayed dates? FR-I1/I3 and `I:748–759` say close opens the next day, while PRD `:560–562` says 00:00–23:59 WIB; `P/end-of-day.html:36,86–88` and `F/report-detail.html:48` use 06:00/23:14 close boundaries. **Proposed:** preserve explicit stored day identity and close-to-close behavior, display all times HH:MM WIB, and ask the owner to resolve the calendar sentence before final day fixtures. | **Owner**, because it changes business-day meaning; the lead prepares exact document reconciliation. |
| Q3 | Which manager may resume a draft, and what happens at eight-hour expiry? `I:543–545` routes absolute expiry to Login; FR-A2b says unsaved form state is preserved behind re-authentication; `P/today.html:99–105` proves neither. **Proposed:** idle uses M-6 over the same draft and requires the same manager; route absolute expiry to Login as the inventory says, preserving recoverable local work without resubmitting it, subject to the owner's confirmation. Do not authorize another manager to adopt a draft by design assumption. | **Owner** for identity/expiry semantics; **designer** for the modal and restoration presentation after that decision. |
| Q4 | Is staff number required for back-office login and user management, and how is the first manager established? `P/login.html:38–39`, `P/users.html:44,82` introduce these assumptions; FR-A2b/B3 do not specify identifier or bootstrap flow. **Proposed:** retain staff number only if the established identity contract requires it; keep the required empty staff drawing as an explicitly exceptional/fixture state and do not invent self-signup. The lead should supply existing identity decisions to the dispatch. | **Owner** for identity/bootstrap policy, with the **lead** supplying any already-decided answer. |
| Q5 | Are Seats and Reactivate intended configuration affordances? `P/tables.html:54,67,80`, `P/users.html:67`, `P/presets.html:61` exceed the inventory's named operations. **Proposed:** do not make them frontend acceptance requirements until the owner confirms them; omit unconfirmed extras from new operational paths. This is a scope question, not a declaration that every edit-based reactivation violates the PRD. | **Owner**, because these are configuration capabilities; the lead records the answer. |
| Q6 | How should a ppm rate be entered as a percentage? `P/settings.html:77–80,131` uses six decimal percent places. **Proposed:** exact conversion with up to four decimal percentage places and field-local format feedback. The permissible maximum remains PRD §9's open rate-range question; do not choose it. Receipt field requirements remain the separate receipt-content question. | **Designer** for representation consistent with FR-M5; **owner** for permitted range and receipt content. |
| Q7 | Where does failed or UNKNOWN report printing appear? Both report artifacts promise receipt-class incidents without a matching BO-13 requirement (`F/report-detail.html:43–44`; FR-I4 versus FR-E6). **Proposed:** retain a local result with reprint available, and add a distinct low-urgency report incident only if the owner authorizes that scope. | **Owner**, because incident classes and report-print recovery are product behavior. |
| Q8 | What are the audit viewer's refund before/after amounts? `P/audit.html:132–133` says the stored order total becomes zero. **Proposed:** preserve charged total, separately name refunded/net movement using the actual audit schema, and show no amounts for REFUSED outcomes, as FR-J3 requires. The task brief must cite the agreed field semantics before drawing them. | **Lead** supplies the existing contract/schema interpretation; **owner** decides any new audit semantics. |
| Q9 | How do the Frost emergency action rules apply to the desktop table? `D:1159–1179` uses POS control sizes, `D:553,963–970` requires office density, and `I:880–881` requires independent table components. **Proposed:** 36px emergency recovery and 28px receipt recovery with solid emergency coverage and explicit acknowledgement; retain every domain distinction, review at 1440px, and document the office variant. | **Designer** for presentation, reviewed by the **lead**. Any change to clearing/audit/gating behavior belongs to the **owner**. |
| Q10 | Which containers own scrolling and pagination? `F/menu.html:133` promises sticky headers, `P/audit.html:110–116` pictures paging, and `D:809–811` permits vertical growth. **Proposed:** persistent shell navigation/status, explicit table header sticking, document scrolling for forms/reports, paged report/audit lists, and viewport-contained modals. Register only geometry that needs a token. | **Designer**; the **lead** validates slice acceptance and dependencies. |
| Q11 | How should unsaved navigation and network uncertainty be shown? The current links reload pages (`P/item-editor.html:134–135`, `P/settings.html:121–122`) and no design distinguishes unknown save/close/reprint outcome. **Proposed:** keep local edits on definite errors, reread before claiming a command failed when its outcome is unknown, and use explicit Save/Cancel with an unsaved-work departure decision where needed. Do not auto-repeat a money/day command. | **Designer** for interaction; **lead** for compatibility with command semantics, escalating any new persistence policy to the **owner**. |
| Q12 | May future design slices register needed tokens and synchronize the gallery? DESIGN-009 originally prohibited new tokens, whereas this audit only proposes them; the BO work needs newly reviewed controls and layout recipes. **Proposed:** authorize each slice to submit designed token proposals with honest provenance and register them only under the lead's review process. Require each artifact's state list to match the gallery and its links to stay in Frost once destinations exist. | **Lead**, a dispatch/review-scope decision, not a product change. |

## Proposed design slices

These are proposed task boundaries, not newly assigned task IDs. Each screen and M-6 is assigned exactly once in the Screen ownership column. Shared patterns are owned by Slice A and consumed by later slices; later work can request a narrowly reviewed extension rather than redesigning them independently. A slice should be accepted only with all inventory states, any current-PRD additions identified above, subject-correct links, browser measurements at 1440px, token provenance, and a full-prose Handoff. The lead should include the necessary authority excerpts and question answers in each dispatch so a worker does not have to search lead memory.

| Order | Screen ownership | Work and review boundary | Dependencies | Frontend work enabled |
|---|---|---|---|---|
| A | **M-6**, plus shared shell | Establish Frost navigation/top bar, global day/alert compositions, desktop modal/focus/scroll behavior, baseline fields and loading/error/empty recipes. Demonstrate one genuinely changed draft surviving idle re-authentication. Include the gallery plumbing and initial token proposals. | Q1/Q2/Q3 authority supplied where needed; use existing system values first. | Authenticated office shell, shared desktop primitives and session-expiry presentation. |
| B | **BO-01, BO-02** | Draw manager login and its five applicable states; build Today with loading/error/overflow and read-only open-order information. Verify entry/logout and standing day/incident visibility. | A; Q4 identity answer; Q2 day identity. | Sign-in and manager landing routes against fixtures. |
| C | **BO-13** | Draw the desktop incident table and every urgency/delivery/reprint state, multiple incidents, acknowledgement and dismissal. Keep request/result/subject distinct and account for current FR-J3. | A; Q1 and Q9; Q7 only if report incidents are authorized. | Application-wide incident display and desktop recovery fixtures. |
| D | **BO-03, BO-04** | Complete categories and editable item/variant/modifier forms; repair subject identity, 86/lease/archived flows, sticky overflow and category validation. Migrate all editor links in the 51-link ledger. | A; B/C destinations for shell navigation can be linked as they land. | Menu/category configuration and availability management. |
| E | **BO-05, BO-06** | Draw table and staff creation/editing with consistent row identity, empty/load/error/overflow states, table refusal, non-authenticating kitchen classification and PIN/session effects. | A; Q4/Q5 answers. | Floor configuration and staff/PIN management fixtures. |
| F | **BO-07, BO-08** | Complete both discount kinds and all validation states, locked IDR settings, tax/service version changes and custom payment-method management. Keep receipt fields and rate range within the owner's decided scope. | A; Q5/Q6 answers, and existing I-9/FR-B7. | Preset, settings and tender-type configuration. |
| G | **BO-09** | Draw authoritative close/refusal/recheck, long open-order lists, loading, definite error/unknown-result recovery, confirmation, success and already-closed context. No POS operation links. | A/B; Q2/Q11 resolved for close behavior. May use a clearly labelled report destination fixture until H lands. | End-of-day close interface and transaction-result fixtures. |
| H | **BO-10, BO-11** | Draw the growing stored-day list and subject-correct detail/return, all zero figures, full FR-I5 fixtures, loading/errors and reprint results. Correct the metadata header selector and test large aggregate amounts and long method names. | A/G; Q2/Q7. | Stored reports, full snapshot display and report reprinting. |
| I | **BO-12** | Draw working filters/paging and subject-specific detail, both empties and all current audit outcomes, with no mutation control or telemetry view. | A; Q1/Q8; use the accepted C–H fixture subjects where useful. | Read-only audit route and complete display coverage of required actions/outcomes. |

**Run A first.** Every later screen depends on the same unresolved global alert, session, form, modal and scroll behaviors. Drawing eleven separate pages before agreeing on those pieces would multiply the same ambiguity and leave the manager's most important cross-route behavior unreviewed. A is deliberately a shared-pattern session rather than a feature bundle; B and C then prove that shell with login, open orders and real incident density before configuration and reporting fill it out.

Each slice should repoint only links whose Frost destinations now exist. The last slice's acceptance includes the consolidated 51-link migration ledger and a crawl of all back-office states, but that is verification, not a second ownership assignment for every screen. BO-14 stays deferred under I-3. Printed receipt/ticket layouts, fiscal requirements, post-close corrections and permitted rate limits remain outside these slices except for recording dependencies.

## Handoff

This report is the sole repository file written by design011. No artifact, token, contract, sitemap, inventory, task Handoff, application source or test was edited, and no commit was made. Existing unrelated worktree changes were left in place. Browser scripts and captures were kept outside the repository.

The report accounts for every inventory state of BO-01 through BO-13 and the preservation requirement of M-6, confirms the 40+11 prototype-link count with a complete target ledger, and assigns each screen once in nine proposed design slices. The lead needs to reconcile the current PRD with stale I-8/audit language and the contradictory business-day wording, supply identity/session answers where required, then dispatch the shell slice. Nothing in this audit authorizes a contract change or silently resolves an owner question.

DONE
