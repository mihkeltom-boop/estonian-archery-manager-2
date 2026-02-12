// ── ENUMS ──────────────────────────────────────────────────────────────────

export type BowType = 'Recurve' | 'Compound' | 'Barebow' | 'Longbow';
export type AgeClass = 'Adult' | 'U21' | 'U18' | 'U15' | 'U13' | '+50' | '+60' | '+70';
export type Gender = 'Men' | 'Women';
export type Step = 'import' | 'review' | 'database';

// ── CORE RECORD ────────────────────────────────────────────────────────────

export interface Correction {
  field: string;
  original: string;
  corrected: string;
  method: 'exact' | 'fuzzy' | 'translation' | 'extraction';
  confidence: number;
  timestamp: number;
}

export interface CompetitionRecord {
  _id: number;
  Date: string;
  Athlete: string;
  Club: string;
  'Bow Type': BowType;
  'Age Class': AgeClass;
  Gender: Gender;
  'Shooting Exercise': string;
  Result: number;
  Competition: string;
  _sourceFile: string;
  _corrections: Correction[];
  _needsReview: boolean;
  _confidence: number;
  _originalData?: Record<string, string>;
}

// ── FILTER / SORT STATE ────────────────────────────────────────────────────

export interface FilterState {
  searchText: string;
  club: string;
  competition: string;
  bowType: string;
  ageClasses: string[];  // Changed from ageClass to support multiple
  genders: string[];     // Changed from gender to support multiple
  distance: string;
  sourceFile: string;
  seasonalBest: boolean;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

// ── FILE VALIDATION ────────────────────────────────────────────────────────

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// ── ATHLETE REGISTRY ───────────────────────────────────────────────────────

export type {
  Athlete,
  AthleteMatch,
  AthleteSuggestion,
  AgeGroupCategory
} from './athlete';
export { AGE_GROUP_CATEGORIES, getDisplayAgeGroup } from './athlete';
