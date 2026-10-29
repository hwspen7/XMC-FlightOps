import { describe, expect, it } from 'vitest';
import { CONTROLLER_TICKET_KEY, readSessionTicket, saveSessionTicket } from './controllerSession';

describe('Controller session storage', () => {
  it('preserves only the opaque ticket, not the pairing code', () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => { saved.set(key, value); },
      removeItem: (key: string) => { saved.delete(key); },
    };
    const ticket = 'A'.repeat(43);
    saveSessionTicket(storage, ticket);
    expect(readSessionTicket(storage)).toBe(ticket);
    expect(Array.from(saved.keys())).toEqual([CONTROLLER_TICKET_KEY]);
    saveSessionTicket(storage, 'not-a-ticket');
    expect(readSessionTicket(storage)).toBeNull();
  });
  it('never throws when browser storage is unavailable', () => {
    expect(readSessionTicket({ getItem: () => { throw Error('blocked'); } })).toBeNull();
    expect(() => saveSessionTicket({ setItem: () => { throw Error('blocked'); }, removeItem: () => { throw Error('blocked'); } }, 'A'.repeat(43))).not.toThrow();
  });
});
