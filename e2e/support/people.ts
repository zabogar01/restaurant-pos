import { randomBytes, randomInt } from 'node:crypto';
import { createBackOfficeCredential } from '../../apps/server/src/domain/back-office-credential.js';
import { createStaffUser, findUserByPin } from '../../apps/server/src/domain/pin.js';
import type { StaffRole } from '../../apps/server/src/domain/pin.js';
import type { Person } from '../../apps/server/test/support/people.js';

// Playwright writes error-context.md (the error messages and a page snapshot) for
// every failing test, whatever the trace, video and screenshot settings say, and
// there is no switch to turn it off. So the protection is at the source: the
// harness's people have a display name, a PIN, a username and a password that are
// independent of each other and of anything in the code, so that no diagnostic
// that names one can spell another. `makePeople` derives all four from one number
// and stays as it is for the server tests.

function letters(length: number, alphabet: string): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(alphabet.length)];
  return out;
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz';

function randomName(): string {
  return letters(1, LOWER.toUpperCase()) + letters(7, LOWER);
}

function randomPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function makeHarnessPeople() {
  async function make(role: StaffRole, withLogin: boolean): Promise<Person> {
    const name = randomName();
    // A PIN taken by an active user is refused by the domain function; draw again.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const pin = randomPin();
      let id: string;
      try {
        ({ id } = await createStaffUser({ name, role, pin }));
      } catch (err) {
        if (err instanceof Error && err.message === 'PIN already in use') continue;
        throw new Error('the harness could not create a person');
      }
      const found = await findUserByPin(pin);
      if (!found) throw new Error('the harness could not find the person it created');
      const person: Person = { id, pin, name, credentialVersion: found.credentialVersion };
      if (withLogin) {
        person.username = letters(12, LOWER);
        person.password = randomBytes(18).toString('base64url');
        await createBackOfficeCredential({
          staffUserId: id,
          username: person.username,
          password: person.password,
        });
      }
      return person;
    }
    throw new Error('the harness could not draw an unused PIN');
  }
  return {
    cashier: () => make('CASHIER', false),
    manager: () => make('MANAGER', true),
  };
}
