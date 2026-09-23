/**
 * Exercises the BUILT event ledger in a child process.
 *
 * Deliberately a separate process rather than an in-test import: `@pas/events`
 * and `@pas/database` resolve their configuration once, at module load, from
 * the environment. Importing them inside the test file would bind them to the
 * suite's own `PAS_DATABASE_URL` and quietly ignore the scratch database this
 * test creates — which is precisely the class of "green test, wrong target"
 * this file exists to rule out.
 *
 * Prints one JSON line per check. The test asserts on that, so a failure names
 * the behaviour that broke rather than a process exit code.
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = process.argv[2];
const dist = (p) => pathToFileURL(join(ROOT, 'packages', p, 'dist/index.js')).href;

const db = await import(dist('database'));
const events = await import(dist('events'));

const out = [];
const check = async (name, fn) => {
  try {
    await fn();
    out.push({ name, ok: true });
  } catch (e) {
    out.push({ name, ok: false, error: e.message });
  }
};
const refuses = (name, fn) =>
  check(name, async () => {
    let threw = false;
    try {
      await fn();
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('it was ALLOWED');
  });

const mk = (over = {}) =>
  events.createDomainEvent({
    eventType: 'ClaimApproved',
    aggregateType: 'claim',
    aggregateId: 'claim-1',
    actor: { type: 'SYSTEM' },
    payload: { claimId: 'claim-1' },
    ...over,
  });

await check('the built package exports the ledger surface', async () => {
  for (const need of [
    'appendDomainEvent',
    'emitWithin',
    'readDomainEvents',
    'readAggregateStream',
    'createDomainEvent',
    'recordAuditEntry',
  ]) {
    if (!(need in events)) throw new Error(`built @pas/events is missing ${need}`);
  }
});

await check('append, then read back through the built read path', async () => {
  const e = await events.appendDomainEvent(mk());
  const rows = await events.readDomainEvents();
  if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}`);
  if (rows[0].event.eventId !== e.eventId) throw new Error('round trip lost the event id');
  if (rows[0].event.payload.claimId !== 'claim-1') throw new Error('round trip lost the payload');
  if (typeof rows[0].sequence !== 'bigint') throw new Error('sequence is not a bigint');
});

await refuses('UPDATE of a historical event', () =>
  db.query(`update domain_events set event_type = 'Tampered'`),
);

await refuses('DELETE of a historical event', () => db.query(`delete from domain_events`));

await refuses('an appended payload carrying a credential', () =>
  events.appendDomainEvent(mk({ payload: { token: `eyJ${'x'.repeat(40)}` } })),
);

await check('a rolled-back mutation leaves no event — Part I §5', async () => {
  await db.query(`create table if not exists probe_claims (id text primary key)`);
  await db.query(`truncate probe_claims`);
  const before = (await events.readDomainEvents()).length;
  try {
    await db.withTransaction(async (client) => {
      await db.query(`insert into probe_claims (id) values ('c9')`, [], { client });
      await events.emitWithin(client, {
        eventType: 'ClaimApproved',
        aggregateType: 'claim',
        aggregateId: 'c9',
        actor: { type: 'SYSTEM' },
        payload: { claimId: 'c9' },
      });
      throw new Error('deliberate rollback');
    });
  } catch {
    /* expected */
  }
  const claims = await db.query(`select 1 from probe_claims`);
  if (claims.rows.length !== 0) throw new Error('the mutation survived the rollback');
  const after = (await events.readDomainEvents()).length;
  if (after !== before) throw new Error(`the event survived the rollback: ${before} -> ${after}`);
});

await check('an aggregate stream replays in sequence order', async () => {
  await db.query('truncate table domain_events');
  for (let i = 0; i < 25; i += 1) {
    await events.appendDomainEvent(mk({ payload: { n: i } }));
  }
  const stream = await events.readAggregateStream('claim', 'claim-1');
  const ns = stream.map((s) => s.event.payload.n);
  if (ns.length !== 25) throw new Error(`lost events: ${ns.length} of 25`);
  const sorted = [...ns].sort((a, b) => a - b);
  if (JSON.stringify(ns) !== JSON.stringify(sorted)) throw new Error(`out of order: ${ns}`);
});

await refuses('a SYSTEM row carrying a user id, written past the service', () =>
  db.query(
    `insert into domain_events
       (event_id, event_type, schema_version, aggregate_type, aggregate_id,
        actor_type, actor_id, payload, occurred_at, recorded_at)
     values (gen_random_uuid(), 'ClaimApproved', 1, 'probe', 'x', 'SYSTEM',
             '00000000-0000-4000-8000-000000000001', '{}'::jsonb, now(), now())`,
  ),
);

await db.closePool();
process.stdout.write(JSON.stringify(out));
