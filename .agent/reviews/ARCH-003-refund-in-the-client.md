# ARCH-003 — How the fixture client may model a refund

Author: `architect3`, 2026-10-01. Read-only consult for FE-032 (draft, not dispatched).
Nothing was edited except this report, and nothing was committed.

## Summary

1. **Yes, the client may record a refund in the order book**, on the same terms as `close`:
   as a development stand-in for the server's refund command, shaped as a command, never as
   a status the screen sets. A screen-local REFUNDED picture loses because it leaves a
   second refund on offer. Fixtures only is the fallback if the owner declines item 4.
2. **The operation** is a pure `refundOrder` beside `closeOrder`, reached through
   `book.refund(orderId, request, refundedAt)`. It stores one refund record on the order,
   set once and never unset; the status `refunded` is derived from it. It returns a result
   value with a named refusal, and a refusal leaves the book identical.
3. **The approver:** a refund made in this session records and shows no approver, and its
   notice does not say *approved*. *Approved by M. Iqbal* stays fixture copy on the fixture
   `refunded` picture only.
4. **The PIN:** acceptable as a stand-in for the server's answer, provided the digits are
   never read, no value is compared, nothing about an approval is stored, and the owner
   accepts it in writing. This is the first time the client acts out an approval-gated
   transition, so I ask for that acceptance rather than assume it.
5. **Change:** each tender's effective contribution is found by walking the tenders in the
   order taken against the running remaining balance. FR-G4 already defines change that
   way. No row is negative and the rows sum to the total. For every order the settlement
   screen can produce, this agrees with FE-031's rule; unlike that rule it cannot go
   negative.
6. **Refusals:** the screen maps the operation's refusal to the artifact's two pictures
   and always draws the order from the book afterwards. The no-response rule has no failure
   to handle without a network; its discipline (read the order before describing it) is
   kept. No asynchronous path and no simulated failure is built now.
7. **Audit:** none in the client, not even a mock. The Handoff must list four server-owed
   entries; the draft's list is missing the failed approval.
8. **One M-1:** section 7.1 of the architecture and ADR-007 constrain the seam. The approval
   must be one callback that carries out the whole protected command, never a step that
   yields an approval the caller then holds; and Cancel must be the caller's callback,
   because on the server it becomes an audited request.
9. **Pushback:** six points, the most serious being that a book order's REFUNDED notice and
   *Money returned* rows cannot reuse FE-031's fixture copy and `moneyReturned`, and that
   `PosRoutes.tsx:90` breaks if a third status is added without it.

## What I verified

I read the task's named inputs with the file tools: `FE-032-refund.md` whole;
`docs/ARCHITECTURE.md` whole; ADR-001, 002, 003, 004 and 007; `docs/PRD.md` and
`docs/BOUNDARIES.md` whole; `orderStore.ts`, `close.ts`, `tender.ts`, `closedOrders.ts`,
`closedOrderDetail.ts`, `ClosedOrderScreen.tsx`, `ClosedOrdersScreen.tsx`, `Approval.tsx`,
`PinPad.tsx`, `approvalFixtures.ts`, `PosRoutes.tsx`, `SettlementScreen.tsx`,
`paymentSession.ts`, `FloorScreen.tsx`; `closed.js:80–180`; DESIGN-009's task file at
`:120–176`, `:290–434` and `:690–839`; `SCREEN-INVENTORY.md:940–1066`; FE-031's task file.

The lead's account under *What exists* holds, with these precisions:

- `close` is `orderStore.ts:356–381`. Its inner `update` (`:287–295`) changes **the active
  order only** and refuses any change to a closed order. POS-06 is handed `book`, not
  `store` (`PosRoutes.tsx:103`), and the order it shows need not be the active one. A
  refund therefore cannot go through `update`.
- M-1 does not quite *ignore* the digits. `PinPad` hands them to `onSubmit(pin)`
  (`PinPad.tsx:81–88`), and `ApprovalPrompt` supplies a handler that declares no parameter
  (`Approval.tsx:62`). The digits reach the edge of the handler and are dropped there. This
  matters for question 4.
- `closeOrder` (`close.ts:74–101`) does not itself enforce FR-G3 or B-5. It checks only
  pending lines and a positive balance. That a card never exceeds the balance is held by
  the Add gate in the settlement screen (`tender.ts:39–41`), not by the close. See
  question 9.

Not read: the test files, `OrderPanel.tsx`, `VoidSheets.tsx`, `Sheets.tsx`, `closed.css`,
DESIGN-010's task file, and ADR-005 and ADR-006 (printing and receipt numbering, which the
refund does not touch). I had no search tool, so the list of readers under question 2 is
what I found by reading the files above, not the result of a search. No library or API fact
was needed, so the librarian was not asked.

---

## 1. May the client record a refund in the order book at all?

**Answer: yes, as a stand-in, through one command-shaped operation.**

**What the documents decide.** The POS client "never owns committed order, money, receipt,
approval, or print state" (ARCHITECTURE section 4.1). PostgreSQL is the sole authority, and
"browser- or client-owned state synchronized later" was considered and rejected (ADR-002).
The refund, its allocations, the `CLOSED → REFUNDED` transition and its audit entry commit
together in one transaction (section 6.5, ADR-007). Clients "send explicit commands, not
replacement aggregates or requested status values" (section 4.4, section 13).

None of that forbids a pre-server client from holding an in-memory picture of what the
server will hold. The book already is one: FE-026 and FE-027 put orders and the close into
it, it lives in React state, and a reload empties it. What the documents do forbid is
treating that picture as the authority, and letting the screen decide a resulting state.

**Recommendation, and why the alternatives lose.**

- *A screen-local REFUNDED picture the book never learns of.* POS-06 would say REFUNDED
  while POS-05's row still says closed, and re-entering POS-06 would offer *Refund this
  order* again. The client would then draw exactly the path FR-H6, B-10 and AC-14 exist to
  remove. It is also the screen deciding a resulting state, which section 4.4 forbids in
  spirit. It loses.
- *Fixtures only.* Honest and small, but the flow dead-ends on a live order, and the
  rules that are cheapest to get wrong (once only, all or nothing, the zero row, the exact
  sum) would have no executable form until Phase 5. It is the right fallback if the owner
  declines the stand-in approval of question 4, not the first choice.
- *A book operation.* It keeps POS-05 and POS-06 in agreement, makes "refused by whatever
  records it" (the draft's criterion 10) testable, and gives the rules a pure function that
  Phase 5 can read. It is consistent with `close`. It is the recommendation.

**Fixture addresses are different and stay screen-local.** FE-031's rule is that a URL
with a `state` is the artifact's picture and `?order=<id>` alone is a book order. A refund
confirmed on a fixture address has no book entry to change. It shows the artifact's
REFUNDED composition for that order in screen state, as `closed.js:172` does, and writes
nothing. `book.refund` is never called for a fixture address, and a fixture address never
creates a book entry. The draft does not say this; it needs to.

**What must be written down so the operation is not mistaken for the transaction
boundary.**

1. A header comment on the pure module and on `OrderBook.refund`: this is a stand-in for
   `/api/pos/history/…` full refund (section 13); it runs in memory and is lost on reload;
   it verifies no PIN and knows no actor or approver; it takes no idempotency key and no
   expected order version (ADR-003); it locks no business day (section 8); it writes no
   audit entry (ADR-007); it stores no `Refund` or `RefundTender` row.
2. In the task file: FE-032's tests prove the client's behaviour only. They are not
   evidence for AC-11, AC-14, AC-18, AC-25 or AC-34. ADR-002 requires integration tests
   against real PostgreSQL, and section 14.2 places the refund races and audit completeness
   there. Those criteria stay open until the server exists.
3. A removal rule: when the server's refund command exists, the in-memory operation is
   deleted. It is never kept as a fallback for an unreachable server, because "no client
   may claim an order, approval, fire, tender, or close succeeded" during an outage
   (section 12), and offline writes are deferred (section 15).
4. The Handoff's list of what the backend must replace (collected under *For the task
   file*, rule 14).

---

## 2. The shape of the operation

**What the documents decide.** `CLOSED → REFUNDED` is an order state transition and
REFUNDED is terminal (section 6.1, B-10, PRD section 2). The refund "is a separate
immutable record, never a negative Tender and never a mutation of original Tenders"
(section 6.5). State machines stay enums and "do not acquire redundant boolean flags"
(section 5). An allocation of zero "is dropped before the refund is recorded and is never
stored" (FR-H5, AC-34). A reason is required (FR-H5). A refusal leaves the order exactly as
it was (B-20).

**Recommendation.** Both things the lead asks about exist, and one is derived from the
other: the book stores a **refund record** on the order, and `orders()` reports a **third
status `refunded`** derived from the presence of that record. Nothing stores the status
separately, so the two cannot disagree.

```ts
// refund.ts: pure, beside close.ts. Reads no clock and imports no React.

export type RefundRequest = {
  /** One entry per original tender money goes back to, by its position in the order's tenders. */
  allocations: ReadonlyArray<{ tender: number; amount: Money }>;
  reason: string;
};

export type RefundRecord = {
  refundedAt: string; // an argument, as closedAt is
  reason: string; // trimmed
  /** Amounts above zero only, in tender order; the label is the original tender's, copied. */
  allocations: ReadonlyArray<{ tender: number; label: string; amount: Money }>;
  amount: Money; // the order total
};

export type RefundRefusal =
  | 'not-closed' | 'already-refunded' | 'zero-total' | 'day-closed'
  | 'no-reason' | 'not-a-tender' | 'invalid-amount' | 'sum-mismatch';

export function refundOrder(
  order: { closed?: { tenders: ReadonlyArray<Tender> }; refunded?: RefundRecord; total: Money; dayClosed?: boolean },
  request: RefundRequest,
  refundedAt: string
): { refunded: RefundRecord; refused?: undefined } | { refused: RefundRefusal; refunded?: undefined };
```

The book adds `refund(orderId, request, refundedAt)` with the same result, plus the refusal
`unknown-order` for an id it does not hold.

**The record.** `StoreState` gains `refunded?: RefundRecord`, set once and never unset, as
`closed` is. The `closed` facts (`closedAt`, `tenders`, `change`), the lines and the totals
are not touched. The record has **no approver, no actor and no approval flag** (question
3). `amount` mirrors the `Refund` entity's amount (section 5.1).

**Refusals, checked in this order**, so the answer is deterministic and a refunded order
always answers `already-refunded` whatever else is wrong:

1. `unknown-order`: the book does not hold the id.
2. `not-closed`: the order is still open (FR-H1).
3. `already-refunded`: a refund record exists (FR-H6, B-10, AC-14).
4. `zero-total`: the total is 0 (FR-H5b).
5. `day-closed`: the caller says the order's business day is closed (B-9, FR-H7). The book
   has no business day, so no book order ever sets this; it is an input fact, exactly as
   `locked` is for `closeOrder`. It costs one line and keeps B-9 inside whatever records a
   refund.
6. `no-reason`: the reason is empty after trimming (FR-H5). The lead's list omits this one.
7. `not-a-tender`: a position outside the order's tenders, or the same position twice.
8. `invalid-amount`: a negative amount.
9. `sum-mismatch`: the amounts above zero do not sum to the order total exactly.

**Zero rows.** The screen drops them before calling (ruling O3). The operation also never
stores one: it discards a zero amount before the sum check rather than refusing it. FR-H5
reads as *dropped*, not *rejected*, and AC-34 says *not stored*. Whether the server's API
rejects or drops a zero row it is sent is a Phase 5 detail; FR-H5's wording points to drop.

**How a refusal is reported.** As the result value above, never a thrown error and never a
bare boolean. The screen needs the reason to choose its picture (question 6).

**All or nothing (B-20).** The whole request is validated before anything is written, and
the write is one field in one state update. Follow `close`: run the pure function inside
the functional updater against the previous state, so a second call in the same tick finds
the order refunded and changes nothing. On a refusal the updater returns the same book
object, so a test can assert identity, not only equality. Do not loosen `update`'s
closed-order guard to make room for this; the refund is the single transition out of
closed and gets its own by-id path that can set `refunded` and nothing else.

As with `close`, the value returned to a caller in the same tick comes from a pre-check
against the last rendered book. Once-only is therefore proven on the book's contents (one
record, the first), and the screen reads the outcome back from the book (question 6).

**Why a third status and not `closed` plus a flag.** The PRD's vocabulary and the
architecture's state machine have REFUNDED as its own state, and the server will send it
as one. If the book reported `closed` with a refund beside it, a reader that forgot the
refund would treat a refunded order as refundable, which is the dangerous direction. With
a third status, a reader that forgot it loses the order from a list or shows an error,
which is visible and safe. The cost is that every `status === 'closed'` comparison must be
revisited.

**Readers that must handle the new state** (found by reading; the builder must also search
`apps/pos/src` and `apps/pos/test` for `status ===`, `isClosed` and `.closed`):

| Reader | Today | Must become |
|---|---|---|
| `orderStore.ts:226`, `:409–415` (`orders()`) | `'open' \| 'closed'` | adds `'refunded'` and carries the record |
| `orderStore.ts:163` (`isClosed`), used at `:168` and `:291` | true when `closed` is set | unchanged, and still true for a refunded order: its table is free and it accepts no edit |
| `closedOrders.ts:236` (`bookRows`) | lists `status === 'closed'` only | lists refunded orders too (A2); `refunded` at `:249` read from the book |
| `closedOrderDetail.ts:246` (`bookDetail`) | anything not `closed` is `undefined` | accepts `refunded`; otherwise a refunded book order draws *Could not load this order* |
| `closedOrderDetail.ts:272` | `refunded: false` | read from the record, with its time, reason and allocations |
| `closedOrderDetail.ts:108–125` (`noticesFor`) | fixture time, approver and reason, hard-coded | a book order's notice is built from its record (question 3) |
| `ClosedOrderScreen.tsx:165–175` | `moneyReturned(tenders, change)` | a book order lists the record's allocations (question 5) |
| `PosRoutes.tsx:90` (`closedActive`) | `status === 'closed'` | must include `refunded`, or Back onto a refunded order's order or settlement route draws live controls again, undoing FE-027's rule 6 |

`FloorScreen.tsx` and `ClosedOrdersScreen.tsx` read the book only through `openOrderIdOf`,
`hasOrderFor`, `orderFor` and the row model, so they need no change. I recommend one named
predicate for "reached CLOSED" (`status !== 'open'`), the report's own phrase (section
6.6), in place of scattered string comparisons.

**Two cautions for the builder.** `OrderStore.close` is optional so that a test's hand-built
store need not supply it; a required `refund` on `OrderBook` may break hand-built books in
existing tests, which the task forbids changing. And whether three Card rows become three
`RefundTender` rows or one per tender type is not settled by the documents (FR-H5 speaks of
tender types; section 5.1 defaults from each original Tender). The client keeps the rows as
allocated, as the artifact draws them; the schema is Phase 5's.

---

## 3. The approver

**What the documents decide.** The server is authoritative for actor identity and inline
manager approval (section 4.4). Every audited action names a specific, identified person
(B-13). An approval authorises one action at the moment it is given (B-14, FR-A6). In
ADR-007, `approver = null` has a meaning: a failed or cancelled approval.

**Answer.** For a refund made in this session, the client **records no approver and shows
none**, and the notice **does not say *approved***. Nobody was identified and nothing was
verified, so both a name and the word would be statements the client cannot back.

- The record has no approver field at all. Do not write `approver: null`: a successful
  refund carrying a null approver is the shape ADR-007 reserves for a failed or cancelled
  approval, and Phase 5 must not find it modelled as a success.
- The notice for a session-made refund reads `REFUNDED · <HH:MM>` with the body *The whole
  order was refunded. Reason: <reason>.* That is the artifact's copy with the approver
  clause removed. The time is `refundedAt` in WIB.
- *REFUNDED · 20:31 · approved by M. Iqbal* remains, as fixture copy, on the fixture
  `refunded` picture and on Table 3. It pictures a server's answer, exactly as FE-031 kept
  a printed time for `reprint-printed` alone and let a live press say only *Reprint sent*.
- The same rule covers a refund walked through on a fixture address (question 1): a
  REFUNDED view produced by a press names no approver.

**Alternatives.** *A fixture name* on a live refund fabricates identity on a record the
cashier just created, and would survive into screenshots and tests as if it were data.
*A generic "approved by a manager"* is still the claim that an approval happened. *A
placeholder such as "approver not recorded"* draws attention to a server concern the
cashier cannot act on and invents copy nobody drew. All three lose to saying nothing.

The header's *Ana R. · Cashier* is existing fixture copy on every screen. It is not stored
in the record either; the audit's actor comes from the server-side session.

The wording is a copy deviation from a reviewed artifact, on an identity matter. I list it
for the owner.

---

## 4. The PIN

**What the documents decide.** No PIN value appears in any log, audit entry, error or
analytics event (B-12). The raw PIN is discarded immediately after verification (section
7.3). Manager approval "is embedded in the protected POS command", "authorizes exactly one
action, and creates no approval session or reusable token" (section 7.1, B-14).

**What they do not decide.** Nothing in the architecture governs what a pre-server client
may act out. On POS-03 the modal's confirm routes to a picture. Here a change to the
in-memory book follows. That book is not committed state, so no boundary is broken; but it
is the first time the client performs an approval-gated transition, and a reader could
take the modal for a working gate.

**Answer: acceptable, as a stand-in for the server's answer, if all of the following
hold.**

1. **The digits are never read.** They are not compared with anything, not passed to the
   book operation, not placed in React state, a record, an attribute, the URL or a log.
   The handler that receives the confirm declares no parameter, as `Approval.tsx:62` does
   today. There is **no magic PIN**: accepting one particular value would be a fabricated
   credential check, and worse than checking nothing.
2. **Nothing about an approval is stored.** No `approved` flag in screen state, no approver
   and no approval time. What is stored is the refund record of question 2. A second
   attempt after a refusal mounts a fresh M-1 with an empty pad (B-14).
3. **Six digits is input completeness, not verification.** Requiring six before the
   confirm key turns on is FR-A1's shape rule. The comment at the call site says, in
   words: confirm stands for the server accepting the protected command; nothing is
   verified.
4. **The screen claims nothing it does not know** (question 3).
5. **The seam is the real one** (question 8), so that the server's answer replaces the
   stand-in without the modal changing.
6. **It is written down**, in the module comment and the Handoff, and the owner's
   acceptance is recorded. A ruling that is not in DECISIONS.md is not decided.

If the owner declines, FE-032 falls back to fixtures only: the sheet and M-1 are built and
walkable, the book operation and its tests may still be written as a pure function, and
the confirm key on a book order has nothing to call until FR-A and the server exist. That
is a sequencing choice for the owner, not something I can settle by architecture.

---

## 5. Change against several cash tenders

**What the documents decide.** "A cash tender may exceed the remaining balance. Change
equals cash tendered minus remaining balance" (FR-G4). A non-cash tender never exceeds the
remaining balance (FR-G3, B-5). The close validates each tender "against the running
remaining balance" (section 6.4, steps 5 to 7). On the server each `Tender` stores its own
amount tendered, change and effective contribution (section 5.1).

So change is a fact about one tender, fixed by the balance that remained when it was taken.
The book loses this by storing one `change` per order, and the client has to derive it.

**The rule.** Walk the tenders in the order they were taken:

```
remaining = order total
for each tender, in order:
    contribution = min(tender amount, remaining)
    remaining    = remaining − contribution
```

The default allocation for a row is its `contribution`. Its change is `amount −
contribution`.

**Properties.** Every contribution is between 0 and the tender's amount, so no row is
negative. The contributions sum to the order total for any closed order, since an order
closes only when tendered less change equals the total (B-18). The per-tender changes sum
to the stored `change`. The rule reads no label, so it does not depend on a tender being
named `Cash`.

**The lead's two cases.** With two cash tenders the later one carries the change: Cash
50.000 then Cash 150.000 on 155.925 defaults to 50.000 and 105.925. A change larger than
the last tender cannot arise from the settlement screen. `addDraft` appends
(`paymentSession.ts:77`), drafts are only ever removed, and an Add is accepted only against
a positive balance (`tender.ts:16–41`). Every draft still in the list was added while the
drafts before it summed to less than the total, so only the last tender can carry the sum
past the total, by less than its own amount; and since a card is capped at the balance,
that tender is cash. For every reachable book order the walk therefore gives what FE-031's
`moneyReturned` and the artifact's `defaults()` give. The difference is in the orders that
should not exist: there the walk yields a row at 0, where "the last Cash tender" yields a
negative amount.

**Alternatives.** *Change off the last Cash tender* (FE-031, the artifact) is a partial
function and depends on a display label; a custom tender's name is configuration (FR-B7).
*Change spread across the cash tenders in proportion* invents arithmetic and a rounding
step the PRD does not have (B-2) and contradicts FR-G4. *Change off the first cash tender*
contradicts FR-G4.

**One function.** The walk is written once and used for the sheet's defaults, for the
row-by-row comparison behind *ALLOCATION EDITED*, and for the arithmetic line (drawn for
the tender whose contribution is less than its amount: *Cash: 200.000 − 44.075 =
155.925.*). `cashContribution` (FE-031) should equal the sum of the walk's contributions
over Cash tenders; assert that in a test instead of rewriting FE-031. `moneyReturned` must
not be used for a book order after this task: once an allocation can be edited, *Money
returned* is the record's allocations, not a recomputed default. Its one remaining use is
the fixture `refunded` picture; build that on the walk or give the fixture its own refund
record, so the client has one rule for change, not two that agree by accident.

When the server exists it supplies each tender's effective contribution, and this
derivation is deleted. The client is not to remain the place where it is computed
(section 16, the risk of two bundles duplicating domain behaviour).

---

## 6. Refusals and failure

**What the screen does on the operation's result.** In every case it closes the approval,
then draws the order from the book. It keeps no `refunded` flag of its own.

| Result | The book then says | The screen draws |
|---|---|---|
| refunded | REFUNDED | the REFUNDED detail from the record; the draft is discarded |
| `already-refunded` | REFUNDED | the REFUNDED detail from the record that exists, never from the draft; *Refund failed · the order is unchanged* / *Nothing was refunded.*, no control |
| `zero-total`, `not-closed`, `unknown-order` | not refundable | the same notice with no control, over whatever the book holds |
| `day-closed` | closed day | the `day-refusal` picture, then the standing closed-day picture; never a retry (B-9) |
| `no-reason`, `not-a-tender`, `invalid-amount`, `sum-mismatch` | still CLOSED | `refund-error` with *Review refund*; allocation and reason kept; a new attempt opens a fresh M-1 |

A correctly built sheet cannot reach any refusal on a book order, because *Continue* is off
until the sum and the reason are right. The table is exercised by tests that hand the
screen a book whose `refund` refuses, which is also the proof that the screen does not
decide the outcome itself.

**The no-response rule** (DESIGN-009 `:823–829`). It handles a command whose fate is
unknown. A synchronous in-memory call always answers, so there is no such failure to
handle and none should be invented. What the rule demands underneath is that the client
never describe the order from its own belief: it reads the order, then speaks. That part is
honest today and is the first sentence of this section. `bookDetail` already runs on every
render, so it costs nothing.

**Built now, a seam, or left to the backend?** Shape the seam; build no asynchronous path.

- *Now:* one function in the screen turns the confirmed request into a result, and
  everything after it depends only on that result and on re-reading the book.
- *Not now:* a `no-response` outcome, a timeout, a pending or verifying picture, or a
  simulated failure on a book order. The in-flight state is not drawn, and DESIGN-009's
  Handoff records that the verifying-state cancel is an unresolved owner ruling. Building
  a guess at it would settle a product question by code.
- I will not promise "no rewrite". When the command becomes a request, the screen gains an
  in-flight state. The seam keeps that change in one function and one new state.

The design rule that the client never re-sends on its own has an architectural reason
worth recording: the PIN travels inside the command and is discarded (section 7.3), so a
resend would require the client to have kept it, which B-12 and B-14 forbid. Reading the
order again is the only retry-free way to learn what happened.

`refund-error`, `refund-error-cash` and `day-refusal` stay reachable by URL as fixture
pictures of a server's answer.

---

## 7. Audit

**Answer: the client writes none, and it is right that it writes none.** Audit evidence is
inserted in the same PostgreSQL transaction as the action it records (ADR-007, section
11). The log is append-only (B-7) and every entry names an identified actor (B-13). A
client-side list would be neither evidence nor attributable. A mock audit array is worse
than nothing, because a later reader would have to work out that it is not the log. The
client also draws no claim that something was recorded.

**FE-032's Handoff should record these as owed by the server in Phase 5:**

1. **Success.** One combined entry naming the initiating actor and the approver, with the
   action, outcome, order, reason, timestamp and before/after amounts (FR-J2, FR-J3,
   AC-11), committed in the same transaction as the `Refund`, its `RefundTender` rows and
   the `CLOSED → REFUNDED` transition (section 6.5).
2. **Cancelled approval.** Cancel or Escape in M-1: one entry naming the initiating actor,
   `approver = null`, outcome cancelled, in its own short transaction. If it cannot commit,
   the request fails (ADR-007). So on the server, Cancel is a request that can fail.
   Cancelling the *sheet*, before M-1 opens, is not an approval outcome and writes nothing.
3. **Failed approval.** A wrong PIN, or a valid PIN that is not a manager's: one entry
   naming the initiating actor with `approver = null` and the failed outcome, and a count
   against the `MANAGER_APPROVAL` throttle (FR-A5, FR-J3). **The lead's list omits this
   one.** POS-06 does not build these states, but the server owes the entry all the same.
4. **Approved, then refused** (ruling O4). One entry naming actor and approver, outcome
   `REFUSED`, the refusal code, and no before/after amounts (FR-J3, AC-18). The client
   states that correspond are `refund-error` and `day-refusal`.
5. **No response.** The client writes nothing; the server's record is whatever it did.
6. **No PIN value in either store, in any form** (FR-J4, B-12).

Two things the Handoff should name as undecided rather than assume:

- **The order of the server's checks.** Whether the request's own validity (sum, tenders,
  reason) is checked before or after the PIN decides whether a malformed refund produces
  entry 3, entry 4 or none. That is Phase 5 architecture and should get an ADR then.
- **Which exits from M-1 count as cancelled.** Cancel and Escape plainly do. An abandoned
  prompt (the 90-second idle lock, navigation, a closed tab) is not covered by FR-J3. The
  client cannot reliably report its own disappearance. This one is the owner's.

---

## 8. One M-1

**What the documents constrain.**

- **Section 7.1, B-14, FR-A6: no token, no approval session.** The approval lives only
  inside the one protected command that carries the PIN. So the seam must not be two
  steps, *verify, then act*, with an approval value passed between them. Anything shaped
  `approve(): Approval` followed by `refund(approval)` puts an approval in client state,
  which is the thing B-14 forbids and `approvalFixtures.ts` deliberately never represents.
- **ADR-007: Cancel is an audited outcome.** On the server it becomes a request that can
  fail. Cancel must therefore be the caller's callback, and every way of dismissing the
  modal must go through it.
- **ADR-003: an idempotency key and an expected order version.** Both belong to the refund
  command, not to M-1. They do not constrain the component beyond this: M-1 must not own
  the identity of an attempt.

**The seam I recommend.** M-1 becomes a controlled, presentational dialog. The caller
gives it what to show and two callbacks, and owns everything else:

- *the request to display*, fixed for the life of one mounting: the subject line, the
  money-back line and its tag for POS-06; the existing single line for POS-03;
- *`onSubmit(pin)`*: one callback that carries out the whole protected action. The
  parameter is typed, because the real command needs the PIN inside it. FE-032's POS-06
  handler declares no parameter, so the digits are dropped unread;
- *`onCancel()`*: the caller's, called by Cancel and by Escape alike;
- *the server's answer*, as props the caller sets: the existing `notice` and `throttled`.
  POS-06 passes neither today. When the server exists, a wrong PIN sets a notice and the
  modal stays; a result closes it.

`ApprovalPrompt({ approval, go })` stays as a thin adapter over that dialog for POS-03, so
its fixture routing and its tests do not change.

**Rules that follow.**

1. The object displayed and the object submitted are the same one. The allocation the
   manager reads in M-1 is, by construction, the allocation the handler sends. The sheet
   cannot change it while the modal is open.
2. The dialog holds nothing between openings, and a new attempt is a new mounting. This is
   already the practice (`Approval.tsx:13–17`).
3. No dismissal other than Cancel and Escape. Today the scrim has no click handler; keep
   it that way, or an unaudited exit is created.
4. No idempotency key, attempt id or version is added to the component or to the in-memory
   operation now. A key on a call that cannot be retried would be pretend infrastructure.
   The Handoff records it as owed. One note for Phase 5: if a wrong PIN is followed by a
   second entry in the same modal, that is a new submission and most likely a new key,
   since reuse with a different payload is rejected (section 8).

---

## 9. Anything else in the draft

1. **A book order's REFUNDED view cannot reuse FE-031's fixture pieces.** `noticesFor`
   hard-codes *20:31 · approved by M. Iqbal* and *Wrong dish served*
   (`closedOrderDetail.ts:113–121`), and the screen lists `moneyReturned(tenders, change)`
   (`ClosedOrderScreen.tsx:168`). FE-031's Handoff says `moneyReturned` "already produces"
   the rows. After an edited allocation that would show money going back to tenders it did
   not go back to, under a fabricated approver. The draft's item 7 must say that a book
   order's notice and rows come from its record.
2. **`PosRoutes.tsx:90` is not in the draft's inputs.** With a third status and no change
   there, a refunded order that is still the active one stops counting as closed for the
   Back-navigation guard. The book would still refuse edits, but live controls would be
   drawn for a refunded order.
3. **The acceptance criteria cite AC-14, AC-25 and AC-34 as if this task met them.** It
   cannot (question 1). Reword them as the client's behaviour, and say once that the PRD's
   criteria remain open.
4. **A citation.** The constraint *Recorded revenue is not edited here (B-6)* is right in
   substance but B-6 says revenue is the order total, not the amount tendered. The
   authority for "the refund is its own record and the tenders are not changed" is
   section 6.5 and the immutability list in section 8.
5. **The fixture-address walk is unspecified** (question 1). Item 6 defers everything to
   this consult, and items 7 and 10 do not say what a confirm does on a fixture address.
6. **Found, and not FE-032's to fix:** `closeOrder` accepts whatever drafts it is given.
   A single Card draft above the total would close with change against a card, which B-5
   forbids. Only the Add gate prevents it, and `initialDrafts` seeds drafts without passing
   that gate (safe today only because each seeded state also selects its own order). The
   refund's default allocation must not assume a well-formed tender list, which is one
   reason for the walk in question 5. The lead may want a small task to make `closeOrder`
   refuse a non-cash tender above the running balance.

The lead's ruling that a cancelled sheet is discarded has no architectural objection. The
draft is tab-local presentation state (section 4.1) and carries nothing of an approval.

No boundary is broken by the draft as written. B-1, B-9, B-10, B-19, B-20 and B-23 are each
stated as constraints and are consistent with what is proposed here.

---

## For the task file

Rules for the *Architect consult* section of FE-032, in the lead's words or these.

1. **Stand-in.** An approved refund of a book order is recorded in the in-memory book by
   `book.refund(orderId, request, refundedAt)`, over a pure `refundOrder` in a module beside
   `close.ts` that reads no clock and imports no React. Its header comment says it stands in
   for the server's refund command and lists what it omits: PIN verification, actor,
   approver, idempotency key, expected order version, the business-day lock, the audit
   entry, and persisted `Refund` and `RefundTender` rows.
2. **A command, never a status.** The screen passes the order id, the allocations and the
   reason. It never sets a status and never keeps its own `refunded` flag. After any result
   it draws the order from the book.
3. **The record.** `refunded?: { refundedAt, reason, allocations, amount }` on the book's
   order, set once and never unset. Amounts above zero only, in tender order, each with its
   position and the original tender's label. No approver, no actor, no approval flag, and
   never `approver: null`. The close facts, lines and totals are not changed.
4. **The status.** `orders()` reports `'open' | 'closed' | 'refunded'`, derived from the
   record. Update `bookRows`, `bookDetail`, `noticesFor`, the *Money returned* rows and
   `PosRoutes.tsx:90`; leave `isClosed` true for a refunded order. Search for every other
   comparison against `'closed'` and say in the Handoff what was found.
5. **Refusals,** in this order: `unknown-order`, `not-closed`, `already-refunded`,
   `zero-total`, `day-closed` (an input fact; no book order sets it), `no-reason`,
   `not-a-tender` (out of range or repeated), `invalid-amount` (negative), `sum-mismatch`.
   The result is a value naming the refusal, never a throw and never a bare boolean.
6. **All or nothing.** Validate everything, then write one field in one update, through the
   functional updater so a second call in the same tick changes nothing. A refusal returns
   the same book object. Do not loosen `update`'s closed-order guard.
7. **Zero rows.** The screen drops them before calling; the operation also never stores
   one.
8. **The default allocation** is the running-balance walk: `contribution = min(amount,
   remaining)`, in the order the tenders were taken. One function serves the defaults, the
   *ALLOCATION EDITED* comparison and the arithmetic line. A test asserts that the rows are
   never negative, that they sum to the total, and that the Cash rows sum to
   `cashContribution`. `moneyReturned` is not used for a book order.
9. **The approver.** A refund made in this session names no approver and does not say
   *approved*: `REFUNDED · <HH:MM WIB>` and *The whole order was refunded. Reason:
   <reason>.* The artifact's approver copy appears only on the fixture `refunded` picture
   and Table 3. (Copy pending the owner, below.)
10. **The PIN.** The digits are never read, compared, stored, passed on or logged. The
    confirm handler declares no parameter. There is no magic PIN. The six-digit rule is
    input completeness. The call site's comment says confirm stands for the server
    accepting the command and that nothing is verified.
11. **The M-1 seam.** One controlled dialog: the request to display, `onSubmit(pin)` as a
    single callback that performs the whole action, `onCancel()` owned by the caller and
    used by Cancel and Escape alike, and `notice` and `throttled` as props. No step that
    returns an approval. No other way to dismiss it. No key, attempt id or version in the
    component. `ApprovalPrompt({ approval, go })` remains as an adapter for POS-03.
12. **Refusal pictures.** As the table in question 6. No asynchronous path, no pending
    state, no `no-response` outcome and no simulated failure on a book order. The three
    failure states stay as fixture pictures by URL. A test hands the screen a book whose
    `refund` refuses.
13. **Fixture addresses.** A confirm on an address with a `state` shows the artifact's
    REFUNDED composition in screen state, with the chosen reason and allocation and no
    approver. It never calls `book.refund` and never creates a book entry.
14. **No audit in the client,** and no mock of one. The Handoff lists what the server owes:
    the four entries and two undecided points of question 7; the idempotency key and
    expected version (ADR-003); the business-day lock (section 8); server time for
    `refundedAt` in place of the browser clock (section 14.4); the server's own refusal
    codes in place of the client's names (section 13); each tender's effective contribution
    from the server in place of the walk; the in-flight state and the no-response re-read;
    and whether `RefundTender` rows follow original tenders or tender types.
15. **Removal.** When the server's refund command exists, the in-memory operation is
    deleted, not kept as a fallback.
16. **What the tests prove.** The client's behaviour. AC-11, AC-14, AC-18, AC-25 and AC-34
    are not closed by this task; reword the criteria that cite them.

## For the owner

1. **Accept, or decline, the approval stand-in.** In the fixture client, six digits and the
   confirm key will move a book order to REFUNDED with no PIN verified, under the
   conditions of question 4. I recommend accepting it, and recording it in DECISIONS.md so
   it is not later read as a working gate. If declined, FE-032 is built as fixtures only
   and the live refund waits for FR-A and the server.
2. **The REFUNDED notice without an approver.** For a refund made in this session I
   propose `REFUNDED · <HH:MM>` / *The whole order was refunded. Reason: <reason>.*, the
   reviewed copy with *approved by M. Iqbal* removed. It is a change to reviewed copy on an
   identity matter, so it is the owner's to confirm.
3. **Not blocking FE-032; needed before Phase 5.** Whether an abandoned approval prompt
   (the 90-second idle lock, navigating away, a closed tab) is a *cancelled approval* for
   FR-J3 and AC-18. The client cannot reliably report it, so the ruling decides whether the
   server must infer it. The verifying-state cancel that DESIGN-009 left unresolved belongs
   to the same conversation.

Nothing here asks for a change to PRODUCT.md, PRD.md, ROADMAP.md or BOUNDARIES.md, and no
new ADR is proposed. If the owner wants the stand-in rule (rules 1 and 15) to outlive this
task as a standing decision, it fits a line in DECISIONS.md better than an ADR, because it
describes how the client is built before the server exists and changes nothing in the
approved architecture.

DONE
