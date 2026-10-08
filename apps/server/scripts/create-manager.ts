// Creates a manager and their back-office credential from a terminal (ADR-009 §7).
// Operator tooling, never imported by apps/server/src. It holds no name, PIN,
// username or password (B-24); every value is typed at the prompt and nothing
// secret is printed, logged or kept (B-11, B-12).
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { getPool, withTransaction } from '../src/db/pool.js';
import { createBackOfficeCredential } from '../src/domain/back-office-credential.js';
import { createStaffUser } from '../src/domain/pin.js';

export interface NewManager {
  name: string;
  pin: string;
  username: string;
  password: string;
}

/**
 * The work, separate from the prompting. The staff user and the credential are
 * written in one transaction: a refusal from either leaves neither behind.
 */
export async function createManager(
  answers: NewManager
): Promise<{ id: string; username: string }> {
  return withTransaction(async (client) => {
    const { id } = await createStaffUser(
      { name: answers.name, role: 'MANAGER', pin: answers.pin },
      client
    );
    const { username } = await createBackOfficeCredential(
      { staffUserId: id, username: answers.username, password: answers.password },
      client
    );
    return { id, username };
  });
}

async function prompt(): Promise<NewManager> {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });

  async function ask(label: string, secret: boolean): Promise<string> {
    process.stdout.write(`${label}: `);
    muted = secret;
    try {
      return await rl.question('');
    } finally {
      muted = false;
      if (secret) process.stdout.write('\n');
    }
  }

  async function askTwice(label: string): Promise<string> {
    const first = await ask(label, true);
    const second = await ask(`${label} (again)`, true);
    if (first !== second) throw new Error(`The two ${label} entries differ; nothing was written`);
    return first;
  }

  try {
    const name = await ask('Name', false);
    const pin = await askTwice('PIN');
    const username = await ask('Username', false);
    const password = await askTwice('Password');
    return { name, pin, username, password };
  } finally {
    rl.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch(() => {
      console.error('create-manager failed; nothing was written');
      process.exit(1);
    });
}

async function main(): Promise<number> {
  // A secret must not arrive through a pipe, where shell history could hold it.
  if (!process.stdin.isTTY) {
    console.error('create-manager needs a terminal; refusing to read from a pipe');
    return 1;
  }
  try {
    const created = await createManager(await prompt());
    console.log(`created manager ${created.id} with username ${created.username}`);
    return 0;
  } catch (err) {
    // Every refusal carries a fixed message that names no value typed.
    console.error(err instanceof Error ? err.message : 'create-manager failed');
    return 1;
  } finally {
    await getPool().end();
  }
}
