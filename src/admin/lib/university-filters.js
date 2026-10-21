import { catalogKeywordMatches } from '../../lib/keyword-search.js';

export function filterManagedUniversities(universities, { query = '', searchQuery = '', type = 'All types', status = '' } = {}) {
  return universities.filter(item =>
    (!status || item.status === status) &&
    (type === 'All types' || item.type === type) &&
    [query, searchQuery].every(value => catalogKeywordMatches(item, value, 'school'))
  );
}
