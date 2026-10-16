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
