// ── LEADERBOARD LAYOUT CONFIG ───────────────────────────────────────────────
//
// Structure mirrors the Estonian national records framework (Rekordite raamistik):
//   • 4 bow-type sections: Recurve → Compound → Barebow → Longbow
//   • Within each bow type: Men first, then Women
//   • Within each gender block: Adult → +50 → +60 → +70 → U21 → U18 → U15 → U13
//   • Distances: outdoor first (longest → shortest), then indoor
//
// targetFace on a DistanceConfig:
//   When set, ONLY results shot on that exact face size are included for that
//   entry. This keeps the per-age indoor face rules correct while upward
//   eligibility is still applied (e.g. a U18 Woman on 40cm appears in
//   Adult Women 18m because both specify 40cm; a Recurve U15 on 60cm does
//   NOT appear there because Adult 18m requires 40cm).
//
//   Outdoor distances deliberately omit targetFace — the auto-split logic
//   in the leaderboard component creates sub-tables when a distance has
//   multiple face sizes in the actual data.
//
// `key` must exactly match the 'Shooting Exercise' value stored in data.json.
// Categories and distances with no data for the selected year are hidden.

import type { AgeClass, BowType, Gender } from '../types';

export interface DistanceConfig {
  key: string;           // Exact 'Shooting Exercise' value in data
  label: string;         // Display label shown to the user
  targetFace?: string;   // When set, filter to only this face size
}

export interface CategoryConfig {
  ageClass: AgeClass;
  gender: Gender;
  bowType: BowType;
  distances: DistanceConfig[];
}

// ── RECURVE (Sportvibu) ──────────────────────────────────────────────────────

const RECURVE_OUTDOOR: DistanceConfig[] = [
  { key: '90m+70m+50m+30m', label: '1440' },
  { key: '2x90m+2x70m',     label: '2x90m+2x70m' },
  { key: '90m',              label: '90m' },
  { key: '2x70m',            label: '2x70m' },
  { key: '70m',              label: '70m' },
  { key: '60m',              label: '60m' },
  { key: '50m',              label: '50m' },
  { key: '40m',              label: '40m' },
  { key: '30m',              label: '30m' },
];

// Shorter outdoor set for U15/U13 (document: max 60m for junior recurve)
const RECURVE_JUNIOR_OUTDOOR: DistanceConfig[] = [
  { key: '2x60m', label: '2x60m' },
  { key: '60m',   label: '60m' },
  { key: '2x50m', label: '2x50m' },
  { key: '50m',   label: '50m' },
  { key: '40m',   label: '40m' },
  { key: '30m',   label: '30m' },
];

// Indoor — Adult / +50 / +60 / +70 / U21 / U18: 18m on 40cm face
const RECURVE_SENIOR_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m', targetFace: '40cm' },
  { key: '18m',   label: '18m',   targetFace: '40cm' },
];

// Indoor — U15: 18m on 60cm face, 15m on 80cm face
const RECURVE_U15_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m', targetFace: '60cm' },
  { key: '18m',   label: '18m',   targetFace: '60cm' },
  { key: '2x15m', label: '2x15m', targetFace: '80cm' },
  { key: '15m',   label: '15m',   targetFace: '80cm' },
];

// Indoor — U13: 15m on 80cm face only
const RECURVE_U13_INDOOR: DistanceConfig[] = [
  { key: '2x15m', label: '2x15m', targetFace: '80cm' },
  { key: '15m',   label: '15m',   targetFace: '80cm' },
];

const RECURVE_SENIOR_ALL: DistanceConfig[] = [...RECURVE_OUTDOOR,        ...RECURVE_SENIOR_INDOOR];
const RECURVE_U15_ALL:    DistanceConfig[] = [...RECURVE_JUNIOR_OUTDOOR, ...RECURVE_U15_INDOOR];
const RECURVE_U13_ALL:    DistanceConfig[] = [...RECURVE_JUNIOR_OUTDOOR, ...RECURVE_U13_INDOOR];

// ── COMPOUND (Plokkvibu) ─────────────────────────────────────────────────────

const COMPOUND_OUTDOOR: DistanceConfig[] = [
  { key: '50m+30m+50m+30m', label: '1440 Compound' },
  { key: '2x50m',            label: '2x50m' },
  { key: '50m',              label: '50m' },
  { key: '40m',              label: '40m' },
  { key: '30m',              label: '30m' },
];

// Indoor — all senior + U18 + U21: 18m on 40cm (Compound always 40cm)
const COMPOUND_SENIOR_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m', targetFace: '40cm' },
  { key: '18m',   label: '18m',   targetFace: '40cm' },
];

// Indoor — U15: also competes at 18m 40cm, plus 15m 80cm
const COMPOUND_U15_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m', targetFace: '40cm' },
  { key: '18m',   label: '18m',   targetFace: '40cm' },
  { key: '2x15m', label: '2x15m', targetFace: '80cm' },
  { key: '15m',   label: '15m',   targetFace: '80cm' },
];

// Indoor — U13: 15m on 80cm face only
const COMPOUND_U13_INDOOR: DistanceConfig[] = [
  { key: '2x15m', label: '2x15m', targetFace: '80cm' },
  { key: '15m',   label: '15m',   targetFace: '80cm' },
];

const COMPOUND_SENIOR_ALL: DistanceConfig[] = [...COMPOUND_OUTDOOR, ...COMPOUND_SENIOR_INDOOR];
const COMPOUND_U15_ALL:    DistanceConfig[] = [...COMPOUND_OUTDOOR, ...COMPOUND_U15_INDOOR];
const COMPOUND_U13_ALL:    DistanceConfig[] = [...COMPOUND_OUTDOOR, ...COMPOUND_U13_INDOOR];

// ── BAREBOW (Vaistuvibu) ─────────────────────────────────────────────────────

const BAREBOW_OUTDOOR: DistanceConfig[] = [
  { key: '70m',   label: '70m' },
  { key: '60m',   label: '60m' },
  { key: '2x50m', label: '2x50m' },
  { key: '50m',   label: '50m' },
  { key: '40m',   label: '40m' },
  { key: '2x30m', label: '2x30m' },
  { key: '30m',   label: '30m' },
];

// Indoor — Adult / +50 / +60 / +70 / U21 / U18: 18m on 40cm
const BAREBOW_SENIOR_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m', targetFace: '40cm' },
  { key: '18m',   label: '18m',   targetFace: '40cm' },
];

// Indoor — U15: 18m on 60cm, 15m on 122cm (Barebow junior face)
const BAREBOW_U15_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m', targetFace: '60cm' },
  { key: '18m',   label: '18m',   targetFace: '60cm' },
  { key: '2x15m', label: '2x15m', targetFace: '122cm' },
  { key: '15m',   label: '15m',   targetFace: '122cm' },
];

// Indoor — U13: 15m on 122cm face only
const BAREBOW_U13_INDOOR: DistanceConfig[] = [
  { key: '2x15m', label: '2x15m', targetFace: '122cm' },
  { key: '15m',   label: '15m',   targetFace: '122cm' },
];

const BAREBOW_SENIOR_ALL: DistanceConfig[] = [...BAREBOW_OUTDOOR, ...BAREBOW_SENIOR_INDOOR];
const BAREBOW_U15_ALL:    DistanceConfig[] = [...BAREBOW_OUTDOOR, ...BAREBOW_U15_INDOOR];
const BAREBOW_U13_ALL:    DistanceConfig[] = [...BAREBOW_OUTDOOR, ...BAREBOW_U13_INDOOR];

// ── LONGBOW (Pikkvibu) ───────────────────────────────────────────────────────

const LONGBOW_OUTDOOR: DistanceConfig[] = [
  { key: '70m', label: '70m' },
  { key: '60m', label: '60m' },
  { key: '50m', label: '50m' },
  { key: '40m', label: '40m' },
  { key: '30m', label: '30m' },
];

// Indoor — Adult / +50 / +60 / +70 / U21 / U18: 18m on 40cm
const LONGBOW_SENIOR_INDOOR: DistanceConfig[] = [
  { key: '2x18m', label: '2x18m', targetFace: '40cm' },
  { key: '18m',   label: '18m',   targetFace: '40cm' },
];

// Indoor — U15 / U13: 15m on 80cm face (no 18m data in dataset)
const LONGBOW_JUNIOR_INDOOR: DistanceConfig[] = [
  { key: '2x15m', label: '2x15m', targetFace: '80cm' },
  { key: '15m',   label: '15m',   targetFace: '80cm' },
];

const LONGBOW_SENIOR_ALL: DistanceConfig[] = [...LONGBOW_OUTDOOR, ...LONGBOW_SENIOR_INDOOR];
const LONGBOW_JUNIOR_ALL: DistanceConfig[] = [...LONGBOW_OUTDOOR, ...LONGBOW_JUNIOR_INDOOR];

// ── FULL LEADERBOARD LAYOUT ──────────────────────────────────────────────────
// Order: Bow (Recurve→Compound→Barebow→Longbow)
//   Within bow:    Men → Women
//   Within gender: Adult → +50 → +60 → +70 → U21 → U18 → U15 → U13

export const LEADERBOARD_LAYOUT: CategoryConfig[] = [

  // ── RECURVE MEN ─────────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Men', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: '+50',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: '+60',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: '+70',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: 'U21',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: 'U18',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: 'U15',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_U15_ALL },
  { ageClass: 'U13',   gender: 'Men', bowType: 'Recurve', distances: RECURVE_U13_ALL },

  // ── RECURVE WOMEN ───────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Women', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: '+50',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: '+60',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: '+70',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: 'U21',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: 'U18',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_SENIOR_ALL },
  { ageClass: 'U15',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_U15_ALL },
  { ageClass: 'U13',   gender: 'Women', bowType: 'Recurve', distances: RECURVE_U13_ALL },

  // ── COMPOUND MEN ────────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Men', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: '+50',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: '+60',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: '+70',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: 'U21',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: 'U18',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: 'U15',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_U15_ALL },
  { ageClass: 'U13',   gender: 'Men', bowType: 'Compound', distances: COMPOUND_U13_ALL },

  // ── COMPOUND WOMEN ──────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Women', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: '+50',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: '+60',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: '+70',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: 'U21',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: 'U18',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_SENIOR_ALL },
  { ageClass: 'U15',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_U15_ALL },
  { ageClass: 'U13',   gender: 'Women', bowType: 'Compound', distances: COMPOUND_U13_ALL },

  // ── BAREBOW MEN ─────────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Men', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: '+50',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: '+60',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: '+70',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: 'U21',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: 'U18',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: 'U15',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_U15_ALL },
  { ageClass: 'U13',   gender: 'Men', bowType: 'Barebow', distances: BAREBOW_U13_ALL },

  // ── BAREBOW WOMEN ───────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Women', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: '+50',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: '+60',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: '+70',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: 'U21',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: 'U18',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_SENIOR_ALL },
  { ageClass: 'U15',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_U15_ALL },
  { ageClass: 'U13',   gender: 'Women', bowType: 'Barebow', distances: BAREBOW_U13_ALL },

  // ── LONGBOW MEN ─────────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Men', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: '+50',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: '+60',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: '+70',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: 'U21',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: 'U18',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: 'U15',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_JUNIOR_ALL },
  { ageClass: 'U13',   gender: 'Men', bowType: 'Longbow', distances: LONGBOW_JUNIOR_ALL },

  // ── LONGBOW WOMEN ───────────────────────────────────────────────────────
  { ageClass: 'Adult', gender: 'Women', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: '+50',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: '+60',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: '+70',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: 'U21',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: 'U18',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_SENIOR_ALL },
  { ageClass: 'U15',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_JUNIOR_ALL },
  { ageClass: 'U13',   gender: 'Women', bowType: 'Longbow', distances: LONGBOW_JUNIOR_ALL },
];
