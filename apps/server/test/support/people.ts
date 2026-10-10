import type { inject } from './request.js';
import { createBackOfficeCredential } from '../../src/domain/back-office-credential.js';
import { createStaffUser, findUserByPin } from '../../src/domain/pin.js';
import type { StaffRole } from '../../src/domain/pin.js';
import { ownerQuery } from './database.js';

// Users are made through the domain functions, never by inserting rows. Each test
// file takes its own PIN range so two files never collide on a PIN.
export interface Person {
  id: string;
  pin: string;
  name: string;
  credentialVersion: number;
  username?: string;
  password?: string;
}

export function makePeople(pinBase: number) {
  let counter = 0;
  async function make(role: StaffRole, withLogin: boolean): Promise<Person> {
    counter += 1;
    const pin = String(pinBase + counter);
    const name = `Person ${pinBase + counter}`;
    const { id } = await createStaffUser({ name, role, pin });
    const found = await findUserByPin(pin);
    if (!found) throw new Error('fixture user not found');
    const person: Person = { id, pin, name, credentialVersion: found.credentialVersion };
    if (withLogin) {
      person.username = `mgr-${pinBase + counter}`;
      person.password = `a long password ${pinBase + counter}`;
      await createBackOfficeCredential({
        staffUserId: id,
        username: person.username,
        password: person.password,
      });
    }
    return person;
  }
  return {
    cashier: () => make('CASHIER', false),
    manager: () => make('MANAGER', true),
  };
}

type Res = Awaited<ReturnType<typeof inject>>;

export function setCookiesNamed(res: Res, name: string): string[] {
  const header = res.headers['set-cookie'];
  const lines = Array.isArray(header) ? header : header === undefined ? [] : [String(header)];
  return lines.filter((line) => line.startsWith(`${name}=`));
}

export interface SessionRow {
  id: string;
  audience: string;
  staff_user_id: string;
  credential_version: number;
  client_instance_id: string | null;
  issued_at: string;
  absolute_expires_at: string | null;
  released_at: string | null;
}

export async function sessionRow(id: string): Promise<SessionRow> {
  const rows = await ownerQuery<SessionRow>(
    `SELECT id, audience, staff_user_id, credential_version, client_instance_id,
            issued_at::text, absolute_expires_at::text, released_at::text
       FROM actor_session WHERE id = $1`,
    [id]
  );
  return rows[0]!;
}

export async function sessionCount(): Promise<number> {
  return (await ownerQuery('SELECT 1 FROM actor_session')).length;
}

export async function wholeSessionTable(): Promise<string[]> {
  const rows = await ownerQuery<{ r: string }>(
    'SELECT to_jsonb(actor_session)::text AS r FROM actor_session ORDER BY id'
  );
  return rows.map((row) => row.r);
}

export async function sessionIdOfUser(staffUserId: string, audience: string): Promise<string[]> {
  const rows = await ownerQuery<{ id: string }>(
    `SELECT id FROM actor_session
      WHERE staff_user_id = $1 AND audience = $2 ORDER BY issued_at, id`,
    [staffUserId, audience]
  );
  return rows.map((row) => row.id);
}

export async function bucket(throttleClass: string): Promise<string> {
  const rows = await ownerQuery<{ r: string }>(
    'SELECT to_jsonb(pin_throttle_bucket)::text AS r FROM pin_throttle_bucket WHERE throttle_class = $1',
    [throttleClass]
  );
  return rows[0]!.r;
}

export async function credentialCount(staffUserId: string): Promise<string> {
  const rows = await ownerQuery<{ r: string }>(
    `SELECT consecutive_failures || '|' || coalesce(blocked_until::text, '') AS r
       FROM back_office_credential WHERE staff_user_id = $1`,
    [staffUserId]
  );
  return rows[0]!.r;
}

export async function failuresOf(staffUserId: string): Promise<number> {
  const rows = await ownerQuery<{ n: number }>(
    'SELECT consecutive_failures AS n FROM back_office_credential WHERE staff_user_id = $1',
    [staffUserId]
  );
  return rows[0]!.n;
}

export async function securityEvents(): Promise<
  { event_type: string; throttle_class: string; client_instance_id: string | null }[]
> {
  return ownerQuery(
    'SELECT event_type, throttle_class, client_instance_id FROM security_event ORDER BY id'
  );
}

export async function wholeSecurityLog(): Promise<string> {
  const rows = await ownerQuery<{ r: string }>('SELECT to_jsonb(security_event)::text AS r FROM security_event ORDER BY id');
  return rows.map((row) => row.r).join('\n');
}

export async function auditCount(): Promise<number> {
  return (await ownerQuery('SELECT 1 FROM audit_entry')).length;
}

/** Moves a PIN class's cooldown into the past, as the passage of time would. */
export async function ageOutPinCooldown(throttleClass: string): Promise<void> {
  await ownerQuery(
    `UPDATE pin_throttle_bucket
        SET blocked_until = clock_timestamp() - interval '1 second'
      WHERE throttle_class = $1`,
    [throttleClass]
  );
}

export async function ageOutPasswordCooldown(staffUserId: string): Promise<void> {
  await ownerQuery(
    `UPDATE back_office_credential
        SET blocked_until = clock_timestamp() - interval '1 second'
      WHERE staff_user_id = $1`,
    [staffUserId]
  );
}

export async function ageSession(id: string, seconds: number): Promise<void> {
  await ownerQuery(
    `UPDATE actor_session
        SET last_interactive_at = clock_timestamp() - make_interval(secs => $2::int)
      WHERE id = $1`,
    [id, seconds]
  );
}
