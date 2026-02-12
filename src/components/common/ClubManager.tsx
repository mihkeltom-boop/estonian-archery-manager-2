import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from './index';
import ClubAutocomplete from './ClubAutocomplete';
import { getClubs, removeClub, addClub, subscribeToClubs } from '../../utils/clubStore';

const ClubManager: React.FC = () => {
  const [clubs, setClubs]     = useState(getClubs());
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError]     = useState('');
  const [added, setAdded]     = useState('');

  // Keep in sync when club list changes externally (e.g. via autocomplete)
  useEffect(() => subscribeToClubs(() => setClubs(getClubs())), []);

  const handleAdd = () => {
    setError(''); setAdded('');
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    if (!code || !name) { setError('Both code and name are required.'); return; }
    const ok = addClub(code, name);
    if (!ok) { setError(`Code "${code}" already exists.`); return; }
    setAdded(`"${code}" added successfully!`);
    setNewCode(''); setNewName('');
    setClubs(getClubs());
  };

  const handleRemove = (code: string) => {
    removeClub(code);
    setClubs(getClubs());
  };

  const userClubs    = clubs.filter(c => c.userAdded);
  const builtInClubs = clubs.filter(c => !c.userAdded);

  return (
    <div className="space-y-6">
      {/* Add new club */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Add a New Club</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
            <input
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              placeholder="e.g. PÄRK"
              maxLength={10}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none
                focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Full name *</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Pärnu Vibukool"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none
                focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <Button onClick={handleAdd} size="sm">+ Add Club</Button>
          {error  && <span className="text-xs text-red-500">{error}</span>}
          {added  && <span className="text-xs text-green-600">{added}</span>}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          New clubs are saved locally and immediately available for fuzzy matching and autocomplete.
        </p>
      </Card>

      {/* User-added clubs */}
      {userClubs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Custom Clubs</h3>
            <Badge color="purple">{userClubs.length}</Badge>
          </div>
          <div className="divide-y divide-gray-100">
            {userClubs.map(club => (
              <div key={club.code} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-blue-700 w-16 shrink-0">{club.code}</span>
                  <span className="text-sm text-gray-700">{club.name}</span>
                  <Badge color="purple">custom</Badge>
                </div>
                <button
                  onClick={() => handleRemove(club.code)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Built-in clubs (read-only) */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Built-in Clubs</h3>
          <Badge color="blue">{builtInClubs.length}</Badge>
          <span className="text-xs text-gray-400 ml-auto">Read-only · defined in clubStore.ts</span>
        </div>
        <div className="divide-y divide-gray-100">
          {builtInClubs.map(club => (
            <div key={club.code} className="flex items-center gap-3 px-5 py-2.5">
              <span className="font-mono font-semibold text-blue-700 w-16 shrink-0 text-sm">{club.code}</span>
              <span className="text-sm text-gray-600">{club.name}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ClubManager;
