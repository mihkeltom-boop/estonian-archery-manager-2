import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Button, Card, Badge, StatCard, Input, Select, EmptyState } from '../common';
import { useDatabaseState } from '../../hooks/useDatabaseState';
import { exportToCSV, downloadCSV } from '../../utils/security';
import { showToast } from '../common/Toast';
import { formatNumber } from '../../utils/formatting';
import type { CompetitionRecord, FilterState } from '../../types';

// ── TABLE COLUMN DEFINITIONS ────────────────────────────────────────────────

const COLUMNS = [
  { key: 'Date',              label: 'Date' },
  { key: 'Athlete',           label: 'Athlete' },
  { key: 'Club',              label: 'Club' },
  { key: 'Bow Type',          label: 'Bow Type' },
  { key: 'Age Class',         label: 'Age Class' },
  { key: 'Gender',            label: 'Gender' },
  { key: 'Shooting Exercise', label: 'Distance' },
  { key: 'Target Face',       label: 'Face' },
  { key: 'Result',            label: 'Result' },
  { key: 'Competition',       label: 'Competition' },
] as const;

// ── COLOR MAPS ──────────────────────────────────────────────────────────────

const AGE_CLASS_COLOR: Record<string, 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'teal'> = {
  'Adult': 'blue',
  'U21':   'purple',
  'U18':   'green',
  'U15':   'yellow',
  'U13':   'red',
  '+50':   'teal',
  '+60':   'teal',
  '+70':   'teal',
};

const GENDER_COLOR: Record<string, 'blue' | 'purple'> = {
  'Men':   'blue',
  'Women': 'purple',
};

// ── RESULT CELL ─────────────────────────────────────────────────────────────

const ResultCell: React.FC<{ value: number }> = ({ value }) => (
  <span className="font-bold tabular-nums text-gray-900">
    {formatNumber(value)}
  </span>
);

// ── SORT INDICATOR ──────────────────────────────────────────────────────────

const SortIndicator: React.FC<{ active: boolean; direction: string }> = ({ active, direction }) =>
  active ? <span className="text-blue-500 ml-1">{direction === 'asc' ? '↑' : '↓'}</span> : null;

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────

interface Props {
  records: CompetitionRecord[];
}

const DatabaseModule: React.FC<Props> = ({ records }) => {
  const db = useDatabaseState(records);
  const { state, displayed, allFiltered, filteredCount, hasMore, activeFilterCount, statistics, uniqueValues, uniqueValuesByCount } = db;

  // Unique option lists for dropdowns
  const clubOptions      = uniqueValues('Club').map(v => ({ value: v, label: v }));
  // Build distance dropdown: append face in brackets only when a distance has multiple face sizes
  const distanceOptions = useMemo(() => {
    const exerciseCounts = new Map<string, number>();
    const facesPerExercise = new Map<string, Set<string>>();
    for (const r of records) {
      const ex = r['Shooting Exercise'];
      if (!ex) continue;
      exerciseCounts.set(ex, (exerciseCounts.get(ex) || 0) + 1);
      if (!facesPerExercise.has(ex)) facesPerExercise.set(ex, new Set());
      if (r['Target Face']) facesPerExercise.get(ex)!.add(r['Target Face']);
    }

    const opts: { value: string; label: string }[] = [];
    const sorted = [...exerciseCounts.entries()].sort((a, b) => b[1] - a[1]);

    for (const [exercise] of sorted) {
      const faces = facesPerExercise.get(exercise) ?? new Set();
      if (faces.size <= 1) {
        const face = [...faces][0];
        opts.push({ value: exercise, label: face ? `${exercise} (${face})` : exercise });
      } else {
        for (const face of [...faces].sort()) {
          opts.push({ value: `${exercise}|${face}`, label: `${exercise} (${face})` });
        }
      }
    }
    return opts;
  }, [records]);

  // ── Infinite scroll via IntersectionObserver ──
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(db.loadMore);
  loadMoreRef.current = db.loadMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // ── Export helpers ──
  const cols = COLUMNS.map(c => ({ key: c.key, label: c.label }));

  const handleExportSelection = () => {
    const csv = exportToCSV(displayed as unknown as Record<string, unknown>[], cols);
    downloadCSV(csv, `archery-selection-${new Date().toISOString().split('T')[0]}.csv`);
    showToast('success', `Exported ${displayed.length} loaded records to CSV`);
  };

  const handleExportAll = () => {
    const csv = exportToCSV(allFiltered as unknown as Record<string, unknown>[], cols);
    downloadCSV(csv, `archery-all-${new Date().toISOString().split('T')[0]}.csv`);
    showToast('success', `Exported all ${allFiltered.length} filtered records to CSV`);
  };

  // Export viewer-compatible JSON (strips internal-only fields not used by the viewer)
  const handleExportJSON = () => {
    const viewerRecords = allFiltered.map(({ _corrections, _needsReview, _confidence, _originalData, ...pub }) => pub);
    const blob = new Blob([JSON.stringify(viewerRecords, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archery-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', `Exported ${viewerRecords.length} records as viewer JSON`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Database</h2>
          <p className="text-gray-500 mt-1">
            {filteredCount.toLocaleString()} of {records.length.toLocaleString()} records
            {activeFilterCount > 0 && (
              <span className="text-blue-600 font-medium ml-2">
                · {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="secondary" onClick={handleExportSelection} size="sm">
            ↓ CSV loaded ({displayed.length.toLocaleString()})
          </Button>
          <Button variant="secondary" onClick={handleExportAll} size="sm">
            ↓ CSV all ({filteredCount.toLocaleString()})
          </Button>
          <Button variant="secondary" onClick={handleExportJSON} size="sm">
            ↓ JSON ({filteredCount.toLocaleString()})
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Records"      value={formatNumber(statistics.total)}                      emoji="📊" color="blue" />
        <StatCard label="Athletes"     value={formatNumber(statistics.athletes)}                    emoji="🏹" color="purple" />
        <StatCard label="Clubs"        value={formatNumber(statistics.clubs)}                       emoji="🏛️" color="teal" />
        <StatCard label="Competitions" value={formatNumber(statistics.competitions)}                emoji="🏆" color="orange" />
        <StatCard label="Avg Result"   value={statistics.avgResult ? formatNumber(statistics.avgResult) : '—'} emoji="📈" color="green" />
        <StatCard label="Best Score"   value={statistics.bestResult ? formatNumber(statistics.bestResult) : '—'} emoji="⭐" color="orange" />
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        {/* Row 1: Search */}
        <Input
          placeholder="🔍 Search athletes, clubs, competitions…"
          value={state.filters.searchText}
          onChange={e => db.setFilter('searchText', e.target.value)}
        />

        {/* Row 2: Distance + Club dropdowns */}
        <div className="flex gap-3 flex-wrap">
          <div className="w-40">
            <Select
              options={distanceOptions}
              placeholder="All Distances"
              value={state.filters.distance}
              onChange={e => db.setFilter('distance', e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              options={clubOptions}
              placeholder="All Clubs"
              value={state.filters.club}
              onChange={e => db.setFilter('club', e.target.value)}
            />
          </div>
        </div>

        {/* Row 3: Pill filters */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">

            {/* Gender pills */}
            <div className="flex gap-1">
              {['', 'Men', 'Women'].map(g => (
                <button
                  key={g}
                  onClick={() => db.setFilter('gender', g)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    state.filters.gender === g
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {g || 'All Genders'}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-gray-200" />

            {/* Bow Type pills */}
            <div className="flex gap-1 flex-wrap">
              {['', ...uniqueValues('Bow Type')].map(bt => (
                <button
                  key={bt}
                  onClick={() => db.setFilter('bowType', bt)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    state.filters.bowType === bt
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {bt || 'All Bow Types'}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-gray-200" />

            {/* Age Class pills */}
            <div className="flex gap-1 flex-wrap">
              {['', ...uniqueValues('Age Class')].map(ac => (
                <button
                  key={ac}
                  onClick={() => db.setFilter('ageClass', ac)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    state.filters.ageClass === ac
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {ac || 'All Ages'}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-gray-200" />

            {/* Seasonal best toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={state.filters.seasonalBest}
                onChange={e => db.setFilter('seasonalBest', e.target.checked)}
                className="rounded text-blue-600"
              />
              Seasonal best only
            </label>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={db.clearFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => db.setSort(col.key)}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500
                      uppercase tracking-wide cursor-pointer hover:bg-gray-100
                      whitespace-nowrap select-none"
                  >
                    {col.label}
                    <SortIndicator
                      active={state.sort.column === col.key}
                      direction={state.sort.direction}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      emoji="🔍"
                      title="No records match your filters"
                      description="Try adjusting or clearing the filters above"
                    />
                  </td>
                </tr>
              ) : (
                displayed.map(r => (
                  <tr key={r._id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.Date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.Athlete}</td>
                    <td className="px-4 py-3">
                      <Badge color="blue">{r.Club}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r['Bow Type']}</td>
                    <td className="px-4 py-3">
                      <Badge color={AGE_CLASS_COLOR[r['Age Class']] ?? 'gray'}>{r['Age Class']}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={GENDER_COLOR[r.Gender] ?? 'gray'}>{r.Gender}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r['Shooting Exercise']}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">{r['Target Face'] || '—'}</td>
                    <td className="px-4 py-3"><ResultCell value={r.Result} /></td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.Competition}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Infinite scroll sentinel + status */}
        {hasMore && (
          <div ref={sentinelRef} className="px-4 py-3 border-t border-gray-100 text-center">
            <span className="text-sm text-gray-400">
              Showing {displayed.length.toLocaleString()} of {filteredCount.toLocaleString()} — scroll for more
            </span>
          </div>
        )}
        {!hasMore && displayed.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-center">
            <span className="text-sm text-gray-400">
              All {filteredCount.toLocaleString()} records loaded
            </span>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DatabaseModule;
