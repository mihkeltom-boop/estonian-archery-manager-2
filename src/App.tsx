import React, { useState } from 'react';
import ImportModule from './components/import/ImportModule';
import ReviewModule from './components/review/ReviewModule';
import DatabaseModule from './components/database/DatabaseModule';
import LogsModule from './components/logs/LogsModule';
import ClubManager from './components/common/ClubManager';
import { Badge } from './components/common';
import type { CompetitionRecord, Step } from './types';

type AppStep = Step | 'clubs';

const StepNav: React.FC<{
  current: AppStep;
  hasParsed: boolean;
  hasReviewed: boolean;
  onNavigate: (s: AppStep) => void;
}> = ({ current, hasParsed, hasReviewed, onNavigate }) => {
  const steps: Array<{ id: AppStep; label: string; num: string; locked?: boolean }> = [
    { id: 'import',   label: 'Import',   num: '1' },
    { id: 'review',   label: 'Review',   num: '2', locked: !hasParsed },
    { id: 'database', label: 'Database', num: '3', locked: !hasReviewed },
    { id: 'logs',     label: 'Logs',     num: '4', locked: !hasReviewed },
    { id: 'clubs',    label: 'Clubs',    num: '⚙' },
  ];

  const isDone = (id: AppStep) =>
    (id === 'import' && hasParsed) || (id === 'review' && hasReviewed);

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex">
        {steps.map(step => {
          const active = current === step.id;
          const done   = isDone(step.id);
          return (
            <button
              key={step.id}
              onClick={() => !step.locked && onNavigate(step.id)}
              disabled={step.locked}
              className={`flex items-center gap-2 py-4 px-4 sm:px-5 border-b-2 text-sm font-medium
                transition-colors whitespace-nowrap
                ${active   ? 'border-blue-500 text-blue-600'
                : step.locked ? 'border-transparent text-gray-300 cursor-not-allowed'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${done    ? 'bg-green-100 text-green-700'
                : active  ? 'bg-blue-100 text-blue-700'
                : step.id === 'clubs' ? 'bg-gray-100 text-gray-600'
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

const App: React.FC = () => {
  const [step, setStep]         = useState<AppStep>('import');
  const [parsed, setParsed]     = useState<CompetitionRecord[]>([]);
  const [reviewed, setReviewed] = useState<CompetitionRecord[]>([]);

  const handleParsed = (recs: CompetitionRecord[]) => {
    setParsed(recs);
    if (recs.some(r => r._needsReview)) setStep('review');
    else { setReviewed(recs); setStep('database'); }
  };

  const handleReviewed = (recs: CompetitionRecord[]) => {
    setReviewed(recs);
    setStep('database');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-xl shrink-0">🏹</div>
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

      <StepNav
        current={step}
        hasParsed={parsed.length > 0}
        hasReviewed={reviewed.length > 0}
        onNavigate={setStep}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {step === 'import'   && <ImportModule onParsed={handleParsed} />}
        {step === 'review'   && <ReviewModule records={parsed} onComplete={handleReviewed} />}
        {step === 'database' && <DatabaseModule records={reviewed} />}
        {step === 'logs'     && <LogsModule records={reviewed} />}
        {step === 'clubs'    && (
          <div className="space-y-4 fade-in">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Club Manager</h2>
              <p className="text-gray-500 mt-1">
                Add custom clubs — they'll be included in fuzzy matching and autocomplete immediately.
              </p>
            </div>
            <ClubManager />
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs text-gray-400">
          <span>Estonian Archery Federation · Data Management System</span>
          <span className="hidden sm:block">🔒 Secure · ⚡ Fast · ✅ {reviewed.length} records loaded</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
