/**
 * PAS-0205 — the security suite's harness.
 *
 * ── Why this server exists, and what it is honestly worth ────────────────
 *
 * The ticket requires verifying that *frontend behaviour is irrelevant to
 * server authorization*. That cannot be shown in-process: "the client sent a
 * header claiming to be an admin" is not representable as a function call.
 * It needs a real socket, real requests, and a client free to send whatever
 * it likes.
 *
 * No protected route exists yet — `apps/api` serves `/health`, `/ready` and a
 * 404, and the first domain routes arrive at PAS-0405. Two options were
 * considered and rejected:
 *
 *   Defer PAS-0205 until routes exist. Build 02 would then close with an
 *   unmet acceptance criterion, which the completion contract forbids.
 *
 *   Add a protected route to `apps/api` for the tests to drive. That is
 *   PAS-0405's scope, and a route that exists only for a test is product
 *   surface nobody asked for.
 *
 * So the harness composes the **real** `resolveSession` and
 * `requireCapability` in exactly the order a route will, over a real socket.
 * It is not a mock: every authorization decision here is made by the shipped
 * service against the shipped schema.
 *
 * **What it does not prove:** that PAS-0405's routes will call this path. That
 * is PAS-0204's job — `Grant` makes omission a compile error and
 * `no-bypass.test.ts` makes a private reimplementation a test failure. When
 * real routes land, this suite re-points at them and the harness goes.
 */

import { createServer, type Server, type IncomingMessage } from 'node:http';
import { type AddressInfo } from 'node:net';
import { toErrorResponse } from '@pas/contracts';
import {
  resolveSession,
  requireCapability,
  actorForUser,
  inAccount,
  ANONYMOUS,
  PLATFORM_SCOPE,
  type Actor,
  type Capability,
  type ResourceContext,
} from '@pas/auth';

/**
 * The route table a real router would hold.
 *
 * The **server** decides which capability guards which path. Nothing a client
 * sends selects it — that is the property under test, so it is structural
 * here rather than asserted.
 */
const ROUTES: {
  method: string;
  pattern: RegExp;
  capability: Capability;
  scope: (match: RegExpExecArray) => ResourceContext;
}[] = [
  {
    method: 'GET',
    pattern: /^\/accounts\/([^/]+)\/records$/,
    capability: 'authority.record.read',
    scope: (m) => inAccount(m[1]),
  },
  {
    method: 'GET',
    pattern: /^\/accounts\/([^/]+)\/records\/private$/,
    capability: 'authority.record.read_private',
    scope: (m) => inAccount(m[1]),
  },
  {
    method: 'POST',
    pattern: /^\/accounts\/([^/]+)\/claims$/,
    capability: 'claim.create',
    scope: (m) => inAccount(m[1]),
  },
  {
    method: 'POST',
    pattern: /^\/accounts\/([^/]+)\/claims\/approve$/,
    capability: 'claim.approve',
    scope: (m) => inAccount(m[1]),
  },
  {
    method: 'POST',
    pattern: /^\/accounts\/([^/]+)\/publish$/,
    capability: 'publication.publish',
    scope: (m) => inAccount(m[1]),
  },
  {
    method: 'GET',
    pattern: /^\/accounts\/([^/]+)\/manage$/,
    capability: 'organization.manage',
    scope: (m) => inAccount(m[1]),
  },
  {
    method: 'GET',
    pattern: /^\/platform\/audit$/,
    capability: 'audit.read',
    scope: () => PLATFORM_SCOPE,
  },
];

/**
 * Extracts the bearer token.
 *
 * The cookie and the `Authorization` header are the only places a credential
 * is read from. Every other header, every cookie, and the entire body are
 * ignored — which is what "frontend behaviour is irrelevant" means in code.
 */
function credentialFrom(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || undefined;
  }

  const cookie = request.headers.cookie;
  if (typeof cookie === 'string') {
    for (const part of cookie.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === 'pas_session') return rest.join('=') || undefined;
    }
  }
  return undefined;
}

async function actorFrom(request: IncomingMessage): Promise<Actor> {
  const token = credentialFrom(request);
  if (!token) return ANONYMOUS;

  const resolved = await resolveSession(token);
  // A session that is expired, revoked or unknown is anonymous. It is never
  // "logged in but unauthorized" — whatever the client still displays.
  return resolved.ok ? actorForUser(resolved.session.userId) : ANONYMOUS;
}

export interface SecuredServer {
  base: string;
  close: () => Promise<void>;
}

/** Starts the harness on an ephemeral port. */
export async function startSecuredServer(): Promise<SecuredServer> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      try {
        const path = (request.url ?? '/').split('?')[0];
        const method = request.method ?? 'GET';

        const route = ROUTES.find((r) => r.method === method && r.pattern.test(path));
        if (!route) {
          response.writeHead(404, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: { code: 'resource.not_found' } }));
          return;
        }

        const match = route.pattern.exec(path) as RegExpExecArray;
        const actor = await actorFrom(request);

        // Throws AuthorizationError on DENY. The route cannot proceed without
        // the grant, which is PAS-0204's point.
        const grant = await requireCapability(actor, route.capability, route.scope(match));

        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, capability: grant.capability }));
      } catch (error) {
        // PAS-0003 decides what a client may see. Nothing is formatted here,
        // and in particular the denial reason is never reached for.
        const body = toErrorResponse(error, { correlationId: 'security-test', deployed: true });
        const status = body.error.family === 'AUTHORIZATION' ? 403 : 500;
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export interface Response {
  status: number;
  body: { ok?: boolean; error?: { code?: string; message?: string; family?: string; details?: unknown } };
  raw: string;
}

/** A request with whatever headers, cookies and body a hostile client likes. */
export async function call(
  base: string,
  method: string,
  path: string,
  options: { token?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : {}, raw };
}
