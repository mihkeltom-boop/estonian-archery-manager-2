// ── LEADERBOARD LAYOUT CONFIG ───────────────────────────────────────────────
//
// This file defines which categories appear in the leaderboard and in what
// order, and which distances are shown inside each category.
//
// EDITING GUIDE:
//   - Add/remove distances from a category's `distances` array to change what
//     appears in that section.
//   - `key` must exactly match the 'Shooting Exercise' value stored in data.json.
//   - `label` is the display name shown in the UI (can differ from key).
//   - Categories with no matching records in the selected year are hidden.
//   - Distances with no matching records are also hidden.
//
// ORDER RULES (enforced by array order):
//   1. Age:    Adult → U21 → U18 → U15 → U13 → +50 → +60 → +70
//   2. Gender: Women → Men  (within each age)
//   3. Bow:    Recurve → Compound → Barebow → Longbow  (within each gender)

import type { AgeClass, BowType, Gender } from '../types';

export interface DistanceConfig {
  key: string;    // Exact 'Shooting Exercise' value in data
  label: string;  // Display label shown to the user
}

export interface CategoryConfig {
  ageClass: AgeClass;
  gender: Gender;
  bowType: BowType;
  distances: DistanceConfig[];
}

// ── SHARED DISTANCE SETS ────────────────────────────────────────────────────

const RECURVE_OUTDOOR: DistanceConfig[] = [
  { key: '90m+70m+50m+30m', label: '1440' },
  { key: '2x90m+2x70m',     label: '2x90m+2x70m' },
  { key: '90m',              label: '90m' },
  { key: '2x70m',            label: '2x70m' },
  { key: '70m',              label: '70m' },
  { key: '50m',              label: '50m' },
  { key: '30m',              label: '30m' },
];

const RECURVE_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m' },
  { key: '18m',   label: '18m' },
  { key: '2x25m', label: '2x25m' },
  { key: '25m',   label: '25m' },
];

const RECURVE_ALL: DistanceConfig[] = [
  ...RECURVE_INDOOR,
  ...RECURVE_OUTDOOR,
];

const COMPOUND_OUTDOOR: DistanceConfig[] = [
  { key: '50m+30m+50m+30m', label: '1440 Compound' },
  { key: '2x50m',            label: '2x50m' },
  { key: '50m',              label: '50m' },
  { key: '30m',              label: '30m' },
];

const COMPOUND_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m' },
  { key: '18m',   label: '18m' },
  { key: '2x25m', label: '2x25m' },
  { key: '25m',   label: '25m' },
];

const COMPOUND_ALL: DistanceConfig[] = [
  ...COMPOUND_INDOOR,
  ...COMPOUND_OUTDOOR,
];

const BAREBOW_OUTDOOR: DistanceConfig[] = [
  { key: '2x50m', label: '2x50m' },
  { key: '50m',   label: '50m' },
  { key: '2x30m', label: '2x30m' },
  { key: '30m',   label: '30m' },
];

const BAREBOW_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m' },
  { key: '18m',   label: '18m' },
  { key: '2x25m', label: '2x25m' },
  { key: '25m',   label: '25m' },
];

const BAREBOW_ALL: DistanceConfig[] = [
  ...BAREBOW_INDOOR,
  ...BAREBOW_OUTDOOR,
];

const LONGBOW_OUTDOOR: DistanceConfig[] = [
  { key: '50m',   label: '50m' },
  { key: '30m',   label: '30m' },
];

const LONGBOW_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m' },
  { key: '18m',   label: '18m' },
  { key: '2x25m', label: '2x25m' },
  { key: '25m',   label: '25m' },
];

const LONGBOW_ALL: DistanceConfig[] = [
  ...LONGBOW_INDOOR,
  ...LONGBOW_OUTDOOR,
];

// Juniors (U15, U13) shoot shorter outdoor distances
const RECURVE_JUNIOR_OUTDOOR: DistanceConfig[] = [
  { key: '2x60m', label: '2x60m' },
  { key: '60m',   label: '60m' },
  { key: '2x50m', label: '2x50m' },
  { key: '50m',   label: '50m' },
  { key: '30m',   label: '30m' },
];

const RECURVE_JUNIOR_ALL: DistanceConfig[] = [
  ...RECURVE_INDOOR,
  ...RECURVE_JUNIOR_OUTDOOR,
];

// ── FULL LEADERBOARD LAYOUT ─────────────────────────────────────────────────
// Order: Bow (Recurve→Compound→Barebow→Longbow)
//   Within bow: Gender (Women→Men)
//   Within gender: Age (Adult first, then U21→U18→U15→U13→+50→+60→+70)
//
// This groups all age classes under the same bow+gender column in the quick-jump
// nav: Recurve Women | Recurve Men | Compound Women | … | Longbow Men

export const LEADERBOARD_LAYOUT: CategoryConfig[] = [

  // ── RECURVE WOMEN ───────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Women', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: 'U21',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: 'U18',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: 'U15',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_JUNIOR_ALL },
  { ageClass: 'U13',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_JUNIOR_ALL },
  { ageClass: '+50',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: '+60',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: '+70',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_ALL },

  // ── RECURVE MEN ─────────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Men', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: 'U21',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: 'U18',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: 'U15',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_JUNIOR_ALL },
  { ageClass: 'U13',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_JUNIOR_ALL },
  { ageClass: '+50',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: '+60',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_ALL },
  { ageClass: '+70',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_ALL },

  // ── COMPOUND WOMEN ──────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Women', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: 'U21',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: 'U18',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: 'U15',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: 'U13',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: '+50',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: '+60',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: '+70',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_ALL },

  // ── COMPOUND MEN ────────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Men', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: 'U21',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: 'U18',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: 'U15',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: 'U13',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: '+50',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: '+60',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_ALL },
  { ageClass: '+70',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_ALL },

  // ── BAREBOW WOMEN ───────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Women', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: 'U21',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: 'U18',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: 'U15',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: 'U13',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: '+50',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: '+60',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: '+70',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_ALL },

  // ── BAREBOW MEN ─────────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Men', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: 'U21',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: 'U18',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: 'U15',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: 'U13',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: '+50',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: '+60',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_ALL },
  { ageClass: '+70',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_ALL },

  // ── LONGBOW WOMEN ───────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Women', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: 'U21',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: 'U18',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: 'U15',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: 'U13',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: '+50',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: '+60',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: '+70',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_ALL },

  // ── LONGBOW MEN ─────────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Men', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: 'U21',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: 'U18',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: 'U15',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: 'U13',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: '+50',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: '+60',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_ALL },
  { ageClass: '+70',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_ALL },
];
