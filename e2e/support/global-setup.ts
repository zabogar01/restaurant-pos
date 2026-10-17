import { spawn, type ChildProcess } from 'node:child_process';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { provision } from '../../apps/server/scripts/provision.js';
import { makeCert } from '../../apps/server/scripts/make-cert.js';
import { resetE2eDatabase } from './database.js';
import { E2E_PORT } from './env.js';

// One browser run at a time across worktrees: they share one port and one
// database. A different key from the server tests', so a browser run and a
// verify never wait on each other.
const LOCK = "hashtext('restaurant-pos:e2e')";
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const READY_MS = 30_000;
const STOP_MS = 10_000;

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; refusing to start the browser harness`);
  return value;
}

function tail(logPath: string): string {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-20).join('\n');
  } catch {
    return '(no server log)';
  }
}

function health(cert: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { hostname: 'localhost', port: E2E_PORT, path: '/api/health', ca: cert, timeout: 2_000 },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }
    );
    req.on('timeout', () => req.destroy(new Error('health probe timed out')));
    req.on('error', reject);
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export default async function setup(): Promise<() => Promise<void>> {
  // 1. Lock. A session-level lock lives as long as this connection.
  const lock = new pg.Client({ connectionString: need('PROVISION_DATABASE_URL') });
  await lock.connect();
  let dir: string | undefined;
  let child: ChildProcess | undefined;
  let exited = false;

  const teardown = async (): Promise<void> => {
    if (child && !exited) {
      const gone = new Promise<void>((resolve) => child!.once('exit', () => resolve()));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child!.kill('SIGKILL'), STOP_MS);
      await gone;
      clearTimeout(timer);
    }
    if (dir) await rm(dir, { recursive: true, force: true });
    await lock.end();
  };

  try {
    const got = await lock.query<{ ok: boolean }>(`SELECT pg_try_advisory_lock(${LOCK}) AS ok`);
    if (!got.rows[0]?.ok) {
      console.log('another browser run holds the harness database; waiting for it to finish');
      await lock.query(`SELECT pg_advisory_lock(${LOCK})`);
    }

    // 2. Provision the role and the harness's database.
    await provision({
      ownerUrl: need('PROVISION_DATABASE_URL'),
      appPassword: need('POS_APP_PASSWORD'),
      testDatabase: need('POS_E2E_DB_NAME'),
    });
    // 3. Reset once, so the server starts on a migrated schema.
    await resetE2eDatabase();

    // 4. A throwaway certificate for this run.
    dir = await mkdtemp(join(tmpdir(), 'rpos-e2e-'));
    const { keyPath, certPath } = await makeCert({ dir });
    const cert = readFileSync(certPath);

    // 5. The server, with an environment built here and no env file read by node: a variable
    // forgotten below is absent, never filled with the development value. No
    // MIGRATION_DATABASE_URL either; the server never needs the owner connection.
    const logPath = join(dir, 'server.log');
    const log = openSync(logPath, 'a');
    try {
      child = spawn(join(ROOT, 'node_modules', '.bin', 'tsx'), ['apps/server/src/index.ts'], {
        cwd: ROOT,
        env: {
          PATH: need('PATH'),
          HOME: need('HOME'),
          DATABASE_URL: need('DATABASE_URL'),
          PIN_PEPPER: need('PIN_PEPPER'),
          POS_LISTEN_PORT: String(E2E_PORT),
          POS_TLS_KEY_PATH: keyPath,
          POS_TLS_CERT_PATH: certPath,
          POS_LOG_LEVEL: 'trace',
        },
        stdio: ['ignore', log, log],
      });
    } finally {
      closeSync(log);
    }
    child.once('exit', () => {
      exited = true;
    });
    process.env.E2E_SERVER_LOG = logPath;

    // 6. Ready: health creates no client instance, so polling writes nothing.
    const deadline = Date.now() + READY_MS;
    for (;;) {
      if (exited) throw new Error(`the harness server exited during start-up:\n${tail(logPath)}`);
      let status = 0;
      try {
        status = await health(cert);
      } catch {
        // not listening yet
      }
      // Only a server this run started counts: a busy port makes ours exit, and
      // only ours writes the line that says it is listening.
      if (status === 200 && !exited && readFileSync(logPath, 'utf8').includes('listening on')) break;
      if (Date.now() > deadline) {
        throw new Error(`the harness server was not ready in ${READY_MS} ms:\n${tail(logPath)}`);
      }
      await sleep(250);
    }
  } catch (err) {
    await teardown();
    throw err;
  }

  return teardown;
}
