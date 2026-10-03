import type { Money } from '@pos/money';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ApprovalDialog } from './Approval.js';
import type { ApprovalRequest } from './approvalFixtures.js';
import { formatAmount } from './money.js';
import type { OrderLine, OrderView } from './orderFixtures.js';
import type { VoidOutcome } from './orderStore.js';
import { SheetFrame } from './Sheets.js';
import type { VoidThrough } from './voidChange.js';
import { firedWork, givenReason, voidRule, type ReasonChoice, type VoidReason, type VoidRule } from './void.js';
import { linesOf, type ShownOrder, type VoidSheetFixture } from './voidFixtures.js';

// The void sheets (F2j): a FIRED line, reached from its row body (I-12), and
// the whole order, reached from the close bar's Void order. Nothing here is a
// refund, and nothing shares a word or a control with one (FR-H1): refund is
// POS-06's, on a closed order.
//
// Nothing here decides a gate. Each sheet asks voidRule (void.ts) about what
// it would void, on the order beside it, and draws what the answer says: the
// MANAGER REQUIRED tag, the reasons, the cancellation notice, and whether the
// sheet's last button voids at once or opens the manager prompt. So the order
// sheet over an unfired order is FR-H3's, and over an order holding fired
// work it is FR-H4's, whichever ?state= served it.
//
// The prompt is component state, never a URL: a [MODAL] is neither a route nor
// back-stackable (SITEMAP §1). It is handed the reason with the request, so the
// manager approves the void and the reason together (M-1). Cancelling it
// returns to the sheet exactly as it was, reason kept (B-20).
//
// FE-036: the sheet reads the order on screen and writes through the store's
// two void operations (voidChange.ts), which decide the gate again on the order
// they write. A line that is not a FIRED line of that order has no sheet.
//
// B-15: the sheets say a cancellation ticket will print, in the artifact's
// words, and nothing else about printing. The void never waits on a printer,
// so no copy and no indicator here suggests it does.

/** The artifact's last reason. Choosing it asks for the cashier's own words. */
export const OTHER_REASON = 'Other — type a reason';

type Go = (view: OrderView) => void;

type VoidSheetProps = {
  fixture: VoidSheetFixture;
  /** The order on screen, which the sheet reads and the store writes. */
  order: ShownOrder;
  voidLine: (lineId: string, reason: string | undefined, through: VoidThrough) => VoidOutcome;
  voidOrder: (reason: string | undefined, through: VoidThrough) => VoidOutcome;
  go: Go;
  /** The order is voided: the order screen takes the cashier to the floor. */
  leave: () => void;
};

/** Draws nothing for a line that is not a FIRED line of the order (R13): there is nothing to void. */
export function VoidSheet(props: VoidSheetProps) {
  const subject = subjectOf(props.fixture, props.order);
  return subject && <VoidSheetBody {...props} subject={subject} />;
}

function VoidSheetBody({ fixture, voidLine, voidOrder, go, leave, subject }: VoidSheetProps & { subject: Subject }) {
  const [choice, setChoice] = useState<ReasonChoice>();
  const [refusal, setRefusal] = useState<string>();
  const [prompt, setPrompt] = useState<ApprovalRequest>();
  const promptOpen = useRef(false);
  const raisedBy = useRef<HTMLElement | null>(null);
  const other = useRef<HTMLInputElement>(null);

  const rule = voidRule(subject.target);

  // The order has been asked to change. A refusal is not a landing: the prompt,
  // if it was open, closes and the sheet stays, showing what the store holds.
  function settle(result: VoidOutcome) {
    promptOpen.current = false;
    if (result.refused) return setPrompt(undefined);
    if (subject.kind === 'line') go(fixture.landsOn);
    else leave();
  }

  const apply = (reason: string | undefined, through: VoidThrough) =>
    subject.kind === 'line' ? voidLine(subject.line.id, reason, through) : voidOrder(reason, through);

  // The one door. voidRule decides; the sheet only carries out the answer.
  function commit(from: HTMLElement) {
    const reason = givenReason(choice);
    if (rule.reason && reason === undefined) {
      setRefusal(REASON_REFUSAL);
      other.current?.focus();
      return;
    }
    if (!rule.approval) return settle(apply(reason, 'direct'));
    raisedBy.current = from;
    promptOpen.current = true;
    // The prompt displays the request, and what it displays is what it submits.
    setPrompt(requestFor(subject, rule, reason!));
  }

  function cancelPrompt() {
    promptOpen.current = false;
    setPrompt(undefined);
  }

  // Cancelling the prompt hands focus back to the control that raised it.
  useLayoutEffect(() => {
    if (prompt || !raisedBy.current) return;
    raisedBy.current.focus();
    raisedBy.current = null;
  }, [prompt]);

  function choose(next: ReasonChoice) {
    setChoice(next);
    setRefusal(undefined);
  }

  const cancel = () => go(fixture.cancel);

  // Escape does what Cancel does, unless the prompt is open over the sheet:
  // then the prompt's own Escape cancels it, and the sheet stays.
  const escape = useRef(() => {});
  escape.current = () => {
    if (!promptOpen.current) cancel();
  };
  const onEscape = useCallback(() => escape.current(), []);

  // React 18 has no inert prop; an empty string renders the bare attribute.
  const inert = prompt ? { inert: '' } : {};

  const reasons = rule.reason && (
    <Reasons
      reasons={fixture.reasons}
      choice={choice}
      choose={choose}
      refusal={refusal}
      other={other}
    />
  );
  // Continue exists once a reason is chosen, where one is required (FR-H4).
  const ready = !rule.reason || choice !== undefined;
  const foot = (cancelLabel: string, commitLabel: string) => (
    <>
      <button type="button" className="action" onClick={cancel}>
        {cancelLabel}
      </button>
      {ready ? (
        <button type="button" className="action action--primary" onClick={(e) => commit(e.currentTarget)}>
          {commitLabel}
        </button>
      ) : (
        <button type="button" className="action action--off" aria-disabled="true" onClick={() => {}}>
          {commitLabel}
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="void-flow" {...inert}>
        {subject.kind === 'line' ? (
          <SheetFrame
            title="Void a line already sent to the kitchen"
            aside={rule.approval && <span className="void-tag">MANAGER REQUIRED</span>}
            onClose={onEscape}
            foot={foot('Cancel', 'Continue')}
          >
            <div className="void-subject">
              <div className="void-subject__row">
                <span>
                  <b>{subject.line.name}</b>
                  {subject.detail && ` — ${subject.detail}`}
                </span>
                <span>{formatAmount(subject.line.amount)}</span>
              </div>
              <div className="void-subject__note">{subject.sent}</div>
            </div>
            {rule.cancels.length > 0 && (
              <div className="notice void-notice">
                <div className="notice__title">A cancellation ticket will print in the kitchen</div>
                <div>It cancels this work only. It is not a new order and does not re-send the item.</div>
              </div>
            )}
            {reasons}
          </SheetFrame>
        ) : (
          <SheetFrame
            title="Void this order"
            aside={rule.approval && <span className="void-tag">MANAGER REQUIRED</span>}
            onClose={onEscape}
            foot={foot('Keep order', rule.approval ? 'Continue' : 'Void order')}
          >
            {rule.cancels.length > 0 ? (
              <div className="notice void-notice">
                <div className="notice__title">{firedCount(rule.cancels.length)}</div>
                <div>A cancellation ticket will print covering only that fired work.</div>
              </div>
            ) : (
              <div className="notice notice--soft void-notice">
                <div className="notice__title">Nothing on this order has been sent to the kitchen</div>
                <div>No approval needed. The void is recorded against your name.</div>
              </div>
            )}
            {reasons}
            <div className="void-value">
              <span>Order value</span>
              <span className="void-value__amount">{formatAmount(subject.total)}</span>
            </div>
          </SheetFrame>
        )}
      </div>
      {prompt && (
        <ApprovalDialog
          request={prompt}
          requireFull
          // The confirm key stands for the server accepting the command. Nothing
          // is verified here: the six digits are neither read nor kept, so the
          // handler takes no parameter, and a second attempt mounts a fresh prompt.
          onSubmit={() => settle(apply(prompt.reason, 'manager-prompt'))}
          onCancel={cancelPrompt}
        />
      )}
    </>
  );
}

// "2 lines have already been sent to the kitchen", as the artifact counts them.
// PROVISIONAL COPY for one line: the artifact draws only two.
const firedCount = (n: number) =>
  n === 1 ? '1 line has already been sent to the kitchen' : `${n} lines have already been sent to the kitchen`;

// PROVISIONAL COPY. The artifact never draws "Other" chosen, so neither the
// field nor its refusal has reviewed wording.
const OTHER_LABEL = 'Reason, in your words';
const REASON_REFUSAL = 'Type a reason, or choose one above.';

function Reasons({
  reasons,
  choice,
  choose,
  refusal,
  other,
}: {
  reasons: ReadonlyArray<VoidReason>;
  choice: ReasonChoice | undefined;
  choose: (choice: ReasonChoice) => void;
  refusal: string | undefined;
  other: RefObject<HTMLInputElement>;
}) {
  // Choosing Other moves focus to the field it opens, so the cashier can type.
  const otherChosen = choice?.kind === 'other';
  useEffect(() => {
    if (otherChosen) other.current?.focus();
  }, [otherChosen, other]);

  const option = (label: string, selected: boolean, onPress: () => void) => (
    <button
      type="button"
      className={selected ? 'action action--compact void-reason action--primary' : 'action action--compact void-reason'}
      aria-pressed={selected}
      onClick={onPress}
    >
      {label}
    </button>
  );

  return (
    <div role="group" aria-labelledby="void-reasons">
      <span id="void-reasons" className="sheet__label">
        Reason — required
      </span>
      <div className="void-reasons">
        {/* No reason is chosen until a finger chooses one. */}
        {reasons.map((r) =>
          option(r.label, choice?.kind === 'listed' && choice.reason.id === r.id, () => choose({ kind: 'listed', reason: r }))
        )}
        {option(OTHER_REASON, otherChosen, () => {
          if (!otherChosen) choose({ kind: 'other', text: '' });
        })}
      </div>
      {choice?.kind === 'other' && (
        <>
          <label className="sheet__label void-other-label" htmlFor="void-reason-other">
            {OTHER_LABEL}
          </label>
          <input
            id="void-reason-other"
            ref={other}
            className={refusal ? 'void-field void-field--invalid' : 'void-field'}
            type="text"
            autoComplete="off"
            value={choice.text}
            aria-invalid={refusal ? 'true' : undefined}
            aria-describedby={refusal ? 'void-reason-refusal' : undefined}
            onChange={(e) => choose({ kind: 'other', text: e.currentTarget.value })}
          />
          {refusal && (
            <span id="void-reason-refusal" className="void-field__refusal">
              {refusal}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export type Subject =
  | { kind: 'line'; target: { kind: 'line'; line: OrderLine }; line: OrderLine; detail?: string; sent: string }
  | { kind: 'order'; target: { kind: 'order'; lines: ReadonlyArray<OrderLine> }; name: string; total: Money };

/** What the sheet would void, read from the order beside it. Undefined for a line that is not a FIRED line of it. */
export function subjectOf(fixture: VoidSheetFixture, order: ShownOrder): Subject | undefined {
  const all = linesOf(order);
  if (fixture.target.kind === 'order') {
    const lines = all.map((x) => x.line);
    return { kind: 'order', target: { kind: 'order', lines }, name: order.title, total: order.totals.total };
  }
  const { lineId } = fixture.target;
  const found = all.find((x) => x.line.id === lineId);
  if (!found) return undefined;
  const { line, group } = found;
  // I-12: a PENDING line is taken off from its row's own control, and a
  // VOIDED one is inert, so this sheet is only ever a FIRED line's.
  if (group.kind !== 'fired' || firedWork({ kind: 'line', line }).length === 0) return undefined;
  return {
    kind: 'line',
    target: { kind: 'line', line },
    line,
    // The artifact's card reads "Burger — Large, extra cheese": the modifiers
    // as the order carries them, without the price deltas the panel shows.
    detail: line.modifiers?.map((m) => m.name).join(', '),
    sent: `Sent to the kitchen in round ${group.round} at ${group.firedAt}.`,
  };
}

/**
 * The void the manager is asked to approve, with its reason (M-1: "the reason
 * is captured with the approval"). The line's wording is the artifact's own
 * prompt head: "Void a fired line — Burger 135.000 — reason: customer changed
 * their mind".
 *
 * PROVISIONAL COPY for the order: the artifact draws the prompt only for a line.
 */
export function requestFor(subject: Subject, rule: VoidRule<OrderLine>, reason: string): ApprovalRequest {
  if (!rule.reason) throw new Error('an unreasoned void is never approved');
  if (subject.kind === 'line') {
    const { line } = subject;
    return { action: 'void-fired-line', description: 'Void a fired line', subject: { name: line.name, amount: line.amount }, reason };
  }
  return {
    action: 'void-fired-order',
    description: 'Void an order holding fired lines',
    subject: { name: subject.name, amount: subject.total },
    reason,
  };
}
