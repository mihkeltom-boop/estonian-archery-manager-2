/**
 * Text formatting utilities
 */

/**
 * Capitalizes the first letter of each word in a name
 * @example "mari mägi" → "Mari Mägi"
 * @example "JOHN DOE" → "John Doe"
 * @example "võsu-järvi" → "Võsu-Järvi"
 */
export function capitalizeName(name: string): string {
  if (!name) return name;

  return name
    .split(/(\s+|-)/) // Split on spaces and hyphens but keep delimiters
    .map((part, idx) => {
      // Keep delimiters as-is
      if (part.match(/^\s+$/) || part === '-') return part;

      // Capitalize first letter, lowercase the rest
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}
