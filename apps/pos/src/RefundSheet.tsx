import type { Money } from '@pos/money';
import { ApprovalDialog } from './Approval.js';
import type { ApprovalRequest } from './approvalFixtures.js';
import type { Tender } from './close.js';
import { Pad } from './ClosedOrdersScreen.js';
import { formatAmount } from './money.js';
import {
  AMOUNT_DIGITS,
  LETTER_ROWS,
  OTHER_REASON,
  REASON_MAX,
  REASON_PRESETS,
  REFUND_COPY as COPY,
  allocated,
  amountOf,
  arithmetic,
  differenceText,
  isEdited,
  keyedAmount,
  shortBy,
  type Draft,
  type Panel,
} from './refundDraft.js';
import { SheetFrame } from './Sheets.js';

// POS-06's refund, drawn (FE-032): M-5, the allocation sheet, and M-1 over it.
// Both are controlled by the screen and decide nothing: whether a refund is
// accepted is the book's answer, never this file's. The sheet shows the draft;
// the approval shows the same draft, fixed for the life of one mounting, so the
// allocation displayed is the allocation submitted (B-14).

export type SheetState = { draft: Draft; panel: Panel };

const SUM_NOTE_ID = 'refund-sum-note';
const REASON_NOTE_ID = 'refund-reason-note';

export function RefundSheet({
  tenders,
  total,
  sheet,
  onChange,
  onCancel,
  onContinue,
}: {
  tenders: ReadonlyArray<Tender>;
  total: Money;
  sheet: SheetState;
  onChange: (next: SheetState) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const { draft, panel } = sheet;
  const aside = <span className="closed-tag">{COPY.tag}</span>;
  const back = () => onChange({ draft, panel: { kind: 'list' } });

  if (panel.kind === 'edit') {
    const row = tenders[panel.index]!;
    const others = allocated(draft.amounts) - draft.amounts[panel.index]!;
    return (
      <SheetFrame
        title={COPY.editTitle}
        aside={aside}
        onClose={back}
        foot={
          <>
            <button type="button" className="action" data-action="cancel-edit" onClick={back}>
              {COPY.cancelEdit}
            </button>
            <button
              type="button"
              className="action action--primary"
              data-action="save-edit"
              onClick={() => onChange({ draft: { ...draft, amounts: draft.amounts.map((a, i) => (i === panel.index ? amountOf(panel.value) : a)) }, panel: { kind: 'list' } })}
            >
              {COPY.keepAmount}
            </button>
          </>
        }
      >
        <div className="refund-editor">
          <div>
            <h3>{`${row.label} · money back`}</h3>
            <p className="closed-muted">{COPY.editNote(formatAmount(total))}</p>
            <div className="closed-totalrow">
              <output className="closed-field" data-field="amount">
                {panel.value ? formatAmount(amountOf(panel.value)) : '0'}
              </output>
            </div>
            <p>{`Other allocations: ${formatAmount(others)}`}</p>
            <p>{`Required total: ${formatAmount(total)}`}</p>
          </div>
          <Pad onKey={(k) => onChange({ draft, panel: { ...panel, value: keyedAmount(panel.value, k, AMOUNT_DIGITS) } })} />
        </div>
      </SheetFrame>
    );
  }

  if (panel.kind === 'other') {
    const typed = panel.text.trim() !== '';
    const press = (key: string) => {
      const text = key === '←' ? panel.text.slice(0, -1) : key === 'Clear' ? '' : (panel.text + key).slice(0, REASON_MAX);
      onChange({ draft, panel: { kind: 'other', text } });
    };
    return (
      <SheetFrame
        title={COPY.reasonHead}
        aside={aside}
        onClose={back}
        foot={
          <>
            <button type="button" className="action" data-action="cancel-other" onClick={back}>
              {COPY.cancelReason}
            </button>
            <button
              type="button"
              className={typed ? 'action action--primary' : 'action action--off'}
              data-action="save-other"
              aria-disabled={typed ? undefined : true}
              onClick={() => typed && onChange({ draft: { ...draft, reason: panel.text.trim() }, panel: { kind: 'list' } })}
            >
              {COPY.keepReason}
            </button>
          </>
        }
      >
        <p>{OTHER_REASON}</p>
        <input
          className="closed-field refund-reason"
          aria-label={COPY.otherLabel}
          value={panel.text}
          maxLength={REASON_MAX}
          onChange={(e) => onChange({ draft, panel: { kind: 'other', text: e.target.value.slice(0, REASON_MAX) } })}
        />
        <div className="refund-keyboard">
          {LETTER_ROWS.map((row) => (
            <div key={row}>
              {[...row].map((k) => (
                <button key={k} type="button" className="closed-letter" data-key={k} onClick={() => press(k)}>
                  {k}
                </button>
              ))}
            </div>
          ))}
          <div>
            <button type="button" className="closed-button" data-key=" " onClick={() => press(' ')}>
              {COPY.space}
            </button>
            <button type="button" className="closed-button" data-key="←" onClick={() => press('←')}>
              {COPY.deleteLetter}
            </button>
            <button type="button" className="closed-button" data-key="Clear" onClick={() => press('Clear')}>
              {COPY.clear}
            </button>
          </div>
        </div>
      </SheetFrame>
    );
  }

  const short = shortBy(draft.amounts, total);
  const hasReason = draft.reason !== '';
  const custom = hasReason && !REASON_PRESETS.includes(draft.reason);
  const ready = short === 0n && hasReason;
  const why = [short !== 0n && SUM_NOTE_ID, !hasReason && REASON_NOTE_ID].filter(Boolean).join(' ');
  const choose = (reason: string) => onChange({ draft: { ...draft, reason }, panel });

  return (
    <SheetFrame
      title={COPY.sheetTitle}
      aside={aside}
      onClose={onCancel}
      foot={
        <>
          <button type="button" className="action" data-action="cancel-sheet" onClick={onCancel}>
            {COPY.cancel}
          </button>
          <button
            type="button"
            className={ready ? 'action action--primary' : 'action action--off'}
            data-action="continue"
            aria-disabled={ready ? undefined : true}
            aria-describedby={ready ? undefined : why}
            onClick={() => ready && onContinue()}
          >
            {COPY.continue}
          </button>
        </>
      }
    >
      <div className="refund-banner" role="status">
        <strong>{COPY.notice(formatAmount(total))}</strong>
        <p>{COPY.noticeBody}</p>
      </div>
      <p className="closed-label">{COPY.how}</p>
      {tenders.map((t, i) => {
        const amount = draft.amounts[i]!;
        return (
          <div className="refund-allocation" key={i}>
            <span>
              {t.label}
              {amount === 0n && <span className="closed-muted refund-inline">{` ${COPY.notRefunded}`}</span>}
            </span>
            <button
              type="button"
              className="closed-field refund-field"
              data-action="edit"
              data-index={i}
              aria-label={`Edit ${t.label} allocation ${i + 1}`}
              onClick={() => onChange({ draft, panel: { kind: 'edit', index: i, value: String(amount) } })}
            >
              {formatAmount(amount)}
            </button>
          </div>
        );
      })}
      <div className="closed-totalrow">
        <strong>{COPY.allocated}</strong>
        <strong>{`${formatAmount(allocated(draft.amounts))} of ${formatAmount(total)}`}</strong>
      </div>
      {short !== 0n ? (
        <p className="closed-invalid" role="alert" id={SUM_NOTE_ID}>
          {`${differenceText(short)}. Allocations must equal ${formatAmount(total)} exactly.`}
        </p>
      ) : (
        <p className="closed-muted">{COPY.equal}</p>
      )}
      {draft.amounts.some((a) => a === 0n) && <p className="closed-muted">{COPY.zeroRow}</p>}
      <p className="closed-muted">{[COPY.defaults, ...arithmetic(tenders, total)].join(' ')}</p>
      <h3>{COPY.reasonHead}</h3>
      <div className="closed-options">
        {REASON_PRESETS.map((r) => (
          <button key={r} type="button" className="closed-button" data-action="reason" aria-pressed={draft.reason === r} onClick={() => choose(r)}>
            {r}
          </button>
        ))}
        <button
          type="button"
          className="closed-button"
          data-action="other"
          aria-pressed={custom}
          onClick={() => onChange({ draft, panel: { kind: 'other', text: custom ? draft.reason : '' } })}
        >
          {OTHER_REASON}
        </button>
      </div>
      {custom && <p>{draft.reason}</p>}
      {!hasReason && (
        <p className="closed-muted" id={REASON_NOTE_ID}>
          {COPY.reasonMissing}
        </p>
      )}
    </SheetFrame>
  );
}

/**
 * M-1 over POS-06, for this one refund (B-14): the subject, the reason and the
 * money back, row by row, with the tag where any row differs from its default.
 * The confirm handler is the caller's and receives no digits it may use: nothing
 * here, and nothing the caller does with the entry, verifies a PIN.
 */
export function RefundApproval({
  name,
  tenders,
  total,
  draft,
  onSubmit,
  onCancel,
}: {
  name: string;
  tenders: ReadonlyArray<Tender>;
  total: Money;
  draft: Draft;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const request: ApprovalRequest = { action: 'refund', description: `Refund ${name}, ${formatAmount(total)}`, reason: draft.reason };
  const back = tenders.map((t, i) => (draft.amounts[i] === 0n ? `${t.label} ${COPY.approvalNotRefunded}` : `${t.label} ${formatAmount(draft.amounts[i]!)}`));
  return (
    <ApprovalDialog
      request={request}
      requireFull
      footnote={COPY.approves}
      detail={
        <p className="modal__split">
          {`Money back: ${back.join(' · ')}`}
          {isEdited(draft.amounts, tenders, total) && (
            <>
              {' '}
              <span className="closed-tag">{COPY.edited}</span>
            </>
          )}
        </p>
      }
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
