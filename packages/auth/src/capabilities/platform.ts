/**
 * PAS-0203 — resolving the platform account.
 *
 * ADR-007 models the platform as an account so that `authorize()` has one
 * grain and no branch: a platform administrator holds an `account_membership`
 * like anyone else, and `platform.admin` cannot be held without a row somebody
 * can list, audit and revoke.
 *
 * Resolved by `account_type`, not by a well-known identifier. A constant like
 * `0000…0001` would be a semantic identifier, which PAS-0103 forbids, and it
 * is unnecessary: a unique partial index makes exactly one PLATFORM account
 * possible, so looking it up by type is total.
 */

import { query, type PoolClient } from '@pas/database';
import { InternalError } from '@pas/contracts';

/**
 * Cached for the process lifetime.
 *
 * Sound rather than a shortcut: the row is created by migration `0003` and
 * there is a unique index preventing a second one, so the value cannot change
 * under a running process. Only a *successful* resolution is cached, so a
 * process that started before the migration ran keeps retrying rather than
 * caching a failure forever.
 */
let cached: string | undefined;

/** Test-only: forget the cached identifier. */
export function resetPlatformAccountCache(): void {
  cached = undefined;
}

export async function platformAccountId(client?: PoolClient): Promise<string> {
  if (cached !== undefined) return cached;

  const { rows } = await query<{ id: string }>(
    `select id from accounts where account_type = 'PLATFORM'`,
    [],
    { client, operation: 'auth.platform_account' },
  );

  if (rows.length !== 1) {
    // Not a NotFoundError: nothing the caller did caused this, and it is not
    // a condition any request can recover from. Migration 0003 seeds exactly
    // one row and an index forbids a second, so neither zero nor two is
    // reachable without the schema being wrong.
    throw new InternalError(
      `Expected exactly one PLATFORM account, found ${rows.length}.`,
      { code: 'auth.platform_account_missing' },
    );
  }

  cached = rows[0].id;
  return cached;
}
