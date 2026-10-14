import { stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

/** Absolute directories, each holding one client's built output. */
export interface BundleRoots {
  pos: string;
  backOffice: string;
}

/**
 * Each client builds into its own package's dist/ (Vite's default). The paths are
 * read from this file's own position in the tree, never from the working
 * directory, so the server finds them from wherever it was started.
 */
export function defaultBundleRoots(): BundleRoots {
  return {
    pos: fileURLToPath(new URL('../../../pos/dist/', import.meta.url)),
    backOffice: fileURLToPath(new URL('../../../back-office/dist/', import.meta.url)),
  };
}

// No unsafe-inline, no nonce and no data: source (ARCHITECTURE 14.4). Vite's built
// HTML has no inline block and the build inlines no asset.
export const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; " +
  "connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const NO_CACHE = 'no-cache';
const NO_STORE = 'no-store';
const IMMUTABLE = 'public, max-age=31536000, immutable';

// Fixed sentences in source; nothing from the request is ever put in one.
const NOT_FOUND = 'Not Found';
const NOT_BUILT: Record<keyof BundleRoots, string> = {
  pos: 'The POS client has not been built. Run: npm run build -w apps/pos',
  backOffice: 'The back-office client has not been built. Run: npm run build -w apps/back-office',
};

interface Bundle {
  /** Where it is mounted, with no trailing slash. */
  prefix: string;
  /** `Location` of the redirect from the bare prefix: a constant, never built from the request. */
  slash: string;
  key: keyof BundleRoots;
}

const BUNDLES: Bundle[] = [
  { prefix: '/pos', slash: '/pos/', key: 'pos' },
  { prefix: '/back-office', slash: '/back-office/', key: 'backOffice' },
];

/**
 * By hand, never a security-header plugin: ADR-010 forbids a transport-security
 * header (rule 6) and any cross-origin grant (rule 4), and a bundle sets no cookie.
 */
function setBundleHeaders(reply: FastifyReply): void {
  reply
    .header('content-security-policy', CONTENT_SECURITY_POLICY)
    .header('x-content-type-options', 'nosniff')
    .header('referrer-policy', 'no-referrer')
    .header('cross-origin-resource-policy', 'same-origin');
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * What a path under a prefix is, by its shape alone (the server holds no list of
 * client paths; NFR-5). `file` is a relative path inside the bundle, `index` is
 * the entry point or the fallback, `miss` is never answered with HTML.
 */
function classify(rest: string): { kind: 'index' } | { kind: 'file'; path: string } | { kind: 'miss' } {
  if (rest.includes('\0') || rest.includes('\\')) return { kind: 'miss' };
  const segments = rest.split('/');
  // A dot segment or a dotfile is never served, however it was spelled.
  if (segments.some((s) => s.startsWith('.'))) return { kind: 'miss' };
  const last = segments[segments.length - 1] ?? '';
  if (rest === '' || rest === 'index.html') return { kind: 'index' };
  const underAssets = segments[0] === 'assets';
  if (underAssets || last.includes('.')) return { kind: 'file', path: rest };
  return { kind: 'index' };
}

/**
 * Serves both bundles from their roots, on the root instance and outside the API
 * context. Each prefix answers from its own bundle only and has its own miss
 * handler: there is no catch-all on the root, so no path under /api and no path
 * outside the two prefixes can receive HTML. Existence is checked per request, so
 * a bundle built after the server started is served without a restart.
 */
export function bundleRoutes(roots: BundleRoots): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    // Only the sendFile decorator is wanted; each call names its own root.
    await app.register(fastifyStatic, { serve: false, cacheControl: false, dotfiles: 'deny', redirect: false });

    for (const { key } of BUNDLES) {
      if (!existsSync(join(roots[key], 'index.html'))) {
        app.log.warn(`the ${key === 'pos' ? 'POS' : 'back-office'} bundle is not built`);
      }
    }

    for (const bundle of BUNDLES) {
      const root = roots[bundle.key];

      // The bare prefix is outside the prefixed scope below, so it has a scope of
      // its own: a refusal on it (the Host check) carries the bundle's headers too,
      // and no response outside the two prefixes does.
      await app.register(async (bare) => {
        const inherited = bare.errorHandler;
        bare.setErrorHandler((err, request, reply) => {
          setBundleHeaders(reply);
          return inherited.call(bare, err as Error, request, reply);
        });
        bare.get(bundle.prefix, async (_request, reply) => {
          setBundleHeaders(reply);
          return reply.code(302).header('location', bundle.slash).header('cache-control', NO_STORE).send();
        });
      });

      await app.register(
        async (scope) => {
          const missing = (reply: FastifyReply) => {
            setBundleHeaders(reply);
            return reply.code(404).header('cache-control', NO_STORE).type('text/plain').send(NOT_FOUND);
          };
          const notBuilt = (reply: FastifyReply) => {
            setBundleHeaders(reply);
            return reply
              .code(503)
              .header('cache-control', NO_STORE)
              .type('text/plain')
              .send(NOT_BUILT[bundle.key]);
          };

          scope.setNotFoundHandler(async (_request, reply) => missing(reply));
          // Whatever the root handler does (it is plain text outside /api), the
          // bundle's headers go on first.
          const inherited = scope.errorHandler;
          scope.setErrorHandler((err, request, reply) => {
            setBundleHeaders(reply);
            return inherited.call(scope, err as Error, request, reply);
          });

          scope.get('/*', async (request: FastifyRequest, reply) => {
            const rest = (request.params as { '*': string })['*'];
            const target = classify(rest);
            if (target.kind === 'miss') return missing(reply);

            if (target.kind === 'file') {
              if (!(await isFile(join(root, target.path)))) return missing(reply);
              setBundleHeaders(reply);
              reply.header('cache-control', target.path.startsWith('assets/') ? IMMUTABLE : NO_CACHE);
              return reply.sendFile(target.path, root);
            }

            if (!(await isFile(join(root, 'index.html')))) return notBuilt(reply);
            setBundleHeaders(reply);
            reply.header('cache-control', NO_CACHE);
            return reply.sendFile('index.html', root);
          });
        },
        { prefix: bundle.prefix }
      );
    }
  };
}
