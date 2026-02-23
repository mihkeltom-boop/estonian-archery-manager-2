import type { BowType, AgeClass, Gender } from '../types';

// ── DISTANCE PARSER ────────────────────────────────────────────────────────────

/**
 * Parses a normalised exercise string into an ordered list of distances in metres.
 * Handles: "18m", "2x18m", "70m", "90m+70m+50m+30m", "2x90m+2x70m"
 */
function parseDistances(exercise: string): number[] {
  if (!exercise) return [];
  const out: number[] = [];
  for (const part of exercise.toLowerCase().split('+')) {
    const multi  = part.trim().match(/^(\d+)x(\d+)m?$/);
    const simple = part.trim().match(/^(\d+)m?$/);
    if (multi)       { const n = parseInt(multi[1], 10); for (let i = 0; i < n; i++) out.push(parseInt(multi[2], 10)); }
    else if (simple) { out.push(parseInt(simple[1], 10)); }
  }
  return out;
}

// ── SINGLE-DISTANCE LOOKUP ─────────────────────────────────────────────────────

/**
 * Returns the WA target face size for one distance component within a round.
 *
 * Key rules:
 *  • 18m indoor: Compound → 40cm; Recurve/BB/LB U13/U15 → 60cm; U18+ → 40cm
 *  • 25m indoor: all types/ages → 60cm
 *  • Outdoor Compound: always 80cm (6-ring face)
 *  • Outdoor Barebow:  always 122cm
 *  • Outdoor Recurve/Longbow ≥ 60m: 122cm
 *  • Outdoor Recurve/Longbow < 60m: 80cm, EXCEPT in a multi-distance round where this
 *    distance falls at position 0 or 1 (1st/2nd distance) AND it is 50m AND the archer
 *    is U18 or Master Women → 122cm (WA 1440-round exception: those groups shoot 50m as
 *    their 2nd-longest distance, not their 3rd, so the face stays at 122cm).
 */
function faceForDistance(
  bow: BowType,
  age: AgeClass,
  gender: Gender,
  distanceM: number,
  roundIndex: number,
  isMultiRound: boolean,
): string {
  // ── Indoor 18m ──────────────────────────────────────────────────────────────
  if (distanceM === 18) {
    if (bow === 'Compound') return '40cm';
    return (age === 'U13' || age === 'U15') ? '60cm' : '40cm';
  }

  // ── Indoor 25m ──────────────────────────────────────────────────────────────
  if (distanceM === 25) return '60cm';

  // ── Outdoor ─────────────────────────────────────────────────────────────────
  if (bow === 'Compound') return '80cm';   // compound always 80cm (6-ring) outdoors
  if (bow === 'Barebow')  return '122cm';  // barebow always 122cm outdoors

  // Recurve / Longbow outdoor
  if (distanceM >= 60) return '122cm';    // 60m, 70m, 90m

  // 50m exception: U18 Women and Master Women in a 1440-style multi-distance round
  // shoot 50m as their 2nd-longest distance → face stays at 122cm
  if (
    distanceM === 50 &&
    isMultiRound &&
    roundIndex < 2 &&
    gender === 'Women' &&
    (age === 'U18' || age === '+50' || age === '+60' || age === '+70')
  ) return '122cm';

  return '80cm'; // all other outdoor distances (50m, 40m, 30m)
}

// ── PUBLIC API ─────────────────────────────────────────────────────────────────

/**
 * Returns the WA target face size(s) for a competition record.
 *
 * Examples:
 *   Recurve Adult Men  "70m"                  → "122cm"
 *   Compound Adult     "50m"                  → "80cm"
 *   Recurve Adult Men  "90m+70m+50m+30m"      → "122cm + 122cm + 80cm + 80cm"
 *   Recurve U18 Women  "60m+50m+40m+30m"      → "122cm + 122cm + 80cm + 80cm"
 *   Recurve Adult Men  "2x18m"                → "40cm"
 *   Recurve U15 Any    "18m"                  → "60cm"
 *
 * Returns "" if the exercise string cannot be parsed.
 */
export function getTargetFace(
  bowType: BowType,
  ageClass: AgeClass,
  gender: Gender,
  exercise: string,
): string {
  const distances = parseDistances(exercise);
  if (distances.length === 0) return '';

  const isMultiRound = distances.length > 1;
  const faces = distances.map((d, i) =>
    faceForDistance(bowType, ageClass, gender, d, i, isMultiRound),
  );

  // If all components use the same face, collapse to a single value
  const unique = [...new Set(faces)];
  return unique.length === 1 ? unique[0] : faces.join(' + ');
}
