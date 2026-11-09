// BO-06 Staff (PHASE1-S8c1). Every sentence is a row of DESIGN-023's copy, warning or modal
// tables (.agent/tasks/DESIGN-023-users.md, "Exact copy and accessible names"), or a shared
// sentence of `../copy.ts` where DESIGN-023 reuses its words (departure, logout, M-6, BO-01).
// Braces in the table are the values here: names, classifications and usernames the read or an
// answer returned. A zod message, a server text, an error code or a submitted value never becomes
// visible text, and a credential is never interpolated.
//
// Left out on purpose (ruling 19): everything of S8c2 (the role change, the resets of another
// person, the own password and PIN, and their states), the kitchen-emergency sentences, BO-01's
// held-draft sentence, and the review artifact's response chooser and cross-client links.

export type NoticeCopy = { title: string; body: string };
export type Classification = 'KITCHEN' | 'CASHIER' | 'MANAGER';

export const STAFF = 'Staff';
export const ADD_PERSON = 'Add person';
export const INTRO = 'Cashiers and managers sign in. Kitchen staff have no PIN and do not sign in.';
export const counts = (active: number, inactive: number): string => `${active} active · ${inactive} inactive`;
export const LIST_LABEL = 'Staff list';
export const LIST_CAPTION = 'Active first · Oldest created first within each status';
export const COLUMN_PERSON = 'Person';
export const COLUMN_CLASSIFICATION = 'Classification';
export const COLUMN_STATUS = 'Status';
export const COLUMN_ACTIONS = 'Actions';
export const OWN_MARKER = 'You · Signed in';
export const NO_SIGN_IN = 'No sign-in';
export const username = (value: string): string => `Username: ${value}`;
export const retainedUsername = (value: string): string => `Retained username: ${value} · No back-office access`;
export const STATUS_ACTIVE = 'Active';
export const STATUS_INACTIVE = 'Inactive';

export const classificationText = (classification: Classification): string =>
  classification === 'KITCHEN' ? 'Kitchen' : classification === 'CASHIER' ? 'Cashier' : 'Manager';

export const DEACTIVATE = 'Deactivate';
export const REACTIVATE = 'Reactivate';
export const deactivateName = (name: string): string => `Deactivate — ${name}`;
export const reactivateName = (name: string): string => `Reactivate — ${name}`;

// The page's states.
export const LOADING = 'Loading staff…';
export const READ_FAILED: NoticeCopy = {
  title: 'Staff could not be loaded',
  body: 'Try again to read the staff list.',
};
export const LIST_PARTIAL: NoticeCopy = {
  title: 'The staff list may be out of date',
  body: 'The rows below are the ones this page knows, including your latest change. Try again to read the full list.',
};
export const TRY_AGAIN = 'Try again';

// The forms.
export const CREATE_HEADING = ADD_PERSON;
export const reactivateHeading = (name: string): string => `Reactivate — ${name}`;
export const CREATE_CONTEXT = 'Create a named person. Choose the classification before entering credentials.';
export const reactivateContext = (name: string): string => `Set a new PIN to reactivate ${name}.`;
export const NAME_LABEL = 'Name';
export const NAME_HELP = '1–64 characters. Check the spelling: a name cannot be changed after saving.';
export const CLASSIFICATION_LABEL = 'Classification';
export const CLASSIFICATION_HELP = 'Kitchen needs a name only. Cashiers need a PIN. Managers also need a back-office login.';
export const classificationChoice = (classification: Classification): string =>
  classification === 'KITCHEN' ? 'Kitchen · no sign-in' : classificationText(classification);
export const PIN_LABEL = 'New PIN';
export const PIN_HELP = 'Exactly six digits, 0–9. PINs must differ among active staff.';
export const USERNAME_LABEL = 'Username';
export const USERNAME_HELP =
  '3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit. It can never be changed or reused.';
export const PASSWORD_LABEL = 'New password';
export const PASSWORD_HELP = '8–128 characters. Spaces count and are kept exactly as typed.';
export const CREDENTIALS_CLEARED = 'Enter the credentials again. The name and classification choices are kept.';
export const FOOT_HINT = 'Nothing is sent until you save.';
export const FOOT_HINT_PENDING = 'Wait for the save result.';
export const FOOT_HINT_BLOCKED = 'Return to the staff list and choose an action on the current person.';
export const CANCEL = 'Cancel';
export const SAVE = 'Save';
export const SAVE_REACTIVATE = 'Reactivate with new PIN';
export const RETURN_TO_LIST = 'Return to staff list';

// Refusals of the form's own check.
export const NAME_EMPTY = 'Enter a name.';
export const NAME_LONG = 'Use 64 characters or fewer.';
export const NAME_CONTROL = 'Remove control characters from the name.';
export const PIN_INVALID = 'Enter exactly six digits, 0–9.';
export const USERNAME_INVALID =
  'Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit.';
export const PASSWORD_INVALID = 'Use 8–128 characters. Spaces count.';

// Refusals of the server, placed by `details.field`. The PIN refusal names no one.
export const PIN_DUPLICATE = 'That PIN is already in use. Choose a different PIN.';
export const PIN_DUPLICATE_REACTIVATE = 'That PIN is already in use. Enter a new PIN to reactivate this person.';
export const USERNAME_DUPLICATE = 'That username is already in use. Choose another username.';

// What a save did.
export const SAVING: NoticeCopy = { title: 'Saving…', body: 'Wait for the result. Your draft is kept.' };
export const added = (name: string): string => `${name} added.`;
export const deactivated = (name: string): string => `${name} deactivated.`;
export const reactivated = (name: string): string => `${name} reactivated.`;
export const deactivating = (name: string): string => `Deactivating ${name}…`;
export const reactivating = (name: string): string => `Reactivating ${name}…`;
export const FORM_FAILED: NoticeCopy = {
  title: 'Something went wrong',
  body: 'Nothing was saved. Your draft is kept. Enter credentials again, then press Save to try again.',
};
export const FORM_SESSION_REFUSED: NoticeCopy = {
  title: 'Nothing was saved',
  body: 'Enter credentials again, then press Save.',
};
export const statusFailed = (name: string): string =>
  `Something went wrong. ${name} was not changed. Use its row action to try again.`;
export const statusSessionRefused = (name: string): string =>
  `${name} was not changed. Use its row action to try again.`;
export const WAITING = 'Waiting for an earlier save to finish. Nothing will be sent again.';

// The form-level refusals of the reactivation-PIN form.
export const OWN_ACCOUNT: NoticeCopy = {
  title: 'This action cannot change your own account',
  body: 'Use Change my password or Change my PIN on your own row. You cannot deactivate yourself or change your own role.',
};
export const userChanged = (name: string, read: boolean): NoticeCopy => ({
  title: `${name} changed while you were editing`,
  body: read
    ? 'Nothing was saved. The staff list has been refreshed. Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person.'
    : 'Nothing was saved. The staff list could not be refreshed. Try again reads the list only. Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person.',
});
export const notFound = (name: string, read: boolean): NoticeCopy => ({
  title: `${name} could not be found`,
  body: read
    ? 'Nothing was saved. The staff list has been refreshed. Return to the staff list to choose another person.'
    : 'Nothing was saved. The staff list could not be refreshed. Return to the staff list to choose another person.',
});

// Unknown outcomes.
export const OUTCOME_UNKNOWN_TITLE = 'Outcome not confirmed';
export const unknownBody = (name: string, read: boolean): string =>
  read
    ? `${name}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.`
    : `${name}: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.`;
export const UNKNOWN_FORM_CONTINUATION = 'Your draft is kept; enter credentials again.';
export const outcomeUnknown = (name: string, read: boolean): NoticeCopy => ({
  title: OUTCOME_UNKNOWN_TITLE,
  body: `${unknownBody(name, read)} ${UNKNOWN_FORM_CONTINUATION}`,
});

// The deactivation confirmation. Its warning follows the person's current classification: a
// cashier has POS sessions only (a former manager's retained login never verifies), a manager
// has both, and a kitchen person has no PIN and no sessions.
export const deactivateTitle = (name: string): string => `Deactivate ${name}?`;
export const deactivateWarning = (name: string, classification: Classification): string => {
  if (classification === 'KITCHEN') {
    return `${name} will be inactive. Kitchen staff have no PIN or sign-in sessions. You can reactivate this person later.`;
  }
  const surfaces = classification === 'MANAGER' ? 'POS and back-office sessions' : 'POS sessions';
  return `${name}’s ${surfaces} will end on their next action. They cannot sign in while inactive. You can reactivate this person later.`;
};
export const KEEP_ACTIVE = 'Keep active';
export const keepActiveName = (name: string): string => `Keep active — ${name}`;
export const confirmDeactivateName = (name: string): string => `Deactivate ${name}`;
