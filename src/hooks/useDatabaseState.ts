import { useReducer, useMemo, useCallback, useEffect } from 'react';
import type { CompetitionRecord, FilterState, SortState } from '../types';

// ── STATE SHAPE ────────────────────────────────────────────────────────────

interface State {
  records: CompetitionRecord[];
  filters: FilterState;
  sort: SortState;
  page: number;
}

type Action =
  | { type: 'SET_RECORDS'; payload: CompetitionRecord[] }
  | { type: 'UPDATE_RECORD'; payload: { id: number; updates: Partial<CompetitionRecord> } }
  | { type: 'DELETE_RECORD'; payload: number }
  | { type: 'SET_FILTER'; field: keyof FilterState; value: FilterState[keyof FilterState] }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_SORT'; column: string }
  | { type: 'LOAD_MORE' }
  | { type: 'RESET_PAGE' };

const PAGE_SIZE = 50;

const defaultFilters: FilterState = {
  searchText: '', club: '', competition: '', bowType: '',
  ageClasses: [], genders: [], distance: '', sourceFile: '', seasonalBest: false,
};

const initialState: State = {
  records: [],
  filters: defaultFilters,
  sort: { column: 'Result', direction: 'desc' },
  page: 1,
};

// ── REDUCER ────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_RECORDS':
      return { ...state, records: action.payload, page: 1 };

    case 'UPDATE_RECORD':
      return {
        ...state,
        records: state.records.map(r =>
          r._id === action.payload.id ? { ...r, ...action.payload.updates } : r
        ),
      };

    case 'DELETE_RECORD':
      return { ...state, records: state.records.filter(r => r._id !== action.payload) };

    case 'SET_FILTER':
      return { ...state, filters: { ...state.filters, [action.field]: action.value }, page: 1 };

    case 'CLEAR_FILTERS':
      return { ...state, filters: defaultFilters, page: 1 };

    case 'SET_SORT': {
      const sameCol = state.sort.column === action.column;
      return {
        ...state,
        sort: {
          column: action.column,
          direction: sameCol && state.sort.direction === 'asc' ? 'desc' : 'asc',
        },
        page: 1,
      };
    }

    case 'LOAD_MORE':
      return { ...state, page: state.page + 1 };

    case 'RESET_PAGE':
      return { ...state, page: 1 };

    default:
      return state;
  }
}

// ── DERIVED DATA ────────────────────────────────────────────────────────────

function applyFilters(records: CompetitionRecord[], f: FilterState): CompetitionRecord[] {
  let d = records;

  if (f.searchText) {
    const q = f.searchText.toLowerCase();
    d = d.filter(r =>
      r.Athlete?.toLowerCase().includes(q) ||
      r.Club?.toLowerCase().includes(q) ||
      r.Competition?.toLowerCase().includes(q)
    );
  }
  if (f.club)        d = d.filter(r => r.Club === f.club);
  if (f.competition) d = d.filter(r => r.Competition === f.competition);
  if (f.bowType)     d = d.filter(r => r['Bow Type'] === f.bowType);
  if (f.ageClasses.length > 0) d = d.filter(r => f.ageClasses.includes(r['Age Class']));
  if (f.genders.length > 0)    d = d.filter(r => f.genders.includes(r.Gender));
  if (f.distance)    d = d.filter(r => r['Shooting Exercise'] === f.distance);
  if (f.sourceFile)  d = d.filter(r => r._sourceFile === f.sourceFile);

  if (f.seasonalBest) {
    const map = new Map<string, CompetitionRecord>();
    d.forEach(r => {
      const key = `${r.Athlete}__${r['Bow Type']}`;
      if (!map.has(key) || r.Result > map.get(key)!.Result) map.set(key, r);
    });
    d = Array.from(map.values());
  }

  return d;
}

function applySort(records: CompetitionRecord[], sort: SortState): CompetitionRecord[] {
  return [...records].sort((a, b) => {
    const av = a[sort.column as keyof CompetitionRecord];
    const bv = b[sort.column as keyof CompetitionRecord];
    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
    return sort.direction === 'asc' ? cmp : -cmp;
  });
}

// ── HOOK ───────────────────────────────────────────────────────────────────

export function useDatabaseState(initial: CompetitionRecord[] = []) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, records: initial });

  // Sync records when initial prop changes
  useEffect(() => {
    dispatch({ type: 'SET_RECORDS', payload: initial });
  }, [initial]);

  const filtered = useMemo(() => applyFilters(state.records, state.filters), [state.records, state.filters]);
  const sorted   = useMemo(() => applySort(filtered, state.sort), [filtered, state.sort]);
  const displayed = useMemo(() => sorted.slice(0, state.page * PAGE_SIZE), [sorted, state.page]);

  const activeFilterCount = useMemo(() => {
    const f = state.filters;
    return [
      f.searchText, f.club, f.competition, f.bowType, f.distance, f.sourceFile,
      f.genders.length > 0, f.ageClasses.length > 0, f.seasonalBest
    ].filter(Boolean).length;
  }, [state.filters]);

  const statistics = useMemo(() => {
    const results = filtered.map(r => r.Result).filter(Boolean);
    const best = results.length ? Math.max(...results) : 0;
    const bestRecord = filtered.find(r => r.Result === best);
    return {
      total: filtered.length,
      athletes: new Set(filtered.map(r => r.Athlete)).size,
      clubs: new Set(filtered.map(r => r.Club)).size,
      competitions: new Set(filtered.map(r => r.Competition)).size,
      avgResult: results.length ? Math.round(results.reduce((a, b) => a + b, 0) / results.length) : 0,
      bestResult: best,
      bestAthlete: bestRecord?.Athlete ?? '',
    };
  }, [filtered]);

  const uniqueValues = useCallback((field: keyof CompetitionRecord): string[] =>
    [...new Set(state.records.map(r => String(r[field] ?? '')).filter(Boolean))].sort(),
    [state.records]
  );

  return {
    state,
    displayed,
    filteredCount: filtered.length,
    hasMore: sorted.length > displayed.length,
    activeFilterCount,
    statistics,
    uniqueValues,
    setRecords:   (records: CompetitionRecord[]) => dispatch({ type: 'SET_RECORDS', payload: records }),
    updateRecord: (id: number, updates: Partial<CompetitionRecord>) => dispatch({ type: 'UPDATE_RECORD', payload: { id, updates } }),
    deleteRecord: (id: number) => dispatch({ type: 'DELETE_RECORD', payload: id }),
    setFilter:    (field: keyof FilterState, value: FilterState[keyof FilterState]) => dispatch({ type: 'SET_FILTER', field, value }),
    clearFilters: () => dispatch({ type: 'CLEAR_FILTERS' }),
    setSort:      (column: string) => dispatch({ type: 'SET_SORT', column }),
    loadMore:     () => dispatch({ type: 'LOAD_MORE' }),
  };
}
