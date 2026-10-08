import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listenHost, listenPort, logLevel, tlsPaths } from '../src/config.js';

describe('configuration', () => {
  beforeEach(() => {
    for (const name of [
      'POS_LISTEN_HOST',
      'POS_LISTEN_PORT',
      'POS_TLS_KEY_PATH',
      'POS_TLS_CERT_PATH',
      'POS_LOG_LEVEL',
    ]) {
      vi.stubEnv(name, undefined);
    }
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('11. unset, the host is 127.0.0.1 and the port 8443', () => {
    expect(listenHost()).toBe('127.0.0.1');
    expect(listenPort()).toBe(8443);
  });

  it.each(['0', '80', '1023', '65536', '70000', '8443x', '', ' 8443', '-1', '1e4', '08443x'])(
    '12. POS_LISTEN_PORT %j throws, naming the variable',
    (value) => {
      vi.stubEnv('POS_LISTEN_PORT', value);
      expect(() => listenPort()).toThrow(/POS_LISTEN_PORT/);
    }
  );

  it('12. a port in range is accepted, at both ends', () => {
    vi.stubEnv('POS_LISTEN_PORT', '1024');
    expect(listenPort()).toBe(1024);
    vi.stubEnv('POS_LISTEN_PORT', '65535');
    expect(listenPort()).toBe(65535);
  });

  it('13. an exported HOST=0.0.0.0 has no effect', () => {
    vi.stubEnv('HOST', '0.0.0.0');
    expect(listenHost()).toBe('127.0.0.1');
  });

  it('13. POS_LISTEN_HOST is passed on as it is, empty included, for the guard to judge', () => {
    vi.stubEnv('POS_LISTEN_HOST', '');
    expect(listenHost()).toBe('');
    vi.stubEnv('POS_LISTEN_HOST', '0.0.0.0');
    expect(listenHost()).toBe('0.0.0.0');
  });

  it('the TLS paths default to a directory outside the working tree, each overridable', () => {
    const { keyPath, certPath } = tlsPaths();
    expect(keyPath).toMatch(/\.config\/restaurant-pos\/tls\/localhost-key\.pem$/);
    expect(certPath).toMatch(/\.config\/restaurant-pos\/tls\/localhost-cert\.pem$/);
    vi.stubEnv('POS_TLS_KEY_PATH', '/elsewhere/key.pem');
    expect(tlsPaths()).toEqual({ keyPath: '/elsewhere/key.pem', certPath });
    vi.stubEnv('POS_TLS_CERT_PATH', '');
    expect(() => tlsPaths()).toThrow(/POS_TLS_CERT_PATH/);
  });

  it('the log level defaults to info and refuses an unknown one, naming the variable', () => {
    expect(logLevel()).toBe('info');
    vi.stubEnv('POS_LOG_LEVEL', 'trace');
    expect(logLevel()).toBe('trace');
    vi.stubEnv('POS_LOG_LEVEL', 'loud');
    expect(() => logLevel()).toThrow(/POS_LOG_LEVEL/);
  });
});
