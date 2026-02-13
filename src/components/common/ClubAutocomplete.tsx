import React, { useState, useRef, useEffect } from 'react';
import { getClubSuggestions, addClub, getClubs, subscribeToClubs } from '../../utils/clubStore';
import type { Club } from '../../utils/clubStore';

interface Props {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const ClubAutocomplete: React.FC<Props> = ({
  value, onChange, placeholder = 'Type club code or name…', autoFocus
}) => {
  const [inputText, setInputText]     = useState(value);
  const [suggestions, setSuggestions] = useState<Club[]>([]);
  const [showList, setShowList]       = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [, forceUpdate]               = useState(0); // triggers re-render on club list change
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Re-render if club list changes (user adds a new club)
  useEffect(() => subscribeToClubs(() => forceUpdate(n => n + 1)), []);

  // Keep local text in sync when parent changes value
  useEffect(() => { setInputText(value); }, [value]);

  // Auto-focus support
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setShowList(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (text: string) => {
    setInputText(text);
    const sug = getClubSuggestions(text);
    setSuggestions(sug);
    setShowList(true);
    setHighlighted(0);
  };

  const select = (club: Club) => {
    setInputText(club.code);
    onChange(club.code);
    setShowList(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showList) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, suggestions.length)); // +1 for "add new" row
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted < suggestions.length) {
        select(suggestions[highlighted]);
      } else {
        // "Add as new club" row selected
        handleAddNew();
      }
    }
    if (e.key === 'Escape') setShowList(false);
  };

  // Determine if the typed text looks like it could be a new club code
  const isNewCode = inputText.trim().length >= 2 &&
    !getClubs().some(c => c.code.toLowerCase() === inputText.trim().toLowerCase());

  const handleAddNew = () => {
    const code = inputText.trim().toUpperCase();
    if (!code) return;
    // Use code as both code and name for now; user can edit name later
    const added = addClub(code, code);
    if (added) {
      onChange(code);
      setShowList(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => {
          setSuggestions(getClubSuggestions(inputText));
          setShowList(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none
          focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {showList && (suggestions.length > 0 || isNewCode) && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg
          shadow-lg overflow-hidden max-h-60 overflow-y-auto">

          {suggestions.map((club, i) => (
            <button
              key={club.code}
              onMouseDown={() => select(club)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left
                transition-colors ${highlighted === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-700 w-14 shrink-0">{club.code}</span>
                <span className="text-gray-600">{club.name}</span>
              </div>
              {club.userAdded && (
                <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full ml-2 shrink-0">
                  custom
                </span>
              )}
            </button>
          ))}

          {/* Add new club row */}
          {isNewCode && (
            <button
              onMouseDown={handleAddNew}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left
                border-t border-gray-100 transition-colors
                ${highlighted === suggestions.length ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <span className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center
                justify-center text-xs font-bold shrink-0">+</span>
              <span className="text-gray-700">
                Add <strong className="text-gray-900">"{inputText.trim().toUpperCase()}"</strong> as new club
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ClubAutocomplete;
