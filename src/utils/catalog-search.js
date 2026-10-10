import { normalizeSearch, searchPhrase, searchScope, searchTerms } from "./keyword-search.js";
import { assert } from "./http-error.js";

// PostgreSQL's built-in normalization avoids requiring the unaccent extension.
// Query text is always bound as parameters, never inserted into SQL.
export function normalizedSearchSql(fields) {
  return `(' ' || trim(regexp_replace(translate(lower(concat_ws(' ', ${fields.join(", ")})),
    'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', ' ', 'g')) || ' ')`;
}

export function catalogSearch(query, { fields, name, related, scopes = {}, programTitle = false }) {
  const raw = String(query ?? "").trim();
  assert(raw.length <= 200, 400, "Use a search of 200 characters or fewer.");
  const terms = searchTerms(raw);
  assert(terms.length <= 12, 400, "Use 12 keywords or fewer.");
  if (!terms.length) return { condition: "", values: [], order: "", orderValues: [] };
  const direct = normalizedSearchSql(fields);
  const title = normalizedSearchSql([name]);
  const relatedText = normalizedSearchSql(related.fields);
  const specific = terms.some(options => ["program", "school"].includes(searchScope(options)));
  function expression(options, relatedSide = false) {
    const scope = searchScope(options);
    // Location interpretation is unambiguous for "BSIT Manila" or "PUP Taguig".
    // Preserve literal name matching for a full name such as "Ateneo de Manila".
    const scoped = scope === "location" && !specific ? "general" : scope;
    const scopedFields = relatedSide ? related.scopes?.[scoped] : scopes[scoped];
    return scopedFields ? scopedFields.length ? normalizedSearchSql(scopedFields) : "' '" : relatedSide ? relatedText : direct;
  }

  function group(expression, alternatives, values) {
    if (!alternatives.length) return "FALSE";
    const parameters = alternatives.map(term => {
      values.push(`%${searchPhrase(term)}%`);
      return "?";
    });
    return `(${expression} LIKE ANY (ARRAY[${parameters.join(", ")}]))`;
  }
  function all(text, values) {
    return "(" + terms.map(options => group(typeof text === "function" ? text(options) : text, options, values)).join(" AND ") + ")";
  }

  const values = [];
  const directMatch = all(expression, values);
  // All related keywords must belong to the SAME offering/campus. This avoids
  // "computer science" matching computer engineering plus an unrelated science course.
  const offeringMatch = terms.map(options =>
    `(${group(expression(options), options, values)} OR ${group(expression(options, true), options, values)})`
  ).join(" AND ");
  const condition = `(${directMatch} OR EXISTS (
    SELECT 1 FROM ${related.from} WHERE ${related.where} AND ${offeringMatch}
  ))`;
  const orderValues = [` ${normalizeSearch(raw)} `];
  const programTerms = programTitle ? terms.filter(options => searchScope(options) === "program") : [];
  const coreTitle = `regexp_replace(${title},
    '^ (bachelor of science in |bachelor of arts in |bachelor of business administration in |bachelor of science |bachelor of arts |bachelor in |bs |ba |bba )',
    ' ')`;
  const exactProgramMatch = programTerms.length ? "(" + programTerms.map(options => {
    const placeholders = options.map(term => { orderValues.push(` ${term} `); return "?"; });
    return `${coreTitle} = ANY (ARRAY[${placeholders.join(", ")}])`;
  }).join(" AND ") + ")" : "FALSE";
  const primaryProgramMatch = programTerms.length ? "(" + programTerms.map(options =>
    "(" + options.map(term => {
      orderValues.push(`${searchPhrase(term)}%`);
      return `${coreTitle} LIKE ?`;
    }).join(" OR ") + ")"
  ).join(" AND ") + ")" : "FALSE";
  const titleMatch = all(title, orderValues);
  const metadataMatch = all(expression, orderValues);
  const order = `CASE WHEN ${title} = ? THEN 0 WHEN ${exactProgramMatch} THEN 1
    WHEN ${primaryProgramMatch} THEN 2 WHEN ${titleMatch} THEN 3
    WHEN ${metadataMatch} THEN 4 ELSE 5 END ASC, ${name} ASC`;
  return { condition, values, order, orderValues };
}

export const schoolSearch = query => catalogSearch(query, {
  name: "s.school_name",
  fields: ["s.school_name", "s.city_district", "s.address", "s.school_type"],
  scopes: {
    school: ["s.school_name"], program: [],
    location: ["s.city_district", "regexp_replace(s.address, 'metro manila', '', 'gi')"]
  },
  related: {
    fields: ["px.program_name", "px.category", "px.degree_level", "px.career_paths::text", "px.interest_tags::text"],
    scopes: { program: ["px.program_name"], school: [], location: [] },
    from: "school_programs spx JOIN programs px ON px.program_id = spx.program_id",
    where: "spx.school_id = s.school_id AND px.is_active = TRUE"
  }
});

export const programSearch = query => catalogSearch(query, {
  name: "p.program_name",
  programTitle: true,
  fields: ["p.program_name", "p.category", "p.degree_level", "p.description", "p.career_paths::text", "p.interest_tags::text"],
  scopes: { program: ["p.program_name"], school: [], location: [] },
  related: {
    fields: ["sx.school_name", "sx.city_district", "sx.address", "sx.school_type"],
    scopes: {
      school: ["sx.school_name"], program: [],
      location: ["sx.city_district", "regexp_replace(sx.address, 'metro manila', '', 'gi')"]
    },
    from: "school_programs spx JOIN schools sx ON sx.school_id = spx.school_id JOIN available_schools ax ON ax.school_id = sx.school_id",
    where: "spx.program_id = p.program_id AND ax.is_active_available = TRUE"
  }
});
