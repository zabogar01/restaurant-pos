import { BlockList, isIPv4, isIPv6 } from 'node:net';
import { Server as TlsServer } from 'node:tls';
import type { FastifyInstance } from 'fastify';
import { StartupError } from './errors.js';

// One list per family. A BlockList that held both would match an IPv4-mapped
// IPv6 address (::ffff:127.0.0.1) against its IPv4 rules, and that spelling is
// refused on purpose.
const loopbackV4 = new BlockList();
loopbackV4.addSubnet('127.0.0.0', 8, 'ipv4');
const loopbackV6 = new BlockList();
loopbackV6.addAddress('::1', 'ipv6');
function refusal(host: string): StartupError {
  return new StartupError(
    `refusing to listen on "${host}": the MVP listens on a loopback IP address only ` +
      '(ARCHITECTURE 3.1; changing this is the pre-production gate in 3.2)'
  );
}

/**
 * Accepts an IP literal in 127.0.0.0/8 or ::1 and nothing else. A name is
 * refused, `localhost` included: the operating system resolves a name at bind
 * time, so a check on the string checks something other than what is bound.
 */
export function assertLoopbackAddress(host: string): void {
  if (typeof host !== 'string' || host.includes('%')) throw refusal(String(host));
  if (isIPv4(host) && loopbackV4.check(host, 'ipv4')) return;
  if (isIPv6(host) && loopbackV6.check(host, 'ipv6')) return;
  throw refusal(host);
}

/**
 * The only code in apps/server/src that listens. It refuses a server that is
 * not HTTPS, checks the configured host, listens, then checks every address the
 * socket is actually bound to and closes if one is not loopback. No flag
 * switches any of this off.
 */
export async function listenLoopback(
  app: FastifyInstance,
  { host, port }: { host: string; port: number }
): Promise<void> {
  if (!(app.server instanceof TlsServer)) {
    throw new StartupError('refusing to listen: the server was built without TLS');
  }
  assertLoopbackAddress(host);
  await app.listen({ host, port });
  try {
    for (const bound of app.addresses()) assertLoopbackAddress(bound.address);
  } catch (err) {
    await app.close();
    throw err;
  }
}
