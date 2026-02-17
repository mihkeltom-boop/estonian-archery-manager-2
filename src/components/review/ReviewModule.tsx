import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button, Card, Badge, ConfidenceBadge } from '../common';
import ClubAutocomplete from '../common/ClubAutocomplete';
import type { CompetitionRecord } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Decision = 'approve' | 'reject';
type Phase = 'import' | 'consistency';

interface IssueTicket {
  id: string;
  field: string;
  originalValue: string;
  suggestedValue: string;
  confidence: number;
  method: string;
  recordIds: number[];
  resolvedValue: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE LEVEL HELPER
// ─────────────────────────────────────────────────────────────────────────────

function confidenceLevel(value: number): { label: string; color: 'green' | 'yellow' | 'red' } {
  if (value >= 85) return { label: 'High', color: 'green' };
  if (value >= 60) return { label: 'Medium', color: 'yellow' };
  return { label: 'Low', color: 'red' };
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP FLAGGED RECORDS INTO TICKETS
// ─────────────────────────────────────────────────────────────────────────────

function buildTickets(records: CompetitionRecord[]): IssueTicket[] {
  const map = new Map<string, IssueTicket>();

  for (const record of records) {
    if (!record._needsReview) continue;
    for (const correction of record._corrections) {
      const key = `${correction.field}::${correction.original}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key, field: correction.field, originalValue: correction.original,
          suggestedValue: correction.corrected, confidence: correction.confidence,
          method: correction.method, recordIds: [], resolvedValue: null,
        });
      }
      map.get(key)!.recordIds.push(record._id);
    }

    if (record._corrections.length === 0) {
      const key = `Club::${record.Club}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key, field: 'Club', originalValue: record.Club, suggestedValue: record.Club,
          confidence: record._confidence, method: 'unknown', recordIds: [], resolvedValue: null,
        });
      }
      map.get(key)!.recordIds.push(record._id);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.confidence - b.confidence);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSISTENCY CHECKING
// ─────────────────────────────────────────────────────────────────────────────

function countVariants(values: string[]): { sorted: [string, number][]; dominance: number } {
  const counts = new Map<string, number>();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const dominance = sorted[0][1] / values.length;
  return { sorted, dominance };
}

function extractYear(date: string): string {
  if (!date) return 'unknown';
  const dotParts = date.split('.');
  if (dotParts.length === 3 && dotParts[2].length === 4) return dotParts[2];
  const dashParts = date.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) return dashParts[0];
  return 'unknown';
}

function isSpecificAgeClass(ac: string): boolean {
  return ac !== 'Adult';
}

function autoFixAgeClasses(records: CompetitionRecord[]): CompetitionRecord[] {
  const groups = new Map<string, CompetitionRecord[]>();
  for (const r of records) {
    const name = r.Athlete.trim();
    if (!name) continue;
    const key = `${name.toLowerCase()}__${extractYear(r.Date)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const fixes = new Map<number, string>();

  for (const recs of groups.values()) {
    const ageClasses = [...new Set(recs.map(r => r['Age Class']))];
    if (ageClasses.length <= 1) continue;
    const specific = ageClasses.filter(isSpecificAgeClass);
    if (specific.length === 1) {
      const correctClass = specific[0];
      for (const r of recs) {
        if (r['Age Class'] !== correctClass) fixes.set(r._id, correctClass);
      }
    }
  }

  if (fixes.size === 0) return records;

  return records.map(r => {
    const fix = fixes.get(r._id);
    if (!fix) return r;
    return {
      ...r,
      'Age Class': fix as CompetitionRecord['Age Class'],
      _corrections: [
        ...r._corrections,
        { field: 'Age Class', original: r['Age Class'], corrected: fix,
          method: 'extraction' as const, confidence: 95, timestamp: Date.now() },
      ],
    };
  });
}

function buildConsistencyTickets(records: CompetitionRecord[]): IssueTicket[] {
  const tickets: IssueTicket[] = [];
  const athleteGroups = new Map<string, CompetitionRecord[]>();
  for (const r of records) {
    const name = r.Athlete.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!athleteGroups.has(key)) athleteGroups.set(key, []);
    athleteGroups.get(key)!.push(r);
  }

  for (const [normName, recs] of athleteGroups) {
    if (recs.length < 2) continue;
    const nameVariants = [...new Set(recs.map(r => r.Athlete))];
    const athleteName = nameVariants.length === 1 ? nameVariants[0] : recs[0].Athlete;

    if (nameVariants.length > 1) {
      const { sorted, dominance } = countVariants(recs.map(r => r.Athlete));
      tickets.push({
        id: `consistency::Athlete::${normName}`, field: 'Athlete',
        originalValue: nameVariants.join(' / '), suggestedValue: sorted[0][0],
        confidence: Math.round(dominance * 100), method: 'consistency',
        recordIds: recs.map(r => r._id), resolvedValue: null,
      });
    }

    const genderVariants = [...new Set(recs.map(r => r.Gender))];
    if (genderVariants.length > 1) {
      const { sorted, dominance } = countVariants(recs.map(r => r.Gender));
      tickets.push({
        id: `consistency::Gender::${normName}`, field: 'Gender',
        originalValue: `${athleteName}: ${sorted.map(([v, n]) => `${v} (${n}x)`).join(' / ')}`,
        suggestedValue: sorted[0][0], confidence: Math.round(dominance * 100),
        method: 'consistency', recordIds: recs.map(r => r._id), resolvedValue: null,
      });
    }

    const yearGroups = new Map<string, CompetitionRecord[]>();
    for (const r of recs) {
      const year = extractYear(r.Date);
      if (!yearGroups.has(year)) yearGroups.set(year, []);
      yearGroups.get(year)!.push(r);
    }
    for (const [year, yearRecs] of yearGroups) {
      const ageVariants = [...new Set(yearRecs.map(r => r['Age Class']))];
      if (ageVariants.length <= 1) continue;
      const { sorted, dominance } = countVariants(yearRecs.map(r => r['Age Class']));
      tickets.push({
        id: `consistency::Age Class::${normName}::${year}`, field: 'Age Class',
        originalValue: `${athleteName} (${year}): ${sorted.map(([v, n]) => `${v} (${n}x)`).join(' / ')}`,
        suggestedValue: sorted[0][0], confidence: Math.round(dominance * 100),
        method: 'consistency', recordIds: yearRecs.map(r => r._id), resolvedValue: null,
      });
    }
  }

  return tickets.sort((a, b) => b.confidence - a.confidence);
}

function applyConsistencyFixes(
  records: CompetitionRecord[],
  tickets: IssueTicket[],
  decisions: Record<string, { decision: Decision; value: string }>,
): CompetitionRecord[] {
  const fixes = new Map<number, Record<string, string>>();

  for (const ticket of tickets) {
    const dec = decisions[ticket.id];
    if (!dec || dec.decision !== 'approve') continue;
    for (const recordId of ticket.recordIds) {
      if (!fixes.has(recordId)) fixes.set(recordId, {});
      fixes.get(recordId)![ticket.field] = dec.value;
    }
  }

  return records.map(r => {
    const f = fixes.get(r._id);
    if (!f) return r;
    return {
      ...r,
      ...(f['Athlete'] ? { Athlete: f['Athlete'] } : {}),
      ...(f['Age Class'] ? { 'Age Class': f['Age Class'] as CompetitionRecord['Age Class'] } : {}),
      ...(f['Gender'] ? { Gender: f['Gender'] as CompetitionRecord['Gender'] } : {}),
    };
  });
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
  isActive?: boolean;
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticket, affectedRecords, decision, onApprove, onReject, isActive = false,
}) => {
  const [editedValue, setEditedValue] = useState(ticket.suggestedValue);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isBulk = ticket.recordIds.length > 1;
  const approveRef = useRef<HTMLButtonElement>(null);
  const level = confidenceLevel(ticket.confidence);

  // Keyboard shortcuts — only on active cards
  useEffect(() => {
    if (!isActive || decision) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, select, textarea')) {
        // Enter inside input field triggers approve
        if (e.key === 'Enter') {
          e.preventDefault();
          onApprove(editedValue);
        }
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); onApprove(editedValue); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onReject(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, decision, editedValue, onApprove, onReject]);

  if (decision) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm
        ${decision === 'approve' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        <span className="text-lg">{decision === 'approve' ? '✓' : '✗'}</span>
        <div className="flex-1">
          <span className="font-medium">{ticket.originalValue}</span>
          {decision === 'approve' && ticket.resolvedValue && ticket.resolvedValue !== ticket.originalValue && (
            <span className="text-green-500 ml-2">→ {ticket.resolvedValue}</span>
          )}
          <span className="ml-2 opacity-70">({ticket.recordIds.length} record{ticket.recordIds.length > 1 ? 's' : ''})</span>
        </div>
        <Badge color={level.color}>{level.label}</Badge>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden fade-in">
      {/* Ticket header */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{ticket.field}</span>
          {ticket.method !== 'consistency' && <ConfidenceBadge value={ticket.confidence} />}
          <Badge color={level.color}>{level.label} confidence</Badge>
          <Badge color={ticket.method === 'consistency' ? 'yellow' : 'gray'}>{ticket.method}</Badge>
          {isBulk && (
            <Badge color="purple">
              {ticket.recordIds.length} records affected
            </Badge>
          )}
        </div>
      </div>

      {/* Correction detail: original → suggested */}
      <div className="p-5 space-y-4">
        {ticket.method === 'validation' ? (
          /* Score validation: show score + rule message, no editable field */
          <div className="flex items-start gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-400 mb-1">Score in CSV</p>
              <span className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-mono font-medium">
                {ticket.originalValue}
              </span>
            </div>
            <div className="flex-1 min-w-48">
              <p className="text-xs text-gray-400 mb-1">Validation issue</p>
              <div className={`px-3 py-2 rounded-lg text-sm border ${
                ticket.confidence === 0
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                {ticket.suggestedValue}
              </div>
            </div>
          </div>
        ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 mb-1">
              {ticket.method === 'consistency' ? 'Inconsistent values found' : 'Original value in CSV'}
            </p>
            <span className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-mono font-medium">
              {ticket.originalValue}
            </span>
          </div>
          <span className="text-gray-400 text-lg mt-5">→</span>
          <div className="flex-1 min-w-48">
            <p className="text-xs text-gray-400 mb-1">
              {ticket.field === 'Club'
                ? 'Choose correct club (or type to add new)'
                : ticket.method === 'consistency'
                  ? 'Select correct value for all records'
                  : 'Corrected value'}
            </p>
            {ticket.field === 'Club' ? (
              <ClubAutocomplete value={editedValue} onChange={setEditedValue} autoFocus />
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
        )}

        {/* Expandable correction details panel */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium
              text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span>
              Affected records {isBulk ? `(${ticket.recordIds.length} total)` : '(1 record)'}
            </span>
            <span className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {detailsOpen && (
            <div className="p-4 space-y-3 fade-in">
              {/* Preview: original vs corrected */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="font-semibold text-red-600 mb-1">Original</p>
                  <p className="font-mono text-red-700">{ticket.originalValue}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="font-semibold text-green-600 mb-1">Corrected</p>
                  <p className="font-mono text-green-700">{editedValue}</p>
                </div>
              </div>
              {/* Record list */}
              <div className="flex flex-wrap gap-1.5">
                {affectedRecords.slice(0, 10).map(r => (
                  <span key={r._id} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    {r.Athlete} · {r.Date} · {r.Competition || '—'}
                  </span>
                ))}
                {affectedRecords.length > 10 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                    +{affectedRecords.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-50 border-t border-gray-200 px-5 py-3.5 flex gap-3 flex-wrap items-center">
        <Button ref={approveRef} onClick={() => onApprove(editedValue)}>
          {ticket.method === 'validation'
            ? `✓ Keep record${isBulk ? `s (${ticket.recordIds.length})` : ''}`
            : `✓ Apply to ${isBulk ? `all ${ticket.recordIds.length} records` : 'record'}`}
        </Button>
        <Button variant="danger" onClick={onReject}>
          {ticket.method === 'validation'
            ? `✗ Remove record${isBulk ? `s (${ticket.recordIds.length})` : ''}`
            : `✗ ${ticket.method === 'consistency' ? 'Skip' : 'Reject'}`}
        </Button>
        <span className="text-xs text-gray-400 ml-auto hidden sm:flex items-center gap-3">
          <span><kbd className="bg-gray-200 rounded px-1.5 py-0.5 font-mono text-gray-600">Enter</kbd> approve</span>
          <span><kbd className="bg-gray-200 rounded px-1.5 py-0.5 font-mono text-gray-600">Delete</kbd> reject</span>
          <span><kbd className="bg-gray-200 rounded px-1.5 py-0.5 font-mono text-gray-600">Esc</kbd> skip</span>
        </span>
      </div>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TICKET REVIEW UI (shared between phases)
// ─────────────────────────────────────────────────────────────────────────────

interface TicketReviewProps {
  title: string;
  subtitle: string;
  tickets: IssueTicket[];
  records: CompetitionRecord[];
  onFinalise: (decisions: Record<string, { decision: Decision; value: string }>) => void;
}

const TicketReview: React.FC<TicketReviewProps> = ({
  title, subtitle, tickets, records, onFinalise,
}) => {
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [decisions, setDecisions]     = useState<Record<string, { decision: Decision; value: string }>>({});

  const current      = tickets[currentIdx];
  const reviewedCount = Object.keys(decisions).length;
  const isLast       = currentIdx === tickets.length - 1;

  const applyDecision = (decision: Decision, resolvedValue: string) => {
    const next = { ...decisions, [current.id]: { decision, value: resolvedValue } };
    setDecisions(next);

    if (!isLast) {
      setCurrentIdx(i => i + 1);
    } else {
      onFinalise(next);
    }
  };

  // Keyboard shortcut: Escape to skip
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current) return;
      if ((e.target as HTMLElement).matches('input, select, textarea')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isLast) setCurrentIdx(i => i + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, isLast]);

  const affectedRecordCount = new Set(tickets.flatMap(t => t.recordIds)).size;
  const approvedCount = Object.values(decisions).filter(d => d.decision === 'approve').length;
  const rejectedCount = Object.values(decisions).filter(d => d.decision === 'reject').length;
  const remaining = tickets.length - reviewedCount;

  // Batch actions
  const handleBatchApprove = () => {
    const bulk: typeof decisions = { ...decisions };
    tickets.slice(currentIdx).forEach(t => {
      bulk[t.id] = { decision: 'approve', value: t.suggestedValue };
    });
    setDecisions(bulk);
    onFinalise(bulk);
  };

  const handleBatchReject = () => {
    const bulk: typeof decisions = { ...decisions };
    tickets.slice(currentIdx).forEach(t => {
      bulk[t.id] = { decision: 'reject', value: '' };
    });
    setDecisions(bulk);
    onFinalise(bulk);
  };

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-gray-500 mt-1">
          {tickets.length} unique issue{tickets.length > 1 ? 's' : ''} affecting {affectedRecordCount} records &nbsp;·&nbsp;
          {reviewedCount} reviewed &nbsp;·&nbsp;
          <span className="text-green-600">{approvedCount} approved</span> &nbsp;·&nbsp;
          <span className="text-red-500">{rejectedCount} skipped</span>
        </p>
        {subtitle && <p className="text-sm text-blue-600 mt-2">{subtitle}</p>}
      </div>

      {/* Overall progress */}
      <div className="space-y-1">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${(reviewedCount / tickets.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right">{Math.round((reviewedCount / tickets.length) * 100)}% complete</p>
      </div>

      {/* Batch actions */}
      {remaining > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleBatchApprove}
            className="text-sm text-green-600 hover:text-green-800 font-medium transition-colors"
          >
            ✓ Accept all {remaining} remaining with suggested values
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleBatchReject}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            ✗ Reject all {remaining} remaining
          </button>
        </div>
      )}

      {/* Already-decided tickets (collapsed summary) - Hidden per user request */}
      {/* Solved tickets are no longer displayed in the review tab */}

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
            isActive
          />
        </div>
      )}
    </div>
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
  const importTickets = useMemo(() => buildTickets(records), [records]);
  const [phase, setPhase] = useState<Phase>('import');
  const [intermediateRecords, setIntermediateRecords] = useState<CompetitionRecord[]>([]);
  const [consistencyTickets, setConsistencyTickets] = useState<IssueTicket[]>([]);

  const handleImportFinalise = (allDecisions: Record<string, { decision: Decision; value: string }>) => {
    const approvedFixes = new Map<number, Record<string, string>>();

    for (const [ticketId, { decision, value }] of Object.entries(allDecisions)) {
      if (decision !== 'approve') continue;
      const ticket = importTickets.find(t => t.id === ticketId);
      if (!ticket) continue;
      for (const recordId of ticket.recordIds) {
        if (!approvedFixes.has(recordId)) approvedFixes.set(recordId, {});
        approvedFixes.get(recordId)![ticket.field] = value;
      }
    }

    const rejectedIds = new Set<number>();
    for (const [ticketId, { decision }] of Object.entries(allDecisions)) {
      if (decision !== 'reject') continue;
      const ticket = importTickets.find(t => t.id === ticketId);
      if (ticket) ticket.recordIds.forEach(id => rejectedIds.add(id));
    }

    const fixedRecords = records
      .filter(r => !r._needsReview || !rejectedIds.has(r._id))
      .map(r => {
        const fixes = approvedFixes.get(r._id);
        if (!fixes) return r;
        return {
          ...r,
          ...(fixes['Club'] ? { Club: fixes['Club'] } : {}),
          ...(fixes['Bow Type'] ? { 'Bow Type': fixes['Bow Type'] as CompetitionRecord['Bow Type'] } : {}),
        };
      });

    transitionToConsistency(fixedRecords);
  };

  const transitionToConsistency = (recs: CompetitionRecord[]) => {
    const autoFixed = autoFixAgeClasses(recs);
    const cTickets = buildConsistencyTickets(autoFixed);
    if (cTickets.length === 0) {
      onComplete(autoFixed);
    } else {
      setIntermediateRecords(autoFixed);
      setConsistencyTickets(cTickets);
      setPhase('consistency');
    }
  };

  const handleConsistencyFinalise = (allDecisions: Record<string, { decision: Decision; value: string }>) => {
    const finalRecords = applyConsistencyFixes(intermediateRecords, consistencyTickets, allDecisions);
    onComplete(finalRecords);
  };

  // No import flags → skip to consistency check
  if (phase === 'import' && !importTickets.length) {
    return (
      <div className="fade-in text-center py-20 space-y-5">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto">✅</div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">All records auto-approved!</h3>
          <p className="text-gray-500 mt-1">Every club matched with high confidence — no review needed.</p>
          <p className="text-gray-500 mt-1">Click continue to check for data consistency across athletes.</p>
        </div>
        <Button onClick={() => transitionToConsistency(records)} size="lg">
          Continue to Consistency Check →
        </Button>
      </div>
    );
  }

  if (phase === 'consistency') {
    return (
      <TicketReview
        title="Consistency Check"
        subtitle="Checking athlete names, age classes, and genders for inconsistencies across all records."
        tickets={consistencyTickets}
        records={intermediateRecords}
        onFinalise={handleConsistencyFinalise}
      />
    );
  }

  return (
    <TicketReview
      title="Review Issues"
      subtitle=""
      tickets={importTickets}
      records={records}
      onFinalise={handleImportFinalise}
    />
  );
};

export default ReviewModule;
