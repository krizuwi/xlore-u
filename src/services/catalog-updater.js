import crypto from "node:crypto";
import { load } from "cheerio";
import { config } from "../config.js";
import { rawPool } from "../db/pool.js";
import { fetchAllowedHtml } from "./robots.js";

const DEFAULT_ITEM_SELECTOR =
  "main h1, main h2, main h3, main h4, main h5, main h6, main li, main td, article h1, article h2, article h3, article h4, article h5, article h6, article li, article td";

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCaseIfUppercase(value) {
  if (value !== value.toUpperCase()) return value;
  const smallWords = new Set(["and", "in", "of", "with", "major"]);
  return value
    .toLowerCase()
    .split(" ")
    .map((word, index) =>
      index > 0 && smallWords.has(word) ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    )
    .join(" ");
}

function cleanProgramName(value) {
  return cleanText(value)
    .replace(/>/g, "")
    .replace(/\s*\([^)]*(?:years?|campus|Manila|Laguna)[^)]*\)\s*$/i, "")
    .replace(/\s*\([A-Z][A-Za-z0-9-]{1,12}\)\s*$/, "")
    .trim();
}

function inferCategory(name) {
  const normalized = normalizeName(name);
  const categories = [
    ["Computing and Information Technology", ["computer", "information technology", "data science", "cyber", "software"]],
    ["Engineering", ["engineering", "mechatronics"]],
    ["Business and Management", ["business", "account", "management", "entrepreneur", "economics", "finance", "marketing"]],
    ["Health Sciences", ["nursing", "pharmacy", "medical", "health", "therapy", "nutrition"]],
    ["Architecture and Design", ["architecture", "design", "multimedia", "fine arts"]],
    ["Communication", ["communication", "journalism", "broadcast", "advertising"]],
    ["Education", ["education", "teaching", "teacher"]],
    ["Natural Sciences", ["biology", "chemistry", "physics", "mathematics", "statistics", "environmental science"]],
    ["Social Sciences", ["psychology", "sociology", "political", "history", "philosophy", "social work"]],
    ["Hospitality and Tourism", ["hospitality", "tourism"]]
  ];
  return categories.find(([, terms]) => terms.some((term) => normalized.includes(term)))?.[0] ?? "Other";
}

function interestTagsFor(category) {
  const tags = {
    "Computing and Information Technology": ["technology", "analytical"],
    Engineering: ["engineering", "analytical", "technology"],
    "Business and Management": ["business", "leadership"],
    "Health Sciences": ["health", "science", "service"],
    "Architecture and Design": ["creative", "design", "technology"],
    Communication: ["communication", "creative"],
    Education: ["education", "service"],
    "Natural Sciences": ["science", "analytical"],
    "Social Sciences": ["social", "communication"],
    "Hospitality and Tourism": ["service", "business"]
  };
  return tags[category] ?? ["general"];
}

function structuredAddress(address) {
  if (typeof address === "string") return cleanText(address);
  if (!address || typeof address !== "object") return null;
  const parts = [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode]
    .map(cleanText)
    .filter(Boolean);
  return parts.length >= 2 ? [...new Set(parts)].join(", ") : null;
}

function findOrganizationJson(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOrganizationJson(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  if (types.some((type) => ["CollegeOrUniversity", "EducationalOrganization", "Organization"].includes(type))) {
    return value;
  }
  return findOrganizationJson(value["@graph"]);
}

function extractSchoolProfile(html, finalUrl) {
  const $ = load(html);
  let organization = null;
  $('script[type="application/ld+json"]').each((_index, element) => {
    if (organization) return;
    try {
      organization = findOrganizationJson(JSON.parse($(element).text()));
    } catch {
      // Ignore malformed metadata from the source and continue with standard meta tags.
    }
  });
  const description = cleanText(
    organization?.description ||
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content")
  );
  return {
    officialWebsiteUrl: finalUrl,
    description:
      description.length >= 60 && description.length <= 1000 && !/cookie|javascript/i.test(description)
        ? description
        : null,
    address: structuredAddress(organization?.address)
  };
}

function extractProgramCandidates(html, parserConfig = {}) {
  const $ = load(html);
  $("script, style, nav, footer, noscript, svg").remove();
  const selector = parserConfig.itemSelector || DEFAULT_ITEM_SELECTOR;
  const values = [];
  $(selector).each((_index, element) => {
    let text = cleanText($(element).clone().children().remove().end().text() || $(element).text());
    text = text
      .replace(/\s+(Course Description|Program Educational Outcomes|Program Requirements|Grade Requirement).*$/i, "")
      .replace(/\s*[|•]\s*.*$/, "")
      .trim();
    text = cleanProgramName(text);
    if (text.length >= 3 && text.length <= 190) values.push(text);
  });
  return [...new Set(values.map(titleCaseIfUppercase))].slice(0, 1000);
}

function isNewBachelorProgram(value) {
  const normalized = normalizeName(value);
  if (!/^bachelor(s | )?(of |in )/.test(normalized)) return false;
  if (/bachelor(s)? (degree|degrees|program|programs)$/.test(normalized)) return false;
  return normalized.split(" ").length >= 4;
}

async function logChange(client, { runId, source, entityType, entityId, action, fieldName, oldValue, newValue }) {
  await client.query(
    `INSERT INTO catalog_change_log
      (run_id, source_id, entity_type, entity_id, action, field_name, old_value, new_value, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
    [
      runId,
      source.source_id,
      entityType,
      entityId,
      action,
      fieldName ?? null,
      oldValue === undefined ? null : JSON.stringify(oldValue),
      newValue === undefined ? null : JSON.stringify(newValue),
      source.source_url
    ]
  );
}

async function applySchoolProfile(client, source, runId, profile) {
  const currentResult = await client.query("SELECT * FROM schools WHERE school_id = $1", [source.school_id]);
  const current = currentResult.rows[0];
  const changes = [];
  const fields = [
    ["official_website_url", profile.officialWebsiteUrl],
    ["description", profile.description]
  ];
  for (const [field, nextValue] of fields) {
    if (!nextValue || current[field] === nextValue) continue;
    await client.query(`UPDATE schools SET ${field} = $1 WHERE school_id = $2`, [nextValue, source.school_id]);
    await logChange(client, {
      runId,
      source,
      entityType: "school",
      entityId: source.school_id,
      action: "update",
      fieldName: field,
      oldValue: current[field],
      newValue: nextValue
    });
    changes.push(field);
  }
  return changes.length;
}

async function loadAliasMap(client) {
  const result = await client.query(
    `SELECT pa.normalized_alias, p.program_id, p.program_name
     FROM program_aliases pa JOIN programs p ON p.program_id = pa.program_id`
  );
  return new Map(result.rows.map((row) => [row.normalized_alias, row]));
}

async function applyPrograms(client, source, runId, candidates) {
  const aliasMap = await loadAliasMap(client);
  const detected = new Map();
  for (const candidate of candidates) {
    const normalized = normalizeName(candidate);
    const known = aliasMap.get(normalized);
    if (known) detected.set(known.program_id, { ...known, sourceName: candidate, existing: true });
    else if (isNewBachelorProgram(candidate)) detected.set(`new:${normalized}`, { sourceName: candidate, existing: false });
    if (detected.size >= 250) break;
  }

  let changed = 0;
  for (const detectedProgram of detected.values()) {
    let programId = detectedProgram.program_id;
    if (!detectedProgram.existing) {
      const category = inferCategory(detectedProgram.sourceName);
      const inserted = await client.query(
        `INSERT INTO programs
          (program_id, program_name, description, category, degree_level, requirements,
           career_paths, interest_tags, source_url, last_verified_at, created_from_scrape)
         VALUES (gen_random_uuid(), $1, $2, $3, 'Bachelor', $4, '[]'::jsonb, $5::jsonb, $6, CURRENT_TIMESTAMP, true)
         ON CONFLICT (program_name) DO UPDATE SET last_verified_at = CURRENT_TIMESTAMP
         RETURNING program_id, (xmax = 0) AS inserted`,
        [
          detectedProgram.sourceName,
          `Undergraduate program listed by ${source.school_name} on its official academic programs page.`,
          category,
          "See the institution's official program page for current admission requirements.",
          JSON.stringify(interestTagsFor(category)),
          source.source_url
        ]
      );
      programId = inserted.rows[0].program_id;
      await client.query(
        `INSERT INTO program_aliases (program_id, alias, normalized_alias)
         VALUES ($1, $2, $3) ON CONFLICT (normalized_alias) DO NOTHING`,
        [programId, detectedProgram.sourceName, normalizeName(detectedProgram.sourceName)]
      );
      if (inserted.rows[0].inserted) {
        await logChange(client, {
          runId,
          source,
          entityType: "program",
          entityId: programId,
          action: "create",
          newValue: { name: detectedProgram.sourceName, category }
        });
        changed += 1;
      }
    } else {
      await client.query(
        "UPDATE programs SET last_verified_at = CURRENT_TIMESTAMP WHERE program_id = $1",
        [programId]
      );
    }

    const offering = await client.query(
      `INSERT INTO school_programs
        (school_program_id, school_id, program_id, tuition_per_semester, is_top_program, source_url, last_verified_at)
       VALUES (gen_random_uuid(), $1, $2, NULL, false, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (school_id, program_id) DO UPDATE SET
         source_url = EXCLUDED.source_url,
         last_verified_at = CURRENT_TIMESTAMP
       RETURNING school_program_id, (xmax = 0) AS inserted`,
      [source.school_id, programId, source.source_url]
    );
    if (offering.rows[0].inserted) {
      await logChange(client, {
        runId,
        source,
        entityType: "school_program",
        entityId: offering.rows[0].school_program_id,
        action: "create",
        newValue: { schoolId: source.school_id, programId }
      });
      changed += 1;
    }
  }
  return { discovered: detected.size, changed };
}

async function processSource(client, source, runId) {
  const { html, finalUrl } = await fetchAllowedHtml(source.source_url, source.allowed_host);
  const contentHash = crypto.createHash("sha256").update(html).digest("hex");
  if (source.last_content_hash === contentHash) {
    await client.query(
      `UPDATE catalog_sources SET last_checked_at = CURRENT_TIMESTAMP, last_success_at = CURRENT_TIMESTAMP,
        last_status = 'unchanged', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE source_id = $1`,
      [source.source_id]
    );
    await client.query("UPDATE schools SET catalog_last_checked_at = CURRENT_TIMESTAMP WHERE school_id = $1", [source.school_id]);
    return { discovered: 0, changed: 0 };
  }

  let result;
  if (source.source_type === "school_profile") {
    const changed = await applySchoolProfile(client, source, runId, extractSchoolProfile(html, finalUrl));
    result = { discovered: 1, changed };
  } else {
    const candidates = extractProgramCandidates(html, source.parser_config);
    result = await applyPrograms(client, source, runId, candidates);
  }

  await client.query(
    `UPDATE catalog_sources SET last_checked_at = CURRENT_TIMESTAMP, last_success_at = CURRENT_TIMESTAMP,
      last_content_hash = $1, last_status = 'success', last_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE source_id = $2`,
    [contentHash, source.source_id]
  );
  await client.query(
    `UPDATE schools SET catalog_last_checked_at = CURRENT_TIMESTAMP,
      catalog_last_updated_at = CASE WHEN $1 > 0 THEN CURRENT_TIMESTAMP ELSE catalog_last_updated_at END
     WHERE school_id = $2`,
    [result.changed, source.school_id]
  );
  return result;
}

export async function runCatalogUpdate({ triggerType = "manual", dueOnly = false } = {}) {
  const client = await rawPool.connect();
  let hasLock = false;
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext('xlore_u_catalog_update')) AS acquired");
    hasLock = lock.rows[0].acquired;
    if (!hasLock) return { skipped: true, reason: "Another catalog update is already running." };

    const run = await client.query(
      "INSERT INTO catalog_update_runs (trigger_type, status) VALUES ($1, 'running') RETURNING run_id",
      [triggerType]
    );
    const runId = run.rows[0].run_id;
    const values = [];
    let dueCondition = "";
    if (dueOnly) {
      values.push(config.catalogUpdater.intervalHours);
      dueCondition = `AND (cs.last_checked_at IS NULL OR cs.last_checked_at <= CURRENT_TIMESTAMP -
        make_interval(hours => LEAST(cs.interval_hours, $1)))`;
    }
    values.push(config.catalogUpdater.maxSourcesPerRun);
    const sources = await client.query(
      `SELECT cs.*, s.school_name
       FROM catalog_sources cs JOIN schools s ON s.school_id = cs.school_id
       WHERE cs.enabled = true ${dueCondition}
       ORDER BY cs.last_checked_at NULLS FIRST, cs.created_at
       LIMIT $${values.length}`,
      values
    );

    const totals = { checked: 0, succeeded: 0, discovered: 0, changed: 0 };
    const errors = [];
    for (const source of sources.rows) {
      totals.checked += 1;
      try {
        const result = await processSource(client, source, runId);
        totals.succeeded += 1;
        totals.discovered += result.discovered;
        totals.changed += result.changed;
      } catch (error) {
        const message = cleanText(error.message).slice(0, 1000);
        errors.push(`${source.school_name}: ${message}`);
        await client.query(
          `UPDATE catalog_sources SET last_checked_at = CURRENT_TIMESTAMP, last_status = 'failed',
            last_error = $1, updated_at = CURRENT_TIMESTAMP WHERE source_id = $2`,
          [message, source.source_id]
        );
      }
    }

    const status = errors.length === 0 ? "completed" : totals.succeeded > 0 ? "partial" : "failed";
    await client.query(
      `UPDATE catalog_update_runs SET status = $1, sources_checked = $2, sources_succeeded = $3,
        records_discovered = $4, records_changed = $5, finished_at = CURRENT_TIMESTAMP,
        error_summary = $6 WHERE run_id = $7`,
      [status, totals.checked, totals.succeeded, totals.discovered, totals.changed, errors.join("\n") || null, runId]
    );
    return { runId, status, ...totals, errors };
  } finally {
    if (hasLock) await client.query("SELECT pg_advisory_unlock(hashtext('xlore_u_catalog_update'))");
    client.release();
  }
}
