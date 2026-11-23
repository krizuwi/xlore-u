import { readFileSync } from 'node:fs';
import { assert } from '../utils/http-error.js';

export const assessmentTemplate = JSON.parse(readFileSync(new URL('../../database/assessment-template-v2.json', import.meta.url), 'utf8'));
function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

// Keep input checks small and reusable so every setting has the same rules.
function validateText(value, label, maxLength = 1000, allowBlank = false) {
  assert(
    typeof value === 'string' && (allowBlank || value.trim()) && value.length <= maxLength,
    400,
    `${label} must be ${allowBlank ? '0' : '1'}–${maxLength} characters.`
  );
  return value.trim();
}

function validateKey(value, label) {
  assert(
    typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value),
    400,
    `Invalid ${label} ID.`
  );
  return value;
}

// Bound list sizes to avoid accepting oversized admin settings payloads.
function validateList(values, label, maxItems = 100) {
  assert(Array.isArray(values) && values.length <= maxItems, 400, `${label} must be a bounded list.`);
  return values;
}

function requireUnique(values, label) {
  assert(new Set(values).size === values.length, 400, `${label} must not contain duplicates.`);
  return values;
}

function validateCatalogIds(values, label) {
  const validIds = validateList(values, label, 1000).map(value => {
    assert(
      typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
      400,
      `${label} needs valid catalog IDs.`
    );
    return value;
  });

  return requireUnique(validIds, label);
}

function validateWords(values, label) {
  const validWords = validateList(values, label).map(value => validateText(value, label, 120));
  return requireUnique(validWords, label);
}

// Numeric display choices must be unique, nonnegative and below their limit.
function validateCaps(values, label, maximum) {
  const caps = validateList(values, label, 20).map(value => {
    assert(
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum,
      400,
      `${label} must contain supported nonnegative amounts.`
    );
    return value;
  });

  return requireUnique(caps, label).sort((left, right) => left - right);
}

/** Validate and copy the admin-managed assessment rules into a safe structure. */
export function validateAssessmentSettings(value) {
  assert(isRecord(value) && value.schemaVersion === 2, 400, 'Unsupported assessment settings version.');
  assert(isRecord(value.profiles), 400, 'Provide the four macro-profile names.');

  const profiles = Object.fromEntries(
    ['A', 'B', 'C', 'D'].map(profileId => [
      profileId,
      validateText(value.profiles[profileId], 'Profile name', 80)
    ])
  );
  requireUnique(Object.values(profiles).map(name => name.toLowerCase()), 'Profile names');

  // Validate reusable section and cluster definitions first. Routing questions
  // below can then safely refer to these IDs.
  const sections = validateList(value.sections, 'Sections', 30).map(section => {
    assert(isRecord(section), 400, 'Invalid assessment section.');
    return {
      id: validateKey(section.id, 'section'),
      title: validateText(section.title, 'Section title', 190)
    };
  });
  assert(sections.length > 0, 400, 'Keep at least one assessment section.');
  requireUnique(sections.map(section => section.id), 'Section IDs');

  const clusters = validateList(value.clusters, 'Clusters', 50).map(cluster => {
    assert(isRecord(cluster), 400, 'Invalid umbrella cluster.');
    return {
      id: validateKey(cluster.id, 'cluster'),
      name: validateText(cluster.name, 'Cluster name', 190),
      description: validateText(cluster.description, 'Cluster description', 3000, true),
      programExamples: validateWords(cluster.programExamples, 'Program examples'),
      includeKeywords: validateWords(cluster.includeKeywords, 'Program keywords'),
      excludeKeywords: validateWords(cluster.excludeKeywords, 'Excluded keywords'),
      includeProgramIds: validateCatalogIds(cluster.includeProgramIds, 'Included programs'),
      excludeProgramIds: validateCatalogIds(cluster.excludeProgramIds, 'Excluded programs')
    };
  });
  assert(clusters.length > 0, 400, 'Keep at least one umbrella cluster.');
  requireUnique(clusters.map(cluster => cluster.id), 'Cluster IDs');
  requireUnique(clusters.map(cluster => cluster.name.toLowerCase()), 'Cluster names');

  // Every profile's follow-up answers must point at a cluster from this settings set.
  const routingQuestions = {};
  assert(isRecord(value.routingQuestions), 400, 'Provide profile-specific routing questions.');
  for (const profileId of ['A', 'B', 'C', 'D']) {
    const question = value.routingQuestions[profileId];
    assert(isRecord(question), 400, `Provide a routing question for profile ${profileId}.`);

    const options = validateList(question.options, 'Routing answers', 20).map(option => {
      const clusterExists = clusters.some(cluster => cluster.id === option?.clusterId);
      assert(isRecord(option) && clusterExists, 400, 'Each routing answer must reference an existing cluster.');
      return {
        id: validateKey(option.id, 'routing answer'),
        label: validateText(option.label, 'Routing answer', 500),
        clusterId: option.clusterId
      };
    });
    assert(options.length >= 2, 400, 'Each profile needs at least two routing choices.');
    requireUnique(options.map(option => option.id), 'Routing answer IDs');

    routingQuestions[profileId] = {
      title: validateText(question.title, 'Routing section title', 190),
      prompt: validateText(question.prompt, 'Routing prompt', 1000),
      options
    };
  }

  const vehicle = value.careerVehicle;
  assert(isRecord(vehicle) && typeof vehicle.enabled === 'boolean', 400, 'Configure the career-launch question.');
  const vehicleOptions = validateList(vehicle.options, 'Career-launch answers', 20).map(option => {
    assert(isRecord(option), 400, 'Invalid career-launch answer.');
    return {
      id: validateKey(option.id, 'career-launch answer'),
      label: validateText(option.label, 'Career-launch answer', 500),
      note: validateText(option.note, 'Career preference note', 1000, true),
      preferredSchoolIds: validateCatalogIds(option.preferredSchoolIds, 'Preferred schools')
    };
  });
  assert(!vehicle.enabled || vehicleOptions.length >= 2, 400, 'An enabled career-launch question needs at least two answers.');
  requireUnique(vehicleOptions.map(option => option.id), 'Career-launch answer IDs');

  const careerVehicle = {
    enabled: vehicle.enabled,
    title: validateText(vehicle.title, 'Career-launch title', 190),
    prompt: validateText(vehicle.prompt, 'Career-launch prompt', 1000),
    options: vehicleOptions
  };

  // Validate policies that control attempts, ties, program levels, and school order.
  const policy = value.policy;
  assert(
    isRecord(policy) && ['once', 'unlimited'].includes(policy.attempts) && ['ask', 'priority'].includes(policy.tieHandling),
    400,
    'Choose valid attempt and tie policies.'
  );
  assert(
    Array.isArray(policy.tiePriority) && policy.tiePriority.length === 4 &&
      policy.tiePriority.every(profileId => Object.hasOwn(profiles, profileId)),
    400,
    'Provide all four profiles in tie-priority order.'
  );
  requireUnique(policy.tiePriority, 'Tie priority');

  const matching = value.matching;
  assert(isRecord(matching), 400, 'Provide matching rules.');
  const supportedDegreeLevels = ['Bachelor', 'Associate', 'Diploma', 'Certificate', 'Postgraduate'];
  assert(
    Array.isArray(matching.degreeLevels) && matching.degreeLevels.length > 0 &&
      matching.degreeLevels.every(level => supportedDegreeLevels.includes(level)),
    400,
    'Choose supported degree levels.'
  );
  requireUnique(matching.degreeLevels, 'Degree levels');
  assert(
    Array.isArray(matching.schoolPriority) && matching.schoolPriority.length === 4 &&
      matching.schoolPriority.every(priority => ['career', 'distance', 'tuition', 'name'].includes(priority)),
    400,
    'Order all four school priorities.'
  );
  requireUnique(matching.schoolPriority, 'School priorities');

  const display = value.display;
  assert(
    isRecord(display) && Number.isInteger(display.programPreviewCount) &&
      display.programPreviewCount >= 1 && display.programPreviewCount <= 50,
    400,
    'Program preview count must be 1–50.'
  );
  for (const flag of ['showVoteBreakdown', 'showConstraints', 'showClusterDirectory']) {
    assert(typeof display[flag] === 'boolean', 400, 'Result visibility settings must be booleans.');
  }

  assert(isRecord(value.copy), 400, 'Provide assessment text.');
  const copy = Object.fromEntries(
    Object.keys(assessmentTemplate.copy).map(field => [
      field,
      validateText(value.copy[field], field, 3000, !/Button$|Title$/.test(field))
    ])
  );

  return {
    schemaVersion: 2,
    profiles,
    sections,
    clusters,
    routingQuestions,
    careerVehicle,
    policy: {
      attempts: policy.attempts,
      tieHandling: policy.tieHandling,
      tiePriority: policy.tiePriority
    },
    matching: {
      degreeLevels: matching.degreeLevels,
      schoolPriority: matching.schoolPriority
    },
    display: {
      programPreviewCount: display.programPreviewCount,
      showVoteBreakdown: display.showVoteBreakdown,
      showConstraints: display.showConstraints,
      showClusterDirectory: display.showClusterDirectory,
      tuitionChoices: validateCaps(display.tuitionChoices, 'Tuition choices', 1000000),
      distanceChoices: validateCaps(display.distanceChoices, 'Distance choices', 1000)
    },
    copy
  };
}

export function programMatchesCluster(program, cluster) {
  const id = program.program_id ?? program.id;
  if (cluster.excludeProgramIds.includes(id)) return false;
  if (cluster.includeProgramIds.includes(id)) return true;

  // Compare catalog terms in a consistent lowercase, punctuation-free form.
  const normalizeForKeywordSearch = value => String(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
  const normalizedProgramName = ` ${normalizeForKeywordSearch(program.program_name ?? program.name)} `;
  const programNameContains = keyword => normalizedProgramName.includes(` ${normalizeForKeywordSearch(keyword)} `);

  return cluster.includeKeywords.some(programNameContains) && !cluster.excludeKeywords.some(programNameContains);
}

export function assessmentDisplay(settings) {
  // Return only settings that are safe and useful to show in the assessment UI.
  return {
    schemaVersion: settings.schemaVersion,
    profiles: settings.profiles,
    sections: settings.sections,
    policy: settings.policy,
    display: settings.display,
    copy: settings.copy,
    clusters: settings.clusters.map(({ id, name, description, programExamples }) => ({
      id,
      name,
      description,
      programExamples
    }))
  };
}
