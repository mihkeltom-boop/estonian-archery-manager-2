import React, { useState, useMemo, useEffect } from 'react';
import { Button, Card, Badge, ConfidenceBadge } from '../common';
import ClubAutocomplete from '../common/ClubAutocomplete';
import type { CompetitionRecord, BowType } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Decision = 'approve' | 'reject';

/**
 * A grouped "issue ticket" — all records that share the same original value
 * for the same field get merged into one ticket for batch editing.
 *
 * e.g. 12 records all have Club "Tallinna Laskuklubi" (misspelled the same way)
 * → one ticket, apply fix once, all 12 records updated.
 */
interface IssueTicket {
  id: string;                          // Unique ticket id
  field: string;                       // Which field has the issue (usually 'Club')
  originalValue: string;               // What was in the CSV
  suggestedValue: string;              // What auto-correction suggested
  confidence: number;                  // Match confidence
  method: string;                      // How it was corrected
  recordIds: number[];                 // All _id values of affected records
  resolvedValue: string | null;        // null = unresolved
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP FLAGGED RECORDS INTO TICKETS
// ─────────────────────────────────────────────────────────────────────────────

function buildTickets(records: CompetitionRecord[]): IssueTicket[] {
  // Group by: field + originalValue
  const map = new Map<string, IssueTicket>();

  for (const record of records) {
    if (!record._needsReview) continue;
    for (const correction of record._corrections) {
      const key = `${correction.field}::${correction.original}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          field: correction.field,
          originalValue: correction.original,
          suggestedValue: correction.corrected,
          confidence: correction.confidence,
          method: correction.method,
          recordIds: [],
          resolvedValue: null,
        });
      }
      map.get(key)!.recordIds.push(record._id);
    }

    // Records flagged but with no corrections logged (e.g. unknown club)
    if (record._corrections.length === 0) {
      const key = `Club::${record.Club}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          field: 'Club',
          originalValue: record.Club,
          suggestedValue: record.Club,
          confidence: record._confidence,
          method: 'unknown',
          recordIds: [],
          resolvedValue: null,
        });
      }
      map.get(key)!.recordIds.push(record._id);
    }
  }

  // Sort: lowest confidence first (most urgent)
  return Array.from(map.values()).sort((a, b) => a.confidence - b.confidence);
}

// ─────────────────────────────────────────────────────────────────────────────
// TICKET CARD
// ─────────────────────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: IssueTicket;
  affectedRecords: CompetitionRecord[];
  decision: Decision | null;
  onApprove: (resolvedValue: string) => void;
  onReject: () => void;
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticket, affectedRecords, decision, onApprove, onReject,
}) => {
  const [editedValue, setEditedValue] = useState(ticket.suggestedValue);
  const isBulk = ticket.recordIds.length > 1;

  // Keyboard shortcuts for approve/reject
  useEffect(() => {
    if (decision) return; // Already decided

    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if ((e.target as HTMLElement).matches('input, select, textarea')) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        onApprove(editedValue);
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        onReject();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editedValue, decision, onApprove, onReject]);

  if (decision) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm
        ${decision === 'approve' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        <span className="text-lg">{decision === 'approve' ? '✓' : '✗'}</span>
        <div>
          <span className="font-medium">{ticket.originalValue}</span>
          {decision === 'approve' && ticket.resolvedValue && ticket.resolvedValue !== ticket.originalValue && (
            <span className="text-green-500 ml-2">→ {ticket.resolvedValue}</span>
          )}
          <span className="ml-2 opacity-70">({ticket.recordIds.length} record{ticket.recordIds.length > 1 ? 's' : ''})</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden fade-in">
      {/* Ticket header */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{ticket.field}</span>
          <ConfidenceBadge value={ticket.confidence} />
          <Badge color="gray">{ticket.method}</Badge>
          {isBulk && (
            <Badge color="purple">
              {ticket.recordIds.length} records share this issue
            </Badge>
          )}
        </div>
      </div>

      {/* Correction detail */}
      <div className="p-5 space-y-4">
        {/* Original → suggested */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 mb-1">Original value in CSV</p>
            <span className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-mono font-medium">
              {ticket.originalValue}
            </span>
          </div>
          <span className="text-gray-400 text-lg mt-5">→</span>
          <div className="flex-1 min-w-48">
            <p className="text-xs text-gray-400 mb-1">
              {ticket.field === 'Club'
                ? 'Choose correct club (or type to add new)'
                : 'Corrected value'}
            </p>
            {ticket.field === 'Club' ? (
              <ClubAutocomplete
                value={editedValue}
                onChange={setEditedValue}
                autoFocus
              />
            ) : (
              <input
                value={editedValue}
                onChange={e => setEditedValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>
        </div>

        {/* Affected athletes preview */}
        <div>
          <p className="text-xs text-gray-400 mb-2">
            Affected records {isBulk ? `(${ticket.recordIds.length} total, showing first 5)` : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {affectedRecords.slice(0, 5).map(r => (
              <span key={r._id} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                {r.Athlete} · {r.Date}
              </span>
            ))}
            {affectedRecords.length > 5 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                +{affectedRecords.length - 5} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-50 border-t border-gray-200 px-5 py-3.5 flex gap-3 flex-wrap items-center">
        <Button onClick={() => onApprove(editedValue)}>
          ✓ Apply to {isBulk ? `all ${ticket.recordIds.length} records` : 'record'}
        </Button>
        <Button variant="danger" onClick={onReject}>
          ✗ Reject
        </Button>
        <span className="text-xs text-gray-400 ml-auto hidden sm:block">
          <kbd className="bg-gray-200 rounded px-1">Enter</kbd> approve &nbsp;
          <kbd className="bg-gray-200 rounded px-1">Delete</kbd> reject
        </span>
      </div>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN REVIEW MODULE
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  records: CompetitionRecord[];
  onComplete: (finalRecords: CompetitionRecord[]) => void;
}

const ReviewModule: React.FC<Props> = ({ records, onComplete }) => {
  const tickets = useMemo(() => buildTickets(records), [records]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [decisions, setDecisions]     = useState<Record<string, { decision: Decision; value: string }>>({});

  const current      = tickets[currentIdx];
  const reviewedCount = Object.keys(decisions).length;
  const isLast       = currentIdx === tickets.length - 1;

  // ── Apply decision ──────────────────────────────────────────────────────

  const applyDecision = (decision: Decision, resolvedValue: string) => {
    const next = { ...decisions, [current.id]: { decision, value: resolvedValue } };
    setDecisions(next);

    if (!isLast) {
      setCurrentIdx(i => i + 1);
    } else {
      finalise(next);
    }
  };

  const finalise = (allDecisions: typeof decisions) => {
    // Build a map of recordId → approved club corrections
    const approvedFixes = new Map<number, Record<string, string>>();

    for (const [ticketId, { decision, value }] of Object.entries(allDecisions)) {
      if (decision !== 'approve') continue;
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) continue;
      for (const recordId of ticket.recordIds) {
        if (!approvedFixes.has(recordId)) approvedFixes.set(recordId, {});
        approvedFixes.get(recordId)![ticket.field] = value;
      }
    }

    // Apply fixes to records, exclude rejected-only records
    const rejectedIds = new Set<number>();
    for (const [ticketId, { decision }] of Object.entries(allDecisions)) {
      if (decision !== 'reject') continue;
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) ticket.recordIds.forEach(id => rejectedIds.add(id));
    }

    const finalRecords = records
      .filter(r => !r._needsReview || !rejectedIds.has(r._id))
      .map(r => {
        const fixes = approvedFixes.get(r._id);
        if (!fixes) return r;
        return {
          ...r,
          ...(fixes['Club'] ? { Club: fixes['Club'] } : {}),
          ...(fixes['Bow Type'] ? { 'Bow Type': fixes['Bow Type'] as BowType } : {}),
        };
      });

    onComplete(finalRecords);
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current) return;
      if ((e.target as HTMLElement).matches('input, select, textarea')) return;
      // Approve/reject handled by active TicketCard — key events bubble up here
      // We only handle navigation shortcuts
      if (e.key === 's' || e.key === 'S') {
        if (!isLast) setCurrentIdx(i => i + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, isLast]);

  // ── No flags ─────────────────────────────────────────────────────────────

  if (!tickets.length) {
    return (
      <div className="fade-in text-center py-20 space-y-5">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto">✅</div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">All records auto-approved!</h3>
          <p className="text-gray-500 mt-1">Every club matched with high confidence — no review needed.</p>
        </div>
        <Button onClick={() => onComplete(records)} size="lg">Continue to Database →</Button>
      </div>
    );
  }

  // ── Summary header ────────────────────────────────────────────────────────

  const affectedRecordCount = new Set(tickets.flatMap(t => t.recordIds)).size;
  const approvedCount = Object.values(decisions).filter(d => d.decision === 'approve').length;
  const rejectedCount = Object.values(decisions).filter(d => d.decision === 'reject').length;

  return (
    <div className="space-y-6 fade-in">

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review Issues</h2>
        <p className="text-gray-500 mt-1">
          {tickets.length} unique issue{tickets.length > 1 ? 's' : ''} affecting {affectedRecordCount} records &nbsp;·&nbsp;
          {reviewedCount} reviewed &nbsp;·&nbsp;
          <span className="text-green-600">{approvedCount} approved</span> &nbsp;·&nbsp;
          <span className="text-red-500">{rejectedCount} rejected</span>
        </p>
      </div>

      {/* Overall progress */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${(reviewedCount / tickets.length) * 100}%` }}
        />
      </div>

      {/* Active ticket */}
      {current && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Issue {currentIdx + 1} of {tickets.length}
            </span>
          </div>
          <TicketCard
            key={current.id}
            ticket={{ ...current, resolvedValue: null }}
            affectedRecords={records.filter(r => current.recordIds.includes(r._id))}
            decision={null}
            onApprove={val => applyDecision('approve', val)}
            onReject={() => applyDecision('reject', '')}
          />
        </div>
      )}

      {/* Batch approve all remaining */}
      {tickets.length - reviewedCount > 1 && (
        <div className="text-center pt-2">
          <button
            onClick={() => {
              const bulk: typeof decisions = { ...decisions };
              tickets.slice(currentIdx).forEach(t => {
                bulk[t.id] = { decision: 'approve', value: t.suggestedValue };
              });
              setDecisions(bulk);
              finalise(bulk);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Accept all remaining {tickets.length - reviewedCount} issues with suggested values →
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewModule;
