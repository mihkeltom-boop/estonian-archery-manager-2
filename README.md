# 🏹 Estonian Archery Data Manager v2.0

A production-grade React + TypeScript application for processing Estonian archery competition CSV data.

---

## Setting Up on Replit

### Step 1 — Create the Repl

1. Go to [replit.com](https://replit.com) → **Create Repl**
2. Choose the **React TypeScript** template
3. Name it `estonian-archery-manager`
4. Click **Create Repl**

Replit will scaffold a basic React + Vite + TypeScript project for you automatically.

---

### Step 2 — Replace the generated files

Delete everything inside the `src/` folder that Replit created, then create this exact structure:

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── types/
│   └── index.ts
├── constants/
│   └── clubs.ts
├── utils/
│   ├── parsing.ts
│   └── security.ts
├── hooks/
│   └── useDatabaseState.ts
└── components/
    ├── common/
    │   └── index.tsx
    ├── import/
    │   └── ImportModule.tsx
    ├── review/
    │   └── ReviewModule.tsx
    └── database/
        └── DatabaseModule.tsx
```

Copy each file from this repo into the matching path in Replit.

Also replace these root-level config files:
- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.node.json`
- `tailwind.config.js`
- `postcss.config.js`
- `index.html`

---

### Step 3 — Install dependencies

Open the **Shell** tab in Replit and run:

```bash
npm install
```

This installs React, Tailwind, PapaParse, Zod, Lucide, and TypeScript.

---

### Step 4 — Run the app

```bash
npm run dev
```

The preview pane opens on the right. Click **Open in new tab** (↗) for full screen.

---

## File-by-file guide

| File | What it does |
|------|-------------|
| `src/main.tsx` | Mounts `<App />` to the DOM |
| `src/App.tsx` | Step navigation, top-level state |
| `src/index.css` | Tailwind directives + base styles |
| `src/types/index.ts` | TypeScript interfaces for all data shapes |
| `src/constants/clubs.ts` | All 19 club codes, bow type map, sample CSV |
| `src/utils/parsing.ts` | CSV → `CompetitionRecord[]` with auto-correction |
| `src/utils/security.ts` | File validation, input sanitization, CSV export |
| `src/hooks/useDatabaseState.ts` | Filter / sort / paginate with `useReducer` |
| `src/components/common/index.tsx` | Button, Badge, Card, StatCard, Input, Select |
| `src/components/import/ImportModule.tsx` | Drag-and-drop upload, sample data loader |
| `src/components/review/ReviewModule.tsx` | Approve / reject / skip flagged records |
| `src/components/database/DatabaseModule.tsx` | Sortable table, filters, stats, CSV export |

---

## How data flows

```
User uploads CSV
      ↓
ImportModule reads file text
      ↓
parseCSVText() in parsing.ts
  · maps Estonian headers → internal fields
  · matchClub()         → fuzzy match club codes
  · translateBowType()  → Estonian → English
  · extractAgeClass()   → from dedicated col or embedded in class
  · extractGender()     → from class string
  · normalizeDistance() → "18" → "18m", "2x18" → "2x18m"
  · builds _corrections audit trail
  · sets _needsReview if confidence < 90%
      ↓
App checks: any _needsReview records?
  YES → ReviewModule (approve / reject each flagged record)
  NO  → skip straight to DatabaseModule
      ↓
DatabaseModule
  · useDatabaseState hook handles all filter/sort/paginate
  · Shows live statistics
  · Export filtered data as CSV
```

---

## Adding more features

The architecture is modular — common patterns to follow:

**Add a new filter** → add a field to `FilterState` in `types/index.ts`, handle it in `applyFilters()` in `useDatabaseState.ts`, add a UI control in `DatabaseModule.tsx`.

**Add a new column** → add to the `COLUMNS` array in `DatabaseModule.tsx`.

**Add a new club** → add to `ESTONIAN_CLUBS` in `constants/clubs.ts`.

**Add a new bow type** → add to `BOW_TRANSLATIONS` in `constants/clubs.ts`.
