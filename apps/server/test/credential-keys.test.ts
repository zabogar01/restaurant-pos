import { describe, expect, it } from 'vitest';
import * as contracts from '@pos/contracts';
import { SECRET_KEYS } from '../src/http/log.js';

// ADR-010 rule 2 and consult C3 section 8. The log redaction is a backstop over listed key
// names only: a field called `newPassword`, or a `pin` two levels down, passes straight
// through it. This walks every request schema in @pos/contracts and holds each
// credential-shaped key to the list, at the top level of its request.
//
// It lives beside the list it checks, in the server's tests: the contracts package cannot
// import the server.

const CREDENTIAL_SHAPED = /pin|password|username/i;

interface Found {
  key: string;
  depth: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The definition of a zod 4 schema, or null for anything else. */
const defOf = (schema: unknown): Record<string, unknown> | null => {
  if (!isRecord(schema)) return null;
  const internals = schema._zod;
  if (!isRecord(internals) || !isRecord(internals.def)) return null;
  return internals.def;
};

/** Every object key at any depth, with how deep it sits (0 is the top level of the request). */
function keysOf(schema: unknown, depth = 0, out: Found[] = []): Found[] {
  const def = defOf(schema);
  if (def === null) return out;
  if (def.type === 'object' && isRecord(def.shape)) {
    for (const [key, field] of Object.entries(def.shape)) {
      out.push({ key, depth });
      keysOf(field, depth + 1, out);
    }
  }
  // A union's options sit at the same depth as the union.
  if (Array.isArray(def.options)) for (const option of def.options) keysOf(option, depth, out);
  // An array's elements are one level down.
  if (def.element !== undefined) keysOf(def.element, depth + 1, out);
  // An optional, a nullable, a default or a pipe wraps a schema at the same depth.
  for (const inner of [def.innerType, def.in, def.out]) if (inner !== undefined) keysOf(inner, depth, out);
  return out;
}

const requests = Object.entries(contracts).filter(
  ([name, value]) => name.endsWith('Request') && defOf(value) !== null
);

describe('the credential-shaped keys of every request schema', () => {
  it('finds the request schemas it is meant to walk', () => {
    const names = requests.map(([name]) => name);
    for (const expected of [
      'PosLoginRequest',
      'BackOfficeLoginRequest',
      'ReauthenticateRequest',
      'CreateUserRequest',
      'CreateManagerUserRequest',
      'ChangeRoleRequest',
      'KitchenToManagerRequest',
      'ReactivateUserRequest',
    ]) {
      expect(names).toContain(expected);
    }
    // The walk really reaches into a union and an object, and sees a nested key as nested.
    const created = keysOf(contracts.CreateUserRequest).map((f) => f.key);
    expect(created).toEqual(expect.arrayContaining(['classification', 'name', 'pin', 'username', 'password']));
    const nested = keysOf(contracts.UserResponse);
    expect(nested.find((f) => f.key === 'username')?.depth).toBe(1);
  });

  it('13. is in the redaction backstop list, at the top level of its request', () => {
    const offences: string[] = [];
    for (const [name, schema] of requests) {
      for (const { key, depth } of keysOf(schema)) {
        if (!CREDENTIAL_SHAPED.test(key)) continue;
        if (!SECRET_KEYS.includes(key)) offences.push(`${name}.${key} is not in SECRET_KEYS`);
        if (depth !== 0) offences.push(`${name}.${key} is nested`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('the backstop list names every credential key the requests carry', () => {
    for (const key of ['pin', 'password', 'managerPin', 'currentPassword', 'username']) {
      expect(SECRET_KEYS, key).toContain(key);
    }
  });
});
