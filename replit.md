# Estonian Archery Data Manager

## Overview
A React-based web application for managing Estonian archery competition data. Supports importing CSV files (Estonian and English headers), reviewing flagged records, and browsing/filtering/exporting competition data.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS 3 + PostCSS + Autoprefixer
- **CSV Parsing**: PapaParse
- **Icons**: Lucide React
- **Validation**: Zod

## Project Structure
```
src/
  main.tsx              - Entry point
  App.tsx               - Main app with step navigation
  index.css             - Global styles + Tailwind directives
  types/index.ts        - TypeScript types and interfaces
  constants/clubs.ts    - Estonian club data, header mappings, sample CSV
  utils/parsing.ts      - CSV parsing logic
  utils/security.ts     - Input sanitization, file validation, CSV export
  hooks/useDatabaseState.ts - Database view state management hook
  components/
    common/index.tsx    - Shared UI components (Button, Badge, Card, etc.)
    import/ImportModule.tsx  - CSV file import step
    review/ReviewModule.tsx  - Flagged record review step
    database/DatabaseModule.tsx - Data browsing/filtering/export step
```

## Running
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build`

## Recent Changes
- 2026-02-12: Initial Replit setup - organized source into src/ directory, configured Vite for port 5000 with proxy support
