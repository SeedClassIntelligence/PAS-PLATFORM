/**
 * `@pas/events` — audit ledger, domain event envelope, event ledger and the
 * transactional outbox (PAS-0301…0304).
 *
 * Implemented: PAS-0301, PAS-0302.
 */

export {
  type ActorType,
  type ActorRef,
  isWellFormedActor,
  SYSTEM_ACTOR,
} from './actor.js';

export * from './audit/index.js';
export * from './envelope/index.js';
