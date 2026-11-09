import { CurrentPassword, NewPassword, NewPin, NewUsername, StaffName } from '@pos/contracts';
import { describe, expect, it } from 'vitest';
import {
  checkCurrentPassword, checkName, checkPassword, checkPin, checkUsername, storedUsername,
} from '../src/staff/fields.js';

// BO-06's four field checks (PHASE1-S8c1 ruling 4), each held against the contract schema S8a
// exported over the boundary values: the form's check and the server's schema must agree on
// every value, so that a value the form sends is never refused for its shape. Lengths are in
// code points.

const emoji = (n: number) => '😀'.repeat(n);
const astral = (n: number) => '𝒜'.repeat(n);

describe('the name check', () => {
  const sentences = (typed: string) => checkName(typed).error;

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['a'.repeat(65), 'long'],
    ['a'.repeat(64), null],
    [emoji(65), 'long'],
    ['Name\u0007', 'control'],
    ['Na\tme', 'control'],
    ['Na\u001bme', 'control'],
    ['Na\u009bme', 'control'],
    ['Ana R.', null],
    ['  Ana R.  ', null],
    ['Ana  R.', null],
    ['a', null],
  ] as const)('%j is refused as %j', (typed, error) => {
    expect(sentences(typed)).toBe(error);
  });

  it('trims what it sends and keeps an inner space', () => {
    expect(checkName('  Ana R.  ').name).toBe('Ana R.');
    expect(checkName('Ana  R.').name).toBe('Ana  R.');
  });

  it('counts code points: 64 emoji are 64 characters, and 65 are one too many', () => {
    expect(checkName(emoji(64)).error).toBeNull();
    expect(checkName(emoji(65)).error).toBe('long');
    expect(checkName(astral(64)).error).toBeNull();
  });

  // The pair test. The form's check and StaffName agree on every boundary value, the astral
  // ones included: the schema counts characters as the form does, not UTF-16 units.
  it.each([
    '',
    '   ',
    'a',
    'a'.repeat(64),
    'a'.repeat(65),
    '  Ana R.  ',
    'Ana  R.',
    'Name\u0007',
    'Na\tme',
    'Na\u001bme',
    'Na\u009bme',
    emoji(32),
    emoji(33),
    emoji(64),
    emoji(65),
    astral(33),
    astral(64),
    astral(65),
  ])('agrees with the contract schema on %j', (typed) => {
    const checked = checkName(typed);
    expect(checked.error === null).toBe(StaffName.safeParse(checked.name).success);
  });
});

describe('the PIN check', () => {
  it.each([
    ['012345', null],
    ['123456', null],
    ['12345', 'invalid'],
    ['1234567', 'invalid'],
    ['12 345', 'invalid'],
    ['１２３４５６', 'invalid'],
    ['+12345', 'invalid'],
    ['', 'invalid'],
    [' 123456', 'invalid'],
    ['12345a', 'invalid'],
  ] as const)('%j is %j', (typed, error) => {
    expect(checkPin(typed)).toBe(error);
  });

  it.each(['012345', '12345', '1234567', '12 345', '１２３４５６', '+12345', '', ' 123456'])(
    'agrees with the contract schema on %j',
    (typed) => {
      expect(checkPin(typed) === null).toBe(NewPin.safeParse(typed).success);
    }
  );
});

describe('the username check', () => {
  it.each([
    ['Ab', 'invalid'],
    ['abc', null],
    ['a'.repeat(32), null],
    ['a'.repeat(33), 'invalid'],
    ['.abc', 'invalid'],
    ['ABC.def', null],
    ['  Ana.R  ', null],
    ['ana r', 'invalid'],
    ['anä', 'invalid'],
    ['', 'invalid'],
    ['_abc', 'invalid'],
  ] as const)('%j is %j', (typed, error) => {
    expect(checkUsername(typed).error).toBe(error);
  });

  it('shows and sends the stored form: trimmed, with ASCII letters lower-cased', () => {
    expect(storedUsername('  Ana.R  ')).toBe('ana.r');
    expect(checkUsername('ABC.def').username).toBe('abc.def');
    // Only ASCII letters change case.
    expect(storedUsername('ÄBC')).toBe('Äbc');
  });

  it.each(['Ab', 'abc', 'a'.repeat(32), 'a'.repeat(33), '.abc', 'ABC.def', '  Ana.R  ', 'ana r', 'anä'])(
    'agrees with the contract schema on %j once stored',
    (typed) => {
      const checked = checkUsername(typed);
      expect(checked.error === null).toBe(NewUsername.safeParse(checked.username).success);
    }
  );
});

describe('the password check', () => {
  it.each([
    ['1234567', 'invalid'],
    ['12345678', null],
    ['x'.repeat(128), null],
    ['x'.repeat(129), 'invalid'],
    [astral(8), null],
    [astral(128), null],
    [astral(129), 'invalid'],
    [astral(7), 'invalid'],
    ['  spaced  ', null],
    ['        ', null],
  ] as const)('%j is %j', (typed, error) => {
    expect(checkPassword(typed)).toBe(error);
  });

  it('never trims: a password of eight spaces is eight characters', () => {
    expect(checkPassword('        ')).toBeNull();
    expect(checkPassword('       ')).toBe('invalid');
  });

  it.each(['1234567', '12345678', 'x'.repeat(128), 'x'.repeat(129), astral(8), astral(128), astral(129), '  spaced  '])(
    'agrees with the contract schema on %j',
    (typed) => {
      expect(checkPassword(typed) === null).toBe(NewPassword.safeParse(typed).success);
    }
  );
});

// PHASE1-S8c2 ruling 4: the current password is judged by verification, so the form refuses only
// what the contract would refuse as malformed: nothing, and more than 1024 code points. It is
// never trimmed, so leading and trailing spaces count and are kept.
describe('the current password check', () => {
  const cases: [string, string, 'empty' | 'long' | null][] = [
    ['nothing', '', 'empty'],
    ['one character', 'x', null],
    ['1024 characters', 'x'.repeat(1024), null],
    ['1025 characters', 'x'.repeat(1025), 'long'],
    ['1024 astral letters', astral(1024), null],
    ['1025 astral letters', astral(1025), 'long'],
    ['1024 emoji', emoji(1024), null],
    ['1025 emoji', emoji(1025), 'long'],
    ['one space', ' ', null],
    ['spaces kept at both ends', '  leading and trailing  ', null],
  ];

  it.each(cases)('%s', (_label, typed, error) => {
    expect(checkCurrentPassword(typed)).toBe(error);
  });

  it('never trims: one space is a current password', () => {
    expect(checkCurrentPassword(' ')).toBeNull();
    expect(checkCurrentPassword('  leading')).toBeNull();
  });

  it.each(cases)('agrees with the contract schema on %s', (_label, typed) => {
    expect(checkCurrentPassword(typed) === null).toBe(CurrentPassword.safeParse(typed).success);
  });
});
