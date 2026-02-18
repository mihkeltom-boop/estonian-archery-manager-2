export const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return '';
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
};


export const sanitizeFilename = (name: string): string =>
  name.replace(/\.\./g, '').replace(/[\/\\<>:"|?*]/g, '').slice(0, 255);

export const safeJSONParse = <T>(json: string): T | null => {
  try { return JSON.parse(json) as T; }
  catch { return null; }
};

export const exportToCSV = (
  records: Array<Record<string, unknown>>,
  columns: Array<{ key: string; label: string }>
): string => {
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = columns.map(c => c.label).join(',');
  const rows = records.map(r => columns.map(c => escape(r[c.key])).join(','));
  return [header, ...rows].join('\n');
};

export const downloadCSV = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
