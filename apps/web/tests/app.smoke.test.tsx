/**
 * PAS-0001 non-regression smoke test.
 *
 * Proves the preserved frontend still mounts and renders each of the four
 * PASEnvironment surfaces after the structural move into apps/web.
 *
 * This asserts behavioral continuity of the migrated baseline. It does NOT
 * assert that the prototype's behavior is correct — CONF-A, SUP-13 and the
 * other recorded findings remain open and are addressed by their own tickets.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import App from '../src/App';
import { usePASStore } from '../src/store/usePASStore';

const initial = usePASStore.getState();

beforeEach(() => usePASStore.setState(initial, true));
afterEach(cleanup);

describe('PAS frontend baseline', () => {
  it('mounts the authenticated OS shell', () => {
    render(<App />);
    expect(screen.getByText('PAS PLATFORM OS')).toBeDefined();
  });

  it('renders every PASEnvironment without throwing', () => {
    for (const env of [
      'PUBLIC_PLATFORM',
      'AUTHENTICATED_APP',
      'PUBLISHED_PERSONAL_PAS',
      'PUBLISHED_BPAS',
    ] as const) {
      usePASStore.setState({ environment: env });
      expect(() => render(<App />)).not.toThrow();
      cleanup();
    }
  });

  it('preserves the seeded authority record shape', () => {
    const s = usePASStore.getState();
    expect(s.authorityObjects).toHaveLength(5);
    expect(s.modules).toHaveLength(8);
    expect(s.dossiers).toHaveLength(10);
  });
});
