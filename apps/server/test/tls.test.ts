import { execFile } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadTls } from '../src/http/tls.js';
import { CERT_FILE, KEY_FILE, makeCert } from '../scripts/make-cert.js';

const run = promisify(execFile);
const DAY = 24 * 60 * 60 * 1000;

let root: string;
let good: { keyPath: string; certPath: string };
let other: { keyPath: string; certPath: string };
let authority: { keyPath: string; certPath: string };
let stranger: { keyPath: string; certPath: string };

/** A certificate for a refusal test, made with arbitrary extensions. */
async function handMade(name: string, subject: string, extensions: string[]) {
  const keyPath = join(root, `${name}-key.pem`);
  const certPath = join(root, `${name}-cert.pem`);
  await run('openssl', [
    'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
    '-keyout', keyPath, '-out', certPath, '-days', '30', '-subj', subject,
    ...extensions.flatMap((e) => ['-addext', e]),
  ]);
  chmodSync(keyPath, 0o600);
  return { keyPath, certPath };
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'pos-tls-test-'));
  good = await makeCert({ dir: join(root, 'good dir') });
  other = await makeCert({ dir: join(root, 'other') });
  authority = await handMade('ca', '/CN=localhost', [
    'subjectAltName=DNS:localhost',
    'basicConstraints=critical,CA:TRUE',
  ]);
  stranger = await handMade('stranger', '/CN=example.com', [
    'subjectAltName=DNS:example.com',
    'basicConstraints=critical,CA:FALSE',
  ]);
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('make-cert', () => {
  it('7. states CA:FALSE explicitly rather than relying on the OpenSSL default', async () => {
    const { stdout } = await run('openssl', ['x509', '-in', good.certPath, '-noout', '-text']);
    expect(stdout).toMatch(/X509v3 Basic Constraints: critical\s+CA:FALSE/);
    expect(stdout).toMatch(/X509v3 Key Usage: critical\s+Digital Signature\s/);
    expect(stdout).toMatch(/X509v3 Extended Key Usage:\s+TLS Web Server Authentication\s/);
    expect(stdout).toMatch(/DNS:localhost, IP Address:127\.0\.0\.1, IP Address:0:0:0:0:0:0:0:1/);
  });

  it('7. makes a pair loadTls accepts: a leaf for localhost, 127.0.0.1 and ::1, at most 398 days, key 0600', () => {
    expect(good.keyPath.endsWith(KEY_FILE)).toBe(true);
    expect(good.certPath.endsWith(CERT_FILE)).toBe(true);
    const { key, cert } = loadTls(good);
    expect(key.length).toBeGreaterThan(0);

    const x509 = new X509Certificate(cert);
    expect(x509.ca).toBe(false);
    expect(x509.checkHost('localhost')).toBe('localhost');
    expect(x509.checkIP('127.0.0.1')).toBe('127.0.0.1');
    expect(x509.checkIP('::1')).toBeDefined();
    const days = (x509.validToDate.getTime() - x509.validFromDate.getTime()) / DAY;
    expect(days).toBeLessThanOrEqual(398);
    expect(days).toBeGreaterThan(300);
    expect(x509.keyUsage).toContain('1.3.6.1.5.5.7.3.1'); // serverAuth

    expect((statSync(good.keyPath).mode & 0o777).toString(8)).toBe('600');
    expect((statSync(join(root, 'good dir')).mode & 0o777).toString(8)).toBe('700');
  });

  it('8. run again on a valid pair, changes neither file', async () => {
    const before = [good.keyPath, good.certPath].map((p) => ({
      content: readFileSync(p),
      mtime: statSync(p).mtimeMs,
    }));
    const again = await makeCert({ dir: join(root, 'good dir') });
    expect(again.created).toBe(false);
    [good.keyPath, good.certPath].forEach((p, i) => {
      expect(readFileSync(p).equals(before[i]!.content)).toBe(true);
      expect(statSync(p).mtimeMs).toBe(before[i]!.mtime);
    });
  });

  it('replaces a pair that has expired', async () => {
    const dir = join(root, 'stale');
    const first = await makeCert({ dir });
    const old = readFileSync(first.certPath);
    const renewed = await makeCert({ dir, now: new Date(Date.now() + 400 * DAY) });
    expect(renewed.created).toBe(true);
    expect(readFileSync(renewed.certPath).equals(old)).toBe(false);
    loadTls(renewed);
  });
});

// Each refusal: the paths to load, the time to judge at, and a sentence it must carry.
const REFUSALS: Record<
  string,
  () => { paths: { keyPath: string; certPath: string }; now?: Date; says: RegExp }
> = {
  'a missing key': () => ({
    paths: { keyPath: join(root, 'no-such-key.pem'), certPath: good.certPath },
    says: /TLS key file is missing/,
  }),
  'a missing certificate': () => ({
    paths: { keyPath: good.keyPath, certPath: join(root, 'no-such-cert.pem') },
    says: /TLS certificate file is missing/,
  }),
  'a key from another pair': () => ({
    paths: { keyPath: other.keyPath, certPath: good.certPath },
    says: /key does not belong to the certificate/,
  }),
  'a time after expiry': () => ({
    paths: good,
    now: new Date(Date.now() + 500 * DAY),
    says: /has expired/,
  }),
  'a time before validity': () => ({
    paths: good,
    now: new Date(Date.now() - 2 * DAY),
    says: /not yet valid/,
  }),
  'a certificate that is a CA': () => ({
    paths: authority,
    says: /is a certificate authority/,
  }),
  'a certificate without localhost': () => ({
    paths: stranger,
    says: /does not name localhost/,
  }),
  'a file that is not a certificate': () => ({
    paths: { keyPath: good.keyPath, certPath: good.keyPath },
    says: /is not a certificate/,
  }),
};

function refusalOf(name: string): { message: string; paths: { keyPath: string; certPath: string } } {
  const { paths, now, says } = REFUSALS[name]!();
  let message: string | undefined;
  try {
    loadTls(paths, now);
  } catch (err) {
    message = (err as Error).message;
  }
  expect(message, `${name} was not refused`).toBeDefined();
  expect(message).toMatch(says);
  return { message: message!, paths };
}

describe('loadTls', () => {
  it.each(Object.keys(REFUSALS))('9. refuses %s, naming the path and npm run cert', (name) => {
    const { message, paths } = refusalOf(name);
    expect(message).toContain('npm run cert');
    const named = [paths.keyPath, paths.certPath].some((p) => message.includes(p));
    expect(named).toBe(true);
  });

  it('9. refuses a key file readable by group', () => {
    const dir = join(root, 'loose');
    const loose = { keyPath: join(dir, KEY_FILE), certPath: join(dir, CERT_FILE) };
    return makeCert({ dir }).then(() => {
      chmodSync(loose.keyPath, 0o640);
      expect(() => loadTls(loose)).toThrow(/key file is readable by group or others.*npm run cert/);
      expect(() => loadTls(loose)).toThrow(loose.keyPath);
    });
  });

  it('9. every refusal has its own sentence', () => {
    const messages = Object.keys(REFUSALS).map((name) => refusalOf(name).message);
    // The same wording may name a different path, but no two checks share a sentence.
    const sentences = messages.map((m) => m.replace(/\([^)]*\)/, '').trim());
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it('10. no refusal message contains a line of either file', () => {
    const lines = new Set<string>();
    for (const p of [good.keyPath, good.certPath, other.keyPath, authority.certPath]) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        if (line.length >= 16) lines.add(line);
      }
    }
    expect(lines.size).toBeGreaterThan(0);
    for (const name of Object.keys(REFUSALS)) {
      const { message } = refusalOf(name);
      for (const line of lines) expect(message).not.toContain(line);
    }
  });
});
