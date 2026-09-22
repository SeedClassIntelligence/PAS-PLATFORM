/**
 * PAS-0205 — the six actors, over HTTP.
 *
 * *"Test: anonymous user, authenticated owner, authorized collaborator,
 *  unauthorized user, organization administrator, platform administrator."*
 *
 * Driven through a socket rather than by calling `authorize` directly, because
 * an authorization service that is correct in isolation and never reached is
 * the failure this build exists to prevent. Each actor holds a real session
 * token and is judged by the same path a request takes.
 *
 * The matrix is written out in full, including every DENY. A security suite
 * that only asserts the allows passes just as well against a server that
 * allows everything.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closePool, query } from '@pas/database';
import { startSecuredServer, call, type SecuredServer } from './harness.js';
import { buildScenario, type Scenario, type TestActor } from './actors.js';

let server: SecuredServer;
let scenario: Scenario;

beforeAll(async () => {
  scenario = await buildScenario();
  server = await startSecuredServer();
}, 90_000);

afterAll(async () => {
  await server?.close();
  await closePool();
});

/** Every actor against every guarded path, as one table. */
type Expectation = 'ALLOW' | 'DENY';

interface Case {
  path: (accountId: string) => string;
  method: string;
  what: string;
  expected: Record<string, Expectation>;
}

const CASES: Case[] = [
  {
    what: 'read records',
    method: 'GET',
    path: (a) => `/accounts/${a}/records`,
    expected: {
      anonymous: 'DENY',
      owner: 'ALLOW',
      collaborator: 'ALLOW',
      unauthorized: 'DENY',
      organizationAdmin: 'ALLOW',
      platformAdmin: 'DENY',
    },
  },
  {
    what: 'read PRIVATE records',
    method: 'GET',
    path: (a) => `/accounts/${a}/records/private`,
    expected: {
      anonymous: 'DENY',
      owner: 'ALLOW',
      // PAS-0203 withholds private read from a collaborator deliberately.
      collaborator: 'DENY',
      unauthorized: 'DENY',
      organizationAdmin: 'ALLOW',
      // The MasterAdminView answer: being a platform administrator is not
      // authority over anyone's material.
      platformAdmin: 'DENY',
    },
  },
  {
    what: 'create a claim',
    method: 'POST',
    path: (a) => `/accounts/${a}/claims`,
    expected: {
      anonymous: 'DENY',
      owner: 'ALLOW',
      collaborator: 'ALLOW',
      unauthorized: 'DENY',
      organizationAdmin: 'ALLOW',
      platformAdmin: 'DENY',
    },
  },
  {
    what: 'APPROVE a claim',
    method: 'POST',
    path: (a) => `/accounts/${a}/claims/approve`,
    // INV-27, INV-12, SUP-12: no role holds this. Nobody, including the
    // platform administrator, can approve a claim.
    expected: {
      anonymous: 'DENY',
      owner: 'DENY',
      collaborator: 'DENY',
      unauthorized: 'DENY',
      organizationAdmin: 'DENY',
      platformAdmin: 'DENY',
    },
  },
  {
    what: 'publish',
    method: 'POST',
    path: (a) => `/accounts/${a}/publish`,
    expected: {
      anonymous: 'DENY',
      owner: 'ALLOW',
      collaborator: 'DENY',
      unauthorized: 'DENY',
      organizationAdmin: 'ALLOW',
      platformAdmin: 'DENY',
    },
  },
  {
    what: 'administer the organization',
    method: 'GET',
    path: (a) => `/accounts/${a}/manage`,
    expected: {
      anonymous: 'DENY',
      owner: 'DENY',
      collaborator: 'DENY',
      unauthorized: 'DENY',
      organizationAdmin: 'ALLOW',
      platformAdmin: 'DENY',
    },
  },
];

const ACTORS = [
  'anonymous',
  'owner',
  'collaborator',
  'unauthorized',
  'organizationAdmin',
  'platformAdmin',
] as const;

describe('the six actors', () => {
  for (const testCase of CASES) {
    describe(testCase.what, () => {
      for (const key of ACTORS) {
        const expected = testCase.expected[key];
        it(`${expected}s the ${key}`, async () => {
          const actor: TestActor = scenario[key];
          const response = await call(
            server.base,
            testCase.method,
            testCase.path(scenario.accountId),
            { token: actor.token },
          );
          expect(response.status, `${actor.label}: ${response.raw}`).toBe(
            expected === 'ALLOW' ? 200 : 403,
          );
        });
      }
    });
  }

  it('lets the platform administrator read the platform audit record', async () => {
    // The one thing they can do, and it is scoped to the platform account.
    const response = await call(server.base, 'GET', '/platform/audit', {
      token: scenario.platformAdmin.token,
    });
    expect(response.status, response.raw).toBe(200);
  });

  it.each(['owner', 'collaborator', 'organizationAdmin', 'unauthorized'] as const)(
    'refuses the platform audit record to the %s',
    async (key) => {
      const response = await call(server.base, 'GET', '/platform/audit', {
        token: scenario[key].token,
      });
      expect(response.status, response.raw).toBe(403);
    },
  );
});

describe('the matrix is load-bearing', () => {
  /**
   * A suite that only asserted the allows would pass against a server that
   * allowed everything. This asserts the table itself contains refusals in
   * every row, so a future edit cannot quietly turn it into a list of
   * permissions.
   */
  it('expects a refusal for every guarded path', () => {
    for (const testCase of CASES) {
      const denials = Object.values(testCase.expected).filter((e) => e === 'DENY');
      expect(denials.length, testCase.what).toBeGreaterThan(0);
    }
  });

  it('covers all six actors in every row', () => {
    for (const testCase of CASES) {
      expect(Object.keys(testCase.expected).sort(), testCase.what).toEqual([...ACTORS].sort());
    }
  });
});

describe('a revoked membership stops authorizing immediately', () => {
  it('refuses an owner whose membership was revoked, on the next request', async () => {
    const path = `/accounts/${scenario.accountId}/records`;
    expect((await call(server.base, 'GET', path, { token: scenario.owner.token })).status).toBe(200);

    await query(`update account_memberships set status = 'REVOKED' where id = $1`, [
      scenario.owner.membershipId,
    ]);

    // No cache, no session invalidation needed: the decision is made from the
    // database on every request.
    expect((await call(server.base, 'GET', path, { token: scenario.owner.token })).status).toBe(403);

    await query(`update account_memberships set status = 'ACTIVE' where id = $1`, [
      scenario.owner.membershipId,
    ]);
  });
});
