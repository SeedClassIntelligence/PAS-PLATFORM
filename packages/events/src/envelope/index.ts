/** PAS-0302 — Domain Event Envelope. */

export {
  type DomainEvent,
  type DomainEventInput,
  EVENT_TYPE_PATTERN,
} from './types.js';

export { createDomainEvent } from './create.js';
export { isDomainEvent, assertDomainEvent, isEventOfType } from './validate.js';
