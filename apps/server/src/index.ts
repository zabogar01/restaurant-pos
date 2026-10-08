import { listenHost, listenPort, logLevel, pinPepper, tlsPaths } from './config.js';
import { closePool, query } from './db/pool.js';
import { StartupError } from './http/errors.js';
import { logLine } from './http/log.js';
import { assertLoopbackAddress, listenLoopback } from './http/loopback.js';
import { buildServer } from './http/server.js';
import { loadTls } from './http/tls.js';

const SHUTDOWN_MS = 10_000;

// A configuration function throws a sentence written in this repository that
// names a variable and never its value; it is the message that is printed.
function configured<T>(read: () => T): T {
  try {
    return read();
  } catch (err) {
    throw err instanceof Error ? new StartupError(err.message) : err;
  }
}

async function main(): Promise<void> {
  // 1. Configuration. Pure, no I/O.
  const host = configured(listenHost);
  assertLoopbackAddress(host);
  const port = configured(listenPort);
  const level = configured(logLevel);
  // 2. The pepper is read once, only to fail now rather than at the first login.
  configured(pinPepper);
  // 3. The certificate, before any socket or connection.
  const tls = loadTls(configured(tlsPaths));
  // 4. The database, as pos_app.
  try {
    await query('SELECT 1');
  } catch (err) {
    logLine('error', 'the database did not answer', err);
    throw new StartupError('the database did not answer; is DATABASE_URL set and the database running (npm run db:up)?');
  }
  // 5. The server.
  const origin = `https://localhost:${port}`;
  const app = buildServer({ origin, logLevel: level, tls });
  await listenLoopback(app, { host, port });
  logLine('info', `listening on ${origin}`);

  let stopping = false;
  const stop = (): void => {
    if (stopping) process.exit(1);
    stopping = true;
    setTimeout(() => process.exit(1), SHUTDOWN_MS).unref();
    // app.close() lets requests in flight finish; the pool closes after it, not in
    // an onClose hook, so a test that builds several servers keeps its pool.
    app
      .close()
      .then(() => closePool())
      .then(() => process.exit(0))
      .catch((err) => {
        logLine('error', 'shutdown failed', err);
        process.exit(1);
      });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

process.on('uncaughtException', (err) => {
  logLine('error', 'uncaught exception', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logLine('error', 'unhandled rejection', err);
  process.exit(1);
});

main().catch((err) => {
  logLine('error', 'the server did not start', err);
  process.exit(1);
});
