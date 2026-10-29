// The browser origin is local HTTPS. The server enforces a 30-minute inactivity TTL.
export const CONTROLLER_TICKET_KEY = 'xmc.controller.session';

export function validSessionTicket(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function readSessionTicket(storage: Pick<Storage, 'getItem'>): string | null {
  try {
    const value = storage.getItem(CONTROLLER_TICKET_KEY);
    return validSessionTicket(value) ? value : null;
  } catch {
    return null; // Private browsing or restricted storage must not break flying.
  }
}

export function saveSessionTicket(storage: Pick<Storage, 'setItem' | 'removeItem'>, ticket: unknown): void {
  try {
    if (validSessionTicket(ticket)) storage.setItem(CONTROLLER_TICKET_KEY, ticket);
    else storage.removeItem(CONTROLLER_TICKET_KEY);
  } catch { /* A denied storage operation must not crash the controller. */ }
}
