import type { EventState } from '@fairdraw/core';

const STORE_KEY = 'fairdraw-v1';

export function loadPersisted(): unknown | null {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function savePersisted(state: EventState): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/** Detects another browser tab overwriting the same localStorage slot mid-event, so we never silently double-draw. */
export function watchForeignChange(getState: () => EventState, onForeignChange: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== STORE_KEY || !e.newValue) return;
    try {
      const other = JSON.parse(e.newValue) as { eventId?: string; revision?: number };
      const state = getState();
      if (other.eventId !== state.eventId || other.revision !== state.revision) onForeignChange();
    } catch {
      /* ignore malformed foreign writes; they don't affect our own state */
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
