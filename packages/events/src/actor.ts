/**
 * Who an audit entry or a domain event is attributed to.
 *
 * ── Why this is not `@pas/auth`'s `Actor` ────────────────────────────────
 *
 * There are two actor shapes in PAS and that is deliberate, not drift:
 *
 *   `@pas/auth`  Actor    = ANONYMOUS | USER
 *   `@pas/events` ActorRef = ANONYMOUS | USER | SYSTEM
 *
 * Authorization answers "may this request proceed", and a request always has
 * a requester — a person or nobody. There is no third case, and inventing one
 * would silently answer a question nobody has asked: *what would it mean to
 * authorize the dispatcher?* PAS-0204 refuses anonymous before touching the
 * database precisely because the set is closed.
 *
 * Attribution answers "who did this", and work with no human behind it — a
 * migration, a scheduled job, the outbox dispatcher — still has to be
 * attributable. **Especially** that work, because nobody is watching it.
 *
 * Collapsing them would force authorization to handle SYSTEM. Keeping them
 * apart costs one mapping at the boundary, which is the caller's and is
 * trivial: an authorization `Actor` is an `ActorRef` with `kind` read as
 * `type` and `userId` as `id`.
 *
 * What is **not** acceptable is a third shape. Audit (PAS-0301) and the event
 * envelope (PAS-0302) share this one.
 */

export type ActorType = 'USER' | 'SYSTEM' | 'ANONYMOUS';

export interface ActorRef {
  type: ActorType;
  /** Required for USER, forbidden otherwise. Enforced by callers and schema. */
  id?: string;
}

/** Whether an actor is internally consistent. */
export function isWellFormedActor(actor: unknown): actor is ActorRef {
  if (actor === null || typeof actor !== 'object') return false;
  const { type, id } = actor as ActorRef;
  if (type !== 'USER' && type !== 'SYSTEM' && type !== 'ANONYMOUS') return false;
  // A SYSTEM row carrying a user id reads, during an investigation, as that
  // user having done it.
  return type === 'USER' ? typeof id === 'string' && id.length > 0 : id === undefined;
}

/** The actor for work with no human behind it. */
export const SYSTEM_ACTOR: ActorRef = Object.freeze({ type: 'SYSTEM' as const });
