import React, { useState, useEffect } from 'react';
import DatabaseModule from './components/database/DatabaseModule';
import { Badge } from './components/common';
import { ToastContainer, showToast } from './components/common/Toast';
import type { CompetitionRecord } from './types';

const App: React.FC = () => {
  const [records, setRecords]   = useState<CompetitionRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch('/data.json')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load data (HTTP ${res.status})`);
        return res.json() as Promise<CompetitionRecord[]>;
      })
      .then(data => {
        setRecords(data);
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        showToast('error', `Could not load results: ${message}`);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <ToastContainer />

      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-xl shrink-0">🏹</div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight text-sm sm:text-base">
                Estonian Archery Results Viewer
              </h1>
              <p className="text-xs text-gray-400">Competition results · v1.0.0</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-2">
            <Badge color="blue">🇪🇪 Estonian</Badge>
            <Badge color="green">v1.0.0</Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm gap-2">
            <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading results…
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-gray-700 font-semibold">Could not load results</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && <DatabaseModule records={records} />}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs text-gray-400">
          <span>Estonian Archery Federation · Results Viewer</span>
          <span className="hidden sm:block">⚡ Fast · ✅ {records.length} records loaded</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
