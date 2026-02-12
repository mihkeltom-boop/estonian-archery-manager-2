import type { BowType, AgeClass, Gender, Correction } from '../types';
import { BOW_TRANSLATIONS, ESTONIAN_HEADERS } from '../constants/clubs';
import { getClubs } from './clubStore';
import { validateScore, getMaxScore } from './scoreValidation';
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
  method: 'exact-code' | 'exact-name' | 'fuzzy-stripped' | 'fuzzy-raw' | 'exact-code-embedded' | 'unknown';
}

export const matchClub = (input: string): ClubMatchResult => {
  if (!input) return { code: '', confidence: 0, method: 'unknown' };
  const clubs = getClubs(); // live list — includes user-added clubs
  const trimmed = input.trim();

  // Check for embedded club code at the start (e.g., "TLVK Tallinna Laskurvibuklubi")
  const words = trimmed.split(/\s+/);
  const firstWord = words[0]?.toUpperCase().trim();

  // Club codes are typically 2-5 characters
  if (firstWord && firstWord.length >= 2 && firstWord.length <= 5) {
    const codeMatch = clubs.find(c => c.code === firstWord);
    if (codeMatch) {
      return {
        code: codeMatch.code,
        confidence: 100,
        method: 'exact-code-embedded'
      };
    }
  }

  const exactCode = clubs.find(c => c.code.toLowerCase() === trimmed.toLowerCase());
  if (exactCode) return { code: exactCode.code, confidence: 100, method: 'exact-code' };

  const exactName = clubs.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (exactName) return { code: exactName.code, confidence: 100, method: 'exact-name' };

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
  const combined = `${ageField || ''} ${classField || ''}`.toUpperCase();

  // Match age class patterns (U21, U18, etc.)
  if (/U21/i.test(combined)) return 'U21';
  if (/U18/i.test(combined)) return 'U18';
  if (/U15/i.test(combined)) return 'U15';
  if (/U13/i.test(combined)) return 'U13';
  if (/\+60|\+70/i.test(combined)) return '+60';  // Normalize +70 to +60
  if (/\+50/i.test(combined)) return '+50';

  return 'Adult';
};

export const extractGender = (classField: string): Gender =>
  /naised|women/i.test(classField) ? 'Women' : 'Men';

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

          // Try multiple field names for Date (handle unmapped or case variations)
          const date = sanitize(
            row['Date'] || row['date'] || row['DATE'] ||
            row['Kuupäev'] || row['kuupäev'] || row['Aeg'] || ''
          );

          // Handle athlete name - can be in 2 columns (FirstName + FamilyName) or 1 column (Athlete)
          const firstName = sanitize(
            row['FirstName'] || row['Eesnimi'] || row['eesnimi'] ||
            row['First Name'] || row['first name'] || ''
          );
          const familyName = sanitize(
            row['FamilyName'] || row['Perekonnanimi'] || row['perekonnanimi'] ||
            row['Family Name'] || row['family name'] || row['Last Name'] || row['last name'] || ''
          );

          // If both first and family name exist, combine them; otherwise try single column
          const athlete = (firstName && familyName)
            ? `${firstName} ${familyName}`.trim()
            : sanitize(
                row['Athlete'] || row['athlete'] || row['ATHLETE'] ||
                row['Sportlane'] || row['sportlane'] || row['Nimi'] ||
                row['Name'] || row['name'] || firstName || familyName || ''
              );

          const clubRaw     = sanitize(row['Club'] || row['Klubi'] || row['klubi'] || '');
          const bowClass    = sanitize(row['Class'] || row['Bow Type'] || row['Vibu'] || '');
          const ageRaw      = sanitize(row['AgeClass'] || row['Age Class'] || row['Vanuserühm'] || '');
          const distRaw     = sanitize(row['Distance'] || row['Shooting Exercise'] || row['Distants'] || '');
          const normalizedDist = normalizeDistance(distRaw);
          const result      = parseInt(sanitize(row['Result'] || row['Tulemus'] || row['Points'] || '0')) || 0;
          const competition = sanitize(row['Competition'] || row['Võistlus'] || row['competition'] || '');
          const clubMatch   = matchClub(clubRaw);
          const bowType     = translateBowType(bowClass);
          const ts          = Date.now();
          const corrections: Correction[] = [];

          // Validate score against distance
          const scoreValidation = validateScore(result, normalizedDist);
          let needsReview = clubMatch.confidence < 90;

          if (!scoreValidation.valid && scoreValidation.maxScore) {
            corrections.push({
              field: 'Result',
              original: result.toString(),
              corrected: `Max ${scoreValidation.maxScore}`,
              method: 'extraction',
              confidence: 0,
              timestamp: ts
            });
            needsReview = true;
          }

          if (clubRaw && clubMatch.confidence < 100)
            corrections.push({ field: 'Club', original: clubRaw, corrected: clubMatch.code,
              method: 'fuzzy', confidence: clubMatch.confidence, timestamp: ts });
          const rawBow = bowClass.split(/\s+/)[0];
          if (rawBow && rawBow.toLowerCase() !== bowType.toLowerCase())
            corrections.push({ field: 'Bow Type', original: rawBow, corrected: bowType,
              method: 'translation', confidence: 100, timestamp: ts });
          return {
            _id: i + 1, Date: date, Athlete: athlete, Club: clubMatch.code,
            'Bow Type': bowType, 'Age Class': extractAgeClass(ageRaw, bowClass),
            Gender: extractGender(bowClass), 'Shooting Exercise': normalizedDist,
            Result: result, Competition: competition, _sourceFile: sourceFile,
            _corrections: corrections, _needsReview: needsReview,
            _confidence: clubMatch.confidence, _originalData: rawRow,
          };
        }));
      },
    });
  });
