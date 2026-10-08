// Development tooling. Never imported by apps/server/src.
//
// Makes the local HTTPS certificate: a self-signed leaf, not a certificate
// authority (`CA:FALSE`), for localhost, 127.0.0.1 and ::1, valid 397 days. The
// key is unencrypted, mode 0600, in a directory of mode 0700 outside the working
// tree. Idempotent: a valid pair is left alone. It never installs trust: no
// sudo, no keychain, no mkcert. The owner clicks through the browser warning once
// per profile, or trusts the leaf by hand if they wish; CA:FALSE keeps that harmless.
import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { defaultTlsDirectory, listenPort } from '../src/config.js';
import { loadTls } from '../src/http/tls.js';

const run = promisify(execFile);

export const KEY_FILE = 'localhost-key.pem';
export const CERT_FILE = 'localhost-cert.pem';
export const VALID_DAYS = 397;

export interface MakeCertOptions {
  dir: string;
  /** The time the existing pair is judged at; the new one always starts now. */
  now?: Date;
}

export interface MadeCert {
  keyPath: string;
  certPath: string;
  /** False when a valid pair already existed and nothing was changed. */
  created: boolean;
}

export async function makeCert({ dir, now = new Date() }: MakeCertOptions): Promise<MadeCert> {
  const keyPath = join(dir, KEY_FILE);
  const certPath = join(dir, CERT_FILE);

  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);

  try {
    loadTls({ keyPath, certPath }, now);
    return { keyPath, certPath, created: false };
  } catch {
    // Missing, expired, mismatched or failing a check: make a new pair.
  }

  // execFile with an argument array, never a shell, so a path with a space is safe.
  const tmpKey = `${keyPath}.tmp`;
  const tmpCert = `${certPath}.tmp`;
  await run('openssl', [
    'req', '-x509',
    '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
    '-nodes',
    '-keyout', tmpKey,
    '-out', tmpCert,
    '-days', String(VALID_DAYS),
    '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1',
    '-addext', 'basicConstraints=critical,CA:FALSE',
    '-addext', 'keyUsage=critical,digitalSignature',
    '-addext', 'extendedKeyUsage=serverAuth',
  ]);
  chmodSync(tmpKey, 0o600);
  renameSync(tmpKey, keyPath);
  renameSync(tmpCert, certPath);

  // The same validation the server uses, on the files as written.
  loadTls({ keyPath, certPath }, new Date());
  return { keyPath, certPath, created: true };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  (async () => {
    if (process.env.POS_TLS_KEY_PATH !== undefined || process.env.POS_TLS_CERT_PATH !== undefined) {
      throw new Error(
        'npm run cert writes to the default directory; unset POS_TLS_KEY_PATH and POS_TLS_CERT_PATH first'
      );
    }
    const made = await makeCert({ dir: defaultTlsDirectory() });
    console.log(made.created ? 'made a new certificate' : 'a valid certificate already exists');
    console.log(`key:  ${made.keyPath}`);
    console.log(`cert: ${made.certPath}`);
    console.log(`origin: https://localhost:${listenPort()}`);
  })().catch((e) => {
    console.error(e instanceof Error ? e.message : 'make-cert failed');
    process.exit(1);
  });
}
