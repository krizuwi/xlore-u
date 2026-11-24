const INVALID_OPTIONS = new Set(['test', 'demo', 'unknown', 'uncategorized', 'n/a', 'na', 'none']);

export function normalizeCatalogOption(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function uniqueCatalogOptions(values = []) {
  const options = new Map();
  for (const rawValue of values) {
    const value = normalizeCatalogOption(rawValue);
    const key = value.toLocaleLowerCase();
    if (!value || INVALID_OPTIONS.has(key) || options.has(key)) continue;
    options.set(key, value);
  }
  return [...options.values()].sort((left, right) => left.localeCompare(right));
}
