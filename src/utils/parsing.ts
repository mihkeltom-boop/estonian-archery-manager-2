import type { BowType, AgeClass, Gender, Correction } from '../types';
import { BOW_TRANSLATIONS, ESTONIAN_HEADERS } from '../constants/clubs';
import { getClubs } from './clubStore';
import { capitalizeWords, formatDate } from './formatting';
import { validateScore, isSuspiciouslyHigh } from './scoreValidation';
import Papa from 'papaparse';
import type { CompetitionRecord } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// TERM STRIPPING
// Words stripped before fuzzy matching so the algorithm focuses on the
// distinctive part of the name, not common suffixes shared by every club.
// Add more terms here as needed.
// ─────────────────────────────────────────────────────────────────────────────

export const STRIP_TERMS = [
  // Archery-specific suffixes
  'vibuklubi', 'vibukool', 'vibu',
  // Sports org suffixes
  'spordiklubi', 'spordikool', 'spordikeskus', 'spordiühing', 'sportklubi',
  // Generic club words
  'klubi', 'kool', 'ühing', 'selts', 'liit', 'rahvaspordiklubi', 'laskurvibuklubi',
  // Abbreviations often appended
  'sk',
];

export const stripNoiseTerms = (input: string): string => {
  if (!input) return '';
  // Short strings (codes) are never stripped
  if (input.length <= 5) return input.toLowerCase();
  let result = input.toLowerCase();
  for (const term of STRIP_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const stripped = result.replace(regex, '').replace(/\s+/g, ' ').trim();
    if (stripped.length > 2) result = stripped;
  }
  return result.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// LEVENSHTEIN
// ─────────────────────────────────────────────────────────────────────────────

export const levenshtein = (a: string, b: string): number => {
  a = a.toLowerCase(); b = b.toLowerCase();
  const dp: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) dp[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      dp[i][j] = a[j-1] === b[i-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
  return dp[b.length][a.length];
};

// ─────────────────────────────────────────────────────────────────────────────
// CLUB MATCHING
// Strategy: exact code → exact name → stripped fuzzy → raw fuzzy
// ─────────────────────────────────────────────────────────────────────────────

export interface ClubMatchResult {
  code: string;
  confidence: number;
  method: 'exact-code' | 'exact-name' | 'short-code' | 'fuzzy-stripped' | 'fuzzy-raw' | 'unknown';
}

export const matchClub = (input: string): ClubMatchResult => {
  if (!input) return { code: '', confidence: 0, method: 'unknown' };
  const clubs = getClubs(); // live list — includes user-added clubs
  const trimmed = input.trim();

  const exactCode = clubs.find(c => c.code.toLowerCase() === trimmed.toLowerCase());
  if (exactCode) return { code: exactCode.code, confidence: 100, method: 'exact-code' };

  const exactName = clubs.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (exactName) return { code: exactName.code, confidence: 100, method: 'exact-name' };

  // Check for 2-4 letter club shortened codes (auto-accept if unique prefix match)
  if (trimmed.length >= 2 && trimmed.length <= 4) {
    const prefixMatches = clubs.filter(c =>
      c.code.toLowerCase().startsWith(trimmed.toLowerCase())
    );
    if (prefixMatches.length === 1) {
      return { code: prefixMatches[0].code, confidence: 95, method: 'short-code' };
    }
  }

  const strippedInput = stripNoiseTerms(trimmed);
  let best: typeof clubs[0] | null = null;
  let bestDist = Infinity;

  for (const club of clubs) {
    const d = Math.min(
      levenshtein(strippedInput, stripNoiseTerms(club.code)),
      levenshtein(strippedInput, stripNoiseTerms(club.name)),
      levenshtein(trimmed, club.code),
      levenshtein(trimmed, club.name),
    );
    if (d < bestDist) { bestDist = d; best = club; }
  }

  if (best) {
    const maxLen = Math.max(strippedInput.length, best.code.length, 1);
    const confidence = Math.max(0, Math.round((1 - bestDist / maxLen) * 100));
    const method = strippedInput !== trimmed.toLowerCase() ? 'fuzzy-stripped' : 'fuzzy-raw';
    return { code: best.code, confidence, method };
  }

  return { code: trimmed, confidence: 0, method: 'unknown' };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const sanitize = (v: unknown): string =>
  v == null ? '' : String(v).replace(/<[^>]*>/g, '').trim();

export const translateBowType = (raw: string): BowType => {
  if (!raw) return 'Recurve';
  return BOW_TRANSLATIONS[raw.trim().split(/\s+/)[0].toLowerCase()] ?? 'Recurve';
};

export const extractAgeClass = (ageField: string, classField: string): AgeClass => {
  const m = (ageField || classField || '').match(/U\d+|\+\d+/i);
  return (m ? m[0] : 'Adult') as AgeClass;
};

export const extractGender = (genderField: string, classField: string): Gender => {
  if (genderField) {
    if (/naised|women|naine|female|^n$/i.test(genderField.trim())) return 'Women';
    if (/mehed|men|mees|male|^m$/i.test(genderField.trim())) return 'Men';
  }
  return /naised|women/i.test(classField) ? 'Women' : 'Men';
};

export const normalizeDistance = (d: string): string => {
  if (!d) return '';
  const s = d.trim();
  if (/^\d+$/.test(s)) return `${s}m`;
  if (/^\d+m$/i.test(s)) return s.toLowerCase();
  const t = s.match(/^2\s*[xX]\s*(\d+)/);
  return t ? `2x${t[1]}m` : s;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARSE
// ─────────────────────────────────────────────────────────────────────────────

const mapHeaders = (row: Record<string, string>): Record<string, string> => {
  const mapped: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) mapped[ESTONIAN_HEADERS[k] ?? k] = v;
  return mapped;
};

export const parseCSVText = (text: string, sourceFile = ''): Promise<CompetitionRecord[]> =>
  new Promise(resolve => {
    Papa.parse<Record<string, string>>(text, {
      header: true, skipEmptyLines: true,
      complete: ({ data }) => {
        resolve(data.map((rawRow, i) => {
          const row         = mapHeaders(rawRow);
          const date        = formatDate(sanitize(row['Date'] || ''));
          const athlete     = capitalizeWords(sanitize(row['Athlete'] || ''));
          const clubRaw     = sanitize(row['Club'] || '');
          const bowClass    = sanitize(row['Class'] || row['Bow Type'] || '');
          const genderRaw   = sanitize(row['Gender'] || '');
          const ageRaw      = sanitize(row['AgeClass'] || row['Age Class'] || '');
          const distRaw     = sanitize(row['Distance'] || row['Shooting Exercise'] || '');
          const result      = parseInt(sanitize(row['Result'] || '0')) || 0;
          const competition = sanitize(row['Competition'] || '');
          const clubMatch   = matchClub(clubRaw);
          const bowType     = translateBowType(bowClass);
          const distance    = normalizeDistance(distRaw);
          const ts          = Date.now();
          const corrections: Correction[] = [];

          // Club matching corrections
          if (clubRaw && clubMatch.confidence < 100)
            corrections.push({ field: 'Club', original: clubRaw, corrected: clubMatch.code,
              method: 'fuzzy', confidence: clubMatch.confidence, timestamp: ts });

          // Bow type translation corrections
          const rawBow = bowClass.split(/\s+/)[0];
          if (rawBow && rawBow.toLowerCase() !== bowType.toLowerCase())
            corrections.push({ field: 'Bow Type', original: rawBow, corrected: bowType,
              method: 'translation', confidence: 100, timestamp: ts });

          // Score validation
          const scoreValidation = validateScore(result, distance);
          let needsReview = clubMatch.confidence < 90;

          if (!scoreValidation.valid) {
            corrections.push({
              field: 'Result',
              original: String(result),
              corrected: scoreValidation.error || 'Invalid score',
              method: 'validation',
              confidence: 0,
              timestamp: ts,
            });
            needsReview = true;
          } else if (result > 0 && isSuspiciouslyHigh(result, distance)) {
            // Flag suspiciously high scores for review (but don't block them)
            corrections.push({
              field: 'Result',
              original: String(result),
              corrected: `High score (max: ${scoreValidation.maxScore})`,
              method: 'validation',
              confidence: 75,
              timestamp: ts,
            });
            needsReview = true;
          }

          return {
            _id: i + 1, Date: date, Athlete: athlete, Club: clubMatch.code,
            'Bow Type': bowType, 'Age Class': extractAgeClass(ageRaw, bowClass),
            Gender: extractGender(genderRaw, bowClass), 'Shooting Exercise': distance,
            Result: result, Competition: competition, _sourceFile: sourceFile,
            _corrections: corrections, _needsReview: needsReview,
            _confidence: clubMatch.confidence, _originalData: rawRow,
          };
        }));
      },
    });
  });
