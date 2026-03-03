// ─────────────────────────────────────────────────────────────────────────────
// CLUB STORE
//
// Runtime manager for the clubs list.
// Built-in clubs come from constants/clubs.ts (single source of truth).
// Users can add their own clubs, persisted to localStorage.
// ─────────────────────────────────────────────────────────────────────────────

import { ESTONIAN_CLUBS } from '../constants/clubs';

export interface Club {
  code: string;
  name: string;
  userAdded?: boolean;
}

const STORAGE_KEY = 'archery_clubs_v3';

const BUILT_IN_CLUBS: Club[] = ESTONIAN_CLUBS.map(c => ({ code: c.code, name: c.name }));

// ── Internal state ────────────────────────────────────────────────────────────

let _clubs: Club[] = loadFromStorage();
let _listeners: Array<() => void> = [];

function loadFromStorage(): Club[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...BUILT_IN_CLUBS];
    const stored: Club[] = JSON.parse(raw);
    // Merge: built-ins first (preserved), then any user-added ones
    const codes = new Set(stored.map(c => c.code));
    const missing = BUILT_IN_CLUBS.filter(c => !codes.has(c.code));
    return [...missing, ...stored];
  } catch {
    return [...BUILT_IN_CLUBS];
  }
}

function saveToStorage(clubs: Club[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clubs));
  } catch {
    // localStorage may be unavailable in some environments
  }
}

function notify() {
  _listeners.forEach(fn => fn());
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get the current full clubs list */
export const getClubs = (): Club[] => _clubs;

/** Subscribe to club list changes — returns unsubscribe fn */
export const subscribeToClubs = (fn: () => void): (() => void) => {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
};

/**
 * Add a new club to the list.
 * If code already exists, returns false (no-op).
 * The new club is persisted and immediately available for fuzzy matching.
 */
export const addClub = (code: string, name: string): boolean => {
  const trimCode = code.trim().toUpperCase();
  const trimName = name.trim();
  if (!trimCode || !trimName) return false;
  if (_clubs.some(c => c.code === trimCode)) return false;
  _clubs = [..._clubs, { code: trimCode, name: trimName, userAdded: true }];
  saveToStorage(_clubs);
  notify();
  return true;
};

/** Remove a user-added club (built-in clubs cannot be removed) */
export const removeClub = (code: string): boolean => {
  const club = _clubs.find(c => c.code === code);
  if (!club || !club.userAdded) return false;
  _clubs = _clubs.filter(c => c.code !== code);
  saveToStorage(_clubs);
  notify();
  return true;
};

/**
 * Get autocomplete suggestions for a partial input string.
 * Searches both code and name, case-insensitive.
 * Returns up to `limit` matches, sorted: exact prefix first, then contains.
 */
export const getClubSuggestions = (input: string, limit = 8): Club[] => {
  if (!input.trim()) return _clubs.slice(0, limit);
  const q = input.toLowerCase();
  const prefixMatch = _clubs.filter(
    c => c.code.toLowerCase().startsWith(q) || c.name.toLowerCase().startsWith(q)
  );
  const containsMatch = _clubs.filter(
    c =>
      !prefixMatch.includes(c) &&
      (c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  );
  return [...prefixMatch, ...containsMatch].slice(0, limit);
};

/** Reset to built-in clubs only (removes all user-added) */
export const resetClubs = (): void => {
  _clubs = [...BUILT_IN_CLUBS];
  saveToStorage(_clubs);
  notify();
};
