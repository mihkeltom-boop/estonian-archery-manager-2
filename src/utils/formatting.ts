// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Special-case prefixes that should keep their casing pattern.
 * Key = lowercase prefix, value = correctly cased prefix.
 */
const NAME_PREFIXES: Record<string, string> = {
  "mc":  "Mc",
  "mac": "Mac",
  "o'":  "O'",
};

/**
 * Capitalize a single word, handling special cases:
 *  - McDonald, MacGregor  (prefix + capital)
 *  - O'Brien, O'Connor    (prefix + capital)
 *  - Regular words         (first letter upper, rest lower)
 */
function capitalizeWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();

  for (const [prefix, replacement] of Object.entries(NAME_PREFIXES)) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      const rest = word.slice(prefix.length);
      return replacement + rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase();
    }
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Capitalize each word in a name string.
 * Handles hyphenated names (Anna-Liisa) and special prefixes.
 *
 * Examples:
 *   "MARI MÄGI"       → "Mari Mägi"
 *   "mcdonald smith"   → "McDonald Smith"
 *   "o'brien"          → "O'Brien"
 *   "anna-liisa kask"  → "Anna-Liisa Kask"
 */
export function capitalizeWords(name: string): string {
  if (!name) return name;
  return name
    .split(/\s+/)
    .map(part =>
      part.includes('-')
        ? part.split('-').map(capitalizeWord).join('-')
        : capitalizeWord(part)
    )
    .join(' ');
}

/**
 * Format a number with locale-aware thousand separators.
 * e.g. 1234 → "1,234"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Normalize a date string to YYYY-MM-DD format.
 * Accepts DD.MM.YYYY (Estonian) or passes through if already ISO-like.
 */
export function formatDate(date: string): string {
  if (!date) return '';
  // DD.MM.YYYY → YYYY-MM-DD
  const dotParts = date.split('.');
  if (dotParts.length === 3 && dotParts[2].length === 4) {
    return `${dotParts[2]}-${dotParts[1].padStart(2, '0')}-${dotParts[0].padStart(2, '0')}`;
  }
  return date;
}
