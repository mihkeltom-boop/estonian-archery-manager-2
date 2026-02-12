/**
 * Athlete registry for tracking consistent athlete data and detecting name typos
 */

import type { Athlete, AthleteMatch, CompetitionRecord } from '../types';

/**
 * Calculate Levenshtein distance between two strings
 * Used for detecting typos (1 letter difference)
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize name for comparison (lowercase, remove extra spaces)
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Create athlete ID from name
 */
export function createAthleteId(firstName: string, lastName: string): string {
  const normalized = normalizeName(`${firstName} ${lastName}`);
  return normalized.replace(/\s+/g, '-');
}

/**
 * Extract first and last name from full name
 */
export function parseAthleteName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * Athlete Registry Manager
 */
export class AthleteRegistry {
  private athletes: Map<string, Athlete> = new Map();

  /**
   * Find athlete by exact name match
   */
  findExact(firstName: string, lastName: string): Athlete | null {
    const id = createAthleteId(firstName, lastName);
    return this.athletes.get(id) || null;
  }

  /**
   * Find athletes with similar names (Levenshtein distance <= maxDistance)
   */
  findSimilar(firstName: string, lastName: string, maxDistance: number = 1): AthleteMatch[] {
    const normalizedFirst = normalizeName(firstName);
    const normalizedLast = normalizeName(lastName);
    const matches: AthleteMatch[] = [];

    for (const athlete of this.athletes.values()) {
      const athleteFirst = normalizeName(athlete.firstName);
      const athleteLast = normalizeName(athlete.lastName);

      // Calculate distance for first and last names separately
      const firstDistance = levenshteinDistance(normalizedFirst, athleteFirst);
      const lastDistance = levenshteinDistance(normalizedLast, athleteLast);

      // Total distance is sum of both
      const totalDistance = firstDistance + lastDistance;

      // Check if within threshold
      if (totalDistance > 0 && totalDistance <= maxDistance) {
        const matchType = totalDistance === 0 ? 'exact' : totalDistance <= 1 ? 'typo' : 'similar';
        matches.push({
          athlete,
          distance: totalDistance,
          matchType
        });
      }
    }

    // Sort by distance (closest first)
    return matches.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Find best match (exact or typo)
   */
  findBestMatch(firstName: string, lastName: string): AthleteMatch | null {
    // Check exact match first
    const exact = this.findExact(firstName, lastName);
    if (exact) {
      return { athlete: exact, distance: 0, matchType: 'exact' };
    }

    // Check for typos (distance = 1)
    const similar = this.findSimilar(firstName, lastName, 1);
    return similar[0] || null;
  }

  /**
   * Add or update athlete from a competition record
   */
  addOrUpdateFromRecord(record: CompetitionRecord): Athlete {
    const { firstName, lastName } = parseAthleteName(record.Athlete);
    const id = createAthleteId(firstName, lastName);

    // Extract year from date
    const year = new Date(record.Date).getFullYear();

    // Get or create athlete
    let athlete = this.athletes.get(id);
    if (!athlete) {
      athlete = {
        id,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        club: record.Club,
        clubs: new Set([record.Club]),
        competitionClasses: new Set([record['Bow Type']]),
        ageGroupsByYear: new Map([[year, new Set([record['Age Class']])]]),
        firstSeen: new Date(record.Date),
        lastSeen: new Date(record.Date)
      };
      this.athletes.set(id, athlete);
    } else {
      // Update existing athlete
      athlete.club = record.Club; // Most recent club
      athlete.clubs.add(record.Club);
      athlete.competitionClasses.add(record['Bow Type']);

      // Update age groups for this year
      const yearGroups = athlete.ageGroupsByYear.get(year) || new Set();
      yearGroups.add(record['Age Class']);
      athlete.ageGroupsByYear.set(year, yearGroups);

      // Update dates
      const recordDate = new Date(record.Date);
      if (recordDate < athlete.firstSeen) athlete.firstSeen = recordDate;
      if (recordDate > athlete.lastSeen) athlete.lastSeen = recordDate;
    }

    return athlete;
  }

  /**
   * Get all athletes
   */
  getAll(): Athlete[] {
    return Array.from(this.athletes.values());
  }

  /**
   * Get athlete count
   */
  count(): number {
    return this.athletes.size;
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.athletes.clear();
  }

  /**
   * Merge athlete data (use when user confirms typo correction)
   */
  mergeAthletes(sourceId: string, targetId: string): void {
    const source = this.athletes.get(sourceId);
    const target = this.athletes.get(targetId);

    if (!source || !target) return;

    // Merge clubs
    source.clubs.forEach(club => target.clubs.add(club));

    // Merge competition classes
    source.competitionClasses.forEach(cc => target.competitionClasses.add(cc));

    // Merge age groups by year
    source.ageGroupsByYear.forEach((groups, year) => {
      const targetGroups = target.ageGroupsByYear.get(year) || new Set();
      groups.forEach(g => targetGroups.add(g));
      target.ageGroupsByYear.set(year, targetGroups);
    });

    // Update dates
    if (source.firstSeen < target.firstSeen) target.firstSeen = source.firstSeen;
    if (source.lastSeen > target.lastSeen) target.lastSeen = source.lastSeen;

    // Remove source athlete
    this.athletes.delete(sourceId);
  }
}
