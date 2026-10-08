import { X509Certificate, createPrivateKey } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { StartupError } from './errors.js';

export interface TlsPaths {
  keyPath: string;
  certPath: string;
}

function refuse(problem: string, path: string): never {
  // No sentence here carries a line of either file.
  throw new StartupError(`${problem} (${path}); run npm run cert to make a local certificate`);
}

function read(path: string, what: string): Buffer {
  try {
    return readFileSync(path);
  } catch {
    return refuse(`the TLS ${what} is missing or not readable`, path);
  }
}

/**
 * Loads the local certificate pair, refusing in this order: both files
 * readable; the key not readable by group or others; the certificate parses; it
 * is not a CA; it matches `localhost`; `now` is inside its validity; the key
 * matches the certificate. There is no fallback to plain HTTP and nothing is
 * generated here: a certificate that expired must be seen to have expired.
 *
 * This is the one place the server reads the wall clock from JavaScript, and it
 * persists nothing, so ARCHITECTURE 14.4 is not touched. `now` is a parameter so
 * that expiry is testable.
 */
export function loadTls(
  { keyPath, certPath }: TlsPaths,
  now: Date = new Date()
): { key: Buffer; cert: Buffer } {
  const key = read(keyPath, 'key file');
  const cert = read(certPath, 'certificate file');

  if ((statSync(keyPath).mode & 0o077) !== 0) {
    refuse('the TLS key file is readable by group or others', keyPath);
  }

  let x509: X509Certificate;
  try {
    x509 = new X509Certificate(cert);
  } catch {
    return refuse('the TLS certificate file is not a certificate', certPath);
  }
  if (x509.ca) refuse('the TLS certificate is a certificate authority', certPath);
  if (x509.checkHost('localhost') === undefined) {
    refuse('the TLS certificate does not name localhost', certPath);
  }
  if (now < x509.validFromDate) refuse('the TLS certificate is not yet valid', certPath);
  if (now > x509.validToDate) refuse('the TLS certificate has expired', certPath);

  let matches = false;
  try {
    matches = x509.checkPrivateKey(createPrivateKey(key));
  } catch {
    matches = false;
  }
  if (!matches) refuse('the TLS key does not belong to the certificate', keyPath);

  return { key, cert };
}
