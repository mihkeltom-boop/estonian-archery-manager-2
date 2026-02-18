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

function categoryLabel(cat: CategoryConfig): string {
  return `${cat.bowType} ${cat.ageClass} ${cat.gender}`;
}

/** Compute seasonal-best ranking for one distance within a category. */
function computeRanking(
  records: CompetitionRecord[],
  year: string,
  cat: CategoryConfig,
  dist: DistanceConfig,
): RankedEntry[] {
  const filtered = records.filter(r =>
    r['Age Class'] === cat.ageClass &&
    r.Gender       === cat.gender   &&
    r['Bow Type']  === cat.bowType  &&
    r['Shooting Exercise'] === dist.key &&
    r.Date.startsWith(year)
  );

  const bestMap = new Map<string, CompetitionRecord>();
  for (const r of filtered) {
    if (!bestMap.has(r.Athlete) || r.Result > bestMap.get(r.Athlete)!.Result) {
      bestMap.set(r.Athlete, r);
    }
  }

  const sorted = [...bestMap.values()].sort((a, b) => b.Result - a.Result);
  let rank = 1;
  return sorted.map((r, i) => {
    if (i > 0 && r.Result < sorted[i - 1].Result) rank = i + 1;
    return { rank, record: r };
  });
}

// ── DISTANCE TABLE ───────────────────────────────────────────────────────────

const DistanceTable: React.FC<{ dist: DistanceConfig; entries: RankedEntry[] }> = ({
  dist,
  entries,
}) => (
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
            <tr key={record._id ?? `${record.Athlete}-${record.Date}`}
                className="hover:bg-blue-50 transition-colors">
              <td className="px-3 py-2 w-10">
                <span className={RANK_STYLE[rank] ?? 'text-gray-500 font-medium text-sm'}>
                  {rank}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                {record.Athlete}
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

  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-gray-200">
        <span className="text-2xl" aria-hidden="true">{BOW_ICON[cat.bowType]}</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {cat.bowType} · {cat.ageClass} · {cat.gender}
          </h2>
          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${AGE_COLOR[cat.ageClass]}`}>
            {cat.ageClass}
          </span>
        </div>
      </div>

      {distancesWithData.map(({ dist, entries }) => (
        <DistanceTable key={dist.key} dist={dist} entries={entries} />
      ))}
    </section>
  );
};

// ── QUICK-JUMP NAV ───────────────────────────────────────────────────────────

const QuickJump: React.FC<{
  categories: CategoryConfig[];
  records: CompetitionRecord[];
  year: string;
}> = ({ categories, records, year }) => {
  const active = useMemo(() =>
    categories.filter(cat =>
      records.some(r =>
        r['Age Class'] === cat.ageClass &&
        r.Gender       === cat.gender   &&
        r['Bow Type']  === cat.bowType  &&
        r.Date.startsWith(year)
      )
    ),
    [categories, records, year]
  );

  if (active.length === 0) return null;

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Jump to category
      </p>
      <div className="flex flex-wrap gap-2">
        {active.map(cat => (
          <button
            key={categoryId(cat)}
            onClick={() => scrollTo(categoryId(cat))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
              bg-white border border-gray-300 text-gray-700
              hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700
              transition-colors cursor-pointer"
          >
            <span>{BOW_ICON[cat.bowType]}</span>
            {categoryLabel(cat)}
          </button>
        ))}
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
