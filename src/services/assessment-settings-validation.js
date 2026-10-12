import { readFileSync } from 'node:fs';
import { assert } from '../utils/http-error.js';

export const assessmentTemplate = JSON.parse(readFileSync(new URL('../../database/assessment-template-v2.json', import.meta.url), 'utf8'));
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, label, max = 1000, blank = false) => {
  assert(typeof value === 'string' && (blank || value.trim()) && value.length <= max, 400, `${label} must be ${blank ? '0' : '1'}–${max} characters.`);
  return value.trim();
};
const key = (value, label) => { assert(typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value), 400, `Invalid ${label} ID.`); return value; };
const list = (values, label, max = 100) => { assert(Array.isArray(values) && values.length <= max, 400, `${label} must be a bounded list.`); return values; };
const unique = (values, label) => { assert(new Set(values).size === values.length, 400, `${label} must not contain duplicates.`); return values; };
const ids = (values, label) => unique(list(values, label, 1000).map(value => {
  assert(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), 400, `${label} needs valid catalog IDs.`); return value;
}), label);
const words = (values, label) => unique(list(values, label).map(value => text(value, label, 120)), label);

export function validateAssessmentSettings(value) {
  assert(record(value) && value.schemaVersion === 2, 400, 'Unsupported assessment settings version.');
  assert(record(value.profiles), 400, 'Provide the four macro-profile names.');
  const profiles = Object.fromEntries(['A', 'B', 'C', 'D'].map(id => [id, text(value.profiles[id], 'Profile name', 80)]));
  unique(Object.values(profiles).map(name => name.toLowerCase()), 'Profile names');
  const sections = list(value.sections, 'Sections', 30).map(section => {
    assert(record(section), 400, 'Invalid assessment section.');
    return { id: key(section.id, 'section'), title: text(section.title, 'Section title', 190) };
  });
  assert(sections.length > 0, 400, 'Keep at least one assessment section.'); unique(sections.map(s => s.id), 'Section IDs');
  const clusters = list(value.clusters, 'Clusters', 50).map(cluster => {
    assert(record(cluster), 400, 'Invalid umbrella cluster.');
    return { id: key(cluster.id, 'cluster'), name: text(cluster.name, 'Cluster name', 190), description: text(cluster.description, 'Cluster description', 3000, true),
      programExamples: words(cluster.programExamples, 'Program examples'), includeKeywords: words(cluster.includeKeywords, 'Program keywords'),
      excludeKeywords: words(cluster.excludeKeywords, 'Excluded keywords'), includeProgramIds: ids(cluster.includeProgramIds, 'Included programs'),
      excludeProgramIds: ids(cluster.excludeProgramIds, 'Excluded programs') };
  });
  assert(clusters.length > 0, 400, 'Keep at least one umbrella cluster.'); unique(clusters.map(c => c.id), 'Cluster IDs');
  unique(clusters.map(c => c.name.toLowerCase()), 'Cluster names');
  const routingQuestions = {};
  assert(record(value.routingQuestions), 400, 'Provide profile-specific routing questions.');
  for (const profile of ['A', 'B', 'C', 'D']) {
    const question = value.routingQuestions[profile]; assert(record(question), 400, `Provide a routing question for profile ${profile}.`);
    const options = list(question.options, 'Routing answers', 20).map(option => {
      assert(record(option) && clusters.some(c => c.id === option.clusterId), 400, 'Each routing answer must reference an existing cluster.');
      return { id: key(option.id, 'routing answer'), label: text(option.label, 'Routing answer', 500), clusterId: option.clusterId };
    });
    assert(options.length >= 2, 400, 'Each profile needs at least two routing choices.'); unique(options.map(o => o.id), 'Routing answer IDs');
    routingQuestions[profile] = { title: text(question.title, 'Routing section title', 190), prompt: text(question.prompt, 'Routing prompt', 1000), options };
  }
  const vehicle = value.careerVehicle; assert(record(vehicle) && typeof vehicle.enabled === 'boolean', 400, 'Configure the career-launch question.');
  const vehicleOptions = list(vehicle.options, 'Career-launch answers', 20).map(option => {
    assert(record(option), 400, 'Invalid career-launch answer.');
    return { id: key(option.id, 'career-launch answer'), label: text(option.label, 'Career-launch answer', 500),
      note: text(option.note, 'Career preference note', 1000, true), preferredSchoolIds: ids(option.preferredSchoolIds, 'Preferred schools') };
  });
  assert(!vehicle.enabled || vehicleOptions.length >= 2, 400, 'An enabled career-launch question needs at least two answers.'); unique(vehicleOptions.map(o => o.id), 'Career-launch answer IDs');
  const careerVehicle = { enabled: vehicle.enabled, title: text(vehicle.title, 'Career-launch title', 190), prompt: text(vehicle.prompt, 'Career-launch prompt', 1000), options: vehicleOptions };
  const policy = value.policy; assert(record(policy) && ['once', 'unlimited'].includes(policy.attempts) && ['ask', 'priority'].includes(policy.tieHandling), 400, 'Choose valid attempt and tie policies.');
  assert(Array.isArray(policy.tiePriority) && policy.tiePriority.length === 4 && policy.tiePriority.every(p => Object.hasOwn(profiles, p)), 400, 'Provide all four profiles in tie-priority order.'); unique(policy.tiePriority, 'Tie priority');
  const matching = value.matching; assert(record(matching), 400, 'Provide matching rules.');
  assert(Array.isArray(matching.degreeLevels) && matching.degreeLevels.length > 0 && matching.degreeLevels.every(v => ['Bachelor', 'Associate', 'Diploma', 'Certificate', 'Postgraduate'].includes(v)), 400, 'Choose supported degree levels.'); unique(matching.degreeLevels, 'Degree levels');
  assert(Array.isArray(matching.schoolPriority) && matching.schoolPriority.length === 4 && matching.schoolPriority.every(v => ['career', 'distance', 'tuition', 'name'].includes(v)), 400, 'Order all four school priorities.'); unique(matching.schoolPriority, 'School priorities');
  const display = value.display; assert(record(display) && Number.isInteger(display.programPreviewCount) && display.programPreviewCount >= 1 && display.programPreviewCount <= 50, 400, 'Program preview count must be 1–50.');
  for (const flag of ['showVoteBreakdown', 'showConstraints', 'showClusterDirectory']) assert(typeof display[flag] === 'boolean', 400, 'Result visibility settings must be booleans.');
  const caps = (values, label, maximum) => unique(list(values, label, 20).map(v => { assert(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= maximum, 400, `${label} must contain supported nonnegative amounts.`); return v; }), label).sort((a, b) => a - b);
  assert(record(value.copy), 400, 'Provide assessment text.');
  const copy = Object.fromEntries(Object.keys(assessmentTemplate.copy).map(field => [field, text(value.copy[field], field, 3000, !/Button$|Title$/.test(field))]));
  return { schemaVersion: 2, profiles, sections, clusters, routingQuestions, careerVehicle,
    policy: { attempts: policy.attempts, tieHandling: policy.tieHandling, tiePriority: policy.tiePriority },
    matching: { degreeLevels: matching.degreeLevels, schoolPriority: matching.schoolPriority },
    display: { programPreviewCount: display.programPreviewCount, showVoteBreakdown: display.showVoteBreakdown,
      showConstraints: display.showConstraints, showClusterDirectory: display.showClusterDirectory,
      tuitionChoices: caps(display.tuitionChoices, 'Tuition choices', 1000000), distanceChoices: caps(display.distanceChoices, 'Distance choices', 1000) }, copy };
}

export function programMatchesCluster(program, cluster) {
  const id = program.program_id ?? program.id;
  if (cluster.excludeProgramIds.includes(id)) return false;
  if (cluster.includeProgramIds.includes(id)) return true;
  const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
  const name = ` ${normalize(program.program_name ?? program.name)} `;
  const matches = keyword => name.includes(` ${normalize(keyword)} `);
  return cluster.includeKeywords.some(matches) && !cluster.excludeKeywords.some(matches);
}

export function assessmentDisplay(settings) {
  return { schemaVersion: settings.schemaVersion, profiles: settings.profiles, sections: settings.sections, policy: settings.policy, display: settings.display, copy: settings.copy,
    clusters: settings.clusters.map(({ id, name, description, programExamples }) => ({ id, name, description, programExamples })) };
}
