// BO-08 Settings (PHASE1-S2b). Every sentence is a row of DESIGN-018's copy table
// (.agent/tasks/DESIGN-018-settings-and-tenders.md, "Copy and accessible names") or of
// DESIGN-018b (the phone). Braces in the table are the values here; a zod message, a server
// text, an error code or a submitted value never becomes visible text. The sentences BO-05
// shares with this screen (the departure decision, Saving, the general failure, the waiting
// sentence, Configuration) stay in `../copy.ts`, their one source.

import type { NoticeCopy } from '../copy.js';
import type { FieldKey, TextKey } from './fields.js';
import type { RateError } from './rate.js';

export const SETTINGS = 'Settings';
export const RATES_AND_RECEIPT = 'Rates and receipt details';

export const factsLine = (version: number, since: string, name: string): string =>
  `Version ${version} · In force since ${since} · Saved by ${name}`;
export const FACTS_FIRST_RUN = 'Not saved yet. Saving creates version 1.';

export const LOADING_SETTINGS = 'Loading settings…';
export const SETTINGS_READ_FAILED: NoticeCopy = {
  title: 'Settings could not be loaded',
  body: 'Try again to read the settings.',
};
export const FIRST_RUN_TITLE = 'No settings saved yet';
export const FIRST_RUN_BODY = 'Enter the rates and receipt details. Saving creates version 1.';
export const ENTER_SETTINGS = 'Enter settings';
export const TRY_AGAIN = 'Try again';

// The read view.
export const GROUP_MONEY = 'Money';
export const GROUP_RATES = 'Rates';
export const GROUP_RECEIPT = 'Receipt details';
export const TERM_CURRENCY = 'Currency';
export const TERM_PRECISION = 'Decimal places';
export const FIXED_NOTE = 'Fixed for this installation.';
export const RECEIPT_NOTE = 'These details are printed on receipts.';
export const NOT_SET = 'Not set';
export const NOT_SET_IN_FORCE = 'not set';
export const CHANGE = 'Change';

/** The currency and the decimal places as words, from the settings read (ADR-012 rule 5). */
export const currencyText = (code: string): string => (code === 'IDR' ? 'IDR · Indonesian rupiah' : code);
export const precisionText = (places: number): string => (places === 0 ? '0 · amounts are whole rupiah' : String(places));

interface RowCopy {
  term: string;
  note?: string;
  /** The field's label in the form. */
  label: string;
  /** The accessible name of the row's Change action. */
  change: string;
  help: string;
}

export const ROW: Record<FieldKey, RowCopy> = {
  tax: {
    term: 'Tax rate',
    note: 'Included in menu prices',
    label: 'Tax rate',
    change: 'Change tax rate',
    help: 'Included in menu prices. 0 to 100, up to four decimal places.',
  },
  service: {
    term: 'Service charge',
    note: 'Added to the bill · not taxed',
    label: 'Service charge rate',
    change: 'Change service charge rate',
    help: 'Added to the bill, not taxed. 0 to 100, up to four decimal places.',
  },
  outlet: { term: 'Outlet name', label: 'Outlet name', change: 'Change outlet name', help: 'Up to 64 characters.' },
  address: {
    term: 'Address',
    label: 'Address',
    change: 'Change address',
    help: 'Up to three lines and 200 characters.',
  },
  phone: {
    term: 'Phone',
    label: 'Phone',
    change: 'Change phone',
    help: 'Up to 32 characters: digits, spaces and + - . ( )',
  },
  npwpd: { term: 'NPWPD', note: 'Optional', label: 'NPWPD', change: 'Change NPWPD', help: 'Optional. Up to 32 characters.' },
  footer: { term: 'Footer line', label: 'Footer line', change: 'Change footer line', help: 'One line, up to 120 characters.' },
};

// The form.
export const EDIT_TITLE = 'Edit settings';
export const EDIT_CONTEXT = 'Changes apply to orders opened after you save. Orders already open keep the settings they opened with.';
export const FIRST_RUN_CONTEXT = 'Nothing is saved yet. Enter every rate and detail; saving creates version 1.';
export const SAVE = 'Save';
export const CANCEL = 'Cancel';

export const RATE_EMPTY: Record<'tax' | 'service', string> = {
  tax: 'Enter the tax rate.',
  service: 'Enter the service charge rate.',
};
export const RATE_REFUSED: Record<Exclude<RateError, 'empty'>, string> = {
  negative: 'Use 0 or more.',
  format: 'Enter a number, such as 10 or 10,5.',
  decimals: 'Use at most four decimal places.',
  over: 'Use 100 or less.',
};

const longer = (limit: number): string => `Use ${limit} characters or fewer.`;
export const TEXT_REFUSED: Record<TextKey, Partial<Record<'empty' | 'long' | 'lines' | 'charset' | 'control', string>>> = {
  outlet: {
    empty: 'Enter the outlet name.',
    long: longer(64),
    control: 'Remove control characters from the outlet name.',
  },
  address: {
    empty: 'Enter the address.',
    long: longer(200),
    lines: 'Use three lines or fewer.',
    control: 'Remove control characters from the address. Line breaks are allowed.',
  },
  phone: {
    empty: 'Enter the phone number.',
    long: longer(32),
    charset: 'Use only digits, spaces and + - . ( ).',
  },
  npwpd: { long: longer(32), control: 'Remove control characters from the NPWPD.' },
  footer: {
    empty: 'Enter the footer line.',
    long: longer(120),
    control: 'Remove control characters from the footer line.',
  },
};

export const nowInForce = (value: string): string => `Now in force: ${value}`;

// The rate confirmation.
export const CONFIRM_TITLE = 'Save new rates?';
export const CONFIRM_RULE =
  'Orders opened after you save use the new rates. Orders already open keep the rates they were opened with. Closed orders and day reports never change.';
export const CONFIRM_ALSO = 'Your other changes are saved in the same version.';
export const CONFIRM_BACK = 'Back to editing';
export const CONFIRM_SAVE = 'Save new rates';
export const rateChange = (name: 'Tax rate' | 'Service charge', from: string, to: string): string =>
  `${name} from ${from}% to ${to}%`;

// Results and notices.
export const saved = (version: number): string => `Settings saved as version ${version}. Orders opened from now on use them.`;
export const unchanged = (version: number): string => `Nothing changed. Version ${version} is still in force.`;

export const STALE_TITLE = 'Settings changed while you were editing';
export const UNKNOWN_TITLE = 'Outcome not confirmed';
const comparison = (differs: boolean): string =>
  differs ? 'Fields where it differs from your draft show its value.' : 'It has the same values as your draft.';
export const staleBody = (version: number, name: string, when: string, differs: boolean): string =>
  `Nothing was saved. Version ${version} was saved by ${name} on ${when}, after you started. ${comparison(differs)} Choose which to keep.`;
export const unknownSameBody = (version: number): string =>
  `The outcome could not be confirmed. The settings have been read again; version ${version} is in force. Your draft is kept; nothing was sent again.`;
/**
 * NOT A ROW OF DESIGN-018. An unknown outcome at the first run whose reread shows nothing saved
 * has no version to name, and the table's sentence needs one. This is the table's sentence with
 * the version clause replaced; it awaits the lead's ruling (see the Handoff).
 */
export const UNKNOWN_FIRST_RUN_BODY =
  'The outcome could not be confirmed. The settings have been read again; nothing is saved yet. Your draft is kept; nothing was sent again.';
export const unknownChangedBody =(version: number, name: string, when: string, differs: boolean): string =>
  `The outcome could not be confirmed. The settings have been read again: version ${version}, saved by ${name} on ${when}, is now in force. It may be this save. ${comparison(differs)} Your draft is kept; nothing was sent again. Choose which to keep.`;
export const UNKNOWN_UNREAD_BODY =
  'The outcome could not be confirmed. The settings could not be read again. Your draft is kept; nothing was sent again.';
export const KEEP = 'Keep my changes';
export const USE_CURRENT = 'Use current settings';
export const CHOOSE_FIRST = 'Choose Keep my changes or Use current settings first.';
export const keptTitle = (version: number): string => `Your changes now build on version ${version}`;
export const KEPT_BODY = 'Nothing has been saved yet. Press Save to save them.';
export const usedTitle = (version: number): string => `The form now shows version ${version}`;
export const USED_BODY = 'Nothing was saved. Edit it and save, or Cancel to close.';

// The payment-methods part (PHASE1-S3b), DESIGN-018's rows from "Methods part" to "Method form
// pending / failure / unknown". The method form's pending, failure and unknown notices, the
// waiting sentence and the departure decision are BO-05's words, quoted verbatim there
// (`../copy.js`); they are not repeated here.
export const METHODS = 'Payment methods';
export const methodCounts = (active: number, inactive: number): string =>
  `${active} active · ${inactive} inactive custom methods`;
export const METHODS_CAPTION = 'Cash and card are always offered · Custom methods: active first, names in order';
export const METHODS_LIST_LABEL = 'Payment method list';
export const COLUMN_NAME = 'Name';
export const COLUMN_STATUS = 'Status';
export const COLUMN_ACTIONS = 'Actions';
/** Cash and card are fixed kinds, not records: their display names are client copy (consult C2 section 8). */
export const FIXED_METHODS = ['Cash', 'Card'] as const;
export const ALWAYS_OFFERED = 'Always offered';
export const STATUS_ACTIVE = 'Active';
export const STATUS_INACTIVE = 'Inactive';
export const METHODS_EMPTY =
  'No custom payment methods yet. Use New payment method for any way of paying other than cash or card.';
export const NEW_METHOD = 'New payment method';
export const EDIT = 'Edit';
export const DEACTIVATE = 'Deactivate';
export const REACTIVATE = 'Reactivate';
export const editMethodName = (name: string, active: boolean): string => `Edit ${name} — ${active ? 'active' : 'inactive'}`;
export const deactivateName = (name: string): string => `Deactivate ${name}`;
export const reactivateName = (name: string): string => `Reactivate ${name}`;

export const LOADING_METHODS = 'Loading payment methods…';
export const METHODS_READ_FAILED: NoticeCopy = {
  title: 'Payment methods could not be loaded',
  body: 'Try again to read the payment methods.',
};
/** A success while the list read stands failed (F4): "could not be loaded" is untrue above a drawn list. */
export const METHODS_PARTIAL: NoticeCopy = {
  title: 'The list may be out of date',
  body: 'Payment methods could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list.',
};

export const methodEditTitle = (name: string): string => `Edit ${name}`;
export const METHOD_CREATE_CONTEXT = 'Choose the name cashiers will see when they take payment.';
export const METHOD_ACTIVE_CONTEXT = 'Active method. Changes keep this method’s history.';
export const METHOD_INACTIVE_CONTEXT = 'Inactive method. Saving its name does not reactivate it.';
export const METHOD_NAME = 'Method name';
export const METHOD_HELP = '1–32 characters. Active methods must have different names.';
export const NAME_EMPTY = 'Enter a method name.';
export const NAME_LONG = 'Use 32 characters or fewer.';
export const NAME_CONTROL = 'Remove control characters from the name.';
export const NAME_DUPLICATE = 'An active payment method already uses this name. Choose another name.';
export const NAME_DUPLICATE_REACTIVATE =
  'An active payment method already uses this name. Rename this inactive method, save, then reactivate it.';
export const NAME_IN_USE = 'Name in use';

export const methodSaved = (name: string): string => `${name} saved.`;
export const methodDeactivated = (name: string): string => `${name} deactivated. It is kept for history.`;
export const methodReactivated = (name: string): string => `${name} reactivated.`;
export const methodDeactivating = (name: string): string => `Deactivating ${name}…`;
export const methodReactivating = (name: string): string => `Reactivating ${name}…`;
export const methodUnknown = (name: string): string =>
  `${name}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.`;
export const methodUnknownUnread = (name: string): string =>
  `${name}: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.`;
export const methodFailed = (name: string): string =>
  `Something went wrong. ${name} was not changed. Use its row action to try again.`;
export const methodSessionRefused = (name: string): string => `${name} was not changed. Use its row action to try again.`;
