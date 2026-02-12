import React from 'react';

// ── BUTTON ─────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children, variant = 'primary', size = 'md',
  loading, icon, className = '', disabled, ...props
}, ref) => {
  const variants = {
    primary:   'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',
    danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost:     'hover:bg-gray-100 text-gray-600',
  };
  const sizes = {
    sm:  'px-3 py-1.5 text-xs gap-1.5',
    md:  'px-4 py-2 text-sm gap-2',
    lg:  'px-5 py-2.5 text-sm gap-2',
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center font-medium rounded-lg transition-all
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      ) : icon ? (
        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
});

// ── BADGE ──────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  color?: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'teal';
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'gray' }) => {
  const colors = {
    gray:   'bg-gray-100 text-gray-700',
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-800',
    red:    'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    teal:   'bg-teal-100 text-teal-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

export const ConfidenceBadge: React.FC<{ value: number }> = ({ value }) => (
  <Badge color={value >= 90 ? 'green' : value >= 70 ? 'yellow' : 'red'}>
    {value}% match
  </Badge>
);

// ── CARD ───────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
    {children}
  </div>
);

// ── STAT CARD ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  emoji: string;
  color?: 'blue' | 'purple' | 'teal' | 'orange' | 'green';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, emoji, color = 'blue' }) => {
  const bg = {
    blue:   'bg-blue-50',
    purple: 'bg-purple-50',
    teal:   'bg-teal-50',
    orange: 'bg-orange-50',
    green:  'bg-green-50',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg[color]} rounded-lg flex items-center justify-center text-xl shrink-0`}>
          {emoji}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </Card>
  );
};

// ── INPUT ──────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
    <input
      className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-all
        ${error ? 'border-red-400 focus:ring-2 focus:ring-red-300' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
        ${className}`}
      {...props}
    />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

// ── SELECT ─────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ label, options, placeholder, className = '', ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
    <select
      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none
        focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// ── PROGRESS BAR ───────────────────────────────────────────────────────────

export const ProgressBar: React.FC<{ value: number; label?: string }> = ({ value, label }) => (
  <div className="space-y-1.5">
    {label && (
      <div className="flex justify-between text-sm text-gray-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
    )}
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

// ── EMPTY STATE ────────────────────────────────────────────────────────────

export const EmptyState: React.FC<{ emoji: string; title: string; description?: string; action?: React.ReactNode }> = ({
  emoji, title, description, action
}) => (
  <div className="text-center py-16 space-y-4">
    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl mx-auto">
      {emoji}
    </div>
    <div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
    {action}
  </div>
);
