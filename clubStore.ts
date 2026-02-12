// ─────────────────────────────────────────────────────────────────────────────
// CLUB STORE
//
// Single source of truth for the acceptable clubs list.
// Ships with the 19 built-in Estonian clubs, but users can add their own.
// Persisted to localStorage so additions survive page refreshes.
// ─────────────────────────────────────────────────────────────────────────────

export interface Club {
  code: string;
  name: string;
  userAdded?: boolean;
}

const STORAGE_KEY = 'archery_clubs_v2';

const BUILT_IN_CLUBS: Club[] = [
  { code: 'TLVK', name: 'Tallinna Laskurvibuklubi' },
  { code: 'VVVK', name: 'Viljandi Vibukool' },
  { code: 'SAG',  name: 'Tallinna SK' },
  { code: 'TVSK', name: 'Tapa' },
  { code: 'JVI',  name: 'Jõhvi' },
  { code: 'PVM',  name: 'Põlva-Võru-Maardu' },
  { code: 'KSK',  name: 'Keila SK' },
  { code: 'SJK',  name: 'Sindi Jõuklubi' },
  { code: 'STR',  name: 'Silla-Tare Rahvaspordiklubi' },
  { code: 'MAG',  name: 'Margus' },
  { code: 'TYRI', name: 'Türi SK' },
  { code: 'BH',   name: 'BH Fitness' },
  { code: 'KVK',  name: 'Kiili Vibukool' },
  { code: 'LVL',  name: 'Laulasmaa VK' },
  { code: 'VVK',  name: 'Valga Vibukool' },
  { code: 'SVK',  name: 'Saku Vibukool' },
  { code: 'TL',   name: 'Tiit Laasberg' },
  { code: 'AMA',  name: 'Amatöör' },
  { code: 'NS',   name: 'NS' },
];

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
