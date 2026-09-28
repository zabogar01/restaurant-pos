// POS-07 print incidents (FE-025). Every incident here is a fixture: FE-022's
// live send yields `queued` and never FAILED, and there is no server, so no live
// source exists until the backend. The copy and data are the reviewed Frost
// artifact's (frost/pos/incidents.html), verbatim.

export type IncidentState =
  | 'default'
  | 'cancel'
  | 'empty'
  | 'reprint'
  | 'overflow'
  | 'loading'
  | 'error'
  | 'reprint-cancel'
  | 'reprint-receipt'
  | 'reprint-table9'
  | 'reprint-counter'
  | 'reprint-printed';

export const INCIDENT_STATES: ReadonlyArray<{ id: IncidentState; label: string }> = [
  { id: 'default', label: 'Kitchen emergency + receipt warning' },
  { id: 'cancel', label: 'Cancellation ticket UNKNOWN' },
  { id: 'empty', label: 'Nothing outstanding' },
  { id: 'reprint', label: 'Reprint result' },
  { id: 'overflow', label: 'Overflow' },
  { id: 'loading', label: 'Loading' },
  { id: 'error', label: 'Error' },
  { id: 'reprint-cancel', label: 'Cancellation reprint sent' },
  { id: 'reprint-receipt', label: 'Receipt reprint sent' },
  { id: 'reprint-table9', label: 'Table 9 reprint sent' },
  { id: 'reprint-counter', label: 'Counter receipt reprint sent' },
  { id: 'reprint-printed', label: 'Server-confirmed print result' },
];

/** `kitchen` and `cancellation` are the emergency class; `receipt` is not (FR-E6, AC-23). */
export type IncidentKind = 'kitchen' | 'cancellation' | 'receipt';

export type Incident = {
  id: string;
  kind: IncidentKind;
  title: string;
  /** The muted line under the title. Absent on a receipt, whose one line is the title. */
  meta?: string;
  /** The cancellation ticket's explanation; `stop` and `Check the printer…` are the artifact's bold runs. */
  note?: boolean;
  button: string;
  /** Copy under a receipt's title that only says what is known: an UNKNOWN delivery. */
  unknownNote?: string;
  /** A fixture's picture of a reprint result. A live press never carries one; only a server answer names a time. */
  serverResult?: string;
};

export const REPRINT_FOLLOW_UP = 'Check the kitchen has the paper before clearing this.';
export const LIVE_REPRINT_TITLE = 'Reprint sent';
export const SERVER_CONFIRMED_PRINT = 'Server confirmed: printed at 20:03';

const KITCHEN_T1R2: Incident = {
  id: 'kitchen-t1r2',
  kind: 'kitchen',
  title: 'Kitchen ticket did not print',
  meta: 'Table 1 · round 2 · 19:58 · 2 items · status FAILED',
  button: 'Reprint ticket',
};
const CANCEL_T1: Incident = {
  id: 'cancel-t1',
  kind: 'cancellation',
  title: 'Cancellation ticket — delivery unknown',
  meta: 'Table 1 · Burger · 20:02 · status UNKNOWN',
  note: true,
  button: 'Reprint cancellation',
};
const KITCHEN_T9R1: Incident = {
  id: 'kitchen-t9r1',
  kind: 'kitchen',
  title: 'Kitchen ticket did not print',
  meta: 'Table 9 · round 1 · 20:04 · 5 items · status FAILED',
  button: 'Reprint ticket',
};
const RECEIPT_T1: Incident = {
  id: 'receipt-t1',
  kind: 'receipt',
  title: 'Receipt did not print — Table 1, closed 20:14 · status FAILED',
  button: 'Reprint receipt',
};
const RECEIPT_COUNTER: Incident = {
  id: 'receipt-counter',
  kind: 'receipt',
  title: 'Receipt did not print — Counter, closed 20:11 · status UNKNOWN',
  unknownNote: 'Delivery is UNKNOWN. Check the printer before reprinting.',
  button: 'Reprint receipt',
};

const sent = (incident: Incident): Incident => ({ ...incident, serverResult: LIVE_REPRINT_TITLE });

export const INCIDENT_FIXTURES: Record<IncidentState, { incidents: ReadonlyArray<Incident> }> = {
  default: { incidents: [KITCHEN_T1R2, RECEIPT_T1] },
  cancel: { incidents: [CANCEL_T1, RECEIPT_T1] },
  // Each reprint-* state draws the artifact's result on its own card. Only
  // reprint-printed pictures a server's answer, so only it names a time.
  reprint: { incidents: [sent(KITCHEN_T1R2), RECEIPT_T1] },
  overflow: { incidents: [KITCHEN_T1R2, CANCEL_T1, KITCHEN_T9R1, RECEIPT_T1, RECEIPT_COUNTER] },
  empty: { incidents: [] },
  loading: { incidents: [] },
  error: { incidents: [] },
  'reprint-cancel': { incidents: [sent(CANCEL_T1), RECEIPT_T1] },
  'reprint-receipt': { incidents: [KITCHEN_T1R2, sent(RECEIPT_T1)] },
  'reprint-table9': { incidents: [KITCHEN_T1R2, sent(KITCHEN_T9R1), RECEIPT_T1, RECEIPT_COUNTER] },
  'reprint-counter': { incidents: [KITCHEN_T1R2, KITCHEN_T9R1, RECEIPT_T1, sent(RECEIPT_COUNTER)] },
  'reprint-printed': { incidents: [{ ...KITCHEN_T1R2, serverResult: SERVER_CONFIRMED_PRINT }, RECEIPT_T1] },
};

export function incidentStateFrom(search: string): IncidentState {
  const requested = new URLSearchParams(search).get('state');
  return INCIDENT_STATES.find((s) => s.id === requested)?.id ?? 'default';
}
