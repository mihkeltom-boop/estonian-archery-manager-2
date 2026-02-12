import type { BowType, AgeClass } from '../types';

// ── CLUBS ──────────────────────────────────────────────────────────────────

export const ESTONIAN_CLUBS = [
  { code: 'TLVK', name: 'Tallinna Laskurvibuklubi' },
  { code: 'VVVK', name: 'Viljandi Vibukool' },
  { code: 'SAG',  name: 'Tallinna SK' },
  { code: 'TVSK', name: 'Tapa' },
  { code: 'JVI',  name: 'Jõhvi' },
  { code: 'PVM',  name: 'Põlva-Võru-Maardu' },
  { code: 'KSK',  name: 'Keila SK' },
  { code: 'SJK',  name: 'Sindi Jõuklubi' },
  { code: 'STR',  name: 'Silla-Tare Rahvaspordiklubi' },
  { code: 'MAG',  name: 'Margus' },
  { code: 'TYRI', name: 'Türi SK' },
  { code: 'BH',   name: 'BH Fitness' },
  { code: 'KVK',  name: 'Kiili Vibukool' },
  { code: 'LVL',  name: 'Laulasmaa VK' },
  { code: 'VVK',  name: 'Valga Vibukool' },
  { code: 'SVK',  name: 'Saku Vibukool' },
  { code: 'TL',   name: 'Tiit Laasberg' },
  { code: 'AMA',  name: 'Amatöör' },
  { code: 'NS',   name: 'NS' },
] as const;

// ── HEADER MAPPINGS ────────────────────────────────────────────────────────

// Maps Estonian CSV column names → internal field names
export const ESTONIAN_HEADERS: Record<string, string> = {
  'Kuupäev':       'Date',
  'Sportlane':     'Athlete',
  'Võistlus':      'Competition',
  'Klubi':         'Club',
  'Võistlusklass': 'Class',
  'Vanuserühm':    'AgeClass',
  'Distants':      'Distance',
  'Tulemus':       'Result',
  'Vanuseklass':   'AgeClass',
};

// ── BOW TYPE TRANSLATIONS ──────────────────────────────────────────────────

export const BOW_TRANSLATIONS: Record<string, BowType> = {
  // Estonian → English
  'sportvibu':         'Recurve',
  'plokkvibu':         'Compound',
  'traditsioonivibu':  'Barebow',
  'pikavibu':          'Longbow',
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
14.12.2024,Jaan Tamm,VVVK,Plokkvibu mehed,Adult,18m,562,Viljandi Cup
13.12.2024,Liisa Kask,SAG,Sportvibu naised,U18,2x18m,545,Eesti Meistrivõistlused
12.12.2024,Peeter Pärn,TVSK,Traditsioonivibu mehed,+50,18m,590,Tapa Indoor
11.12.2024,Kati Kukk,TLVK,Sportvibu naised,Adult,18m,598,Tallinn Open 2024
10.12.2024,Mart Mets,VVVK,Plokkvibu mehed,U21,2x18m,575,Viljandi Cup
09.12.2024,Siiri Saar,KSK,Sportvibu naised,U15,18m,512,Keila Karikavõistlused
08.12.2024,Toomas Tamm,JVI,Plokkvibu mehed,Adult,70m,647,Jõhvi Lahtised
07.12.2024,Erika Eha,TLVK,Sportvibu naised,+50,18m,534,Tallinn Open 2024
06.12.2024,Andres Aas,SAG,Pikavibu mehed,Adult,30m,341,Eesti Meistrivõistlused
05.12.2024,Tiina Teder,VVVK,Traditsioonivibu naised,U21,18m,468,Viljandi Cup
04.12.2024,Kalev Kask,TVSK,Sportvibu mehed,Adult,18m,619,Tapa Indoor
03.12.2024,Helgi Hallik,PVM,Sportvibu naised,U13,18m,498,Põlva Lahtised
02.12.2024,Rein Rand,KVK,Plokkvibu mehed,+60,18m,571,Kiili Karikas
01.12.2024,Aino Alp,LVL,Sportvibu naised,Adult,2x18m,603,Laulasmaa Karikas`;
