import { describe, expect, it } from 'vitest';
import { ErrorBody, ErrorCode } from '../src/errors.js';
import {
  CashierToKitchenRequest,
  CashierToManagerRequest,
  ChangeRoleRequest,
  CreateCashierUserRequest,
  CreateKitchenUserRequest,
  CreateManagerUserRequest,
  CreateUserRequest,
  CurrentPassword,
  DeactivateUserRequest,
  KitchenToCashierRequest,
  KitchenToManagerRequest,
  ManagerToCashierRequest,
  ManagerToKitchenRequest,
  NewPassword,
  NewPin,
  NewUsername,
  OwnPasswordRequest,
  OwnPinRequest,
  ReactivateUserRequest,
  SetPasswordRequest,
  SetPinRequest,
  StaffName,
  UserResponse,
  UserView,
  UsersResponse,
} from '../src/users.js';

const ID = '0b1f3a52-6d0e-4c53-9d5b-2f0f7f6b9a11';

describe('the staff name rule', () => {
  it('accepts 1 to 64 characters with no edge whitespace and no control character', () => {
    for (const name of ['Dewi', 'a', 'x'.repeat(64), 'Siti  Nur', 'Dewi É']) {
      expect(StaffName.safeParse(name).success, name).toBe(true);
    }
  });

  it('refuses an empty, over-long, untrimmed or control-character name, a C1 control included', () => {
    for (const name of ['', 'x'.repeat(65), ' Dewi', 'Dewi ', '\tDewi', 'Dewi\n', 'De\u0007wi', 'De\u009bwi', 'De\u007fwi']) {
      expect(StaffName.safeParse(name).success, JSON.stringify(name)).toBe(false);
    }
    expect(StaffName.safeParse(7).success).toBe(false);
  });
});

describe('the credential field rules', () => {
  it('a PIN is exactly six ASCII digits, as a string', () => {
    expect(NewPin.safeParse('012345').success).toBe(true);
    for (const pin of ['12345', '1234567', '12345a', '١٢٣٤٥٦', 123456, null]) {
      expect(NewPin.safeParse(pin).success, String(pin)).toBe(false);
    }
  });

  it('a username is exactly ADR-009\'s stored form: no upper case, no padding', () => {
    for (const username of ['abc', 'a.b-c_d', '0abc', 'x'.repeat(32)]) {
      expect(NewUsername.safeParse(username).success, username).toBe(true);
    }
    for (const username of ['ab', 'Abc', ' abc', 'abc ', '.abc', 'x'.repeat(33), 'ab c', 'ǻbc']) {
      expect(NewUsername.safeParse(username).success, username).toBe(false);
    }
  });

  it('a password is 8 to 128 code points and is never trimmed', () => {
    expect(NewPassword.safeParse('12345678').success).toBe(true);
    expect(NewPassword.safeParse(' '.repeat(8)).success).toBe(true);
    expect(NewPassword.safeParse('x'.repeat(128)).success).toBe(true);
    expect(NewPassword.safeParse('\u{1F600}'.repeat(128)).success).toBe(true);
    expect(NewPassword.safeParse('1234567').success).toBe(false);
    expect(NewPassword.safeParse('x'.repeat(129)).success).toBe(false);
    expect(NewPassword.safeParse('\u{1F600}'.repeat(129)).success).toBe(false);
    expect(NewPassword.safeParse(12345678).success).toBe(false);
  });
});

describe('create', () => {
  const manager = { classification: 'MANAGER', name: 'Sari', pin: '123456', username: 'sari.m', password: 'long enough' };

  it('is a union on classification whose variants carry exactly their fields', () => {
    expect(CreateUserRequest.safeParse({ classification: 'KITCHEN', name: 'Cook' }).success).toBe(true);
    expect(CreateUserRequest.safeParse({ classification: 'CASHIER', name: 'Rina', pin: '123456' }).success).toBe(true);
    expect(CreateUserRequest.safeParse(manager).success).toBe(true);
    expect(CreateKitchenUserRequest.safeParse({ classification: 'KITCHEN', name: 'Cook' }).success).toBe(true);
    expect(CreateCashierUserRequest.safeParse({ classification: 'CASHIER', name: 'Rina', pin: '123456' }).success).toBe(true);
    expect(CreateManagerUserRequest.safeParse(manager).success).toBe(true);
  });

  it('refuses an extra key, a missing field and an unknown classification', () => {
    for (const body of [
      { classification: 'KITCHEN', name: 'Cook', pin: '123456' },
      { classification: 'CASHIER', name: 'Rina' },
      { classification: 'MANAGER', name: 'Sari', pin: '123456', username: 'sari.m' },
      { ...manager, extra: 1 },
      { ...manager, classification: 'ADMIN' },
    ]) {
      expect(CreateUserRequest.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});

describe('change-role', () => {
  const cases: [string, unknown, boolean][] = [
    ['KITCHEN_TO_CASHIER', { change: 'KITCHEN_TO_CASHIER', staffUserId: ID, pin: '123456' }, true],
    ['KITCHEN_TO_CASHIER without a PIN', { change: 'KITCHEN_TO_CASHIER', staffUserId: ID }, false],
    ['KITCHEN_TO_MANAGER', { change: 'KITCHEN_TO_MANAGER', staffUserId: ID, pin: '123456', password: 'long enough' }, true],
    ['KITCHEN_TO_MANAGER with a username', { change: 'KITCHEN_TO_MANAGER', staffUserId: ID, pin: '123456', password: 'long enough', username: 'cook.m' }, true],
    ['KITCHEN_TO_MANAGER without a password', { change: 'KITCHEN_TO_MANAGER', staffUserId: ID, pin: '123456' }, false],
    ['CASHIER_TO_MANAGER', { change: 'CASHIER_TO_MANAGER', staffUserId: ID, password: 'long enough' }, true],
    ['CASHIER_TO_MANAGER with a PIN', { change: 'CASHIER_TO_MANAGER', staffUserId: ID, password: 'long enough', pin: '123456' }, false],
    ['MANAGER_TO_CASHIER', { change: 'MANAGER_TO_CASHIER', staffUserId: ID }, true],
    ['MANAGER_TO_CASHIER with a PIN', { change: 'MANAGER_TO_CASHIER', staffUserId: ID, pin: '123456' }, false],
    ['CASHIER_TO_KITCHEN', { change: 'CASHIER_TO_KITCHEN', staffUserId: ID }, true],
    ['MANAGER_TO_KITCHEN', { change: 'MANAGER_TO_KITCHEN', staffUserId: ID }, true],
    ['an unknown move', { change: 'KITCHEN_TO_KITCHEN', staffUserId: ID }, false],
    ['a name that is not an id', { change: 'MANAGER_TO_KITCHEN', staffUserId: 'Dewi' }, false],
  ];

  it.each(cases)('%s', (_label, body, ok) => {
    expect(ChangeRoleRequest.safeParse(body).success).toBe(ok);
  });

  it('exports each variant, so a form can read its own field list', () => {
    for (const variant of [
      KitchenToCashierRequest,
      KitchenToManagerRequest,
      CashierToManagerRequest,
      ManagerToCashierRequest,
      CashierToKitchenRequest,
      ManagerToKitchenRequest,
    ]) {
      expect(Object.keys(variant.shape)).toContain('staffUserId');
    }
    expect(Object.keys(KitchenToManagerRequest.shape).sort()).toEqual(['change', 'password', 'pin', 'staffUserId', 'username']);
  });
});

describe('deactivate and reactivate', () => {
  it('take an id; reactivate may carry a new PIN', () => {
    expect(DeactivateUserRequest.safeParse({ staffUserId: ID }).success).toBe(true);
    expect(DeactivateUserRequest.safeParse({ staffUserId: ID, pin: '123456' }).success).toBe(false);
    expect(ReactivateUserRequest.safeParse({ staffUserId: ID }).success).toBe(true);
    expect(ReactivateUserRequest.safeParse({ staffUserId: ID, pin: '123456' }).success).toBe(true);
    expect(ReactivateUserRequest.safeParse({ staffUserId: ID, pin: '12345' }).success).toBe(false);
  });
});

describe('the credential requests (S8b)', () => {
  const PASSWORD = 'a long enough one';

  it('a PIN reset and a password reset take an id and the new secret, strictly', () => {
    expect(SetPinRequest.safeParse({ staffUserId: ID, pin: '123456' }).success).toBe(true);
    expect(SetPinRequest.safeParse({ staffUserId: ID, pin: '12345' }).success).toBe(false);
    expect(SetPinRequest.safeParse({ staffUserId: ID, pin: '123456', currentPassword: PASSWORD }).success).toBe(false);
    expect(SetPasswordRequest.safeParse({ staffUserId: ID, password: PASSWORD }).success).toBe(true);
    expect(SetPasswordRequest.safeParse({ staffUserId: ID, password: 'short' }).success).toBe(false);
    expect(SetPasswordRequest.safeParse({ staffUserId: ID, password: PASSWORD, currentPassword: PASSWORD }).success).toBe(false);
    expect(SetPasswordRequest.safeParse({ password: PASSWORD }).success).toBe(false);
  });

  it('an own change takes the current password and the new secret and names no account', () => {
    expect(OwnPasswordRequest.safeParse({ currentPassword: 'x', password: PASSWORD }).success).toBe(true);
    expect(OwnPinRequest.safeParse({ currentPassword: 'x', pin: '123456' }).success).toBe(true);
    for (const extra of [{ username: 'someone.else' }, { staffUserId: ID }, { newPassword: PASSWORD }]) {
      expect(OwnPasswordRequest.safeParse({ currentPassword: 'x', password: PASSWORD, ...extra }).success).toBe(false);
      expect(OwnPinRequest.safeParse({ currentPassword: 'x', pin: '123456', ...extra }).success).toBe(false);
    }
    expect(OwnPasswordRequest.safeParse({ password: PASSWORD }).success).toBe(false);
    expect(OwnPinRequest.safeParse({ pin: '123456' }).success).toBe(false);
  });

  it('a malformed new secret is refused by the schema; a malformed current password only by size', () => {
    expect(OwnPasswordRequest.safeParse({ currentPassword: 'x', password: 'short' }).success).toBe(false);
    expect(OwnPinRequest.safeParse({ currentPassword: 'x', pin: 123456 }).success).toBe(false);
    // The current password is judged by the verification (and counted), so any string of a
    // sane size passes, as at M-6.
    expect(CurrentPassword.safeParse('x').success).toBe(true);
    expect(CurrentPassword.safeParse(' short ').success).toBe(true);
    expect(CurrentPassword.safeParse('x'.repeat(1024)).success).toBe(true);
    expect(CurrentPassword.safeParse('').success).toBe(false);
    expect(CurrentPassword.safeParse('x'.repeat(1025)).success).toBe(false);
    expect(CurrentPassword.safeParse(123).success).toBe(false);
  });
});

describe('the user view', () => {
  const view = { staffUserId: ID, name: 'Dewi', classification: 'KITCHEN', isActive: true, username: null };

  it('is the five fields and nothing else', () => {
    expect(UserView.safeParse(view).success).toBe(true);
    expect(UserView.safeParse({ ...view, username: 'dewi.m', classification: 'MANAGER' }).success).toBe(true);
    for (const extra of ['pinHash', 'pinLookup', 'credentialVersion', 'hasPin', 'consecutiveFailures']) {
      expect(UserView.safeParse({ ...view, [extra]: 1 }).success, extra).toBe(false);
    }
    expect(UserView.safeParse({ ...view, classification: 'ADMIN' }).success).toBe(false);
    expect(UserResponse.safeParse({ user: view }).success).toBe(true);
    expect(UsersResponse.safeParse({ users: [view, view] }).success).toBe(true);
    expect(UsersResponse.safeParse({ users: [], extra: 1 }).success).toBe(false);
  });
});

describe('the DUPLICATE envelope', () => {
  it('carries no details, or a field of the two literals, and nothing else', () => {
    expect(ErrorBody.safeParse({ error: { code: 'DUPLICATE' } }).success).toBe(true);
    expect(ErrorBody.safeParse({ error: { code: 'DUPLICATE', details: { field: 'pin' } } }).success).toBe(true);
    expect(ErrorBody.safeParse({ error: { code: 'DUPLICATE', details: { field: 'username' } } }).success).toBe(true);
    for (const details of [{ field: 'name' }, { field: 'pin', value: '123456' }, { retryAfterSeconds: 1 }, {}, 'pin']) {
      expect(ErrorBody.safeParse({ error: { code: 'DUPLICATE', details } }).success, JSON.stringify(details)).toBe(false);
    }
  });

  it('OWN_ACCOUNT and USER_CHANGED are codes with no details', () => {
    expect(ErrorCode.OWN_ACCOUNT).toBe('OWN_ACCOUNT');
    expect(ErrorCode.USER_CHANGED).toBe('USER_CHANGED');
    for (const code of ['OWN_ACCOUNT', 'USER_CHANGED']) {
      expect(ErrorBody.safeParse({ error: { code } }).success, code).toBe(true);
      expect(ErrorBody.safeParse({ error: { code, details: { field: 'pin' } } }).success, code).toBe(false);
    }
  });

  it('every code of the list has an envelope', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(ErrorBody.safeParse({ error: { code } }).success, code).toBe(true);
    }
  });
});
