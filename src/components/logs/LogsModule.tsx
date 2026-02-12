import React, { useMemo, useState } from 'react';
import { Card, Badge, ConfidenceBadge, Input, Select, Button, EmptyState } from '../common';
import type { CompetitionRecord, Correction } from '../../types';

// ── TYPES ───────────────────────────────────────────────────────────────────

interface CorrectionRow extends Correction {
  athlete: string;
  recordId: number;
}

// ── CONSTANTS ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const METHOD_COLOR: Record<string, 'green' | 'yellow' | 'purple' | 'blue' | 'gray'> = {
  exact:       'green',
  fuzzy:       'yellow',
  translation: 'purple',
  extraction:  'blue',
};

const COLUMNS = [
  { key: 'timestamp',  label: 'Time' },
  { key: 'athlete',    label: 'Athlete' },
  { key: 'field',      label: 'Field' },
  { key: 'original',   label: 'Original' },
  { key: 'corrected',  label: 'Corrected' },
  { key: 'method',     label: 'Method' },
  { key: 'confidence', label: 'Confidence' },
] as const;

// ── SORT INDICATOR ──────────────────────────────────────────────────────────

const SortIndicator: React.FC<{ active: boolean; direction: string }> = ({ active, direction }) =>
  active ? <span className="text-blue-500 ml-1">{direction === 'asc' ? '↑' : '↓'}</span> : null;

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────

interface Props {
  records: CompetitionRecord[];
}

const LogsModule: React.FC<Props> = ({ records }) => {
  // Flatten all corrections from all records
  const allCorrections = useMemo<CorrectionRow[]>(() => {
    const rows: CorrectionRow[] = [];
    records.forEach(r => {
      (r._corrections ?? []).forEach(c => {
        rows.push({ ...c, athlete: r.Athlete, recordId: r._id });
      });
    });
    return rows.sort((a, b) => b.timestamp - a.timestamp);
  }, [records]);

  // Local state
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [sortCol, setSortCol] = useState<string>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Filtering
  const filtered = useMemo(() => {
    let d = allCorrections;
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(c =>
        c.athlete.toLowerCase().includes(q) ||
        c.field.toLowerCase().includes(q) ||
        c.original.toLowerCase().includes(q) ||
        c.corrected.toLowerCase().includes(q)
      );
    }
    if (methodFilter) d = d.filter(c => c.method === methodFilter);
    return d;
  }, [allCorrections, search, methodFilter]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortCol as keyof CorrectionRow];
      const bv = b[sortCol as keyof CorrectionRow];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  // Pagination
  const displayed = useMemo(() => sorted.slice(0, page * PAGE_SIZE), [sorted, page]);
  const hasMore = sorted.length > displayed.length;

  // Sort toggle
  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  // Method options
  const methodOptions = [...new Set(allCorrections.map(c => c.method))].sort()
    .map(m => ({ value: m, label: (m as string).charAt(0).toUpperCase() + (m as string).slice(1) }));

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Correction Logs</h2>
        <p className="text-gray-500 mt-1">
          {filtered.length.toLocaleString()} correction{filtered.length !== 1 ? 's' : ''} across {records.length.toLocaleString()} records
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="🔍 Search athletes, fields, values…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-48">
            <Select
              options={methodOptions}
              placeholder="All Methods"
              value={methodFilter}
              onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
            />
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
                    onClick={() => toggleSort(col.key)}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500
                      uppercase tracking-wide cursor-pointer hover:bg-gray-100
                      whitespace-nowrap select-none"
                  >
                    {col.label}
                    <SortIndicator active={sortCol === col.key} direction={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      emoji="📋"
                      title="No corrections found"
                      description="No automatic or manual corrections were made during import"
                    />
                  </td>
                </tr>
              ) : (
                displayed.map((c, i) => (
                  <tr key={`${c.recordId}-${c.field}-${i}`} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(c.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.athlete}</td>
                    <td className="px-4 py-3">
                      <Badge color="gray">{c.field}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-mono">
                        {c.original}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-mono">
                        {c.corrected}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={METHOD_COLOR[c.method] ?? 'gray'}>
                        {c.method}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge value={c.confidence} />
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
              Showing {displayed.length.toLocaleString()} of {filtered.length.toLocaleString()}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default LogsModule;
