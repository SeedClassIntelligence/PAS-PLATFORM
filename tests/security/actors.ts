/**
 * PAS-0205 — the six actors the ticket names, built as real database state.
 *
 * Not fixtures in the sense of stubs: every one is a real user, with a real
 * account membership, real roles and a real session, so a test drives the same
 * rows a request would.
 */

import { query, migrate } from '@pas/database';
import { generateId } from '@pas/domain';
import { now } from '@pas/contracts';
import {
  issueSession,
  platformAccountId,
  resetPlatformAccountCache,
  grantRole,
  type Role,
} from '@pas/auth';
import { resolve } from 'node:path';

const MIGRATIONS = resolve(import.meta.dirname, '../../migrations');

export interface TestActor {
  label: string;
  userId?: string;
  accountId?: string;
  membershipId?: string;
  /** Absent for the anonymous actor — it holds no credential. */
  token?: string;
}

export interface Scenario {
  /** The account the six actors are judged against. */
  accountId: string;
  anonymous: TestActor;
  owner: TestActor;
  collaborator: TestActor;
  /** Authenticated, and a member of a different account entirely. */
  unauthorized: TestActor;
  organizationAdmin: TestActor;
  platformAdmin: TestActor;
}

async function makeUser(): Promise<string> {
  const id = generateId();
  await query(
    `insert into users (id, email, created_at, updated_at) values ($1, $2, $3, $3)`,
    [id, `u-${id}@example.com`, now()],
  );
  return id;
}

async function makeAccount(type = 'ORGANIZATION'): Promise<string> {
  const id = generateId();
  await query(
    `insert into accounts (id, account_type, display_name, created_at, updated_at)
     values ($1, $2, $3, $4, $4)`,
    [id, type, `Account ${id.slice(0, 8)}`, now()],
  );
  return id;
}

/**
 * Roles are granted through `@pas/auth`, never by inserting the row here.
 *
 * PAS-0204's bypass guard flagged the raw INSERT that used to be here, and it
 * was right to: the invariants on `membership_roles` live in `@pas/auth`, and
 * a fixture writing the row itself is free to skip every one of them. That it
 * had to be written raw at all was the finding — the registry had no write
 * path until this suite needed one.
 */
async function join(accountId: string, userId: string, role?: Role): Promise<string> {
  const membershipId = generateId();
  await query(
    `insert into account_memberships (id, account_id, user_id, created_at, updated_at)
     values ($1, $2, $3, $4, $4)`,
    [membershipId, accountId, userId, now()],
  );
  if (role) await grantRole(membershipId, role);
  return membershipId;
}

async function member(
  label: string,
  accountId: string,
  role?: Role,
): Promise<TestActor> {
  const userId = await makeUser();
  const membershipId = await join(accountId, userId, role);
  const { token } = await issueSession(userId);
  return { label, userId, accountId, membershipId, token };
}

/** Resets the schema and builds the six actors against one organization account. */
export async function buildScenario(): Promise<Scenario> {
  await query('drop schema public cascade');
  await query('create schema public');
  await migrate({ directory: MIGRATIONS });
  resetPlatformAccountCache();

  const accountId = await makeAccount('ORGANIZATION');

  return {
    accountId,
    anonymous: { label: 'anonymous user' },
    owner: await member('authenticated owner', accountId, 'OWNER'),
    collaborator: await member('authorized collaborator', accountId, 'COLLABORATOR'),
    // Authenticated, in good standing, and a member of somewhere else. The
    // realistic attacker: a legitimate user of the platform, not a stranger.
    unauthorized: await member('unauthorized user', await makeAccount('ORGANIZATION'), 'OWNER'),
    organizationAdmin: await member('organization administrator', accountId, 'ORGANIZATION_ADMIN'),
    platformAdmin: await member('platform administrator', await platformAccountId(), 'PLATFORM_ADMIN'),
  };
}
