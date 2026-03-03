import React, { useState, useRef } from 'react';
import { Button, Card, ProgressBar } from '../common';
import { parseCSVText } from '../../utils/parsing';
import { validateFile } from '../../utils/security';
import { SAMPLE_CSV } from '../../constants/clubs';
import { showToast } from '../common/Toast';
import type { CompetitionRecord } from '../../types';

interface Props {
  onParsed: (records: CompetitionRecord[]) => void;
}

interface SelectedFile {
  file: File;
  error?: string;
}

const ImportModule: React.FC<Props> = ({ onParsed }) => {
  const [selected, setSelected]   = useState<SelectedFile[]>([]);
  const [dragging, setDragging]   = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [parseError, setParseError] = useState('');
  const [validationSummary, setValidationSummary] = useState<{
    total: number;
    invalidScores: number;
    suspiciousScores: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────

  const addFiles = (rawFiles: FileList | File[]) => {
    const incoming = Array.from(rawFiles).map(f => ({
      file: f,
      error: validateFile(f).error,
    }));
    setSelected(prev => {
      const existing = new Set(prev.map(s => s.file.name));
      return [...prev, ...incoming.filter(s => !existing.has(s.file.name))];
    });
  };

  const removeFile = (name: string) =>
    setSelected(prev => prev.filter(s => s.file.name !== name));

  // ── Parse files ────────────────────────────────────────────────────────

  const buildSummary = (records: CompetitionRecord[]) => {
    let invalidScores = 0;
    let suspiciousScores = 0;
    for (const r of records) {
      for (const c of r._corrections) {
        if (c.field === 'Result' && c.method === 'validation') {
          if (c.confidence === 0) invalidScores++;
          else if (c.confidence === 75) suspiciousScores++;
        }
      }
    }
    setValidationSummary({ total: records.length, invalidScores, suspiciousScores });
  };

  const parseFiles = async () => {
    const valid = selected.filter(s => !s.error);
    if (!valid.length) return;

    setParsing(true); setProgress(5); setParseError(''); setValidationSummary(null);

    try {
      const all: CompetitionRecord[] = [];

      for (let i = 0; i < valid.length; i++) {
        const { file } = valid[i];
        const text = await file.text();
        const records = await parseCSVText(text, file.name);
        all.push(...records);
        setProgress(Math.round(((i + 1) / valid.length) * 90) + 5);
      }

      // Re-sequence IDs globally
      all.forEach((r, i) => { r._id = i + 1; });
      buildSummary(all);
      setProgress(100);
      setTimeout(() => { setParsing(false); onParsed(all); }, 300);

    } catch (err) {
      setParsing(false);
      const msg = err instanceof Error ? err.message : 'Unexpected parsing error';
      setParseError(msg);
      showToast('error', msg);
    }
  };

  const loadSample = async () => {
    setParsing(true); setProgress(40); setValidationSummary(null);
    const records = await parseCSVText(SAMPLE_CSV, 'sample_data.csv');
    buildSummary(records);
    setProgress(100);
    setTimeout(() => { setParsing(false); onParsed(records); }, 300);
  };

  // ── Drag & drop ────────────────────────────────────────────────────────

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const validCount = selected.filter(s => !s.error).length;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Import CSV Files</h2>
        <p className="text-gray-500 mt-1">
          Upload Estonian archery competition data or load the built-in sample dataset.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-all
          ${dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:bg-white hover:border-gray-400'}`}
      >
        <input
          ref={inputRef} type="file" accept=".csv" multiple className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
        <div className="mx-auto w-14 h-14 bg-white border border-gray-200 rounded-xl
          shadow-sm flex items-center justify-center text-3xl mb-4">
          📁
        </div>
        <p className="text-sm font-medium text-gray-700">
          Drop CSV files here or <span className="text-blue-600">click to browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Estonian & English headers · 10 MB max · multiple files supported
        </p>
      </div>

      {/* Selected files */}
      {selected.length > 0 && (
        <Card className="divide-y divide-gray-100">
          {selected.map(({ file, error }) => (
            <div key={file.name} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                  ${error ? 'bg-red-50' : 'bg-blue-50'}`}>
                  {error ? '⚠️' : '📄'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  {error
                    ? <p className="text-xs text-red-500">{error}</p>
                    : <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  }
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); removeFile(file.name); }}
                className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none px-2"
              >
                ×
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* Progress */}
      {parsing && <ProgressBar value={progress} label="Parsing and auto-correcting records…" />}

      {/* Error */}
      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {parseError}
        </div>
      )}

      {/* Score validation summary */}
      {validationSummary && (validationSummary.invalidScores > 0 || validationSummary.suspiciousScores > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">Score validation issues found</p>
          <p className="text-xs text-amber-700">
            Parsed {validationSummary.total} records. Scores are validated against the 360-point-per-distance
            archery rule. Flagged records will appear in the Review step.
          </p>
          <div className="flex gap-2 flex-wrap pt-1">
            {validationSummary.invalidScores > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                bg-red-100 text-red-700 text-xs font-medium border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {validationSummary.invalidScores} score{validationSummary.invalidScores > 1 ? 's' : ''} exceed maximum
              </span>
            )}
            {validationSummary.suspiciousScores > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                {validationSummary.suspiciousScores} suspiciously high score{validationSummary.suspiciousScores > 1 ? 's' : ''} (&gt;90% of max)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {validCount > 0 && (
          <Button onClick={parseFiles} disabled={parsing} size="lg" loading={parsing}>
            {parsing ? 'Parsing…' : `▶ Parse ${validCount} file${validCount > 1 ? 's' : ''}`}
          </Button>
        )}
        <Button variant="secondary" onClick={loadSample} disabled={parsing} size="lg">
          ⚡ Load Sample Data
        </Button>
      </div>

      {/* Format reference */}
      <Card className="p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">Accepted CSV formats</p>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-medium text-gray-700 mb-1">🇪🇪 Estonian headers</p>
            <code className="block bg-gray-50 text-gray-600 rounded p-2 leading-6">
              Kuupäev, Sportlane, Klubi,<br />
              Võistlusklass, Vanuserühm,<br />
              Distants, Tulemus, Võistlus
            </code>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-1">🇬🇧 English headers</p>
            <code className="block bg-gray-50 text-gray-600 rounded p-2 leading-6">
              Date, Athlete, Club,<br />
              Bow Type, Age Class,<br />
              Distance, Result, Competition
            </code>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ImportModule;
