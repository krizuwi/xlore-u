import { catalogKeywordMatches } from './keyword-search.js';

const INVALID_CATALOG_OPTIONS = new Set(['test', 'demo', 'unknown', 'uncategorized', 'n/a', 'na', 'none']);

export function normalizeCatalogOption(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function catalogOptionList(values) {
  const unique = new Map();
  for (const rawValue of values) {
    const value = normalizeCatalogOption(rawValue);
    const key = value.toLocaleLowerCase();
    if (!value || INVALID_CATALOG_OPTIONS.has(key) || unique.has(key)) continue;
    unique.set(key, value);
  }
  return [...unique.values()].sort((left, right) => left.localeCompare(right));
}

export function assessmentProgramFilterOptions(programs) {
  const choices = key => catalogOptionList(programs.map(program => program[key]));
  return { categories: choices('category'), degreeLevels: choices('degreeLevel') };
}

export function filterAssessmentPrograms(programs, { search = '', category = '', degreeLevel = '', sort = 'original' } = {}) {
  const matchesChoice = (value, selected) => !selected
    || normalizeCatalogOption(value).toLocaleLowerCase() === normalizeCatalogOption(selected).toLocaleLowerCase();
  const visible = programs.filter(program => matchesChoice(program.category, category)
    && matchesChoice(program.degreeLevel, degreeLevel)
    && catalogKeywordMatches(program, search));
  // Default order retains the saved recommendation ranking. Never mutate results.
  if (sort === 'name') visible.sort((left, right) => String(left.name ?? '').localeCompare(String(right.name ?? '')));
  return visible;
}
