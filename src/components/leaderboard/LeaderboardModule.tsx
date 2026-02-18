import React, { useMemo, useState, useCallback } from 'react';
import { Badge, Select, EmptyState } from '../common';
import { formatNumber } from '../../utils/formatting';
import { LEADERBOARD_LAYOUT } from '../../constants/leaderboard';
import type { CompetitionRecord, AgeClass, BowType, Gender } from '../../types';
import type { CategoryConfig, DistanceConfig } from '../../constants/leaderboard';

// ── TYPES ───────────────────────────────────────────────────────────────────

interface RankedEntry {
  rank: number;
  record: CompetitionRecord;
}

// ── AGE CLASS INCLUSION RULES ────────────────────────────────────────────────
//
// Age classes work as handicap groups: a result from a younger/older class
// counts upward through the age ladder.
//
// Youth (U = under age limit):
//   U13 → eligible for U15, U18, U21, Adult
//   U15 → eligible for U18, U21, Adult
//   U18 → eligible for U21, Adult
//   U21 → eligible for Adult
//
// Veterans (+ = age 50 and above):
//   +70 → eligible for +60, +50, Adult
//   +60 → eligible for +50, Adult
//   +50 → eligible for Adult

const AGE_CLASS_INCLUDES: Record<AgeClass, AgeClass[]> = {
  'Adult': ['Adult', 'U21', 'U18', 'U15', 'U13', '+50', '+60', '+70'],
  'U21':   ['U21',  'U18', 'U15', 'U13'],
  'U18':   ['U18',  'U15', 'U13'],
  'U15':   ['U15',  'U13'],
  'U13':   ['U13'],
  '+50':   ['+50',  '+60', '+70'],
  '+60':   ['+60',  '+70'],
  '+70':   ['+70'],
};

// ── HELPERS ─────────────────────────────────────────────────────────────────

const BOW_ICON: Record<BowType, string> = {
  Recurve:  '🏹',
  Compound: '⚙️',
  Barebow:  '🎯',
  Longbow:  '🌿',
};

const AGE_COLOR: Record<AgeClass, string> = {
  'Adult': 'bg-blue-100 text-blue-800',
  'U21':   'bg-purple-100 text-purple-800',
  'U18':   'bg-green-100 text-green-800',
  'U15':   'bg-yellow-100 text-yellow-800',
  'U13':   'bg-red-100 text-red-800',
  '+50':   'bg-teal-100 text-teal-800',
  '+60':   'bg-teal-100 text-teal-800',
  '+70':   'bg-teal-100 text-teal-800',
};

const RANK_STYLE: Record<number, string> = {
  1: 'text-yellow-500 font-bold text-base',
  2: 'text-gray-400  font-bold text-base',
  3: 'text-amber-600 font-bold text-base',
};

function categoryId(cat: CategoryConfig): string {
  return `${cat.ageClass}-${cat.gender}-${cat.bowType}`.replace(/[^a-zA-Z0-9]/g, '-');
}

// "Adult" is implicit — omit from label when age is Adult.
function categoryLabel(cat: CategoryConfig): string {
  const age = cat.ageClass !== 'Adult' ? ` ${cat.ageClass}` : '';
  return `${cat.bowType}${age} ${cat.gender}`;
}

/** Whether a category has any records in the selected year, using inclusion rules. */
function categoryHasData(
  cat: CategoryConfig,
  records: CompetitionRecord[],
  year: string,
): boolean {
  const eligibleAges = AGE_CLASS_INCLUDES[cat.ageClass];
  return records.some(r =>
    eligibleAges.includes(r['Age Class']) &&
    r.Gender      === cat.gender  &&
    r['Bow Type'] === cat.bowType &&
    r.Date.startsWith(year)
  );
}

/** Compute seasonal-best ranking for one distance within a category. */
function computeRanking(
  records: CompetitionRecord[],
  year: string,
  cat: CategoryConfig,
  dist: DistanceConfig,
): RankedEntry[] {
  const eligibleAges = AGE_CLASS_INCLUDES[cat.ageClass];

  const filtered = records.filter(r =>
    eligibleAges.includes(r['Age Class']) &&
    r.Gender      === cat.gender  &&
    r['Bow Type'] === cat.bowType &&
    r['Shooting Exercise'] === dist.key &&
    r.Date.startsWith(year)
  );

  // Keep best result per athlete
  const bestMap = new Map<string, CompetitionRecord>();
  for (const r of filtered) {
    if (!bestMap.has(r.Athlete) || r.Result > bestMap.get(r.Athlete)!.Result) {
      bestMap.set(r.Athlete, r);
    }
  }

  // Sort descending; assign ranks (ties share the same rank number)
  const sorted = [...bestMap.values()].sort((a, b) => b.Result - a.Result);
  let rank = 1;
  return sorted.map((r, i) => {
    if (i > 0 && r.Result < sorted[i - 1].Result) rank = i + 1;
    return { rank, record: r };
  });
}

// ── DISTANCE TABLE ───────────────────────────────────────────────────────────

const DistanceTable: React.FC<{
  dist: DistanceConfig;
  entries: RankedEntry[];
  categoryAgeClass: AgeClass;
}> = ({ dist, entries, categoryAgeClass }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-2">
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        {dist.label}
      </span>
      <span className="text-xs text-gray-400">{entries.length} athlete{entries.length !== 1 ? 's' : ''}</span>
    </div>

    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-10">#</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Athlete</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Club</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Result</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Date</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">Competition</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {entries.map(({ rank, record }) => (
            <tr
              key={record._id ?? `${record.Athlete}-${record.Date}`}
              className="hover:bg-blue-50 transition-colors"
            >
              <td className="px-3 py-2 w-10">
                <span className={RANK_STYLE[rank] ?? 'text-gray-500 font-medium text-sm'}>
                  {rank}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                {record.Athlete}
                {/* Show the athlete's actual age class when they appear in a higher category */}
                {record['Age Class'] !== categoryAgeClass && (
                  <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${AGE_COLOR[record['Age Class']]}`}>
                    {record['Age Class']}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <Badge color="blue">{record.Club}</Badge>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="font-bold tabular-nums text-gray-900">
                  {formatNumber(record.Result)}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap hidden sm:table-cell">
                {record.Date}
              </td>
              <td className="px-3 py-2 text-gray-500 hidden md:table-cell truncate max-w-xs">
                {record.Competition}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ── CATEGORY SECTION ─────────────────────────────────────────────────────────

const CategorySection: React.FC<{
  cat: CategoryConfig;
  records: CompetitionRecord[];
  year: string;
}> = ({ cat, records, year }) => {
  const distancesWithData = useMemo(() =>
    cat.distances
      .map(dist => ({ dist, entries: computeRanking(records, year, cat, dist) }))
      .filter(({ entries }) => entries.length > 0),
    [cat, records, year]
  );

  if (distancesWithData.length === 0) return null;

  const id = categoryId(cat);
  const isAdult = cat.ageClass === 'Adult';

  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-gray-200">
        <span className="text-2xl" aria-hidden="true">{BOW_ICON[cat.bowType]}</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {cat.bowType}{!isAdult ? ` · ${cat.ageClass}` : ''} · {cat.gender}
          </h2>
          {!isAdult && (
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${AGE_COLOR[cat.ageClass]}`}>
              {cat.ageClass}
            </span>
          )}
        </div>
      </div>

      {distancesWithData.map(({ dist, entries }) => (
        <DistanceTable
          key={dist.key}
          dist={dist}
          entries={entries}
          categoryAgeClass={cat.ageClass}
        />
      ))}
    </section>
  );
};

// ── QUICK-JUMP NAV ───────────────────────────────────────────────────────────
// 8-column grid: one column per bow×gender combo, in the same order as the page.
// Top cell = Adult category (the "column header"), sub-cells = other age classes.

const BOW_GENDER_COLUMNS: Array<{ bowType: BowType; gender: Gender }> = [
  { bowType: 'Recurve',  gender: 'Women' },
  { bowType: 'Recurve',  gender: 'Men'   },
  { bowType: 'Compound', gender: 'Women' },
  { bowType: 'Compound', gender: 'Men'   },
  { bowType: 'Barebow',  gender: 'Women' },
  { bowType: 'Barebow',  gender: 'Men'   },
  { bowType: 'Longbow',  gender: 'Women' },
  { bowType: 'Longbow',  gender: 'Men'   },
];

const GENDER_HEADER_COLOR: Record<Gender, string> = {
  Women: 'bg-purple-600 hover:bg-purple-700 text-white',
  Men:   'bg-blue-600   hover:bg-blue-700   text-white',
};

const GENDER_EMPTY_COLOR: Record<Gender, string> = {
  Women: 'bg-purple-100 text-purple-400',
  Men:   'bg-blue-100   text-blue-400',
};

const QuickJump: React.FC<{
  categories: CategoryConfig[];
  records: CompetitionRecord[];
  year: string;
}> = ({ categories, records, year }) => {
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // For each bow×gender column collect categories that have data (layout order preserved)
  const columns = useMemo(() =>
    BOW_GENDER_COLUMNS.map(col => {
      const catsWithData = categories.filter(c =>
        c.bowType === col.bowType &&
        c.gender  === col.gender  &&
        categoryHasData(c, records, year)
      );
      return { ...col, cats: catsWithData };
    }).filter(col => col.cats.length > 0),
    [categories, records, year]
  );

  if (columns.length === 0) return null;

  return (
    <div className="mb-8">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Jump to category
      </p>
      {/* Horizontally scrollable so it works on small screens */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {columns.map(col => {
            const adultCat  = col.cats.find(c => c.ageClass === 'Adult');
            const otherCats = col.cats.filter(c => c.ageClass !== 'Adult');

            return (
              <div
                key={`${col.bowType}-${col.gender}`}
                className="flex flex-col gap-1 w-24"
              >
                {/* Column header — Adult category */}
                {adultCat ? (
                  <button
                    onClick={() => scrollTo(categoryId(adultCat))}
                    className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg
                      text-xs font-semibold transition-colors ${GENDER_HEADER_COLOR[col.gender]}`}
                  >
                    {BOW_ICON[col.bowType]} {col.gender}
                  </button>
                ) : (
                  /* No Adult data but other ages exist — show label only */
                  <div className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg
                    text-xs font-semibold ${GENDER_EMPTY_COLOR[col.gender]}`}>
                    {BOW_ICON[col.bowType]} {col.gender}
                  </div>
                )}

                {/* Age-class sub-pills */}
                {otherCats.map(cat => (
                  <button
                    key={categoryId(cat)}
                    onClick={() => scrollTo(categoryId(cat))}
                    className={`flex items-center justify-center px-2 py-1 rounded text-xs font-medium
                      transition-opacity hover:opacity-75 ${AGE_COLOR[cat.ageClass]}`}
                  >
                    {cat.ageClass}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── MAIN MODULE ──────────────────────────────────────────────────────────────

const LeaderboardModule: React.FC<{ records: CompetitionRecord[] }> = ({ records }) => {
  const years = useMemo(() => {
    const ys = [...new Set(records.map(r => r.Date?.substring(0, 4)).filter(Boolean))];
    return ys.sort().reverse();
  }, [records]);

  const [year, setYear] = useState<string>(() => years[0] ?? '');

  // Sync year if records change and the selected year disappears
  const selectedYear = years.includes(year) ? year : (years[0] ?? '');

  const hasAnyData = useMemo(() =>
    records.some(r => r.Date?.startsWith(selectedYear)),
    [records, selectedYear]
  );

  const yearOptions = useMemo(() =>
    years.map(y => ({ value: y, label: y })),
    [years]
  );

  if (records.length === 0) {
    return (
      <EmptyState
        emoji="🏆"
        title="No data loaded"
        description="Load data to see the leaderboard."
      />
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leaderboard</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Seasonal best result per athlete · ordered by score
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            label="Season"
            value={selectedYear}
            onChange={e => setYear(e.target.value)}
            options={yearOptions}
            className="w-28"
          />
        </div>
      </div>

      {!hasAnyData ? (
        <EmptyState
          emoji="📅"
          title={`No results for ${selectedYear}`}
          description="Try selecting a different season."
        />
      ) : (
        <>
          <QuickJump categories={LEADERBOARD_LAYOUT} records={records} year={selectedYear} />

          {LEADERBOARD_LAYOUT.map(cat => (
            <CategorySection
              key={categoryId(cat)}
              cat={cat}
              records={records}
              year={selectedYear}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default LeaderboardModule;
