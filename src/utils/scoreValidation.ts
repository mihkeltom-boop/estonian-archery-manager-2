/**
 * Score validation based on archery distance rules
 * Each distance is worth 360 points maximum
 * Examples: 70m = 360, 2x70m = 720, 90m+70m+50m+30m = 1440
 */

/**
 * Parse distance string to extract number of arrows/rounds
 * Examples:
 * - "70m" → 1 distance → 360 max
 * - "2x70m" → 2 distances → 720 max
 * - "2x18m" → 2 distances → 720 max
 * - "90m+70m+50m+30m" → 4 distances → 1440 max
 * - "90m+70m" → 2 distances → 720 max
 */
export function parseDistanceCount(distance: string): number {
  if (!distance || typeof distance !== 'string') return 1;

  const normalized = distance.toLowerCase().trim();

  // Check for "Nx" format (e.g., "2x70m", "3x18m")
  const multiplierMatch = normalized.match(/^(\d+)x/);
  if (multiplierMatch) {
    return parseInt(multiplierMatch[1], 10);
  }

  // Check for "+" format (e.g., "90m+70m+50m+30m")
  const plusCount = (normalized.match(/\+/g) || []).length;
  if (plusCount > 0) {
    return plusCount + 1; // Number of "+" plus one
  }

  // Single distance (e.g., "70m", "18m")
  return 1;
}

/**
 * Calculate maximum possible score for a given distance
 * @param distance Distance string (e.g., "2x70m", "90m+70m+50m+30m")
 * @returns Maximum possible score (360 per distance)
 */
export function getMaxScore(distance: string): number {
  const distanceCount = parseDistanceCount(distance);
  return distanceCount * 360;
}

/**
 * Validate if a score is within the valid range for a distance
 * @param score The score to validate
 * @param distance The distance string
 * @returns Object with valid flag and error message if invalid
 */
export function validateScore(score: number, distance: string): { valid: boolean; error?: string; maxScore?: number } {
  if (typeof score !== 'number' || isNaN(score)) {
    return { valid: false, error: 'Score must be a valid number' };
  }

  if (score < 0) {
    return { valid: false, error: 'Score cannot be negative' };
  }

  const maxScore = getMaxScore(distance);

  if (score > maxScore) {
    return {
      valid: false,
      error: `Score ${score} exceeds maximum ${maxScore} for ${distance}`,
      maxScore
    };
  }

  return { valid: true };
}

/**
 * Check if a score is suspiciously high (>80% of max)
 * This doesn't make it invalid, just flags it for review
 */
export function isScoreSuspiciouslyHigh(score: number, distance: string): boolean {
  const maxScore = getMaxScore(distance);
  return score > maxScore * 0.8;
}
