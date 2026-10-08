import { homedir } from 'node:os';
import { join } from 'node:path';

const MIN_PEPPER_LENGTH = 32;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8443;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

/**
 * The bind address, `POS_LISTEN_HOST` or 127.0.0.1. Deliberately not `HOST`:
 * zsh and csh define that as the machine's name. Whether the value is loopback
 * is judged by assertLoopbackAddress, not here; an empty value is passed on so
 * that the guard refuses it and never falls back to Node's every-interface
 * default.
 */
export function listenHost(): string {
  return process.env.POS_LISTEN_HOST ?? DEFAULT_HOST;
}

/** `POS_LISTEN_PORT` or 8443: an integer from 1024 to 65535. */
export function listenPort(): number {
  const value = process.env.POS_LISTEN_PORT;
  if (value === undefined) return DEFAULT_PORT;
  const port = /^[0-9]{1,5}$/.test(value) ? Number(value) : NaN;
  if (!(port >= 1024 && port <= 65535)) {
    throw new Error('POS_LISTEN_PORT must be an integer from 1024 to 65535');
  }
  return port;
}

/** The directory the local certificate pair lives in, outside the working tree. */
export function defaultTlsDirectory(): string {
  return join(homedir(), '.config', 'restaurant-pos', 'tls');
}

/**
 * Where the TLS key and certificate are. A path is not a secret, so a default
 * is not a B-24 matter. Each override is independent of the other.
 */
export function tlsPaths(): { keyPath: string; certPath: string } {
  const directory = defaultTlsDirectory();
  const keyPath = process.env.POS_TLS_KEY_PATH;
  const certPath = process.env.POS_TLS_CERT_PATH;
  if (keyPath === '') throw new Error('POS_TLS_KEY_PATH is set but empty');
  if (certPath === '') throw new Error('POS_TLS_CERT_PATH is set but empty');
  return {
    keyPath: keyPath ?? join(directory, 'localhost-key.pem'),
    certPath: certPath ?? join(directory, 'localhost-cert.pem'),
  };
}

/** `POS_LOG_LEVEL` or info. */
export function logLevel(): string {
  const value = process.env.POS_LOG_LEVEL;
  if (value === undefined) return 'info';
  if (!LOG_LEVELS.includes(value)) {
    throw new Error(`POS_LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}`);
  }
  return value;
}

/**
 * The key of the PIN lookup digest. Read from the environment on every call, so
 * importing this module never fails and a rotated value is never cached. Unset
 * or short is an error, never a default; the message names the variable and
 * never carries its value.
 */
export function pinPepper(): string {
  const value = process.env.PIN_PEPPER;
  if (!value) {
    throw new Error('PIN_PEPPER is not set; refusing to derive a PIN lookup without it');
  }
  if (value.length < MIN_PEPPER_LENGTH) {
    throw new Error(`PIN_PEPPER must be at least ${MIN_PEPPER_LENGTH} characters`);
  }
  return value;
}
