import React, { useState, useMemo, useEffect } from 'react';
import { Button, Card, Badge, ConfidenceBadge } from '../common';
import type { CompetitionRecord } from '../../types';

interface Props {
  records: CompetitionRecord[];
  onComplete: (approved: CompetitionRecord[]) => void;
}

type Decision = 'approve' | 'reject';

const ReviewModule: React.FC<Props> = ({ records, onComplete }) => {
  const flagged = useMemo(() => records.filter(r => r._needsReview), [records]);
  const [index, setIndex]       = useState(0);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});

  const current    = flagged[index];
  const reviewed   = Object.keys(decisions).length;
  const isLastCard = index === flagged.length - 1;

  // ── Decide ─────────────────────────────────────────────────────────────

  const decide = (dec: Decision) => {
    const next = { ...decisions, [current._id]: dec };
    setDecisions(next);

    if (!isLastCard) {
      setIndex(i => i + 1);
    } else {
      // Build final record list: all auto-approved + manually approved
      const approvedIds = new Set(
        Object.entries(next)
          .filter(([, d]) => d === 'approve')
          .map(([id]) => Number(id))
      );
      const final = records.filter(r => !r._needsReview || approvedIds.has(r._id));
      onComplete(final);
    }
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current) return;
      if ((e.target as HTMLElement).matches('input, select, textarea')) return;
      if (e.key === 'a' || e.key === 'A') decide('approve');
      if (e.key === 'r' || e.key === 'R') decide('reject');
      if ((e.key === 's' || e.key === 'S') && !isLastCard) setIndex(i => i + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, decisions, current, isLastCard]);

  // ── No flags needed ────────────────────────────────────────────────────

  if (!flagged.length) {
    return (
      <div className="fade-in text-center py-20 space-y-5">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto">
          ✅
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">All records auto-approved!</h3>
          <p className="text-gray-500 mt-1">
            Every record matched with high confidence — no manual review needed.
          </p>
        </div>
        <Button onClick={() => onComplete(records)} size="lg">
          Continue to Database →
        </Button>
      </div>
    );
  }

  // ── Main review UI ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6 fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review Flagged Records</h2>
          <p className="text-gray-500 mt-1">
            {reviewed} of {flagged.length} reviewed ·{' '}
            {Object.values(decisions).filter(d => d === 'approve').length} approved ·{' '}
            {Object.values(decisions).filter(d => d === 'reject').length} rejected
          </p>
        </div>
        <div className="text-right text-xs text-gray-400 hidden sm:block">
          <p className="font-medium mb-1">Keyboard shortcuts</p>
          <p>
            <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5">A</kbd> approve &nbsp;
            <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5">R</kbd> reject &nbsp;
            <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5">S</kbd> skip
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${(reviewed / flagged.length) * 100}%` }}
        />
      </div>

      {/* Review card */}
      {current && (
        <Card className="fade-in overflow-hidden">

          {/* Card header */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{current.Athlete}</h3>
              <p className="text-sm text-gray-500">
                {current.Competition} · {current.Date} · {current._sourceFile}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <ConfidenceBadge value={current._confidence} />
              <Badge color="blue">{index + 1} / {flagged.length}</Badge>
            </div>
          </div>

          {/* Corrections highlight */}
          {current._corrections.length > 0 && (
            <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-100">
              <p className="text-xs font-semibold text-yellow-800 mb-2">
                ⚠ Auto-corrections applied — please verify
              </p>
              <div className="space-y-2">
                {current._corrections.map((c, i) => (
                  <div key={i} className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium text-yellow-800 w-20 shrink-0">{c.field}</span>
                    <span className="text-gray-400 line-through">{c.original}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-green-700">{c.corrected}</span>
                    <ConfidenceBadge value={c.confidence} />
                    <Badge color="gray">{c.method}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Record fields */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-5">
            {([
              ['Club',     current.Club],
              ['Bow Type', current['Bow Type']],
              ['Age Class',current['Age Class']],
              ['Gender',   current.Gender],
              ['Distance', current['Shooting Exercise']],
              ['Result',   current.Result],
            ] as [string, string | number][]).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 flex-wrap">
            <Button onClick={() => decide('approve')}>
              ✓ Approve (A)
            </Button>
            <Button variant="danger" onClick={() => decide('reject')}>
              ✗ Reject (R)
            </Button>
            {!isLastCard && (
              <Button variant="secondary" onClick={() => setIndex(i => i + 1)}>
                → Skip (S)
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Batch approve all remaining */}
      {flagged.length - reviewed > 1 && (
        <div className="text-center">
          <button
            onClick={() => {
              const all: Record<number, Decision> = { ...decisions };
              flagged.slice(index).forEach(r => { all[r._id] = 'approve'; });
              const approvedIds = new Set(
                Object.entries(all)
                  .filter(([, d]) => d === 'approve')
                  .map(([id]) => Number(id))
              );
              onComplete(records.filter(r => !r._needsReview || approvedIds.has(r._id)));
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Accept all remaining {flagged.length - reviewed} records →
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewModule;
