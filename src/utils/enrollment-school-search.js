import { normalizedSearchSql } from './catalog-search.js';
import { normalizeSearch, searchPhrase, searchScope, searchTerms } from './keyword-search.js';
import { assert } from './http-error.js';

// Match school identity/location only, never programs offered by another school.
export function enrollmentSchoolSearch(query) {
  assert(query === undefined || typeof query === 'string' && query.length <= 100, 400, 'Use up to 100 characters to search schools.');
  const raw = (query ?? '').trim(), terms = searchTerms(raw);
  assert(terms.length <= 12, 400, 'Use 12 keywords or fewer.');
  if (!raw) return { condition: 'TRUE', values: [], order: 's.school_name, s.school_id', orderValues: [] };
  const title = normalizedSearchSql(['s.school_name']);
  const city = normalizedSearchSql(['s.city_district']);
  const combined = normalizedSearchSql(['s.school_name', 's.city_district']);
  const specificSchool = terms.some(options => searchScope(options) === 'school');
  function group(options, values, nameOnly = false) {
    if (!options.length) return 'FALSE';
    const scope = searchScope(options);
    const field = nameOnly || scope === 'school' ? title : scope === 'location' && specificSchool ? city : combined;
    return '(' + options.map(term => {
      // Full-name aliases start at the school's name: UP must not match PUP
      // merely because "university of the philippines" is inside its name.
      const schoolPhrase = scope === 'school' && term.includes(' ') && term !== 'college of saint benilde';
      values.push((schoolPhrase ? '' : '%') + searchPhrase(term) + '%');
      return `${field} LIKE ?`;
    }).join(' OR ') + ')';
  }
  const values = [], orderValues = [` ${normalizeSearch(raw)} `];
  const condition = terms.map(options => group(options, values)).join(' AND ');
  const nameMatch = terms.map(options => group(options, orderValues, true)).join(' AND ');
  return { condition, values,
    order: `CASE WHEN ${title} = ? THEN 0 WHEN (${nameMatch}) THEN 1 ELSE 2 END, s.school_name, s.school_id`, orderValues };
}
