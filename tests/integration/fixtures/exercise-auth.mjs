/**
 * Exercises the BUILT authentication, capability and authorization surface in
 * a child process.
 *
 * Separate process for the same reason as `exercise-ledger.mjs`: `@pas/auth`,
 * `@pas/database` and `@pas/config` resolve configuration once, at module
 * load. Importing them inside a vitest file binds them to the suite's own
 * `PAS_DATABASE_URL` and silently ignores the scratch database the test just
 * created — a green test pointed at the wrong target.
 *
 * Prints one JSON line per check, so a failure names the behaviour rather than
 * an exit code.
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const ROOT = process.argv[2];
const dist = (p) => pathToFileURL(join(ROOT, 'packages', p, 'dist/index.js')).href;

const db = await import(dist('database'));
const auth = await import(dist('auth'));
const domain = await import(dist('domain'));
const contracts = await import(dist('contracts'));

/**
 * Always `auth.isAllowed(...)`, never a truthy field on the decision.
 *
 * The first version of this file tested `decision.allowed`, which does not
 * exist — `AuthorizationDecision` carries `decision: 'ALLOW' | 'DENY'`. Reading
 * a missing field yields `undefined`, so every "is denied" check below passed
 * without the authorization service being consulted at all. Six vacuous passes;
 * only the three "should be ALLOW" checks could fail, and they are what exposed
 * it. A deny-only probe would have been green and worthless.
 */
const out = [];
const check = async (name, fn) => {
  try {
    await fn();
    out.push({ name, ok: true });
  } catch (e) {
    out.push({ name, ok: false, error: e.message });
  }
};

const at = () => contracts.now();

async function makeUser(status = 'ACTIVE') {
  const id = domain.generateId();
  await db.query(
    `insert into users (id, email, status, created_at, updated_at) values ($1, $2, $3, $4, $4)`,
    [id, `u-${id}@example.com`, status, at()],
  );
  return id;
}

async function makeAccount(type = 'ORGANIZATION') {
  const id = domain.generateId();
  await db.query(
    `insert into accounts (id, account_type, display_name, status, created_at, updated_at)
     values ($1, $2, $3, 'ACTIVE', $4, $4)`,
    [id, type, `Account ${id.slice(0, 8)}`, at()],
  );
  return id;
}

async function makeMembership(accountId, userId) {
  const id = domain.generateId();
  await db.query(
    `insert into account_memberships (id, account_id, user_id, status, created_at, updated_at)
     values ($1, $2, $3, 'ACTIVE', $4, $4)`,
    [id, accountId, userId, at()],
  );
  return id;
}

await check('the built package exports the authentication surface', async () => {
  for (const need of [
    'hashPassword',
    'verifyPassword',
    'login',
    'setPassword',
    'issueSession',
    'resolveSession',
    'revokeSession',
    'authorize',
    'grantRole',
    'setCapabilityOverride',
  ]) {
    if (!(need in auth)) throw new Error(`built @pas/auth is missing ${need}`);
  }
});

// ── PAS-0202: password hashing and login ─────────────────────────────────

await check('a password hash verifies, and a wrong password does not', async () => {
  const hash = await auth.hashPassword('correct horse battery staple');
  if (!hash.startsWith('scrypt$')) throw new Error(`hash is not self-describing: ${hash.slice(0, 20)}`);
  if (!(await auth.verifyPassword('correct horse battery staple', hash))) {
    throw new Error('the correct password did not verify');
  }
  if (await auth.verifyPassword('wrong password', hash)) {
    throw new Error('a WRONG password verified');
  }
});

await check('two hashes of the same password differ — the salt is real', async () => {
  const a = await auth.hashPassword('the same long input password');
  const b = await auth.hashPassword('the same long input password');
  if (a === b) throw new Error('identical hashes: the salt is not random');
});

let loginUserId;
let loginEmail;

await check('login succeeds with the right password and issues a session', async () => {
  loginUserId = await makeUser();
  const row = await db.query(`select email from users where id = $1`, [loginUserId]);
  loginEmail = row.rows[0].email;

  await auth.setPassword(loginUserId, 'a-sufficiently-long-password');
  const result = await auth.login(loginEmail, 'a-sufficiently-long-password');

  if (!result.ok) throw new Error(`login failed: ${result.reason}`);
  if (result.userId !== loginUserId) throw new Error('login returned the wrong user');
  if (!result.session?.token) throw new Error('no session token issued');
});

await check('login fails with the wrong password', async () => {
  const result = await auth.login(loginEmail, 'not-the-password');
  if (result.ok) throw new Error('a WRONG password logged in');
  if (result.reason !== 'INVALID_CREDENTIALS') throw new Error(`unexpected reason: ${result.reason}`);
});

await check('login is case-folded on the address, as the unique index is', async () => {
  const result = await auth.login(loginEmail.toUpperCase(), 'a-sufficiently-long-password');
  if (!result.ok) throw new Error(`upper-case address failed to log in: ${result.reason}`);
});

await check('the stored credential is not the password', async () => {
  const { rows } = await db.query(
    `select password_hash from user_credentials where user_id = $1`,
    [loginUserId],
  );
  if (rows.length === 0) throw new Error('no credential row was written');
  if (rows[0].password_hash.includes('a-sufficiently-long-password')) {
    throw new Error('THE PASSWORD IS STORED IN PLAINTEXT');
  }
});

// ── PAS-0202: sessions ───────────────────────────────────────────────────

await check('a session resolves, and a revoked session does not', async () => {
  const userId = await makeUser();
  const issued = await auth.issueSession(userId);

  const live = await auth.resolveSession(issued.token);
  if (!live.ok) throw new Error(`a fresh session did not resolve: ${live.reason}`);
  if (live.session.userId !== userId) throw new Error('session resolved to the wrong user');

  await auth.revokeSession(issued.session.id, 'integration probe');
  const dead = await auth.resolveSession(issued.token);
  if (dead.ok) throw new Error('a REVOKED session still resolves');
});

await check('a forged token does not resolve', async () => {
  const forged = await auth.resolveSession(randomUUID() + randomUUID());
  if (forged.ok) throw new Error('a FORGED token resolved');
});

await check('the session token is not stored in recoverable form', async () => {
  const userId = await makeUser();
  const issued = await auth.issueSession(userId);
  const { rows } = await db.query(
    `select token_hash, encode(token_hash, 'escape') as as_text from sessions where id = $1`,
    [issued.session.id],
  );

  // Compare the BYTES, not a JSON rendering of them.
  //
  // The first version stringified the row and searched for the token. That can
  // never match: `token_hash` is bytea, so pg hands back a Buffer, and
  // JSON.stringify turns a Buffer into {"type":"Buffer","data":[...]} — a byte
  // array, never the ASCII token. A mutation that stored the raw token instead
  // of its digest passed this check unchanged. The assertion could not fail for
  // the reason it claimed, which on a credential-at-rest check is worse than
  // having no check: it reads as coverage.
  const stored = Buffer.from(rows[0].token_hash);
  if (stored.toString('utf8') === issued.token) {
    throw new Error('THE SESSION TOKEN IS STORED IN PLAINTEXT');
  }
  if (rows[0].as_text.includes(issued.token)) {
    throw new Error('THE SESSION TOKEN IS RECOVERABLE FROM THE STORED VALUE');
  }
  // SHA-256 is 32 bytes. A stored value the length of the token is the token.
  if (stored.length !== 32) {
    throw new Error(`token_hash is ${stored.length} bytes, not a 32-byte SHA-256 digest`);
  }
});

// ── PAS-0203 / PAS-0204: capabilities and authorization ──────────────────

await check('a membership with no role is denied', async () => {
  const userId = await makeUser();
  const accountId = await makeAccount();
  await makeMembership(accountId, userId);

  const decision = await auth.authorize(
    auth.actorForUser(userId),
    'authority.entity.create',
    auth.inAccount(accountId),
  );
  if (auth.isAllowed(decision)) throw new Error('a roleless membership was ALLOWED');
});

await check('granting OWNER allows what the role carries', async () => {
  const userId = await makeUser();
  const accountId = await makeAccount();
  const membershipId = await makeMembership(accountId, userId);
  await auth.grantRole(membershipId, 'OWNER');

  const decision = await auth.authorize(
    auth.actorForUser(userId),
    'authority.entity.create',
    auth.inAccount(accountId),
  );
  if (!auth.isAllowed(decision)) throw new Error(`OWNER was denied: ${decision.reason}`);
});

await check('an OWNER of one account is denied in another', async () => {
  // The bug that matters most in a multi-tenant system.
  const userId = await makeUser();
  const ownAccount = await makeAccount();
  const otherAccount = await makeAccount();
  const membershipId = await makeMembership(ownAccount, userId);
  await auth.grantRole(membershipId, 'OWNER');

  const decision = await auth.authorize(
    auth.actorForUser(userId),
    'authority.entity.create',
    auth.inAccount(otherAccount),
  );
  if (auth.isAllowed(decision)) throw new Error('CROSS-ACCOUNT ACCESS WAS ALLOWED');
});

await check('a DENY override beats the role that grants it', async () => {
  const userId = await makeUser();
  const accountId = await makeAccount();
  const membershipId = await makeMembership(accountId, userId);
  await auth.grantRole(membershipId, 'OWNER');
  await auth.setCapabilityOverride(
    membershipId,
    'authority.entity.create',
    'DENY',
    'integration probe',
  );

  const decision = await auth.authorize(
    auth.actorForUser(userId),
    'authority.entity.create',
    auth.inAccount(accountId),
  );
  if (auth.isAllowed(decision)) throw new Error('a DENY override was overruled by the role');
});

await check('an anonymous actor is denied', async () => {
  const accountId = await makeAccount();
  const decision = await auth.authorize(
    auth.ANONYMOUS,
    'authority.entity.create',
    auth.inAccount(accountId),
  );
  if (auth.isAllowed(decision)) throw new Error('ANONYMOUS was ALLOWED');
});

await check('a capability no role holds is denied even to an OWNER — INV-27', async () => {
  const unheld = auth.UNHELD_CAPABILITIES[0];
  const userId = await makeUser();
  const accountId = await makeAccount();
  const membershipId = await makeMembership(accountId, userId);
  await auth.grantRole(membershipId, 'OWNER');

  const decision = await auth.authorize(
    auth.actorForUser(userId),
    unheld,
    auth.inAccount(accountId),
  );
  if (auth.isAllowed(decision)) throw new Error(`the unheld capability ${unheld} was ALLOWED to an OWNER`);
});

await check('a suspended user is denied what their role would allow', async () => {
  const userId = await makeUser('SUSPENDED');
  const accountId = await makeAccount();
  const membershipId = await makeMembership(accountId, userId);
  await auth.grantRole(membershipId, 'OWNER');

  const decision = await auth.authorize(
    auth.actorForUser(userId),
    'authority.entity.create',
    auth.inAccount(accountId),
  );
  if (auth.isAllowed(decision)) throw new Error('a SUSPENDED user was ALLOWED');
});

await db.closePool();
process.stdout.write(JSON.stringify(out));
