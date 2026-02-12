import React, { useState, useRef } from 'react';
import { Button, Card, ProgressBar } from '../common';
import { parseCSVText } from '../../utils/parsing';
import { validateFile, downloadCSV } from '../../utils/security';
import { AthleteRegistry, parseAthleteName } from '../../utils/athleteRegistry';
import { getDisplayAgeGroup, type AthleteSuggestion, type CompetitionRecord } from '../../types';

interface Props {
  onParsed: (records: CompetitionRecord[]) => void;
  athleteRegistry: AthleteRegistry;
}

interface SelectedFile {
  file: File;
  error?: string;
}

const ImportModule: React.FC<Props> = ({ onParsed, athleteRegistry }) => {
  const [selected, setSelected]   = useState<SelectedFile[]>([]);
  const [dragging, setDragging]   = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [parseError, setParseError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [athleteSuggestions, setAthleteSuggestions] = useState<AthleteSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // ── File handling ──────────────────────────────────────────────────────

  const addFiles = (rawFiles: FileList | File[]) => {
    console.log('addFiles called with', rawFiles.length, 'files');
    const incoming = Array.from(rawFiles).map(f => ({
      file: f,
      error: validateFile(f).error,
    }));

    setSelected(prev => {
      const existing = new Set(prev.map(s => s.file.name));
      const newFiles = incoming.filter(s => !existing.has(s.file.name));
      const duplicates = incoming.length - newFiles.length;

      // Show feedback message
      if (newFiles.length > 0) {
        const msg = `Added ${newFiles.length} file${newFiles.length > 1 ? 's' : ''}${duplicates > 0 ? ` (${duplicates} duplicate${duplicates > 1 ? 's' : ''} skipped)` : ''}`;
        console.log(msg);
      }

      return [...prev, ...newFiles];
    });
    setSuccessMessage(''); // Clear success message when adding new files
    setParseError(''); // Clear error message when adding new files
    setAthleteSuggestions([]); // Clear athlete suggestions when adding new files
  };

  const removeFile = (name: string) =>
    setSelected(prev => prev.filter(s => s.file.name !== name));

  // ── Parse files ────────────────────────────────────────────────────────

  const parseFiles = async () => {
    const valid = selected.filter(s => !s.error);
    if (!valid.length) return;

    setParsing(true); setProgress(5); setParseError(''); setSuccessMessage(''); setAthleteSuggestions([]);

    try {
      const all: CompetitionRecord[] = [];
      const suggestions: AthleteSuggestion[] = [];
      const seenNames = new Set<string>(); // Track names we've already checked

      for (let i = 0; i < valid.length; i++) {
        const { file } = valid[i];
        const text = await file.text();
        const records = await parseCSVText(text, file.name);

        // Check each record for potential name typos
        records.forEach(record => {
          const { firstName, lastName } = parseAthleteName(record.Athlete);
          const nameKey = `${firstName}|${lastName}`;

          // Only check if we haven't seen this name yet in this batch
          if (!seenNames.has(nameKey)) {
            seenNames.add(nameKey);

            // Check for similar athletes in registry
            const match = athleteRegistry.findBestMatch(firstName, lastName);
            if (match && match.matchType === 'typo') {
              suggestions.push({
                originalName: record.Athlete,
                match,
                status: 'pending'
              });
            }
          }
        });

        all.push(...records);
        setProgress(Math.round(((i + 1) / valid.length) * 90) + 5);
      }

      // Re-sequence IDs globally
      all.forEach((r, i) => { r._id = i + 1; });
      setProgress(100);

      const fileCount = valid.length;
      const recordCount = all.length;
      const uniqueAthletes = seenNames.size;

      // Show suggestions if found
      if (suggestions.length > 0) {
        setAthleteSuggestions(suggestions);
        setSuccessMessage(`✓ Parsed ${fileCount} file${fileCount > 1 ? 's' : ''} → ${recordCount} records, ${uniqueAthletes} athletes (${suggestions.length} potential typo${suggestions.length > 1 ? 's' : ''} found)`);
      } else {
        setSuccessMessage(`✓ Successfully parsed ${fileCount} file${fileCount > 1 ? 's' : ''} → ${recordCount} records, ${uniqueAthletes} athletes`);
      }

      setTimeout(() => {
        setParsing(false);
        setSelected([]); // Clear files after successful parsing
        if (inputRef.current) inputRef.current.value = ''; // Reset file input
        onParsed(all);
      }, 300);

    } catch (err) {
      setParsing(false);
      setParseError(err instanceof Error ? err.message : 'Unexpected parsing error');
    }
  };

  // ── Sample file download ───────────────────────────────────────────────

  const downloadSampleCSV = () => {
    const sampleContent = `Kuupäev,Eesnimi,Perekonnanimi,Klubi,Võistlusklass,Vanuserühm,Distants,Tulemus,Võistlus
15.12.2024,Mari,Mägi,TLVK,Sportvibu naised,U21,2x18m,580,Tallinn Open 2024
14.12.2024,Jaan,Tamm,VVVK,Plokkvibu mehed,Adult,18m,562,Viljandi Cup
13.12.2024,Liisa,Kask,SAG,Sportvibu naised,U18,2x18m,545,Eesti Meistrivõistlused`;

    downloadCSV(sampleContent, 'sample_archery_data.csv');
  };

  // ── Drag & drop ────────────────────────────────────────────────────────

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;

    // Check if dragging files
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      console.log('Drag enter - items:', e.dataTransfer.items.length);
      setDragging(true);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep the drag effect as "copy" to show the correct cursor
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;

    // Only set dragging to false when we've left all nested elements
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);

    const files = e.dataTransfer.files;
    console.log('Drop event - files:', files.length);

    // Log each file for debugging
    Array.from(files).forEach((file, i) => {
      console.log(`  File ${i + 1}: ${file.name} (${file.size} bytes, ${file.type})`);
    });

    if (files && files.length > 0) {
      addFiles(files);
    } else {
      console.warn('No files in drop event');
    }
  };

  const validCount = selected.filter(s => !s.error).length;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Import CSV Files</h2>
        <p className="text-gray-500 mt-1">
          Upload Estonian archery competition data in CSV format.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
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
        {/* Child elements with pointer-events-none to not interfere with drag & drop */}
        <div className="mx-auto w-14 h-14 bg-white border border-gray-200 rounded-xl
          shadow-sm flex items-center justify-center text-3xl mb-4 pointer-events-none">
          📁
        </div>
        <p className="text-sm font-medium text-gray-700 pointer-events-none">
          Drop CSV files here or <span className="text-blue-600">click to browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1 pointer-events-none">
          Estonian & English headers · 10 MB max · multiple files supported
        </p>
      </div>

      {/* Selected files */}
      {selected.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {selected.length} file{selected.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => {
                setSelected([]);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Clear all
            </button>
          </div>
          <div className="divide-y divide-gray-100">
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
          </div>
        </Card>
      )}

      {/* Progress */}
      {parsing && <ProgressBar value={progress} label="Parsing and auto-correcting records…" />}

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* Error */}
      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {parseError}
        </div>
      )}

      {/* Athlete name suggestions */}
      {athleteSuggestions.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-gray-100 bg-yellow-50">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Potential Name Typos Detected
                </p>
                <p className="text-xs text-gray-600">
                  Found {athleteSuggestions.length} name{athleteSuggestions.length > 1 ? 's' : ''} similar to existing athletes (1 letter difference)
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {athleteSuggestions.map((suggestion, idx) => {
              const match = suggestion.match;
              const athlete = match.athlete;

              // Get age groups for display
              const currentYear = new Date().getFullYear();
              const ageGroups = athlete.ageGroupsByYear.get(currentYear) || new Set();
              const youthTag = getDisplayAgeGroup(ageGroups, 'youth');
              const seniorTag = getDisplayAgeGroup(ageGroups, 'senior');

              return (
                <div key={idx} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          "{suggestion.originalName}"
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-semibold text-blue-600">
                          {athlete.fullName}
                        </span>
                        {youthTag && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            {youthTag}
                          </span>
                        )}
                        {seniorTag && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            {seniorTag}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Existing: {athlete.club} · {Array.from(athlete.competitionClasses).join(', ')}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {match.distance} letter{match.distance > 1 ? 's' : ''} different
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              💡 These are informational only. Records have been imported as-is.
              The athlete registry will track both variants unless you manually merge them later.
            </p>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap items-center">
        {validCount > 0 && (
          <>
            <Button onClick={parseFiles} disabled={parsing} size="lg" loading={parsing}>
              {parsing ? 'Parsing…' : `▶ Parse All ${validCount} File${validCount > 1 ? 's' : ''}`}
            </Button>
            {validCount > 1 && !parsing && (
              <span className="text-xs text-gray-500">
                All {validCount} files will be combined into one dataset
              </span>
            )}
          </>
        )}
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
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={downloadSampleCSV}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <span>⬇</span> Download sample CSV file
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ImportModule;
