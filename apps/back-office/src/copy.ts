// The sentences of PHASE0-011d1, placed row by row from DESIGN-015's copy table
// (docs/design/SCREEN-INVENTORY.md, BO-01, and the shared general failures). No
// code, no server text and no number the server did not send becomes copy.

/** `{wait}`: "{m} min {s} s", "{m} min" at exact minutes, "{s} s" below a minute. */
export function waitText(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

export type NoticeCopy = { title: string; body: string };

export const UNAVAILABLE: NoticeCopy = {
  title: 'The system is unavailable',
  body: 'Wait a moment, then try again.',
};

export const WENT_WRONG: NoticeCopy = {
  title: 'Something went wrong',
  body: 'Try again. If the problem continues, ask a manager for help.',
};

export const SIGN_IN_FAILED: NoticeCopy = {
  title: 'Sign-in failed',
  body: 'Check your username and password, then try again.',
};

export const SESSION_ENDED: NoticeCopy = {
  title: 'Your session has ended',
  body: 'Sign in again to continue.',
};

export const ACCESS_REFUSED: NoticeCopy = {
  title: 'Manager access required',
  body: 'This account cannot use the back office. Sign in with a manager account.',
};

export const lockedFor = (seconds: number): NoticeCopy => ({
  title: `This username is locked for ${waitText(seconds)}`,
  body: 'This username is cooling down. Other managers can sign in with their own usernames.',
});

// M-6 (PHASE0-011d2), DESIGN-015's rows whose Screen column names M-6.
export const REAUTH_TITLE = 'Your session timed out';
export const reauthBody = (username: string): string =>
  `Your unsaved changes are kept. Continue as ${username} to resume them.`;

export const CHOOSE_OTHER_TITLE = 'Sign in as a different manager?';
export const CHOOSE_OTHER_BODY =
  'The current manager’s unsaved changes will not be available to the manager signing in.';

export const OTHER_TITLE = 'Sign in as a different manager';
export const OTHER_BODY =
  'Enter your own username and password. The current manager’s unsaved changes will not be available to you.';

export const INCORRECT_PASSWORD = 'Incorrect password. Try again.';
export const sameManagerLocked = (seconds: number): string =>
  `This username is cooling down. Try again in ${waitText(seconds)}. You can sign in as a different manager or log out.`;

export const DISCARD_TITLE = 'Log out and discard your changes?';
export const DISCARD_BODY =
  'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.';
export const logoutDuringCooldown = (seconds: number): string =>
  `This username is locked for ${waitText(seconds)}. Logging out does not end its cooldown. Other managers can sign in with their own usernames. Waiting here keeps your draft.`;

export const RESUMED: NoticeCopy = {
  title: 'Your session has resumed.',
  body: 'Your changes are still here. Nothing has been submitted.',
};

export const LOGOUT_UNCONFIRMED = 'Sign-out has not been confirmed.';
export const MISSING_USERNAME = 'Enter your username.';
export const MISSING_PASSWORD = 'Enter your password.';

// BO-05 Tables (PHASE1-S1b). Every sentence is a row of DESIGN-017's copy table
// (.agent/tasks/DESIGN-017-tables.md, "Exact product copy and accessible names for S1b").
// Braces in the table are the values here; a zod message, a server text, an error code or
// a submitted value never becomes visible text. The M-6 and logout rows above stay the
// one source for those sentences.

export const CONFIGURATION = 'Configuration';
export const TABLES = 'Tables';
export const NEW_TABLE = 'New table';
export const counts = (active: number, inactive: number): string => `${active} active · ${inactive} inactive`;
export const LIST_CAPTION = 'Active tables first · Labels in order';
export const EMPTY_TITLE = 'No tables yet';
export const EMPTY_BODY = 'Create your first table to set up the floor.';
export const LOADING = 'Loading tables…';
export const READ_FAILED: NoticeCopy = {
  title: 'Tables could not be loaded',
  body: 'Try again to read the table list.',
};
/**
 * BO-05's F4 state only: a success while the list read stands failed. "Tables could not be
 * loaded" is untrue above a list that is drawn (owner, DESIGN-018 question 4). A plain failed
 * read keeps READ_FAILED.
 */
export const LIST_PARTIAL: NoticeCopy = {
  title: 'The list may be out of date',
  body: 'Tables could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list.',
};

export const editTitle =(label: string): string => `Edit ${label}`;
export const CREATE_CONTEXT = 'Choose the label staff will see on the floor.';
export const RENAME_ACTIVE_CONTEXT = 'Active table. Changes keep this table’s history.';
export const RENAME_INACTIVE_CONTEXT = 'Inactive table. Saving its label does not reactivate it.';
export const LABEL_NAME = 'Table label';
export const LABEL_HELP = '1–32 characters. Active tables must have different labels.';
export const LABEL_EMPTY = 'Enter a table label.';
export const LABEL_LONG = 'Use 32 characters or fewer.';
export const LABEL_CONTROL = 'Remove control characters from the label.';
export const LABEL_DUPLICATE = 'An active table already uses this label. Choose another label.';
export const LABEL_DUPLICATE_REACTIVATE =
  'An active table already uses this label. Rename this inactive table, save, then reactivate it.';
export const LABEL_IN_USE = 'Label in use';

export const SAVING: NoticeCopy = { title: 'Saving…', body: 'Wait for the result. Your draft is kept.' };
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

export const saved = (label: string): string => `${label} saved.`;
export const deactivated = (label: string): string => `${label} deactivated. It is kept for history.`;
export const reactivated = (label: string): string => `${label} reactivated.`;
export const deactivating = (label: string): string => `Deactivating ${label}…`;
export const reactivating = (label: string): string => `Reactivating ${label}…`;
export const statusUnknown = (label: string): string =>
  `${label}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.`;
export const statusUnknownUnread = (label: string): string =>
  `${label}: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.`;
export const statusFailed = (label: string): string =>
  `Something went wrong. ${label} was not changed. Use its row action to try again.`;
export const statusSessionRefused = (label: string): string =>
  `${label} was not changed. Use its row action to try again.`;
export const WAITING = 'Waiting for an earlier save to finish. Nothing will be sent again.';

export const DEPARTURE_TITLE = 'Discard unsaved changes?';
export const DEPARTURE_BODY = 'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
export const DEPARTURE_BODY_UNCERTAIN =
  'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.';
/** The separate paragraph of the logout decisions while a save is pending or its outcome unknown. */
export const LOGOUT_UNCERTAIN = 'The save may or may not have succeeded. Leaving does not send it again.';
