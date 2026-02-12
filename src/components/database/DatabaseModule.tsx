import React from 'react';
import { Button, Card, Badge, StatCard, Input, Select, EmptyState } from '../common';
import { useDatabaseState } from '../../hooks/useDatabaseState';
import { exportToCSV, downloadCSV } from '../../utils/security';
import { capitalizeName } from '../../utils/formatting';
import { getClubs } from '../../utils/clubStore';
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
  { key: 'Result',            label: 'Result' },
  { key: 'Competition',       label: 'Competition' },
] as const;

// ── HELPER FUNCTIONS ────────────────────────────────────────────────────────

// Get full club name from code for tooltip
const getClubName = (code: string): string => {
  const clubs = getClubs();
  const club = clubs.find(c => c.code === code);
  return club ? club.name : code;
};

// ── RESULT CELL ─────────────────────────────────────────────────────────────

const ResultCell: React.FC<{ value: number }> = ({ value }) => (
  <span className={`font-bold tabular-nums ${
    value >= 600 ? 'text-green-600' : value >= 500 ? 'text-blue-600' : 'text-gray-700'
  }`}>
    {value}
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
  const { state, displayed, filteredCount, hasMore, activeFilterCount, statistics, uniqueValues } = db;

  // Unique option lists for dropdowns
  const clubOptions     = uniqueValues('Club').map(v => ({ value: v, label: v }));
  const bowOptions      = uniqueValues('Bow Type').map(v => ({ value: v, label: v }));
  const distanceOptions = uniqueValues('Shooting Exercise').map(v => ({ value: v, label: v }));

  // Multi-select filter helpers
  const toggleGender = (gender: string) => {
    const current = state.filters.genders;
    const updated = current.includes(gender)
      ? current.filter(g => g !== gender)
      : [...current, gender];
    db.setFilter('genders', updated);
  };

  const toggleAgeClass = (ageClass: string) => {
    const current = state.filters.ageClasses;
    const updated = current.includes(ageClass)
      ? current.filter(a => a !== ageClass)
      : [...current, ageClass];
    db.setFilter('ageClasses', updated);
  };

  const handleExport = () => {
    const csv = exportToCSV(
      displayed as unknown as Record<string, unknown>[],
      COLUMNS.map(c => ({ key: c.key, label: c.label }))
    );
    downloadCSV(csv, `archery-${new Date().toISOString().split('T')[0]}.csv`);
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
        <Button variant="secondary" onClick={handleExport} size="sm">
          ↓ Export CSV
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Records"      value={statistics.total.toLocaleString()} emoji="📊" color="blue" />
        <StatCard label="Athletes"     value={statistics.athletes}               emoji="🏹" color="purple" />
        <StatCard label="Clubs"        value={statistics.clubs}                  emoji="🏛️" color="teal" />
        <StatCard label="Competitions" value={statistics.competitions}           emoji="🏆" color="orange" />
        <StatCard label="Avg Result"   value={statistics.avgResult || '—'}       emoji="📈" color="green" />
        <StatCard label="Best Score"   value={statistics.bestResult || '—'}      emoji="⭐" color="orange" />
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            className="sm:col-span-2"
            placeholder="🔍 Search athletes, clubs, competitions…"
            value={state.filters.searchText}
            onChange={e => db.setFilter('searchText', e.target.value)}
          />
          <Select
            options={clubOptions}
            placeholder="All Clubs"
            value={state.filters.club}
            onChange={e => db.setFilter('club', e.target.value)}
          />
          <Select
            options={bowOptions}
            placeholder="All Bow Types"
            value={state.filters.bowType}
            onChange={e => db.setFilter('bowType', e.target.value)}
          />
          <Select
            options={distanceOptions}
            placeholder="All Distances"
            value={state.filters.distance}
            onChange={e => db.setFilter('distance', e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">

            {/* Gender pills - multi-select */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Gender:</span>
              <div className="flex gap-1">
                {['Men', 'Women'].map(g => (
                  <button
                    key={g}
                    onClick={() => toggleGender(g)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      state.filters.genders.includes(g)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

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

        {/* Age class pills - multi-select */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Age Class:</span>
          <div className="flex gap-1 flex-wrap">
            {['Adult', 'U21', 'U18', 'U15', 'U13', '+50', '+60'].map(age => (
              <button
                key={age}
                onClick={() => toggleAgeClass(age)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  state.filters.ageClasses.includes(age)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {age}
              </button>
            ))}
          </div>
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
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{capitalizeName(r.Athlete)}</td>
                    <td className="px-4 py-3">
                      <Badge color="blue" title={getClubName(r.Club)}>{r.Club}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r['Bow Type']}</td>
                    <td className="px-4 py-3">
                      {r['Age Class'] && <Badge color="purple">{r['Age Class']}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.Gender}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r['Shooting Exercise']}</td>
                    <td className="px-4 py-3"><ResultCell value={r.Result} /></td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs">
                      <div className="line-clamp-2">{r.Competition}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {hasMore && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              Showing {displayed.length.toLocaleString()} of {filteredCount.toLocaleString()}
            </span>
            <Button variant="secondary" size="sm" onClick={db.loadMore}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DatabaseModule;
