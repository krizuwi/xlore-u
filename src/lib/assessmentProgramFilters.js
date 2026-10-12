import { catalogKeywordMatches } from './keyword-search.js';

export function assessmentProgramFilterOptions(programs) {
  const choices = key => [...new Set(programs.map(program => program[key]).filter(value => typeof value === 'string' && value.trim()))]
    .sort((left, right) => left.localeCompare(right));
  return { categories: choices('category'), degreeLevels: choices('degreeLevel') };
}

export function filterAssessmentPrograms(programs, { search = '', category = '', degreeLevel = '', sort = 'original' } = {}) {
  const visible = programs.filter(program => (!category || program.category === category)
    && (!degreeLevel || program.degreeLevel === degreeLevel)
    && catalogKeywordMatches(program, search));
  // Default order retains the saved recommendation ranking. Never mutate results.
  if (sort === 'name') visible.sort((left, right) => String(left.name ?? '').localeCompare(String(right.name ?? '')));
  return visible;
}
