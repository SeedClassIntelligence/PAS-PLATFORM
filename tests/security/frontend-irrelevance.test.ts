/**
 * PAS-0205 — *"Verify that frontend behavior is irrelevant to server
 * authorization."*
 *
 * This is the clause that separates this ticket from the four before it.
 * PAS-0204 proved the decision is correct; this proves the decision cannot be
 * influenced by the party it is made about.
 *
 * Every test here is a hostile client. It sends headers claiming roles,
 * cookies claiming administrator status, bodies naming another user, and
 * tokens it has edited. A client is free to send anything; the server is
 * required not to care.
 *
 * ── Why this matters here specifically ───────────────────────────────────
 *
 * The PAS baseline is a prototype where the client decides everything.
 * `usePASStore.ts:503` exposes `setEnvironment`, a plain setter any code may
 * call, and `MasterAdminView` renders a platform-wide console guarded by
 * nothing but `activeRoute === 'admin'`. That is not a bug to be fixed in the
 * React tree — it is the reason server authorization must be independent of
 * the client, and the reason this test exists rather than a note saying the
 * admin view should check a flag.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closePool } from '@pas/database';
import {
  revokeAllSessionsForUser,
  setCapabilityOverride,
  clearCapabilityOverride,
} from '@pas/auth';
import { startSecuredServer, call, type SecuredServer } from './harness.js';
import { buildScenario, type Scenario } from './actors.js';

let server: SecuredServer;
let scenario: Scenario;

/** A path the collaborator is deliberately refused (PAS-0203). */
const PRIVATE = (accountId: string) => `/accounts/${accountId}/records/private`;
/** A path nobody at all may reach (INV-27). */
const APPROVE = (accountId: string) => `/accounts/${accountId}/claims/approve`;

beforeAll(async () => {
  scenario = await buildScenario();
  server = await startSecuredServer();
}, 90_000);

afterAll(async () => {
  await server?.close();
  await closePool();
});

describe('a client cannot claim authority it does not hold', () => {
  /**
   * The headers a frontend would set if it believed its own UI state — which
   * is precisely what the baseline store does.
   */
  const IMPERSONATION_HEADERS: Record<string, string>[] = [
    { 'x-role': 'PLATFORM_ADMIN' },
    { 'x-roles': 'OWNER,ORGANIZATION_ADMIN,PLATFORM_ADMIN' },
    { 'x-capabilities': 'authority.record.read_private' },
    { 'x-pas-capability': 'authority.record.read_private' },
    { 'x-is-admin': 'true' },
    { 'x-admin': '1' },
    { 'x-environment': 'AUTHENTICATED_APP' },
    { 'x-user-role': 'OWNER' },
    { 'x-forwarded-user': 'admin' },
    { authorization: 'Bearer admin' },
  ];

  it.each(IMPERSONATION_HEADERS)('ignores %j from a collaborator', async (headers) => {
    const response = await call(server.base, 'GET', PRIVATE(scenario.accountId), {
      token: scenario.collaborator.token,
      // The hostile headers are applied after the token, so a header the
      // client controls cannot displace the credential either.
      headers,
    });
    expect(response.status, response.raw).toBe(403);
  });

  it.each([
    'pas_session=forged; isAdmin=true',
    'role=PLATFORM_ADMIN; pas_session=forged',
    'capabilities=*; environment=AUTHENTICATED_APP',
  ])('ignores the cookie %j', async (cookie) => {
    const response = await call(server.base, 'GET', PRIVATE(scenario.accountId), {
      headers: { cookie },
    });
    expect(response.status, response.raw).toBe(403);
  });

  it('ignores a body that names a different, more privileged user', async () => {
    const response = await call(server.base, 'POST', `/accounts/${scenario.accountId}/publish`, {
      token: scenario.collaborator.token,
      body: {
        userId: scenario.owner.userId,
        actAs: scenario.owner.userId,
        membershipId: scenario.owner.membershipId,
        role: 'OWNER',
        capabilities: ['publication.publish'],
        authorized: true,
      },
    });
    // A collaborator does not hold publication.publish, and saying so in the
    // body does not create it.
    expect(response.status, response.raw).toBe(403);
  });

  it('ignores a query string naming a capability', async () => {
    const response = await call(
      server.base,
      'GET',
      `${PRIVATE(scenario.accountId)}?capability=authority.record.read&grant=true`,
      { token: scenario.collaborator.token },
    );
    // The server selects the capability from the route, not from the request.
    expect(response.status, response.raw).toBe(403);
  });
});

describe('a client cannot forge or repair a credential', () => {
  it('refuses a request with no credential at all', async () => {
    expect((await call(server.base, 'GET', PRIVATE(scenario.accountId))).status).toBe(403);
  });

  it.each([
    ['', 'empty'],
    ['null', 'the string null'],
    ['undefined', 'the string undefined'],
    ['admin', 'a guess'],
    ['a'.repeat(43), 'the right shape, wrong value'],
    ['../../etc/passwd', 'a traversal'],
    ["' or '1'='1", 'an injection'],
  ])('refuses the token %j (%s)', async (token) => {
    const response = await call(server.base, 'GET', PRIVATE(scenario.accountId), { token });
    expect(response.status, response.raw).toBe(403);
  });

  it('refuses a real token with a single character changed', async () => {
    const real = scenario.owner.token as string;
    // The owner IS allowed here, so a pass would mean the token was not
    // actually checked.
    expect((await call(server.base, 'GET', PRIVATE(scenario.accountId), { token: real })).status)
      .toBe(200);

    const flipped = (real[0] === 'A' ? 'B' : 'A') + real.slice(1);
    expect(flipped).not.toBe(real);
    expect(
      (await call(server.base, 'GET', PRIVATE(scenario.accountId), { token: flipped })).status,
    ).toBe(403);
  });

  it('refuses another account\'s valid token for this account', async () => {
    // A genuine, live credential — for somewhere else. The realistic attack.
    const response = await call(server.base, 'GET', PRIVATE(scenario.accountId), {
      token: scenario.unauthorized.token,
    });
    expect(response.status, response.raw).toBe(403);
  });
});

describe('the server does not trust that the client is still logged in', () => {
  /**
   * A revoked session is the case where the frontend is most confidently
   * wrong: the UI still shows a signed-in user, still renders the buttons,
   * and still sends the token it has.
   */
  it('refuses a revoked session however the client behaves', async () => {
    const scratch = await (async () => {
      const path = `/accounts/${scenario.accountId}/records`;
      expect((await call(server.base, 'GET', path, { token: scenario.owner.token })).status)
        .toBe(200);
      return path;
    })();

    await revokeAllSessionsForUser(scenario.owner.userId as string, 'security test');

    const attempts: Record<string, string>[] = [
      {},
      { 'x-role': 'OWNER' },
      { 'x-session-valid': 'true' },
    ];
    for (const headers of attempts) {
      const response = await call(server.base, 'GET', scratch, {
        token: scenario.owner.token,
        headers,
      });
      expect(response.status, JSON.stringify(headers)).toBe(403);
    }
  });
});

describe('a refusal tells the client nothing it did not already know', () => {
  it('never carries the denial reason', async () => {
    const reasons = [
      'NO_MEMBERSHIP',
      'EXPLICIT_DENY',
      'NO_CAPABILITY',
      'USER_NOT_ACTIVE',
      'ACCOUNT_NOT_ACTIVE',
      'MEMBERSHIP_NOT_ACTIVE',
      'ANONYMOUS',
      'UNKNOWN_CAPABILITY',
    ];

    const probes = [
      { token: undefined, label: 'anonymous' },
      { token: scenario.collaborator.token, label: 'member without the capability' },
      { token: scenario.unauthorized.token, label: 'member of another account' },
      { token: 'garbage', label: 'forged token' },
    ];

    for (const probe of probes) {
      const response = await call(server.base, 'GET', PRIVATE(scenario.accountId), {
        token: probe.token,
      });
      expect(response.status).toBe(403);
      for (const reason of reasons) {
        expect(response.raw, `${probe.label} leaked ${reason}`).not.toContain(reason);
      }
    }
  });

  it('does not reveal whether the account exists', async () => {
    const real = await call(server.base, 'GET', PRIVATE(scenario.accountId), {
      token: scenario.unauthorized.token,
    });
    const imaginary = await call(
      server.base,
      'GET',
      PRIVATE('11111111-1111-4111-8111-111111111111'),
      { token: scenario.unauthorized.token },
    );

    // Identical status and identical body. A difference would confirm which
    // account identifiers are real.
    expect(real.status).toBe(imaginary.status);
    expect(real.body.error?.code).toBe(imaginary.body.error?.code);
    expect(real.body.error?.message).toBe(imaginary.body.error?.message);
  });

  it('does not reveal the membership, account or user in the refusal', async () => {
    const response = await call(server.base, 'GET', PRIVATE(scenario.accountId), {
      token: scenario.collaborator.token,
    });
    for (const secret of [
      scenario.accountId,
      scenario.collaborator.userId as string,
      scenario.collaborator.membershipId as string,
      scenario.owner.userId as string,
    ]) {
      expect(response.raw, secret).not.toContain(secret);
    }
  });
});

describe('server state, not client state, decides', () => {
  /**
   * The direct rebuttal of the baseline's model. Nothing the client does
   * changes the answer; changing a row does, immediately.
   */
  it('changes the answer when the database changes, not when the request does', async () => {
    const path = PRIVATE(scenario.accountId);
    const token = scenario.collaborator.token;

    // Refused, however hard the client insists.
    expect((await call(server.base, 'GET', path, { token, headers: { 'x-role': 'OWNER' } })).status)
      .toBe(403);

    // One override, set server-side with a reason, through the real write path.
    await setCapabilityOverride(
      scenario.collaborator.membershipId as string,
      'authority.record.read_private',
      'ALLOW',
      'security test',
    );

    // Now allowed — with the client sending nothing special at all.
    expect((await call(server.base, 'GET', path, { token })).status).toBe(200);

    await clearCapabilityOverride(
      scenario.collaborator.membershipId as string,
      'authority.record.read_private',
    );
    expect((await call(server.base, 'GET', path, { token })).status).toBe(403);
  });

  it('refuses what no role holds, to every actor, however they ask', async () => {
    // INV-27: no role holds claim.approve. Not the owner, not the
    // organization administrator, not the platform administrator.
    for (const key of ['owner', 'organizationAdmin', 'platformAdmin', 'collaborator'] as const) {
      const response = await call(server.base, 'POST', APPROVE(scenario.accountId), {
        token: scenario[key].token,
        headers: { 'x-role': 'PLATFORM_ADMIN', 'x-capabilities': 'claim.approve' },
        body: { authorized: true, capabilities: ['claim.approve'] },
      });
      expect(response.status, `${key}: ${response.raw}`).toBe(403);
    }
  });
});
