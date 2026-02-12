import Papa from 'papaparse';
import { ESTONIAN_HEADERS, ESTONIAN_CLUBS, BOW_TRANSLATIONS } from '../constants/clubs';
import type { CompetitionRecord, BowType, AgeClass, Gender, Correction } from '../types';

// ── HELPERS ────────────────────────────────────────────────────────────────

export const sanitize = (v: unknown): string =>
  v == null ? '' : String(v).replace(/<[^>]*>/g, '').trim();

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

// ── CLUB MATCHING ──────────────────────────────────────────────────────────

export const matchClub = (input: string): { code: string; confidence: number } => {
  if (!input) return { code: '', confidence: 0 };

  // Exact code match
  const exact = ESTONIAN_CLUBS.find(c => c.code.toLowerCase() === input.toLowerCase());
  if (exact) return { code: exact.code, confidence: 100 };

  // Fuzzy match against both code and full name
  let best = ESTONIAN_CLUBS[0];
  let bestDist = Infinity;

  for (const club of ESTONIAN_CLUBS) {
    const d = Math.min(levenshtein(input, club.code), levenshtein(input, club.name));
    if (d < bestDist) { bestDist = d; best = club; }
  }

  const confidence = Math.max(
    0,
    Math.round((1 - bestDist / Math.max(input.length, best.code.length)) * 100)
  );

  return { code: best.code, confidence };
};

// ── BOW TYPE ───────────────────────────────────────────────────────────────

export const translateBowType = (raw: string): BowType => {
  if (!raw) return 'Recurve';
  const key = raw.trim().split(/\s+/)[0].toLowerCase();
  return BOW_TRANSLATIONS[key] ?? 'Recurve';
};

// ── AGE CLASS ──────────────────────────────────────────────────────────────

export const extractAgeClass = (ageField: string, classField: string): AgeClass => {
  const src = ageField || classField || '';
  const m = src.match(/U\d+|\+\d+/i);
  return (m ? m[0] : 'Adult') as AgeClass;
};

// ── GENDER ─────────────────────────────────────────────────────────────────

export const extractGender = (classField: string): Gender =>
  /naised|women/i.test(classField) ? 'Women' : 'Men';

// ── DISTANCE ──────────────────────────────────────────────────────────────

export const normalizeDistance = (d: string): string => {
  if (!d) return '';
  const s = d.trim();
  if (/^\d+$/.test(s)) return `${s}m`;
  if (/^\d+m$/i.test(s)) return s.toLowerCase();
  const twoX = s.match(/^2\s*[xX]\s*(\d+)/);
  return twoX ? `2x${twoX[1]}m` : s;
};

// ── HEADER NORMALISATION ───────────────────────────────────────────────────

const mapHeaders = (row: Record<string, string>): Record<string, string> => {
  const mapped: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const normalised = ESTONIAN_HEADERS[k] ?? k;
    mapped[normalised] = v;
  }
  return mapped;
};

// ── MAIN PARSE FUNCTION ────────────────────────────────────────────────────

export const parseCSVText = (
  text: string,
  sourceFile: string = ''
): Promise<CompetitionRecord[]> =>
  new Promise((resolve) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const records: CompetitionRecord[] = data.map((rawRow, i) => {
          const row = mapHeaders(rawRow);

          const date        = sanitize(row['Date'] || '');
          const athlete     = sanitize(row['Athlete'] || '');
          const clubRaw     = sanitize(row['Club'] || '');
          const bowClass    = sanitize(row['Class'] || row['Bow Type'] || '');
          const ageRaw      = sanitize(row['AgeClass'] || row['Age Class'] || '');
          const distRaw     = sanitize(row['Distance'] || row['Shooting Exercise'] || '');
          const resultRaw   = sanitize(row['Result'] || '0');
          const competition = sanitize(row['Competition'] || '');

          const clubMatch  = matchClub(clubRaw);
          const bowType    = translateBowType(bowClass);
          const ageClass   = extractAgeClass(ageRaw, bowClass);
          const gender     = extractGender(bowClass);
          const distance   = normalizeDistance(distRaw);
          const result     = parseInt(resultRaw) || 0;

          // Build correction audit trail
          const corrections: Correction[] = [];
          const ts = Date.now();

          if (clubRaw && clubMatch.confidence < 100) {
            corrections.push({
              field: 'Club',
              original: clubRaw,
              corrected: clubMatch.code,
              method: clubMatch.confidence === 100 ? 'exact' : 'fuzzy',
              confidence: clubMatch.confidence,
              timestamp: ts,
            });
          }

          const rawBow = bowClass.split(/\s+/)[0];
          if (rawBow && rawBow.toLowerCase() !== bowType.toLowerCase()) {
            corrections.push({
              field: 'Bow Type',
              original: rawBow,
              corrected: bowType,
              method: 'translation',
              confidence: 100,
              timestamp: ts,
            });
          }

          return {
            _id: i + 1,
            Date: date,
            Athlete: athlete,
            Club: clubMatch.code,
            'Bow Type': bowType,
            'Age Class': ageClass,
            Gender: gender,
            'Shooting Exercise': distance,
            Result: result,
            Competition: competition,
            _sourceFile: sourceFile,
            _corrections: corrections,
            _needsReview: clubMatch.confidence < 90,
            _confidence: clubMatch.confidence,
            _originalData: rawRow,
          };
        });

        resolve(records);
      },
    });
  });
