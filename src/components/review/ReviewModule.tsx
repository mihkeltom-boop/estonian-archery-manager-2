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

// Senior classes resolve upward (oldest wins); youth resolve to youngest (most specific).
const SENIOR_RANK: Record<string, number> = { '+50': 1, '+60': 2, '+70': 3 };
const YOUTH_RANK:  Record<string, number> = { 'U21': 1, 'U18': 2, 'U15': 3, 'U13': 4 };

/** Returns the authoritative age class from a mixed set, or null if ambiguous. */
function resolveAgeClass(ageClasses: string[]): string | null {
  const unique = [...new Set(ageClasses)];
  if (unique.length <= 1) return null;
  const seniors = unique.filter(ac => ac in SENIOR_RANK);
  const youths  = unique.filter(ac => ac in YOUTH_RANK);
  if (seniors.length > 0 && youths.length === 0) {
    // Correct upward: pick the highest senior rank
    return seniors.sort((a, b) => SENIOR_RANK[b] - SENIOR_RANK[a])[0];
  }
  if (youths.length > 0 && seniors.length === 0) {
    // Correct to most specific: pick the youngest youth rank
    return youths.sort((a, b) => YOUTH_RANK[b] - YOUTH_RANK[a])[0];
  }
  return null; // Mixed senior+youth or other — can't auto-resolve
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
    const ageClasses = recs.map(r => r['Age Class']);
    const correctClass = resolveAgeClass(ageClasses);
    if (!correctClass) continue;
    for (const r of recs) {
      if (r['Age Class'] !== correctClass) fixes.set(r._id, correctClass);
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
      // Prefer resolveAgeClass direction (senior upward / youth youngest); fall back to most common.
      const suggestedAge = resolveAgeClass(ageVariants) ?? sorted[0][0];
      tickets.push({
        id: `consistency::Age Class::${normName}::${year}`, field: 'Age Class',
        originalValue: `${athleteName} (${year}): ${sorted.map(([v, n]) => `${v} (${n}x)`).join(' / ')}`,
        suggestedValue: suggestedAge, confidence: Math.round(dominance * 100),
        method: 'consistency', recordIds: yearRecs.map(r => r._id), resolvedValue: null,
      });
    }

    // Bow type consistency across all records for this athlete
    const bowVariants = [...new Set(recs.map(r => r['Bow Type']))];
    if (bowVariants.length > 1) {
      const { sorted: bowSorted, dominance: bowDom } = countVariants(recs.map(r => r['Bow Type']));
      tickets.push({
        id: `consistency::Bow Type::${normName}`, field: 'Bow Type',
        originalValue: `${athleteName}: ${bowSorted.map(([v, n]) => `${v} (${n}x)`).join(' / ')}`,
        suggestedValue: bowSorted[0][0], confidence: Math.round(bowDom * 100),
        method: 'consistency', recordIds: recs.map(r => r._id), resolvedValue: null,
      });
    }
  }

  return tickets.sort((a, b) => b.confidence - a.confidence);
}

function applyConsistencyFixes(
  records: CompetitionRecord[],
  tickets: IssueTicket[],
  decisions: Record<string, DecisionEntry>,
): CompetitionRecord[] {
  const fixes = new Map<number, Record<string, string>>();

  for (const ticket of tickets) {
    const dec = decisions[ticket.id];
    if (!dec || dec.decision !== 'approve') continue;

    // Issue field fix → all records in ticket
    for (const recordId of ticket.recordIds) {
      if (!fixes.has(recordId)) fixes.set(recordId, {});
      fixes.get(recordId)![ticket.field] = dec.value;
    }

    // Other field edits → representative (first) record only
    if (dec.fieldEdits) {
      const repId = ticket.recordIds[0];
      if (!fixes.has(repId)) fixes.set(repId, {});
      for (const [f, v] of Object.entries(dec.fieldEdits)) {
        if (f !== ticket.field) fixes.get(repId)![f] = v;
      }
    }
  }

  return records.map(r => {
    const f = fixes.get(r._id);
    if (!f) return r;
    const updated: any = { ...r };
    for (const [field, val] of Object.entries(f)) {
      updated[field] = field === 'Result' ? (Number(val) || r.Result) : val;
    }
    return updated as CompetitionRecord;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TICKET CARD
// ─────────────────────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: IssueTicket;
  affectedRecords: CompetitionRecord[];
  decision: Decision | null;
  onApprove: (resolvedValue: string, fieldEdits: Record<string, string>) => void;
  onReject: () => void;
  isActive?: boolean;
}

/** Visible CSV fields in display order */
const RECORD_FIELDS = [
  'Date', 'Athlete', 'Club', 'Bow Type', 'Age Class', 'Gender',
  'Shooting Exercise', 'Result', 'Competition',
] as const;

const TicketCard: React.FC<TicketCardProps> = ({
  ticket, affectedRecords, decision, onApprove, onReject, isActive = false,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const isBulk = ticket.recordIds.length > 1;
  const approveRef = useRef<HTMLButtonElement>(null);
  const level = confidenceLevel(ticket.confidence);
  const representative = affectedRecords[0];

  // All field values — editable, initialised from the representative record
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (!representative) return {};
    const init: Record<string, string> = {};
    for (const f of RECORD_FIELDS) {
      init[f] = String(representative[f] ?? '');
    }
    // Override the issue field with the system suggestion (unless validation)
    if (ticket.method !== 'validation') {
      init[ticket.field] = ticket.suggestedValue;
    }
    return init;
  });

  const updateField = (field: string, value: string) =>
    setFieldValues(prev => ({ ...prev, [field]: value }));

  const issueValue = fieldValues[ticket.field] ?? ticket.suggestedValue;

  // Keyboard shortcuts — only on active cards
  useEffect(() => {
    if (!isActive || decision) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, select, textarea')) {
        if (e.key === 'Enter') { e.preventDefault(); onApprove(issueValue, fieldValues); }
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); onApprove(issueValue, fieldValues); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onReject(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, decision, issueValue, fieldValues, onApprove, onReject]);

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

  // Unique source files for this ticket
  const sourceFiles = [...new Set(affectedRecords.map(r => r._sourceFile).filter(Boolean))];

  return (
    <Card className="overflow-hidden fade-in">
      {/* Ticket header */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{ticket.field}</span>
          {ticket.method !== 'consistency' && <ConfidenceBadge value={ticket.confidence} />}
          <Badge color={level.color}>{level.label} confidence</Badge>
          <Badge color={ticket.method === 'consistency' ? 'yellow' : 'gray'}>{ticket.method}</Badge>
          {isBulk && <Badge color="purple">{ticket.recordIds.length} records</Badge>}
        </div>
        {/* Source files in header */}
        {sourceFiles.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {sourceFiles.map(f => (
              <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs
                bg-blue-50 text-blue-600 border border-blue-100 rounded font-mono">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Record form: all CSV fields as a grid */}
      <div className="p-5 space-y-4">
        {/* Validation message banner (for score-validation tickets) */}
        {ticket.method === 'validation' && (
          <div className={`px-4 py-2.5 rounded-lg text-sm border ${
            ticket.confidence === 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {ticket.suggestedValue}
          </div>
        )}

        {/* Consistency description banner */}
        {ticket.method === 'consistency' && (
          <div className="px-4 py-2.5 rounded-lg text-sm border bg-yellow-50 border-yellow-200 text-yellow-800">
            Inconsistent <span className="font-semibold">{ticket.field}</span> values found: {ticket.originalValue}
          </div>
        )}

        {representative && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {RECORD_FIELDS.map(field => {
              const isIssue = field === ticket.field;
              const currentValue = fieldValues[field] ?? '';

              /* ── Issue field: highlighted with original crossed out ── */
              if (isIssue) {
                return (
                  <div key={field} className={`rounded-lg p-3 border-2 col-span-2 md:col-span-3
                    ${ticket.method === 'validation'
                      ? 'bg-red-50 border-red-300 ring-2 ring-red-100'
                      : 'bg-amber-50 border-amber-300 ring-2 ring-amber-100'
                    }`}
                  >
                    <label className={`text-xs font-semibold mb-2 block uppercase tracking-wide
                      ${ticket.method === 'validation' ? 'text-red-600' : 'text-amber-700'}`}>
                      {field}
                    </label>
                    {ticket.method === 'validation' ? (
                      /* Validation: editable score */
                      <input
                        value={currentValue}
                        onChange={e => updateField(field, e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-mono font-medium border border-red-300 rounded-lg
                          outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-white text-red-700"
                      />
                    ) : (
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Original value crossed out */}
                        <span className="line-through text-red-400 text-sm font-mono decoration-2">
                          {ticket.originalValue}
                        </span>
                        <span className="text-gray-400">→</span>
                        {/* Editable suggested value */}
                        <div className="flex-1 min-w-40">
                          {field === 'Club' ? (
                            <ClubAutocomplete
                              value={currentValue}
                              onChange={v => updateField(field, v)}
                              autoFocus
                            />
                          ) : (
                            <input
                              value={currentValue}
                              onChange={e => updateField(field, e.target.value)}
                              className="w-full px-3 py-1.5 text-sm font-mono border border-amber-300 rounded-lg
                                outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              /* ── Normal field: editable input ── */
              return (
                <div key={field} className="rounded-lg p-3 bg-gray-50 border border-gray-200">
                  <label className="text-xs font-semibold text-gray-400 mb-1 block uppercase tracking-wide">
                    {field}
                  </label>
                  {field === 'Club' ? (
                    <ClubAutocomplete
                      value={currentValue}
                      onChange={v => updateField(field, v)}
                    />
                  ) : (
                    <input
                      value={currentValue}
                      onChange={e => updateField(field, e.target.value)}
                      className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 rounded-lg
                        outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white text-gray-700"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bulk: show other affected records */}
        {isBulk && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium
                text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span>{ticket.recordIds.length} records share this issue</span>
              <span className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {moreOpen && (
              <div className="p-3 max-h-60 overflow-y-auto fade-in">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="pb-1.5 pr-2 font-semibold">Athlete</th>
                      <th className="pb-1.5 pr-2 font-semibold">Date</th>
                      <th className="pb-1.5 pr-2 font-semibold">Competition</th>
                      <th className="pb-1.5 font-semibold">File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affectedRecords.slice(0, 20).map(r => (
                      <tr key={r._id} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2 text-gray-700">{r.Athlete}</td>
                        <td className="py-1.5 pr-2 text-gray-500 font-mono">{r.Date}</td>
                        <td className="py-1.5 pr-2 text-gray-500">{r.Competition || '—'}</td>
                        <td className="py-1.5 text-blue-600 font-mono">{r._sourceFile || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {affectedRecords.length > 20 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    +{affectedRecords.length - 20} more records
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-gray-50 border-t border-gray-200 px-5 py-3.5 flex gap-3 flex-wrap items-center">
        <Button ref={approveRef} onClick={() => onApprove(issueValue, fieldValues)}>
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

type DecisionEntry = { decision: Decision; value: string; fieldEdits?: Record<string, string> };

interface TicketReviewProps {
  title: string;
  subtitle: string;
  tickets: IssueTicket[];
  records: CompetitionRecord[];
  onFinalise: (decisions: Record<string, DecisionEntry>) => void;
}

const TicketReview: React.FC<TicketReviewProps> = ({
  title, subtitle, tickets, records, onFinalise,
}) => {
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [decisions, setDecisions]     = useState<Record<string, DecisionEntry>>({});

  const current      = tickets[currentIdx];
  const reviewedCount = Object.keys(decisions).length;
  const isLast       = currentIdx === tickets.length - 1;

  const applyDecision = (decision: Decision, resolvedValue: string, fieldEdits?: Record<string, string>) => {
    const next = { ...decisions, [current.id]: { decision, value: resolvedValue, fieldEdits } };
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
            onApprove={(val, edits) => applyDecision('approve', val, edits)}
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

  const handleImportFinalise = (allDecisions: Record<string, DecisionEntry>) => {
    const approvedFixes = new Map<number, Record<string, string>>();

    for (const [ticketId, { decision, value, fieldEdits }] of Object.entries(allDecisions)) {
      if (decision !== 'approve') continue;
      const ticket = importTickets.find(t => t.id === ticketId);
      if (!ticket) continue;

      // Issue field fix → all records in ticket
      for (const recordId of ticket.recordIds) {
        if (!approvedFixes.has(recordId)) approvedFixes.set(recordId, {});
        approvedFixes.get(recordId)![ticket.field] = value;
      }

      // Other field edits → representative (first) record only
      if (fieldEdits) {
        const repId = ticket.recordIds[0];
        if (!approvedFixes.has(repId)) approvedFixes.set(repId, {});
        for (const [f, v] of Object.entries(fieldEdits)) {
          if (f !== ticket.field) approvedFixes.get(repId)![f] = v;
        }
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
        const updated: any = { ...r };
        for (const [field, val] of Object.entries(fixes)) {
          updated[field] = field === 'Result' ? (Number(val) || r.Result) : val;
        }
        return updated as CompetitionRecord;
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

  const handleConsistencyFinalise = (allDecisions: Record<string, DecisionEntry>) => {
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
