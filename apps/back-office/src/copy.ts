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

export const LOGOUT_UNCONFIRMED = 'Sign-out has not been confirmed.';
export const MISSING_USERNAME = 'Enter your username.';
export const MISSING_PASSWORD = 'Enter your password.';
