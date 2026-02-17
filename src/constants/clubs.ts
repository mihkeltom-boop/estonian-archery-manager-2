import type { BowType, AgeClass } from '../types';

// ── CLUBS ──────────────────────────────────────────────────────────────────

export const ESTONIAN_CLUBS = [
  { code: 'TLVK', name: 'Tallinna Vibukool' },
  { code: 'VVVK', name: 'Vana-Võidu Vibuklub' },
  { code: 'SAG',  name: 'Sagittarius' },
  { code: 'TVSK', name: 'Tartu Valla Spordiklubi' },
  { code: 'JVI',  name: 'Järvakandi Ilves' },
  { code: 'PVM',  name: 'Pärnu Meelis' },
  { code: 'KSK',  name: 'Kajamaa Spordiklubi' },
  { code: 'SJK',  name: 'Suure-Jaani VK' },
  { code: 'STR',  name: 'STORM SK' },
  { code: 'MAG',  name: 'Mägilased' },
  { code: 'TYRI', name: 'Türi Vibukool' },
  { code: 'BH',   name: 'Baltic Hunter SC' },
  { code: 'KVK',  name: 'Kagu Vibuklubi' },
  { code: 'LVL',  name: 'Lääne Vibulaskjad' },
  { code: 'VVK',  name: 'Vooremaa Vibuklubi' },
  { code: 'SVK',  name: 'Saarde Vibuklubi' },
  { code: 'TL',   name: 'TäheLend' },
  { code: 'NS',   name: 'NS Archery Club' },
  { code: 'JAK',  name: 'Järvamaa Amburite Klubi' },
  { code: 'SMA',  name: 'Saaremaa Vibuklubi' },
  { code: 'TVK',  name: 'Tartu Vibuklubi' },
] as const;

// ── HEADER MAPPINGS ────────────────────────────────────────────────────────

// Maps Estonian CSV column names → internal field names
export const ESTONIAN_HEADERS: Record<string, string> = {
  'Kuupäev':       'Date',
  'Sportlane':     'Athlete',
  'Nimi':           'Athlete',
  'Sportlase nimi': 'Athlete',
  'Võistleja':     'Athlete',
  'Võistlus':      'Competition',
  'Klubi':         'Club',
  'Võistlusklass': 'Class',
  'Vanuserühm':    'AgeClass',
  'Distants':      'Distance',
  'Tulemus':       'Result',
  'Vanuseklass':   'AgeClass',
  'Sugu':          'Gender',
};

// ── BOW TYPE TRANSLATIONS ──────────────────────────────────────────────────

export const BOW_TRANSLATIONS: Record<string, BowType> = {
  // Estonian → English
  'sportvibu':         'Recurve',
  'plokkvibu':         'Compound',
  'vaistuvibu':         'Barebow',
  'pikkvibu':          'Longbow',
  // English passthrough (case-insensitive)
  'recurve':           'Recurve',
  'compound':          'Compound',
  'barebow':           'Barebow',
  'longbow':           'Longbow',
};

// ── AGE CLASSES ────────────────────────────────────────────────────────────

export const AGE_CLASSES: AgeClass[] = [
  'Adult', 'U21', 'U18', 'U15', 'U13', '+50', '+60', '+70',
];

// ── SAMPLE DATA ────────────────────────────────────────────────────────────

export const SAMPLE_CSV = `Kuupäev,Sportlane,Klubi,Võistlusklass,Vanuserühm,Distants,Tulemus,Võistlus
15.12.2024,Mari Mägi,TLVK,Sportvibu naised,U21,2x18m,580,Tallinn Open 2024
14.12.2024,Jaan Tamm,VILJ,Plokkvibu mehed,Adult,18m,562,Viljandi Cup
13.12.2024,Liisa Kask,SAG,Sportvibu naised,U18,2x18m,545,Eesti Meistrivõistlused
12.12.2024,Peeter Pärn,TVSK,Traditsioonivibu mehed,+50,18m,590,Tapa Indoor
11.12.2024,Kati Kukk,TLVK,Sportvibu naised,Adult,18m,598,Tallinn Open 2024
10.12.2024,Mart Mets,VILJ,Plokkvibu mehed,U21,2x18m,575,Viljandi Cup
09.12.2024,Siiri Saar,KSK,Sportvibu naised,U15,18m,512,Keila Karikavõistlused
08.12.2024,Toomas Tamm,JVI,Plokkvibu mehed,Adult,70m,647,Jõhvi Lahtised
07.12.2024,Erika Eha,TLVK,Sportvibu naised,+50,18m,534,Tallinn Open 2024
06.12.2024,Andres Aas,SAG,Pikavibu mehed,Adult,30m,341,Eesti Meistrivõistlused
05.12.2024,Tiina Teder,VILJ,Traditsioonivibu naised,U21,18m,468,Viljandi Cup
04.12.2024,Kalev Kask,TVSK,Sportvibu mehed,Adult,18m,619,Tapa Indoor
03.12.2024,Helgi Hallik,PVM,Sportvibu naised,U13,18m,498,Põlva Lahtised
02.12.2024,Rein Rand,KVK,Plokkvibu mehed,+60,18m,571,Kiili Karikas
01.12.2024,Aino Alp,LVL,Sportvibu naised,Adult,2x18m,603,Laulasmaa Karikas`;
