import React, { useState, useEffect, useCallback } from 'react';

// ── Toast types ──────────────────────────────────────────────────────────────

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

// ── Global toast state (lightweight, no context needed) ─────────────────────

let _toasts: ToastMessage[] = [];
let _nextId = 0;
let _listeners: Array<(toasts: ToastMessage[]) => void> = [];

function notify() {
  _listeners.forEach(fn => fn([..._toasts]));
}

export function showToast(type: ToastMessage['type'], text: string, durationMs = 3500) {
  const id = ++_nextId;
  _toasts = [..._toasts, { id, type, text }];
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  }, durationMs);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useToasts(): ToastMessage[] {
  const [toasts, setToasts] = useState<ToastMessage[]>(_toasts);
  useEffect(() => {
    _listeners.push(setToasts);
    return () => { _listeners = _listeners.filter(l => l !== setToasts); };
  }, []);
  return toasts;
}

// ── Render ───────────────────────────────────────────────────────────────────

const ICONS: Record<ToastMessage['type'], string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
};

const COLORS: Record<ToastMessage['type'], string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
};

const ToastDismiss: React.FC<{ id: number }> = ({ id }) => {
  const dismiss = useCallback(() => {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  }, [id]);

  return (
    <button onClick={dismiss} className="ml-3 opacity-70 hover:opacity-100 text-white text-sm">
      ×
    </button>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${COLORS[t.type]} text-white px-4 py-3 rounded-lg shadow-lg
            flex items-center text-sm font-medium fade-in`}
        >
          <span className="mr-2 font-bold">{ICONS[t.type]}</span>
          <span className="flex-1">{t.text}</span>
          <ToastDismiss id={t.id} />
        </div>
      ))}
    </div>
  );
};
