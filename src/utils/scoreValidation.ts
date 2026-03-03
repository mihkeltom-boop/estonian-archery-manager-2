// ─────────────────────────────────────────────────────────────────────────────
// SCORE VALIDATION
//
// Validates competition scores against archery rules (360 points max per distance).
// Handles various distance formats: "70m", "2x70m", "90m+70m+50m+30m", etc.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_POINTS_PER_DISTANCE = 360; // 60 arrows × 6 points max

export interface ScoreValidationResult {
  valid: boolean;
  error?: string;
  maxScore?: number;
}

/**
 * Parse distance string to determine the number of distances shot.
 *
 * Examples:
 * - "70m" → 1
 * - "2x70m" → 2
 * - "90m+70m+50m+30m" → 4
 * - "2x90m+2x70m" → 4
 * - "18m" → 1
 *
 * @param distance The shooting exercise/distance string
 * @returns The number of distances (rounds) shot
 */
export const parseDistanceCount = (distance: string): number => {
  if (!distance) return 1; // Default to 1 distance if not specified

  const normalized = distance.trim().toLowerCase();

  // Check for "NxDm" format (e.g., "2x70m")
  const multiplierMatch = normalized.match(/^(\d+)\s*[xX×]\s*\d+m$/);
  if (multiplierMatch) {
    return parseInt(multiplierMatch[1], 10);
  }

  // Check for addition format (e.g., "90m+70m+50m+30m")
  if (normalized.includes('+')) {
    const parts = normalized.split('+');
    let totalDistances = 0;

    for (const part of parts) {
      const trimmedPart = part.trim();
      // Check if this part has a multiplier (e.g., "2x70m")
      const partMultiplier = trimmedPart.match(/^(\d+)\s*[xX×]\s*\d+m$/);
      if (partMultiplier) {
        totalDistances += parseInt(partMultiplier[1], 10);
      } else if (trimmedPart.match(/^\d+m$/)) {
        totalDistances += 1;
      }
    }

    return totalDistances > 0 ? totalDistances : 1;
  }

  // Single distance format (e.g., "70m", "18m")
  if (normalized.match(/^\d+m$/)) {
    return 1;
  }

  // If we can't parse it, default to 1 distance
  return 1;
};

/**
 * Calculate the maximum possible score for a given distance/shooting exercise.
 *
 * @param distance The shooting exercise/distance string
 * @returns The maximum possible score (360 points per distance)
 */
export const getMaxScore = (distance: string): number => {
  const distanceCount = parseDistanceCount(distance);
  return distanceCount * MAX_POINTS_PER_DISTANCE;
};

/**
 * Validate if a score is possible for the given distance.
 *
 * @param score The result/score to validate
 * @param distance The shooting exercise/distance string
 * @returns Validation result with validity flag, optional error message, and max score
 */
export const validateScore = (score: number, distance: string): ScoreValidationResult => {
  // Scores must be non-negative
  if (score < 0) {
    return {
      valid: false,
      error: 'Score cannot be negative',
      maxScore: getMaxScore(distance),
    };
  }

  const maxScore = getMaxScore(distance);

  // Check if score exceeds maximum possible
  if (score > maxScore) {
    return {
      valid: false,
      error: `Score ${score} exceeds maximum possible ${maxScore} for ${distance}`,
      maxScore,
    };
  }

  // Score is valid
  return {
    valid: true,
    maxScore,
  };
};

/**
 * Check if a score is suspiciously high (>90% of maximum).
 * Used to flag records that may need extra attention during review.
 *
 * @param score The result/score to check
 * @param distance The shooting exercise/distance string
 * @returns True if score is suspiciously high but still valid
 */
export const isSuspiciouslyHigh = (score: number, distance: string): boolean => {
  const maxScore = getMaxScore(distance);
  return score > maxScore * 0.9 && score <= maxScore;
};
