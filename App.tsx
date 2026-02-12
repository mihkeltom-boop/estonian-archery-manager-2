import React, { useState } from 'react';
import ImportModule from './components/import/ImportModule';
import ReviewModule from './components/review/ReviewModule';
import DatabaseModule from './components/database/DatabaseModule';
import { Badge } from './components/common';
import type { CompetitionRecord, Step } from './types';

// ── STEP NAV ───────────────────────────────────────────────────────────────

interface NavProps {
  current: Step;
  hasParsed: boolean;
  hasReviewed: boolean;
  onNavigate: (step: Step) => void;
}

const StepNav: React.FC<NavProps> = ({ current, hasParsed, hasReviewed, onNavigate }) => {
  const steps: Array<{ id: Step; label: string; num: string }> = [
    { id: 'import',   label: 'Import',   num: '1' },
    { id: 'review',   label: 'Review',   num: '2' },
    { id: 'database', label: 'Database', num: '3' },
  ];

  const isLocked = (id: Step) =>
    (id === 'review'   && !hasParsed) ||
    (id === 'database' && !hasReviewed);

  const isDone = (id: Step) =>
    (id === 'import'  && hasParsed) ||
    (id === 'review'  && hasReviewed);

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex">
        {steps.map(step => {
          const locked = isLocked(step.id);
          const done   = isDone(step.id);
          const active = current === step.id;

          return (
            <button
              key={step.id}
              onClick={() => !locked && onNavigate(step.id)}
              disabled={locked}
              className={`flex items-center gap-2 py-4 px-4 sm:px-6 border-b-2 text-sm font-medium
                transition-colors whitespace-nowrap
                ${active  ? 'border-blue-500 text-blue-600'
                : locked  ? 'border-transparent text-gray-300 cursor-not-allowed'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${done   ? 'bg-green-100 text-green-700'
                : active ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-400'}`}>
                {done ? '✓' : step.num}
              </span>
              {step.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// ── APP ────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [step, setStep]         = useState<Step>('import');
  const [parsed, setParsed]     = useState<CompetitionRecord[]>([]);
  const [reviewed, setReviewed] = useState<CompetitionRecord[]>([]);

  const handleParsed = (records: CompetitionRecord[]) => {
    setParsed(records);
    const needsReview = records.some(r => r._needsReview);
    if (needsReview) {
      setStep('review');
    } else {
      setReviewed(records);
      setStep('database');
    }
  };

  const handleReviewed = (records: CompetitionRecord[]) => {
    setReviewed(records);
    setStep('database');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-xl shrink-0">
              🏹
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight text-sm sm:text-base">
                Estonian Archery Data Manager
              </h1>
              <p className="text-xs text-gray-400">Competition data management · v2.0</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-2">
            <Badge color="blue">🇪🇪 Estonian</Badge>
            <Badge color="green">v2.0</Badge>
          </div>
        </div>
      </header>

      {/* ── Step navigation ── */}
      <StepNav
        current={step}
        hasParsed={parsed.length > 0}
        hasReviewed={reviewed.length > 0}
        onNavigate={setStep}
      />

      {/* ── Main content ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {step === 'import'   && <ImportModule onParsed={handleParsed} />}
        {step === 'review'   && <ReviewModule records={parsed} onComplete={handleReviewed} />}
        {step === 'database' && <DatabaseModule records={reviewed} />}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs text-gray-400">
          <span>Estonian Archery Federation · Data Management System</span>
          <span className="hidden sm:block">
            🔒 Secure · ⚡ Fast · ✅ {reviewed.length} records loaded
          </span>
        </div>
      </footer>

    </div>
  );
};

export default App;
