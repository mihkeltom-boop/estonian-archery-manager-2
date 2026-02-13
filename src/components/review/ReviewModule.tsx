import React, { useState, useMemo, useEffect } from 'react';
import { Button, Card, Badge, ConfidenceBadge } from '../common';
import ClubAutocomplete from '../common/ClubAutocomplete';
import type { CompetitionRecord } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Decision = 'approve' | 'reject';
type Phase = 'import' | 'consistency';

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
// CONSISTENCY CHECKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: count occurrences of each value and return sorted entries
 * (most common first) plus the dominance ratio of the top value.
 */
function countVariants(values: string[]): { sorted: [string, number][]; dominance: number } {
  const counts = new Map<string, number>();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const dominance = sorted[0][1] / values.length;
  return { sorted, dominance };
}

/** Extract year from date string (DD.MM.YYYY or YYYY-MM-DD) */
function extractYear(date: string): string {
  if (!date) return 'unknown';
  // DD.MM.YYYY
  const dotParts = date.split('.');
  if (dotParts.length === 3 && dotParts[2].length === 4) return dotParts[2];
  // YYYY-MM-DD
  const dashParts = date.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) return dashParts[0];
  return 'unknown';
}

/** Whether an age class is a specific (non-Adult) class */
function isSpecificAgeClass(ac: string): boolean {
  return ac !== 'Adult';
}

/**
 * Auto-fix age classes: within a calendar year, an athlete's age class
 * is fixed. If the same athlete has "Adult" and one specific class
 * (U13, U18, +50, etc.) in the same year, the specific class wins.
 *
 * Returns updated records (mutates nothing).
 */
function autoFixAgeClasses(records: CompetitionRecord[]): CompetitionRecord[] {
  // Group by normalized athlete name + year
  const groups = new Map<string, CompetitionRecord[]>();
  for (const r of records) {
    const name = r.Athlete.trim();
    if (!name) continue; // Skip records with no athlete name
    const key = `${name.toLowerCase()}__${extractYear(r.Date)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  // Build a fix map: recordId → correct age class
  const fixes = new Map<number, string>();

  for (const recs of groups.values()) {
    const ageClasses = [...new Set(recs.map(r => r['Age Class']))];
    if (ageClasses.length <= 1) continue;

    // Separate specific classes from Adult
    const specific = ageClasses.filter(isSpecificAgeClass);

    if (specific.length === 1) {
      // One specific class + Adult → auto-fix all to the specific class
      const correctClass = specific[0];
      for (const r of recs) {
        if (r['Age Class'] !== correctClass) {
          fixes.set(r._id, correctClass);
        }
      }
    }
    // If multiple specific classes or no Adult involved → leave for ticket
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
        {
          field: 'Age Class',
          original: r['Age Class'],
          corrected: fix,
          method: 'extraction' as const,
          confidence: 95,
          timestamp: Date.now(),
        },
      ],
    };
  });
}

/**
 * After import issues are resolved and age classes are auto-fixed,
 * check for remaining inconsistencies in athlete data:
 *
 * - Name spelling: always flag (different spellings = always a mistake)
 * - Gender: always flag (an athlete can't switch genders)
 * - Age class: only flag remaining conflicts (multiple specific classes
 *   in the same year). Simple Adult→specific cases are already auto-fixed.
 *
 * Confidence is proportional to how dominant the majority value is.
 */
function buildConsistencyTickets(records: CompetitionRecord[]): IssueTicket[] {
  const tickets: IssueTicket[] = [];

  // Group records by normalized athlete name
  const athleteGroups = new Map<string, CompetitionRecord[]>();
  for (const r of records) {
    const name = r.Athlete.trim();
    if (!name) continue; // Skip records with no athlete name
    const key = name.toLowerCase();
    if (!athleteGroups.has(key)) athleteGroups.set(key, []);
    athleteGroups.get(key)!.push(r);
  }

  for (const [normName, recs] of athleteGroups) {
    if (recs.length < 2) continue;

    const nameVariants = [...new Set(recs.map(r => r.Athlete))];
    const athleteName = nameVariants.length === 1 ? nameVariants[0] : recs[0].Athlete;

    // Name spelling: always flag any inconsistency
    if (nameVariants.length > 1) {
      const { sorted, dominance } = countVariants(recs.map(r => r.Athlete));
      tickets.push({
        id: `consistency::Athlete::${normName}`,
        field: 'Athlete',
        originalValue: nameVariants.join(' / '),
        suggestedValue: sorted[0][0],
        confidence: Math.round(dominance * 100),
        method: 'consistency',
        recordIds: recs.map(r => r._id),
        resolvedValue: null,
      });
    }

    // Gender: always flag
    const genderVariants = [...new Set(recs.map(r => r.Gender))];
    if (genderVariants.length > 1) {
      const { sorted, dominance } = countVariants(recs.map(r => r.Gender));
      tickets.push({
        id: `consistency::Gender::${normName}`,
        field: 'Gender',
        originalValue: `${athleteName}: ${sorted.map(([v, n]) => `${v} (${n}x)`).join(' / ')}`,
        suggestedValue: sorted[0][0],
        confidence: Math.round(dominance * 100),
        method: 'consistency',
        recordIds: recs.map(r => r._id),
        resolvedValue: null,
      });
    }

    // Age class: check per year for remaining conflicts
    // (Adult→specific already auto-fixed, only multi-specific conflicts remain)
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
        id: `consistency::Age Class::${normName}::${year}`,
        field: 'Age Class',
        originalValue: `${athleteName} (${year}): ${sorted.map(([v, n]) => `${v} (${n}x)`).join(' / ')}`,
        suggestedValue: sorted[0][0],
        confidence: Math.round(dominance * 100),
        method: 'consistency',
        recordIds: yearRecs.map(r => r._id),
        resolvedValue: null,
      });
    }
  }

  // Sort by confidence descending — most obvious mistakes first
  return tickets.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Apply resolved consistency fixes to records.
 */
function applyConsistencyFixes(
  records: CompetitionRecord[],
  tickets: IssueTicket[],
  decisions: Record<string, { decision: Decision; value: string }>,
): CompetitionRecord[] {
  // Build a map of recordId → field fixes
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
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticket, affectedRecords, decision, onApprove, onReject,
}) => {
  const [editedValue, setEditedValue] = useState(ticket.suggestedValue);
  const isBulk = ticket.recordIds.length > 1;

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
          {ticket.method !== 'consistency' && <ConfidenceBadge value={ticket.confidence} />}
          <Badge color={ticket.method === 'consistency' ? 'yellow' : 'gray'}>{ticket.method}</Badge>
          {isBulk && (
            <Badge color="purple">
              {ticket.recordIds.length} records affected
            </Badge>
          )}
        </div>
      </div>

      {/* Correction detail */}
      <div className="p-5 space-y-4">
        {/* Original → suggested */}
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
          ✓ Apply to {isBulk ? `all ${ticket.recordIds.length} records` : 'record'} (A)
        </Button>
        <Button variant="danger" onClick={onReject}>
          ✗ {ticket.method === 'consistency' ? 'Skip' : 'Reject'} (R)
        </Button>
        <span className="text-xs text-gray-400 ml-auto hidden sm:block">
          <kbd className="bg-gray-200 rounded px-1">A</kbd> approve &nbsp;
          <kbd className="bg-gray-200 rounded px-1">R</kbd> {ticket.method === 'consistency' ? 'skip' : 'reject'}
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current) return;
      if ((e.target as HTMLElement).matches('input, select, textarea')) return;
      if (e.key === 's' || e.key === 'S') {
        if (!isLast) setCurrentIdx(i => i + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, isLast]);

  const affectedRecordCount = new Set(tickets.flatMap(t => t.recordIds)).size;
  const approvedCount = Object.values(decisions).filter(d => d.decision === 'approve').length;
  const rejectedCount = Object.values(decisions).filter(d => d.decision === 'reject').length;

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
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${(reviewedCount / tickets.length) * 100}%` }}
        />
      </div>

      {/* Already-decided tickets (collapsed summary) */}
      {reviewedCount > 0 && (
        <div className="space-y-2">
          {tickets.slice(0, currentIdx).map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={{ ...ticket, resolvedValue: decisions[ticket.id]?.value ?? null }}
              affectedRecords={records.filter(r => ticket.recordIds.includes(r._id))}
              decision={decisions[ticket.id]?.decision ?? null}
              onApprove={() => {}}
              onReject={() => {}}
            />
          ))}
        </div>
      )}

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
              onFinalise(bulk);
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

  // ── Phase 1: Import issue finalisation ────────────────────────────────────

  const handleImportFinalise = (allDecisions: Record<string, { decision: Decision; value: string }>) => {
    // Build a map of recordId → approved corrections
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

    // Apply fixes to records, exclude rejected-only records
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

    // Now run consistency check
    transitionToConsistency(fixedRecords);
  };

  // ── Transition to consistency phase ───────────────────────────────────────

  const transitionToConsistency = (recs: CompetitionRecord[]) => {
    // Auto-fix obvious age class issues (Adult + one specific class in same year)
    const autoFixed = autoFixAgeClasses(recs);

    // Then check for remaining inconsistencies
    const cTickets = buildConsistencyTickets(autoFixed);
    if (cTickets.length === 0) {
      // No inconsistencies, go straight to database
      onComplete(autoFixed);
    } else {
      setIntermediateRecords(autoFixed);
      setConsistencyTickets(cTickets);
      setPhase('consistency');
    }
  };

  // ── Phase 2: Consistency finalisation ─────────────────────────────────────

  const handleConsistencyFinalise = (allDecisions: Record<string, { decision: Decision; value: string }>) => {
    const finalRecords = applyConsistencyFixes(intermediateRecords, consistencyTickets, allDecisions);
    onComplete(finalRecords);
  };

  // ── No import flags → skip to consistency check ───────────────────────────

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

  // ── Render based on phase ─────────────────────────────────────────────────

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
