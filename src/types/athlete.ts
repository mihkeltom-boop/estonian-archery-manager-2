/**
 * Athlete registry types for tracking consistent athlete data
 */

export interface Athlete {
  /** Unique identifier for the athlete */
  id: string;

  /** First name */
  firstName: string;

  /** Last name */
  lastName: string;

  /** Full name for display */
  fullName: string;

  /** Primary club (most recent) */
  club: string;

  /** All clubs the athlete has competed for */
  clubs: Set<string>;

  /** Competition classes competed in */
  competitionClasses: Set<string>;

  /** Age groups by year: Map<year, Set<ageGroup>> */
  ageGroupsByYear: Map<number, Set<string>>;

  /** First seen date */
  firstSeen: Date;

  /** Last seen date */
  lastSeen: Date;
}

export interface AthleteMatch {
  /** The matched athlete */
  athlete: Athlete;

  /** Similarity score (0 = exact match, 1 = 1 letter difference) */
  distance: number;

  /** Type of match */
  matchType: 'exact' | 'typo' | 'similar';
}

export interface AthleteSuggestion {
  /** Original name from CSV */
  originalName: string;

  /** Suggested athlete match */
  match: AthleteMatch;

  /** Whether user accepted the suggestion */
  accepted?: boolean;

  /** User's choice: 'accept' | 'reject' | 'pending' */
  status: 'pending' | 'accepted' | 'rejected';
}

/**
 * Age group categories for determining real age class
 */
export const AGE_GROUP_CATEGORIES = {
  youth: ['U13', 'U15', 'U18', 'U21'],
  senior: ['Adult', 'Senior', 'Masters', 'Masters 50+', 'Masters 60+', 'Masters 70+']
} as const;

export type AgeGroupCategory = keyof typeof AGE_GROUP_CATEGORIES;

/**
 * Get the display age group for an athlete
 * - For youth: return youngest age group
 * - For senior: return oldest age group
 */
export function getDisplayAgeGroup(
  ageGroups: Set<string>,
  category: AgeGroupCategory
): string | null {
  const categoryGroups = AGE_GROUP_CATEGORIES[category] as readonly string[];
  const athleteGroups = Array.from(ageGroups).filter(ag =>
    (categoryGroups as string[]).includes(ag)
  );

  if (athleteGroups.length === 0) return null;

  if (category === 'youth') {
    // Return youngest (earliest in the list)
    for (const group of categoryGroups) {
      if (athleteGroups.includes(group)) return group;
    }
  } else {
    // Return oldest (latest in the list)
    for (let i = categoryGroups.length - 1; i >= 0; i--) {
      if (athleteGroups.includes(categoryGroups[i])) return categoryGroups[i];
    }
  }

  return null;
}
