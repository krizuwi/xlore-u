// Keep this portable module identical in frontend/src/lib and backend/src/utils.
// Both repositories deploy independently; no cross-repository runtime imports.
const aliases = {
  sti: ["sti college", "sti"],
  mapua: ["mapua university", "mapua"],
  ateneo: ["ateneo de manila", "ateneo"],
  adamson: ["adamson university", "adamson"],
  letran: ["colegio de san juan de letran", "letran"],
  sanbeda: ["san beda", "sanbeda"],
  up: ["university of the philippines", "up"],
  upd: ["university of the philippines diliman", "up diliman"],
  upm: ["university of the philippines manila", "up manila"],
  pup: ["polytechnic university of the philippines", "pup"],
  ust: ["university of santo tomas", "ust"],
  dlsu: ["de la salle university", "dlsu"],
  csb: ["college of saint benilde", "csb"],
  dlscsb: ["college of saint benilde", "dls csb"],
  admu: ["ateneo de manila", "admu"],
  feu: ["far eastern university", "feu"],
  nu: ["national university", "nu"],
  ue: ["university of the east", "ue"],
  plm: ["pamantasan ng lungsod ng maynila", "plm"],
  tup: ["technological university of the philippines", "tup"],
  tip: ["technological institute of the philippines", "tip"],
  umak: ["university of makati", "umak"],
  udm: ["universidad de manila", "udm"],
  qcu: ["quezon city university", "qcu"],
  tcu: ["taguig city university", "tcu"],
  pnu: ["philippine normal university", "pnu"],
  pwu: ["philippine women s university", "pwu"],
  ceu: ["centro escolar university", "ceu"],
  lpu: ["lyceum of the philippines", "lpu"],
  earist: ["eulogio amang rodriguez", "earist"],
  olfu: ["our lady of fatima university", "olfu"],
  mlqu: ["manuel l quezon university", "mlqu"],
  apc: ["asia pacific college", "apc"],
  aim: ["asian institute of management", "aim"],
  aims: ["asian institute of maritime studies", "aims"],
  mcu: ["manila central university", "mcu"],
  ntc: ["national teachers college", "ntc"],
  uap: ["university of asia and the pacific", "uap"],
  qc: ["quezon", "qc"],
  bgc: ["bonifacio global city", "global city", "bgc"],
  it: ["information technology", "it"],
  bsit: ["information technology", "bsit", "bs it"],
  cs: ["computer science", "cs"],
  bscs: ["computer science", "bscs", "bs cs"],
  bsa: ["accountancy", "bsa"],
  bsba: ["business administration", "bsba"],
  bsn: ["nursing", "bsn"],
  bshm: ["hospitality management", "bshm"],
  bstm: ["tourism management", "bstm"],
  bsed: ["secondary education", "bsed"],
  beed: ["elementary education", "beed"],
  bsee: ["electrical engineering", "bsee"],
  bsce: ["civil engineering", "bsce"],
  bscpe: ["computer engineering", "bscpe"],
  bsece: ["electronics engineering", "bsece"],
  bsme: ["mechanical engineering", "bsme"],
  bs: ["bachelor of science", "bs"],
  ba: ["bachelor of arts", "ba"],
  bba: ["bachelor of business administration", "bba"]
};
const ignored = new Set(["in", "of", "the", "and", "at", "by", "offered", "program", "programs", "course", "courses", "school", "schools"]);
const programKeys = new Set(["it", "bsit", "cs", "bscs", "bsa", "bsba", "bsn", "bshm", "bstm", "bsed", "beed", "bsee", "bsce", "bscpe", "bsece", "bsme", "bs", "ba", "bba"]);
const locations = new Set(["manila", "makati", "taguig", "pasay", "pasig", "quezon", "caloocan", "malabon", "navotas", "valenzuela", "marikina", "muntinlupa", "paranaque", "pateros", "san juan", "las pinas", "qc", "bgc"]);
// Recognize full course names too, so a course query doesn't merely match a
// mention of that course in another program's description.
const programPhrases = [...programKeys].filter(key => !["bs", "ba", "bba"].includes(key))
  .map(key => [aliases[key][0], aliases[key]])
  .sort((a, b) => b[0].length - a[0].length);
const institutionPhrases = Object.entries(aliases)
  .filter(([key]) => !programKeys.has(key) && !locations.has(key))
  .map(([, alternatives]) => [alternatives[0], alternatives])
  .sort((a, b) => b[0].length - a[0].length);
export function searchScope(alternatives) {
  if (alternatives.some(term => programKeys.has(term))) return "program";
  if (alternatives.some(term => locations.has(term))) return "location";
  if (alternatives.some(term => Object.hasOwn(aliases, term))) return "school";
  return "general";
}


export function normalizeSearch(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/([a-z])\.(?=[a-z]\b)/g, "$1")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function searchText(...values) {
  function flatten(value) {
    if (Array.isArray(value)) return value.map(flatten).join(" ");
    if (value && typeof value === "object") return Object.values(value).map(flatten).join(" ");
    return String(value ?? "");
  }
  return values.map(flatten).join(" ");
}

export function searchTerms(query) {
  const normalized = normalizeSearch(query);
  const words = normalized.split(" ").filter(Boolean);
  const terms = [];
  for (let index = 0; index < words.length; index += 1) {
    const rest = words.slice(index).join(" ");
    const phrase = programPhrases.find(([name]) => rest === name || rest.startsWith(name + " ")) ??
      institutionPhrases.find(([name]) => rest === name || rest.startsWith(name + " "));
    if (phrase) {
      terms.push(phrase[1]);
      index += phrase[0].split(" ").length - 1;
      continue;
    }
    // Also accept spaced abbreviations: "BS IT", "BS CS", "BS BA".
    const compound = words[index] === "bs" ? `bs${words[index + 1] ?? ""}` : "";
    const word = Object.hasOwn(aliases, compound) ? (index += 1, compound) : words[index];
    if (!ignored.has(word)) terms.push(Object.hasOwn(aliases, word) ? aliases[word] : [word]);
  }
  // An empty search shows everything; punctuation-only searches show nothing.
  // Stop-word-only searches remain literal rather than silently matching everything.
  return terms.length ? terms : normalized ? [[normalized]] : String(query ?? "").trim() ? [[]] : [];
}

export function searchPhrase(term) {
  return ` ${term}${term.length < 3 || Object.hasOwn(aliases, term) ? " " : ""}`;
}

// Structured catalog searches mirror the API scopes, including same-campus
// matching. Other admin search bars can use keywordMatches for arbitrary records.
export function catalogKeywordMatches(record, query, kind = "program") {
  const terms = searchTerms(query);
  const specific = terms.some(options => ["program", "school"].includes(searchScope(options)));
  const isSchool = kind === "school";
  const related = isSchool ? (record.programNames ?? []).map(name => ({ name })) : record.schools ?? [];
  function fields(item, school, options) {
    const scope = searchScope(options);
    if (scope === "program") return school ? "" : item.name;
    if (scope === "school") return school ? item.name : "";
    if (scope === "location" && specific) return school ?
      searchText(item.city, String(item.address ?? "").replace(/metro manila/gi, "")) : "";
    return school ? searchText(item.name, item.city, item.address, item.type, item.status) :
      searchText(item.name, item.category, item.degreeLevel, item.description, item.careerPaths, item.interestTags, item.status);
  }
  function matchesOptions(value, options) {
    const text = ` ${normalizeSearch(value)} `;
    return options.some(term => text.includes(searchPhrase(term)));
  }
  const matchesDirect = options => matchesOptions(fields(record, isSchool, options), options);
  return terms.every(matchesDirect) || related.some(item =>
    terms.every(options => matchesDirect(options) || matchesOptions(fields(item, !isSchool, options), options))
  );
}

export function keywordMatches(value, query) {
  const text = ` ${normalizeSearch(searchText(value))} `;
  return searchTerms(query).every(alternatives => alternatives.some(term => {
    // Short words are exact tokens (IT must not match "literature").
    // Longer keywords can match the beginning of a word while typing.
    return text.includes(searchPhrase(term));
  }));
}
