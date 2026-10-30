// BO-07 Discount presets (PHASE1-S6b). Every sentence is a row of DESIGN-022's copy table
// (.agent/tasks/DESIGN-022-discount-presets.md, "Exact product copy and accessible names").
// Braces in the table are the values here; a zod message, a server text, an error code or a
// submitted value never becomes visible text. The departure and logout decisions and M-6 stay the
// one source in `../copy.ts`, and the installation's currency and decimal places are the words of
// `../settings/copy.ts`.
//
// Left out on purpose (PHASE1-S6b ruling 21): the kitchen-emergency sentences, BO-01's held-draft
// sentence, M-6's queued incident, and the review artifact's response chooser and simulation
// controls.

export type NoticeCopy = { title: string; body: string };

export const PRESETS = 'Discount presets';
export const NEW_PRESET = 'New preset';
export const CONTEXT = 'Named discounts staff choose at the POS. Existing orders keep the name and value applied to them.';
export const facts = (active: number, inactive: number, version: number): string =>
  `${active} active · ${inactive} inactive · Catalog version ${version}`;
export const LIST_LABEL = 'Preset list';
export const LIST_CAPTION = 'Active first · Oldest created first within each status · Fixed amounts in IDR';
export const COLUMN_NAME = 'Name';
export const COLUMN_DISCOUNT = 'Discount';
export const COLUMN_STATUS = 'Status';
export const COLUMN_ACTIONS = 'Actions';
export const KIND_PERCENTAGE = 'Percentage';
export const KIND_FIXED = 'Fixed amount';
export const STATUS_ACTIVE = 'Active';
export const STATUS_INACTIVE = 'Inactive';
export const EDIT = 'Edit';
export const DEACTIVATE = 'Deactivate';
export const REACTIVATE = 'Reactivate';
export const editName = (name: string, active: boolean): string => `Edit ${name} — ${active ? 'active' : 'inactive'}`;
export const deactivateName = (name: string): string => `Deactivate ${name}`;
export const reactivateName = (name: string): string => `Reactivate ${name}`;
export const NAME_IN_USE = 'Name in use';

// The page's states.
export const EMPTY_TITLE = 'No presets yet';
export const EMPTY_BODY = 'Use New preset to create the first discount staff can choose.';
export const LOADING = 'Loading discount presets…';
export const READ_FAILED: NoticeCopy = {
  title: 'Discount presets could not be loaded',
  body: 'Try again to read the discount presets.',
};
export const LIST_PARTIAL: NoticeCopy = {
  title: 'The preset list may be out of date',
  body: 'The rows below are the ones this page knows, including your latest change. Try again to read the full list.',
};
export const TRY_AGAIN = 'Try again';
export const REFRESHED = 'The preset list has been refreshed.';

// The form.
export const editTitle = (name: string): string => `Edit ${name}`;
export const CREATE_CONTEXT = 'Choose the name staff will see at the POS.';
export const INACTIVE_CONTEXT = 'Inactive preset. Saving does not reactivate it.';
export const SHARED_CONTEXT =
  'Changes apply only to discounts chosen afterwards. Orders already carrying this preset keep their saved name and value.';
export const versionLine = (version: number): string => `Catalog version ${version}`;
export const NAME_LABEL = 'Preset name';
export const NAME_HELP = '1–32 characters. Active presets must have different names.';
export const KIND_LEGEND = 'Discount kind';
export const PERCENT_LABEL = 'Percentage';
export const PERCENT_SUFFIX = '%';
export const PERCENT_HELP = '0 to 100, up to four decimal places.';
export const FIXED_NOTE = 'Fixed for this installation.';
export const AMOUNT_LABEL = 'Fixed amount';
export const AMOUNT_HELP = '0–99.999.999; whole rupiah. When applied, the discount is capped at the order subtotal.';
export const FOOT_HINT = 'Nothing is sent until you save.';
export const FOOT_HINT_PENDING = 'Wait for the save result.';
export const FOOT_HINT_STALE = 'Choose Keep my changes or Use current preset before saving.';
export const FOOT_HINT_STALE_UNREAD = 'Read the current preset before choosing which values to keep.';
export const CANCEL = 'Cancel';
export const SAVE = 'Save';

// Refusals of the form's own check.
export const NAME_EMPTY = 'Enter a preset name.';
export const NAME_LONG = 'Use 32 characters or fewer.';
export const NAME_CONTROL = 'Remove control characters from the name.';
export const NAME_DUPLICATE = 'An active preset already uses this name. Choose another name.';
export const NAME_DUPLICATE_REACTIVATE =
  'An active preset already uses this name. Rename this inactive preset, save, then reactivate it.';
export const PERCENT_EMPTY = 'Enter a percentage.';
export const PERCENT_NEGATIVE = 'Use 0 or more.';
export const PERCENT_FORMAT = 'Enter a number, such as 10 or 10,5.';
export const PERCENT_DECIMALS = 'Use at most four decimal places.';
export const PERCENT_OVER = 'Use 100 or less.';
export const AMOUNT_EMPTY = 'Enter a fixed amount.';
export const AMOUNT_NEGATIVE = 'Use 0 or more.';
export const AMOUNT_FORMAT = 'Enter whole rupiah, such as 10.000.';
export const AMOUNT_OVER = 'Use 99.999.999 or less.';

// What a save did.
export const SAVING: NoticeCopy = { title: 'Saving…', body: 'Wait for the result. Your draft is kept.' };
export const saved = (name: string): string => `${name} saved.`;
export const unchanged = (name: string, version: number): string =>
  `${name}: nothing changed. Catalog version ${version} is still current.`;
export const FORM_FAILED: NoticeCopy = {
  title: 'Something went wrong',
  body: 'Nothing was saved. Your draft is kept. Press Save to try again.',
};
export const OUTCOME_UNKNOWN: NoticeCopy = {
  title: 'Outcome not confirmed',
  body: 'The outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.',
};
export const OUTCOME_UNKNOWN_UNREAD: NoticeCopy = {
  title: 'Outcome not confirmed',
  body: 'The outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again.',
};
export const outcomeUnknownNewer = (version: number): NoticeCopy => ({
  title: 'Outcome not confirmed',
  body: `The catalog has been read again at version ${version}. It may include this save. Your draft is kept; nothing was sent again. Choose which values to keep.`,
});
export const outcomeAfterChoice = (version: number): NoticeCopy => ({
  title: 'Outcome not confirmed',
  body: `Your draft now builds on catalog version ${version}. The earlier save is still unconfirmed. Nothing was sent again.`,
});

// The stale draft.
export const staleNotice = (version: number): NoticeCopy => ({
  title: 'The catalog changed while you were editing',
  body: `Nothing was saved. The catalog has been read again at version ${version}. Your draft is kept. Choose which values to keep.`,
});
export const STALE_UNREAD: NoticeCopy = {
  title: 'The catalog changed while you were editing',
  body: 'The current preset could not be read. Your draft is kept. Try again reads the list; nothing is sent again.',
};
export const currentName = (name: string): string => `Current name: ${name} · Differs from your draft`;
export const currentKind = (kind: string): string => `Current kind: ${kind} · Differs from your draft`;
export const currentValue = (value: string): string => `Current value: ${value} · Differs from your draft`;
export const SAME_VALUES = 'The current preset has the same values as your draft.';
export const currentStatus = (active: boolean): string => `Current status: ${active ? 'Active' : 'Inactive'}.`;
export const KEEP = 'Keep my changes';
export const USE_CURRENT = 'Use current preset';

// The state commands.
export const deactivateTitle = (name: string): string => `Deactivate “${name}”?`;
export const DEACTIVATE_BODY =
  'It will disappear from the POS picker. Orders that already carry it keep its name and value as applied. You can reactivate it later.';
export const KEEP_ACTIVE = 'Keep active';
export const keepActiveName = (name: string): string => `Keep active — ${name}`;
export const deactivating = (name: string): string => `Deactivating ${name}…`;
export const reactivating = (name: string): string => `Reactivating ${name}…`;
export const deactivated = (name: string): string =>
  `${name} deactivated. It is hidden from the POS picker; existing orders keep it.`;
export const reactivated = (name: string): string => `${name} reactivated. Staff can choose it at the POS.`;
export const stateUnknown = (name: string): string =>
  `${name}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.`;
export const stateUnknownUnread = (name: string): string =>
  `${name}: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.`;
export const stateFailed = (name: string): string =>
  `Something went wrong. ${name} was not changed. Use its row action to try again.`;
export const stateSessionRefused = (name: string): string =>
  `${name} was not changed. Use its row action to try again.`;
export const WAITING = 'Waiting for an earlier save to finish. Nothing will be sent again.';
