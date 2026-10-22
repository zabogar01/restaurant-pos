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
