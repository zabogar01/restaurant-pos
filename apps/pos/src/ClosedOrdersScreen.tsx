import { useCallback, useState } from 'react';
import {
  CLOSED_COPY as COPY,
  CLOSED_STATES,
  NOMATCH_FILTERS,
  NO_FILTERS,
  TABLE_CHOICES,
  clock,
  dayGroups,
  isDayClosed,
  isFiltering,
  keyed,
  listedRows,
  matches,
  rangeIsValid,
  type ClosedFilters,
  type ClosedRow,
  type ClosedState,
} from './closedOrders.js';
import { FLOOR_COPY } from './floorFixtures.js';
import { formatAmount } from './money.js';
import { followClientSide } from './navigation.js';
import type { OrderBook } from './orderStore.js';
import { SheetFrame } from './Sheets.js';

// POS-05, the closed orders list (FE-030). Read-only: nothing here changes an
// order, and nothing names a receipt number (ruling I-1). Every row is an anchor
// that leaves the screen, followed client-side; Release is not drawn, for the
// floor's reason (FloorScreen.tsx) — it ends the actor's session, which is FR-A.
//
// F7: *Apply filter* filters the list at once; there is no Search step. The three
// filters are sheets over the list and combine. The fixture state selects the
// picture, and the screen then behaves: an Apply or a Reset leaves a filter or
// nomatch picture for `default`, as the artifact does (closed.js:79–81).

type Sheet =
  | { kind: 'table'; draft: string }
  | { kind: 'amount'; draft: string }
  | { kind: 'time'; from: string; to: string; field: 'from' | 'to'; invalid: boolean };

/** The range the time sheet opens on when none is set (A1). */
const DEFAULT_RANGE = { from: '1800', to: '2100' } as const;
const AMOUNT_DIGITS = 9;
const TIME_DIGITS = 4;
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', 'Clear'] as const;

function sheetFor(kind: Sheet['kind'], f: ClosedFilters): Sheet {
  if (kind === 'table') return { kind, draft: f.table };
  if (kind === 'amount') return { kind, draft: f.amount };
  return {
    kind,
    from: f.time ? f.time.from.replace(':', '') : DEFAULT_RANGE.from,
    to: f.time ? f.time.to.replace(':', '') : DEFAULT_RANGE.to,
    field: 'from',
    invalid: false,
  };
}

const sheetOf = (state: ClosedState): Sheet['kind'] | undefined =>
  state === 'filter-table' ? 'table' : state === 'filter-time' ? 'time' : state === 'filter-amount' ? 'amount' : undefined;

export function ClosedOrdersScreen({ state: initial, book }: { state: ClosedState; book: OrderBook }) {
  const [state, setState] = useState<ClosedState>(initial);
  const [filters, setFilters] = useState<ClosedFilters>(initial === 'nomatch' ? NOMATCH_FILTERS : NO_FILTERS);
  const [sheet, setSheet] = useState<Sheet | undefined>(() => {
    const kind = sheetOf(initial);
    return kind && sheetFor(kind, NO_FILTERS);
  });

  const closedDay = isDayClosed(initial);
  const home: ClosedState = closedDay ? initial : 'default';
  const filtering = isFiltering(filters);
  const dim = sheet ? { inert: '' } : {};

  const reset = () => {
    setFilters(NO_FILTERS);
    setState(home);
  };
  const closeSheet = useCallback(() => setSheet(undefined), []);

  const apply = () => {
    if (!sheet) return;
    if (sheet.kind === 'time') {
      if (!rangeIsValid(sheet.from, sheet.to)) {
        setSheet({ ...sheet, invalid: true });
        return;
      }
      setFilters({ ...filters, time: { from: clock(sheet.from), to: clock(sheet.to) } });
    } else {
      setFilters({ ...filters, [sheet.kind]: sheet.draft });
    }
    setSheet(undefined);
    if (state === 'nomatch' || sheetOf(state)) setState('default');
  };

  const back = closedDay ? '/pos/floor?state=dayclosed' : '/pos/floor';
  const message = state === 'empty' || state === 'loading' || state === 'error' ? COPY[state] : undefined;

  return (
    <>
      <div className="pos-device closed" data-closed-state={initial}>
        <header className="closed-head" {...dim}>
          <a className="closed-back" href={back} onClick={(e) => followClientSide(e, back)}>
            {COPY.back}
          </a>
          <h1>{COPY.title}</h1>
          <span className="closed-tag">{COPY.tag}</span>
          <div className="floor-actor">
            <span>{FLOOR_COPY.actor}</span>
            <span className="floor-idle">{FLOOR_COPY.idle}</span>
          </div>
        </header>
        {closedDay ? (
          <div className="closed-notice" role="status" {...dim}>
            <strong>{COPY.closedBannerTitle}</strong>
            <p>{COPY.closedBannerBody}</p>
          </div>
        ) : (
          <div className="closed-note" {...dim}>
            {FLOOR_COPY.dayOpen}
          </div>
        )}
        <div className="closed-toolbar" {...dim}>
          <Filter id="table" label={COPY.filters.table} value={filters.table} onOpen={() => setSheet(sheetFor('table', filters))} />
          <Filter
            id="time"
            label={COPY.filters.time}
            value={filters.time ? `${filters.time.from}–${filters.time.to}` : COPY.any}
            onOpen={() => setSheet(sheetFor('time', filters))}
          />
          <Filter
            id="amount"
            label={COPY.filters.amount}
            value={filters.amount ? formatAmount(BigInt(filters.amount)) : COPY.any}
            onOpen={() => setSheet(sheetFor('amount', filters))}
          />
          <button type="button" className="closed-button" data-action="reset" onClick={reset}>
            {COPY.reset}
          </button>
        </div>
        {/* The heads live inside the scroller, sticky, so a space-taking scrollbar narrows heads and rows alike. */}
        <div className="closed-scroll" tabIndex={0} role="region" aria-label={COPY.listLabel} {...dim}>
          <div className="closed-listhead">
            <span>{COPY.heads.closedAt}</span>
            <span>{COPY.heads.order}</span>
            <span>{COPY.heads.payment}</span>
            <span className="closed-money">{COPY.heads.total}</span>
          </div>
          {message ? (
            <div className="closed-empty" aria-live={state === 'loading' ? 'polite' : undefined}>
              <h2>{message.title}</h2>
              <p>{message.body}</p>
              {state === 'error' && (
                <button type="button" className="closed-button" data-action="reset" onClick={reset}>
                  {COPY.error.action}
                </button>
              )}
            </div>
          ) : closedDay ? (
            <DayGroups state={initial} filters={filters} filtering={filtering} onClear={reset} />
          ) : (
            <Rows rows={listedRows(state, book).filter((r) => matches(r, filters))} onClear={reset} />
          )}
        </div>
        {sheet && <FilterSheet sheet={sheet} setSheet={setSheet} onApply={apply} onClose={closeSheet} />}
      </div>
      {import.meta.env.DEV && (
        <nav className="fixture-states" aria-label="Fixture states">
          {CLOSED_STATES.map((s) => (
            <a key={s.id} href={`?state=${s.id}`} aria-current={s.id === initial ? 'page' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}

function Filter({ id, label, value, onOpen }: { id: string; label: string; value: string; onOpen: () => void }) {
  return (
    <div className="closed-filter">
      <span className="closed-label" id={`closed-filter-${id}`}>
        {label}
      </span>
      <button
        type="button"
        className="closed-button closed-button--filter"
        data-action={`filter-${id}`}
        aria-describedby={`closed-filter-${id}`}
        onClick={onOpen}
      >
        {`${value} · ${COPY.set}`}
      </button>
    </div>
  );
}

function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="closed-empty">
      <h2>{COPY.nomatch.title}</h2>
      <p>{COPY.nomatch.body}</p>
      <button type="button" className="closed-button" data-action="reset" onClick={onClear}>
        {COPY.nomatch.action}
      </button>
    </div>
  );
}

function Row({ row }: { row: ClosedRow }) {
  return (
    <a className="closed-row" href={row.href} onClick={(e) => followClientSide(e, row.href)}>
      <span>{row.time}</span>
      <span>{row.name}</span>
      <span>
        {row.payment}
        {row.changeNote && <span className="closed-muted">{row.changeNote}</span>}
        {row.refunded && (
          <>
            {' '}
            <span className="closed-tag">{COPY.refunded}</span>
          </>
        )}
      </span>
      <span className="closed-money">{formatAmount(row.total)}</span>
    </a>
  );
}

/** The rows, or — with none, and a filter set — *No matching orders*. Without one the list is plainly empty. */
function Rows({ rows, onClear }: { rows: ReadonlyArray<ClosedRow>; onClear: () => void }) {
  if (rows.length === 0) return <NoMatch onClear={onClear} />;
  return (
    <>
      {rows.map((r) => (
        <Row key={r.key} row={r} />
      ))}
    </>
  );
}

/** F3: the open day first, then the closed day, reprint only. Filters apply to both groups. */
function DayGroups({ state, filters, filtering, onClear }: { state: ClosedState; filters: ClosedFilters; filtering: boolean; onClear: () => void }) {
  const groups = dayGroups(state);
  const open = groups.openDay.filter((r) => matches(r, filters));
  const old = groups.closedDay.filter((r) => matches(r, filters));
  if (open.length === 0 && old.length === 0 && filtering) return <NoMatch onClear={onClear} />;
  return (
    <>
      <div className="closed-group">{COPY.openGroup}</div>
      {open.length > 0 ? (
        open.map((r) => <Row key={r.key} row={r} />)
      ) : (
        <div className="closed-note">{filtering ? COPY.openGroupNoMatch : COPY.openGroupEmpty}</div>
      )}
      <div className="closed-group">{COPY.closedGroup}</div>
      {old.length > 0 ? old.map((r) => <Row key={r.key} row={r} />) : <div className="closed-note">{COPY.closedGroupNoMatch}</div>}
    </>
  );
}

function Pad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="keypad keypad--approval">
      {PAD_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className="key"
          data-key={k}
          aria-label={k === '←' ? COPY.sheet.deleteKey : undefined}
          onClick={() => onKey(k)}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function FilterSheet({
  sheet,
  setSheet,
  onApply,
  onClose,
}: {
  sheet: Sheet;
  setSheet: (sheet: Sheet) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const copy = COPY.sheet[sheet.kind];
  return (
    <SheetFrame
      title={copy.title}
      aside={<span className="closed-tag">{COPY.sheet.tag}</span>}
      onClose={onClose}
      foot={
        <>
          <button type="button" className="action" data-action="cancel-filter" onClick={onClose}>
            {COPY.sheet.cancel}
          </button>
          <button type="button" className="action action--primary" data-action="apply-filter" onClick={onApply}>
            {COPY.sheet.apply}
          </button>
        </>
      }
    >
      <p>{copy.body}</p>
      {sheet.kind === 'table' && (
        <div className="closed-options">
          {TABLE_CHOICES.map((t) => (
            <button
              key={t}
              type="button"
              className="closed-button"
              data-value={t}
              aria-pressed={sheet.draft === t}
              onClick={() => setSheet({ ...sheet, draft: t })}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {sheet.kind === 'amount' && (
        <>
          <div className="closed-totalrow">
            <span>{COPY.sheet.amount.total}</span>
            <output className="closed-field">{sheet.draft ? formatAmount(BigInt(sheet.draft)) : COPY.any}</output>
          </div>
          <Pad onKey={(k) => setSheet({ ...sheet, draft: keyed(sheet.draft, k, AMOUNT_DIGITS) })} />
        </>
      )}
      {sheet.kind === 'time' && (
        <>
          <div className="closed-options">
            {(['from', 'to'] as const).map((field) => (
              <button
                key={field}
                type="button"
                className="closed-button"
                data-field={field}
                aria-pressed={sheet.field === field}
                onClick={() => setSheet({ ...sheet, field })}
              >
                {`${COPY.sheet.time[field]} ${clock(sheet[field])}`}
              </button>
            ))}
          </div>
          {sheet.invalid && (
            <p className="closed-invalid" role="alert">
              {COPY.sheet.invalid}
            </p>
          )}
          <Pad onKey={(k) => setSheet({ ...sheet, [sheet.field]: keyed(sheet[sheet.field], k, TIME_DIGITS), invalid: false })} />
        </>
      )}
    </SheetFrame>
  );
}
