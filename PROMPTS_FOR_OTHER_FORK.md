# 🏹 Implementation Prompts for Other Fork

Copy-paste these prompts into Claude to implement each feature in your other repository.

---

## 🐛 **Prompt 1: Fix Seasonal Best Filter** (5 minutes - CRITICAL BUG)

```
The seasonal best filter is broken in src/hooks/useDatabaseState.ts.

Currently it shows the highest result across ALL distances for each athlete.
It should show the best result for EACH distance the athlete has shot.

The bug is on line 108:
const key = `${r.Athlete}__${r['Bow Type']}`;

This key needs to include the distance/shooting exercise to group by athlete + bow type + distance, not just athlete + bow type.

Fix: Change to:
const key = `${r.Athlete}__${r['Bow Type']}__${r['Shooting Exercise']}`;

This ensures we keep the best score per distance for each athlete.
```

---

## 🎯 **Prompt 2: Implement Athlete Registry System** (2 hours)

```
I want to implement an athlete registry system that tracks athletes across competitions and detects name typos.

Create these files:
1. src/types/athlete.ts - Define Athlete, AthleteMatch, AthleteSuggestion types
2. src/utils/athleteRegistry.ts - Implement AthleteRegistry class with:
   - levenshteinDistance() - Calculate string similarity
   - findBestMatch() - Find exact or typo matches (1 letter difference)
   - addOrUpdateFromRecord() - Build athlete profile from competition records
   - Track: athlete history (clubs, age groups by year, competition classes)

The registry should:
- Detect typos using Levenshtein distance algorithm
- Suggest corrections when similar names are found
- Track athlete data: clubs, age classes by year, bow types, first/last seen dates
- Provide merge capability when confirming a typo

Integration in ImportModule:
- Build registry during CSV import
- Flag records with potential name typos for review
- Show suggestions in review module
```

---

## ✅ **Prompt 3: Add Score Validation** (30 minutes)

```
Add distance-based score validation following archery rules (360 points maximum per distance).

Create src/utils/scoreValidation.ts with:

1. parseDistanceCount(distance: string) - Parse formats like:
   - "70m" → 1 distance → max 360
   - "2x70m" → 2 distances → max 720
   - "90m+70m+50m+30m" → 4 distances → max 1440

2. getMaxScore(distance: string) - Calculate maximum possible score

3. validateScore(score: number, distance: string) - Check if score is valid
   - Return {valid: boolean, error?: string, maxScore?: number}

4. isScoreSuspiciouslyHigh(score: number, distance: string) - Warn if >80% of max

Integrate in ImportModule:
- Validate scores during CSV parsing
- Flag invalid scores for review
- Show warning badges on suspiciously high scores
```

---

## 📂 **Prompt 4: Enhanced Multi-File CSV Import** (1 hour)

```
Improve CSV import in src/components/import/ImportModule.tsx:

1. Multi-file accumulation:
   - Add checkbox "Add to existing data" (default: false)
   - When checked, new imports accumulate instead of replacing
   - When unchecked, clear previous imports first
   - Show "Clear all imported data" button when data exists

2. Better drag & drop:
   - Prevent child element interference (check if e.target has files)
   - Better visual feedback (border colors, hover states)
   - Support multiple files at once

3. Improved header mapping in src/utils/parsing.ts:
   - Handle Estonian variations: "Kuupäev", "Sportlane", "Klubi"
   - Support split name columns (First Name | Last Name)
   - Fallback to index-based mapping if headers don't match

4. Visual improvements:
   - Show count of imported files
   - Display source filename for each record (_sourceFile field)
   - Loading states during processing
   - Success/error messages with file counts
```

---

## 🔍 **Prompt 5: Advanced Filtering System** (1 hour)

```
Add advanced filters to src/components/database/DatabaseModule.tsx and src/hooks/useDatabaseState.ts:

New filters to add:
1. Distance/Shooting Exercise filter (dropdown)
2. Multiple age class selection (multi-select)
3. Gender filter (checkboxes: Male/Female)
4. Source file filter (dropdown - shows which CSV each record came from)

Visual improvements:
1. Add age class badges in table (color-coded)
2. Club name tooltips on hover
3. Active filter count badge (e.g., "5 filters active")
4. Clear all filters button
5. Filter section collapsible on mobile

Update FilterState type in src/types/index.ts:
- Add: distance: string
- Add: sourceFile: string
- Change ageClasses and genders to arrays for multi-select

Ensure filters reset to page 1 when changed.
```

---

## 🏢 **Prompt 6: Club Management System** (1 hour)

```
Create a dynamic club management system that allows users to add custom clubs.

Create src/utils/clubStore.ts:
- Load 17 built-in Estonian clubs from constants
- Allow users to add custom clubs (persisted to localStorage)
- Provide autocomplete suggestions
- Always use latest built-in club names on refresh

Functions needed:
- getClubs() - Get all clubs
- addClub(code, name) - Add user-defined club
- removeClub(code) - Remove user club (built-ins can't be removed)
- getClubSuggestions(input, limit) - Autocomplete
- subscribeToClubs(callback) - React to changes
- resetClubs() - Reset to built-ins only

Built-in clubs to include:
VVVK (Vana-Võidu VK), SAG (Sagittarius), TVSK (Tartu Valla SK),
JVI (Järvakandi Vibuklubi Ilves), TLVK (Tallinna VK),
PVM (Pärnu Vibuklubi Meelis), KSK (Kajamaa SK), STR (Storm SK),
MAG (Mägilased), SJK (Suure-Jaani VK), TYRI (Türi Vibukool),
BH (Baltic Hunter SC), KVK (Kagu VK), SVK (Saarde VK),
LVL (Lääne Vibulaskjad), SMA (Saaremaa VK), VVK (Vooremaa VK)

Integration:
- Update src/constants/clubs.ts to use clubStore
- Update parsing.ts to use clubStore for fuzzy matching
- Add club management UI in settings/admin section (optional)
```

---

## 🔄 **Prompt 7: Data Consistency Validation** (3 hours - NEW FEATURE)

```
Implement an automated data consistency validation system that runs after review approval.

Create src/utils/consistencyChecker.ts:

1. After all review corrections are approved, scan database for:
   - Name inconsistencies (typos, capitalization differences)
   - Age class mismatches (same athlete, same year, different age class)
   - Gender inconsistencies (same athlete, different genders)

2. Compare against historical data:
   - Identify most common version of each field
   - Calculate confidence scores based on frequency

3. Create consistency review tickets:
   - Show all variations found for each athlete
   - Display frequency counts (e.g., "John Smith: 15x, John Smit: 2x")
   - Ask user to select correct version
   - Group by athlete

4. Batch update after user approval:
   - Update ALL records with selected correct values
   - Maintain audit trail in _corrections field
   - Show summary of changes made

Add new step in App.tsx:
- After ReviewModule → ConsistencyCheckModule
- Only show if inconsistencies detected
- Skip if database is already consistent

UI should be similar to ReviewModule:
- Show one athlete at a time with all their inconsistencies
- Let user select correct values
- Approve/skip/reject options
- Progress indicator

Key functions:
- findInconsistencies(records: CompetitionRecord[]) → InconsistencyReport[]
- suggestCorrection(inconsistency) → string (most common value)
- applyCorrections(records, corrections) → CompetitionRecord[]
```

---

## 🎨 **Prompt 8: UX Improvements Bundle** (1 hour)

```
Apply these UX improvements across the application:

1. Keyboard shortcuts (ReviewModule):
   - Change from A/R to Enter/Delete for approve/reject
   - Add Escape to skip
   - Show keyboard hints in UI

2. Name capitalization (utils/formatting.ts):
   - Create capitalizeWords() function
   - Apply to athlete names during import
   - Handle special cases (McDonald, O'Brien, etc.)

3. Visual feedback:
   - Add loading spinners during imports
   - Success/error toasts with auto-dismiss
   - Progress bars for batch operations
   - Hover states for interactive elements

4. Data presentation:
   - Format large numbers with separators (1,234)
   - Date formatting (YYYY-MM-DD)
   - Color-coded statistics cards (green/blue/orange/purple)
   - Responsive table design

5. Review system improvements:
   - Show correction details in expandable panel
   - Confidence score badges (High/Medium/Low)
   - Preview original vs corrected values
   - Batch select for approve all/reject all
```

---

## 📋 **Recommended Implementation Order**

1. ✅ **Prompt 1** - Seasonal best fix (5 min) - CRITICAL BUG
2. ✅ **Prompt 3** - Score validation (30 min)
3. ✅ **Prompt 4** - Multi-file CSV import (1 hour)
4. ✅ **Prompt 2** - Athlete registry (2 hours)
5. ✅ **Prompt 5** - Advanced filtering (1 hour)
6. ✅ **Prompt 6** - Club management (1 hour)
7. ✅ **Prompt 8** - UX improvements (1 hour)
8. ✅ **Prompt 7** - Data consistency (3 hours) - NEW FEATURE

**Total time:** ~10 hours

---

## 🧪 **Quick Test Commands**

After implementing, test with these scenarios:

**Test seasonal best:**
```
1. Upload CSV with athlete having multiple results in different distances
2. Enable "Seasonal best only" filter
3. Verify: Shows best per distance, not overall best
```

**Test score validation:**
```
1. Try importing score 800 for "70m" (max 360) → should reject
2. Try importing score 700 for "2x70m" (max 720) → should accept
3. Try importing score 1500 for "90m+70m+50m+30m" (max 1440) → should reject
```

**Test multi-file import:**
```
1. Import file1.csv → 100 records
2. Check "Add to existing data" → Import file2.csv → total 250 records
3. Filter by source file → Should see both files separately
```

---

## 📄 **Reference Files**

Files to reference when implementing:

- **Seasonal best bug:** `src/hooks/useDatabaseState.ts:105-112`
- **CSV parsing:** `src/utils/parsing.ts`
- **Import UI:** `src/components/import/ImportModule.tsx`
- **Database view:** `src/components/database/DatabaseModule.tsx`
- **Types:** `src/types/index.ts`, `src/types/athlete.ts`

See `IMPLEMENTATION_OVERVIEW.md` for detailed explanations of each feature.

---

**Happy coding! 🚀**
