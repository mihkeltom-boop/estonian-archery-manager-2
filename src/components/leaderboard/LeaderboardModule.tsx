import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
// Each section applies upward + downward eligibility:
//   U13 → eligible for U15, U18, U21, Adult
//   U15 → eligible for U18, U21, Adult
//   U18 → eligible for U21, Adult
//   U21 → eligible for Adult
//   +70 → eligible for +60, +50, Adult
//   +60 → eligible for +50, Adult
//   +50 → eligible for Adult
//
// Results are additionally filtered by `targetFace` (set per DistanceConfig),
// so e.g. a Recurve U15 on 60cm face is excluded from the Adult 18m table
// (which requires 40cm) even though U15 is age-eligible for Adult.

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

const RANK_BADGE: Record<number, string> = {
  1: 'bg-yellow-400 text-yellow-900',
  2: 'bg-gray-300   text-gray-700',
  3: 'bg-amber-600  text-white',
};

const CLUB_NAMES: Record<string, string> = {
  BH:   'Baltic Hunter SC',
  JVI:  'Järvakandi Ilves',
  KSK:  'Kajamaa Spordiklubi',
  KVK:  'Kagu Vibuklubi',
  LVL:  'Lääne Vibulaskjad',
  MAG:  'Mägilased',
  NS:   'NS Archery Club',
  PVM:  'Pärnu Meelis',
  SAG:  'Sagittarius',
  SJK:  'Suure-Jaani VK',
  SMA:  'Saaremaa Vibuklubi',
  STR:  'STORM SK',
  SVK:  'Saarde Vibuklubi',
  TL:   'Tallinna Vibukool',
  TLVK: 'Tallinna Vibukool',
  TVK:  'Tartu Vibuklubi',
  TVSK: 'Tartu Valla Spordiklubi',
  TYRI: 'Türi Vibukool',
  VVK:  'Vooremaa Vibuklubi',
  VVVK: 'Vana-Võidu Vibuklubi',
};

const ClubBadge: React.FC<{ club: string }> = ({ club }) => {
  const fullName = CLUB_NAMES[club];
  return (
    <span className="relative group/club inline-block">
      <Badge color="blue">{club}</Badge>
      {fullName && (
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
          whitespace-nowrap rounded bg-gray-900 px-2.5 py-1 text-xs text-white shadow-lg
          opacity-0 group-hover/club:opacity-100 transition-opacity z-20">
          {fullName}
          <span className="absolute left-1/2 top-full -translate-x-1/2
            border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
};

const COLLAPSE_LIMIT = 8;

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

/** Compute seasonal-best ranking for one distance within a category.
 *  Uses dist.targetFace when set; faceOverride is only for the auto-split
 *  path where the face is detected from the data (outdoor multi-face). */
function computeRanking(
  records: CompetitionRecord[],
  year: string,
  cat: CategoryConfig,
  dist: DistanceConfig,
  faceOverride?: string,
): RankedEntry[] {
  const eligibleAges = AGE_CLASS_INCLUDES[cat.ageClass];
  const face = faceOverride ?? dist.targetFace;

  const filtered = records.filter(r =>
    eligibleAges.includes(r['Age Class']) &&
    r.Gender      === cat.gender  &&
    r['Bow Type'] === cat.bowType &&
    r['Shooting Exercise'] === dist.key &&
    r.Date.startsWith(year) &&
    (face === undefined || r['Target Face'] === face)
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
  faceLabel?: string;
}> = ({ dist, entries, categoryAgeClass, faceLabel }) => {
  const [expanded, setExpanded] = useState(false);
  const needsCollapse = entries.length > COLLAPSE_LIMIT;
  // Show targetFace from config (indoor) or the auto-detected faceLabel (outdoor multi-face)
  const displayFace = faceLabel ?? dist.targetFace;

  return (
    <div className="mb-6 print-dist-group print-avoid-break">
      {/* Distance + face pills */}
      <div className="flex items-center gap-2 mb-2 print-dist-header">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 print-plain-pill">
          {dist.label}
        </span>
        {displayFace && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 print-plain-pill">
            {displayFace}
          </span>
        )}
        <span className="text-xs text-gray-400 print:hidden">{entries.length} athlete{entries.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table — bottom corners stay square when the expand button is present */}
      <div className={`overflow-x-auto border border-gray-200 ${needsCollapse ? 'rounded-t-lg' : 'rounded-lg'} print-plain-table`}>
        <table className="min-w-full text-sm">
          <colgroup>
            <col style={{ width: '2.25rem' }} />
            <col />
            <col style={{ width: '4.5rem' }} />
            <col style={{ width: '5rem' }} />
            <col style={{ width: '6rem' }} />
            <col />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-center  text-xs font-semibold text-gray-500 w-8">#</th>
              <th className="px-3 py-2 text-left    text-xs font-semibold text-gray-500">Athlete</th>
              <th className="px-3 py-2 text-left    text-xs font-semibold text-gray-500 w-[4.5rem]">Club</th>
              <th className="px-3 py-2 text-right   text-xs font-semibold text-gray-500 w-20">Score</th>
              <th className="px-3 py-2 text-left    text-xs font-semibold text-gray-500 w-24 hidden sm:table-cell print:table-cell">Date</th>
              <th className="px-3 py-2 text-left    text-xs font-semibold text-gray-500 hidden md:table-cell print:hidden">Competition</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {entries.map(({ rank, record }, i) => (
              <tr
                key={record._id ?? `${record.Athlete}-${record.Date}`}
                className={`hover:bg-blue-50/40 transition-colors${
                  needsCollapse && !expanded && i >= COLLAPSE_LIMIT ? ' hidden print:table-row' : ''
                }`}
              >
                <td className="px-3 py-2.5 text-center w-8">
                  {rank <= 3 ? (
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold print-plain-rank ${RANK_BADGE[rank]}`}>
                      {rank}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs tabular-nums">{rank}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                  {record.Athlete}
                  {record['Age Class'] !== categoryAgeClass && (
                    <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold print:hidden ${AGE_COLOR[record['Age Class']]}`}>
                      {record['Age Class']}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 w-[4.5rem]">
                  <span className="print:hidden"><ClubBadge club={record.Club} /></span>
                  <span className="hidden print:inline">{record.Club}</span>
                </td>
                <td className="px-3 py-2.5 text-right w-20">
                  <span className="font-bold tabular-nums text-gray-900">
                    {formatNumber(record.Result)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap w-24 hidden sm:table-cell print:table-cell">
                  {record.Date}
                </td>
                <td className="px-3 py-2.5 text-gray-500 hidden md:table-cell print:hidden truncate max-w-xs">
                  {record.Competition}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand / collapse button — hidden in print */}
      {needsCollapse && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800
            hover:bg-blue-50/60 border border-t-0 border-gray-200 rounded-b-lg transition-colors print:hidden"
        >
          {expanded
            ? '↑ Show top 8'
            : `↓ Show all ${entries.length} results`}
        </button>
      )}
    </div>
  );
};

// ── CATEGORY SECTION ─────────────────────────────────────────────────────────

const CategorySection: React.FC<{
  cat: CategoryConfig;
  records: CompetitionRecord[];
  year: string;
}> = ({ cat, records, year }) => {
  const distancesWithData = useMemo(() => {
    const eligibleAges = AGE_CLASS_INCLUDES[cat.ageClass];

    return cat.distances.flatMap(dist => {
      // When a specific face is declared in the config, use it directly —
      // no need to inspect the data for face sizes.
      if (dist.targetFace !== undefined) {
        const entries = computeRanking(records, year, cat, dist);
        return entries.length > 0
          ? [{ dist, entries, faceLabel: undefined as string | undefined }]
          : [];
      }

      // No face specified (outdoor distances) → auto-split by face sizes
      // present in the data, so e.g. Recurve 50m on 80cm and 122cm each
      // get their own ranked table.
      const faces = [
        ...new Set(
          records
            .filter(r =>
              eligibleAges.includes(r['Age Class']) &&
              r.Gender               === cat.gender  &&
              r['Bow Type']          === cat.bowType &&
              r['Shooting Exercise'] === dist.key    &&
              r.Date.startsWith(year)                &&
              r['Target Face']       !== undefined
            )
            .map(r => r['Target Face'] as string)
        ),
      ].sort();

      if (faces.length <= 1) {
        const entries = computeRanking(records, year, cat, dist);
        return entries.length > 0
          ? [{ dist, entries, faceLabel: undefined as string | undefined }]
          : [];
      }

      return faces
        .map(face => ({
          dist,
          entries: computeRanking(records, year, cat, dist, face),
          faceLabel: face,
        }))
        .filter(item => item.entries.length > 0);
    });
  }, [cat, records, year]);

  if (distancesWithData.length === 0) return null;

  const id = categoryId(cat);
  const isAdult = cat.ageClass === 'Adult';

  return (
    <section id={id} className={`mb-10 scroll-mt-20 print-avoid-break ${isAdult ? 'print:break-before-page' : ''}`}>
      <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-gray-200 print-cat-heading print-keep-heading">
        <span className="text-2xl print:hidden" aria-hidden="true">{BOW_ICON[cat.bowType]}</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {cat.bowType}{!isAdult ? ` · ${cat.ageClass}` : ''} · {cat.gender}
          </h2>
          {!isAdult && (
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold print:hidden ${AGE_COLOR[cat.ageClass]}`}>
              {cat.ageClass}
            </span>
          )}
        </div>
      </div>

      {distancesWithData.map(({ dist, entries, faceLabel }) => (
        <DistanceTable
          key={`${dist.key}-${faceLabel ?? ''}`}
          dist={dist}
          entries={entries}
          categoryAgeClass={cat.ageClass}
          faceLabel={faceLabel}
        />
      ))}
    </section>
  );
};

// ── QUICK-JUMP NAV ───────────────────────────────────────────────────────────
// 8-column grid: one column per bow×gender combo, in the same order as the page.
// Top cell = Adult category (the "column header"), sub-cells = other age classes.

const BOW_GENDER_COLUMNS: Array<{ bowType: BowType; gender: Gender }> = [
  { bowType: 'Recurve',  gender: 'Men'   },
  { bowType: 'Recurve',  gender: 'Women' },
  { bowType: 'Compound', gender: 'Men'   },
  { bowType: 'Compound', gender: 'Women' },
  { bowType: 'Barebow',  gender: 'Men'   },
  { bowType: 'Barebow',  gender: 'Women' },
  { bowType: 'Longbow',  gender: 'Men'   },
  { bowType: 'Longbow',  gender: 'Women' },
];

const GENDER_HEADER_COLOR: Record<Gender, string> = {
  Women: 'bg-purple-600 hover:bg-purple-700 text-white',
  Men:   'bg-blue-600   hover:bg-blue-700   text-white',
};

const GENDER_EMPTY_COLOR: Record<Gender, string> = {
  Women: 'bg-purple-100 text-purple-400',
  Men:   'bg-blue-100   text-blue-400',
};

const SUB_AGE_ORDER: AgeClass[] = ['+50', '+60', '+70', 'U21', 'U18', 'U15', 'U13'];

const QuickJump: React.FC<{
  categories: CategoryConfig[];
  records: CompetitionRecord[];
  year: string;
}> = ({ categories, records, year }) => {
  // Smooth-scroll on click; href="#id" keeps links working in exported PDF
  const handleClick = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // For each bow×gender column collect ALL categories; tag each with hasData
  const columns = useMemo(() =>
    BOW_GENDER_COLUMNS.map(col => {
      const colCats = categories.filter(c =>
        c.bowType === col.bowType && c.gender === col.gender
      );
      const hasAnyData = colCats.some(c => categoryHasData(c, records, year));
      return { ...col, colCats, hasAnyData };
    }).filter(col => col.hasAnyData),
    [categories, records, year]
  );

  if (columns.length === 0) return null;

  return (
    <div className="mb-8 print:hidden">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Jump to category
      </p>
      {/* Horizontally scrollable on screen; wraps naturally in print */}
      <div className="overflow-x-auto print:overflow-visible pb-2">
        <div className="flex gap-2 min-w-max print:min-w-0 print:flex-wrap">
          {columns.map(col => {
            const adultCat  = col.colCats.find(c => c.ageClass === 'Adult');
            const adultHasData = adultCat && categoryHasData(adultCat, records, year);
            const colKey    = `${col.bowType}-${col.gender}`;

            return (
              <div key={colKey} className="flex flex-col gap-1 w-24">
                {/* Column header — Adult category */}
                {adultHasData ? (
                  <a
                    href={`#${categoryId(adultCat)}`}
                    onClick={e => handleClick(categoryId(adultCat), e)}
                    className={`flex items-center justify-center h-9 px-2 rounded-lg
                      text-xs font-semibold transition-colors no-underline
                      ${GENDER_HEADER_COLOR[col.gender]}`}
                  >
                    {col.bowType} {col.gender}
                  </a>
                ) : (
                  <div className={`flex items-center justify-center h-9 px-2 rounded-lg
                    text-xs font-semibold ${GENDER_EMPTY_COLOR[col.gender]}`}>
                    {col.bowType} {col.gender}
                  </div>
                )}

                {/* Age-class sub-links — fixed order, gray when no data */}
                {SUB_AGE_ORDER.map(ageClass => {
                  const cat = col.colCats.find(c => c.ageClass === ageClass);
                  if (!cat) return null;
                  const hasData = categoryHasData(cat, records, year);
                  const id = categoryId(cat);

                  return hasData ? (
                    <a
                      key={ageClass}
                      href={`#${id}`}
                      onClick={e => handleClick(id, e)}
                      className={`flex items-center justify-center h-7 px-2 rounded text-xs font-medium
                        no-underline transition-opacity hover:opacity-75 ${AGE_COLOR[ageClass]}`}
                    >
                      {ageClass}
                    </a>
                  ) : (
                    <div
                      key={ageClass}
                      className={`flex items-center justify-center h-7 px-2 rounded text-xs font-medium
                        opacity-35 cursor-default ${AGE_COLOR[ageClass]}`}
                    >
                      {ageClass}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── SCROLL TO TOP ────────────────────────────────────────────────────────────

const ScrollToTop: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 z-30 print:hidden
        w-10 h-10 rounded-full bg-gray-800 text-white shadow-lg
        flex items-center justify-center
        hover:bg-gray-700 active:bg-gray-900 transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l6 6a1 1 0 01-1.414 1.414L10 5.414l-5.293 5.293a1 1 0 01-1.414-1.414l6-6A1 1 0 0110 3z" clipRule="evenodd" />
      </svg>
    </button>
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
      {/* Print-only document title (hidden on screen) */}
      <div className="hidden print:block print:mb-2 print:pb-1 print:border-b print:border-black">
        <h1 className="print:text-sm print:font-bold">Estonian Archery Leaderboard {selectedYear}</h1>
        <p className="print:text-[8pt] print:text-gray-600 print:mt-0">
          Seasonal best results per athlete · {new Date().toLocaleDateString('et-EE')}
        </p>
      </div>

      {/* Header (hidden in print — replaced by print title above) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-white border border-gray-300 text-gray-600
              hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            ↓ Export PDF
          </button>
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

          <div className="print-columns">
            {LEADERBOARD_LAYOUT.map(cat => (
              <CategorySection
                key={categoryId(cat)}
                cat={cat}
                records={records}
                year={selectedYear}
              />
            ))}
          </div>
        </>
      )}

      <ScrollToTop />
    </div>
  );
};

export default LeaderboardModule;
