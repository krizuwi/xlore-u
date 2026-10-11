import { readFileSync } from 'node:fs';
import { assert } from '../utils/http-error.js';
import { addSchoolDistances } from './proximity.js';

// Independent, user-approved engineering policy. Never reads the unapproved
// eight-tag draft or the old technology-only answer weights.
const core = JSON.parse(readFileSync(new URL('../../database/assessment-macro-routing-v1.json', import.meta.url), 'utf8'));
export const routingVersion = core.version;
export const macroProfiles = core.profiles;
export const routingBranches = {
  A: [
    { id: 'computing', label: 'Writing software and working with computer systems', cluster: 'Technology & Computing' },
    { id: 'engineering', label: 'Designing buildings, machines or physical systems', cluster: 'Engineering & Built Environment' },
    { id: 'science', label: 'Investigating nature, mathematics or scientific problems', cluster: 'Science & Quantitative Studies' },
    { id: 'maritime', label: 'Navigating ships or working with marine systems', cluster: 'Maritime Studies' }
  ],
  B: [
    { id: 'design', label: 'Creating visual designs, digital art or interiors', cluster: 'Arts & Design' },
    { id: 'media', label: 'Writing, storytelling, broadcasting or communication', cluster: 'Communication & Media' },
    { id: 'performance', label: 'Making music, performing or producing artistic work', cluster: 'Music & Performing Arts' }
  ],
  C: [
    { id: 'health', label: 'Helping people through healthcare and health sciences', cluster: 'Health & Life Sciences' },
    { id: 'education', label: 'Teaching and supporting learners', cluster: 'Education' },
    { id: 'social', label: 'Understanding people, serving communities or public service', cluster: 'Social Sciences & Public Service' }
  ],
  D: [
    { id: 'business', label: 'Running businesses, managing finances or leading operations', cluster: 'Business & Management' },
    { id: 'hospitality', label: 'Hospitality, tourism, food service or travel operations', cluster: 'Hospitality & Tourism' },
    { id: 'trades', label: 'Hands-on technical skills, fabrication or skilled trades', cluster: 'Applied Technology & Skilled Trades' },
    { id: 'maritime', label: 'Operating ships or working with marine systems', cluster: 'Maritime Studies' }
  ]
};

export function auditRoutingBank(questions) {
  const available = Array.isArray(questions) && questions.length === core.questions.length &&
    core.questions.every(expected => {
      const actual = questions.find(question => question.id === expected.id);
      return actual?.prompt === expected.prompt && Array.isArray(actual.options) && actual.options.length === expected.options.length &&
        expected.options.every(option => actual.options.some(candidate => candidate.id === option.id && candidate.label === option.label));
    });
  return { available, recognized: Array.isArray(questions) && questions.some(question => core.questions.some(expected => expected.id === question.id)), version: routingVersion, validationStatus: core.status,
    message: available ? null : 'The core questionnaire changed. Its macro-profile routing must be reviewed before this assessment can continue.' };
}

export function buildRoutingPlan(answers, questions) {
  const audit = auditRoutingBank(questions);
  assert(audit.available, 503, audit.message);
  assert(Array.isArray(answers) && answers.length === questions.length &&
    answers.every(answer => answer && typeof answer.questionId === 'string' && typeof answer.optionId === 'string') &&
    new Set(answers.map(answer => answer.questionId)).size === questions.length, 400, 'Choose one valid answer for every core question.');
  const selected = new Map(answers.map(answer => [answer.questionId, answer.optionId]));
  const votes = { A: 0, B: 0, C: 0, D: 0 };
  const constraints = {};
  const normalizedAnswers = [];
  for (const question of core.questions) {
    const option = question.options.find(option => option.id === selected.get(question.id));
    assert(option, 400, 'A core question has an invalid answer.');
    if (question.role === 'macro-vote') votes[option.macro] += 1;
    else constraints[question.number] = { questionNumber: question.number, optionIndex: question.options.indexOf(option), label: option.label };
    normalizedAnswers.push({ questionId: question.id, optionId: option.id, macroVote: option.macro, role: question.role });
  }
  const highest = Math.max(...Object.values(votes));
  const leadingProfiles = Object.keys(votes).filter(profile => votes[profile] === highest);
  return { version: routingVersion, votes, leadingProfiles,
    primaryProfile: leadingProfiles.length === 1 ? leadingProfiles[0] : null,
    profiles: macroProfiles, branches: Object.fromEntries(leadingProfiles.map(profile => [profile, routingBranches[profile]])),
    followUpCount: leadingProfiles.length === 1 ? 1 : 2,
    constraints, answers: normalizedAnswers,
    interpretation: 'Equal-vote preference routing, not aptitude, diagnosis or a probability of success. Follow-up answers add no points.' };
}

function optionalLimit(value, maximum, label) {
  if (value === null || value === undefined || value === '') return null;
  assert((typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' &&
    Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= maximum,
  400, `${label} must be a non-negative number within the supported range.`);
  return Number(value);
}

export function completeRouting(answers, questions, selection, limits = {}) {
  const plan = buildRoutingPlan(answers, questions);
  assert(selection && typeof selection === 'object' && !Array.isArray(selection), 400, 'Complete your targeted follow-up before viewing results.');
  const profile = selection.profile ?? plan.primaryProfile;
  assert(plan.leadingProfiles.includes(profile), 400, 'Choose one of your leading macro-profiles.');
  const branch = routingBranches[profile].find(branch => branch.id === selection.field);
  assert(branch, 400, 'Choose a valid field for your macro-profile.');
  assert(limits && typeof limits === 'object' && !Array.isArray(limits), 400, 'Invalid school limits.');
  return { plan, routing: { version: routingVersion, validationStatus: core.status,
    macroProfile: { id: profile, name: macroProfiles[profile] }, votes: plan.votes,
    leadingProfiles: plan.leadingProfiles, coreVoteCount: 15, field: branch.id,
    fieldLabel: branch.label, umbrellaCluster: branch.cluster, followUpCount: plan.followUpCount,
    constraintAnswers: plan.constraints,
    limits: { maxTuition: optionalLimit(limits.maxTuition, 1000000, 'Maximum tuition'),
      maxDistance: optionalLimit(limits.maxDistance, 1000, 'Maximum distance') },
    interpretation: plan.interpretation } };
}

export function programBelongsToField(program, field) {
  const name = program.program_name ?? program.name ?? '';
  if (/^(?:Bachelor of (?:Secondary|Elementary|Early Childhood|Special Needs|Technical Vocational|Physical) Education|BS Physical Education|BSEd|BEEd)|Teacher Education/i.test(name)) return field === 'education';
  switch (field) {
    case 'computing': return !/Accounting|Business Administration/i.test(name) && /Computer Science|Information Technology|Information Systems?|Software Engineering|Cybersecurity|Data Science/i.test(name);
    case 'engineering': return /Engineering|Architecture|Environmental Planning/i.test(name) && !/Software Engineering|Marine|Maritime|Data Science/i.test(name);
    case 'science': return /\b(Biology|Chemistry|Physics|Mathematics|Statistics|Astronomy|Applied Mathematics)\b/i.test(name);
    case 'maritime': return /Marine Transportation|Marine Engineering|Nautical|Maritime/i.test(name);
    case 'design': return /Multimedia Arts|Fine Arts|Visual Design|Interior Design|Industrial Design|Animation|Fashion|Graphic Design/i.test(name) && !/Information Technology/i.test(name);
    case 'media': return /Communication|Journalism|Broadcasting|English|Film/i.test(name) && !/Engineering/i.test(name);
    case 'performance': return /Music|Performing Arts|Theat(?:er|re)|Dance/i.test(name);
    case 'health': return /Nursing|Pharmacy|Medical Technology|Physical Therapy|Radiologic|Nutrition|Midwifery|Occupational Therapy|Public Health/i.test(name);
    case 'education': return /Education|Teacher/i.test(name);
    case 'social': return /Psychology|Social Work|Sociology|Political Science|Public Administration|Criminology|History|Philosophy/i.test(name);
    case 'business': return /Business Administration|Accountancy|Accounting|Management Accounting|Entrepreneurship|Economics|Office Administration|Real Estate Management|Customs Administration|Internal Auditing/i.test(name);
    case 'hospitality': return /Hospitality|Tourism|Hotel|Restaurant|Culinary/i.test(name);
    case 'trades': return /Automotive|Welding|Fabrication|Industrial Technology|Electrical Technology|Electronics Technology|Civil Technology|HVAC|Refrigeration|Mechanical Technology|Garments|Drafting Technology|Aircraft Maintenance|Avionics/i.test(name);
    default: return false;
  }
}

export function selectRoutedPrograms(programs, routing) {
  // Every eligible named-field offering remains available for school matching;
  // do not truncate campuses by picking only six arbitrary specialized awards.
  return programs.filter(program => program.is_active !== false &&
    ['Bachelor', 'Associate', 'Diploma', 'Certificate'].includes(program.degree_level) && programBelongsToField(program, routing.field))
    .sort((a, b) => Number(/major in|specializ/i.test(a.program_name)) - Number(/major in|specializ/i.test(b.program_name)) ||
      a.program_name.localeCompare(b.program_name) || a.program_id.localeCompare(b.program_id))
    .map(program => ({ ...program, matchScore: 0,
      matchDetails: { status: 'routed', field: routing.field, umbrellaCluster: routing.umbrellaCluster,
        explanation: 'Published program title belongs to the field selected in the unscored follow-up. Not a percentage match.' } }));
}

export function matchRoutedSchools(schools, address, routing, { enforceLocation = true } = {}) {
  const { schools: enriched, locationBasis } = addSchoolDistances(schools, address);
  assert(!enforceLocation || routing.limits.maxDistance === null || locationBasis, 400,
    'Your address needs a recognizable Metro Manila city to apply a distance limit. Update your profile or remove the kilometre limit.');
  const eligible = enriched.flatMap(school => {
    // Filter each actual offering BEFORE aggregation, so an inexpensive unrelated
    // degree cannot make an expensive selected-field program appear affordable.
    const offerings = (school.offerings ?? []).filter(offering => routing.limits.maxTuition === null ||
      (offering.tuition !== null && offering.tuition !== undefined && Number.isFinite(Number(offering.tuition)) && Number(offering.tuition) <= routing.limits.maxTuition));
    if (!offerings.length || (routing.limits.maxDistance !== null &&
      (school.distanceKm === null || school.distanceKm > routing.limits.maxDistance))) return [];
    const fees = offerings.map(item => item.tuition).filter(value => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number);
    const { offerings: _offerings, ...publicSchool } = school;
    return [{ ...publicSchool, matchScore: null, matchLabel: 'Offers your selected field',
      minimumTuition: fees.length ? Math.min(...fees) : null,
      matchedPrograms: [...new Set(offerings.map(item => item.program))] }];
  });
  const distanceImportant = routing.constraintAnswers[17].optionIndex >= 2;
  const costImportant = routing.constraintAnswers[16].optionIndex >= 2;
  const compareKnown = (left, right) => (left ?? Infinity) - (right ?? Infinity);
  eligible.sort((a, b) => (distanceImportant ? compareKnown(a.distanceKm, b.distanceKm) : 0) ||
    (costImportant ? compareKnown(a.minimumTuition, b.minimumTuition) : 0) || a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)));
  return { schools: eligible, locationBasis,
    schoolMatchSummary: { consideredSchools: schools.length, eligibleSchools: eligible.length,
      excludedSchools: schools.length - eligible.length, limits: routing.limits,
      travelTimePreference: routing.constraintAnswers[18].label,
      notice: 'Tuition is an estimate per semester. Unknown fees are excluded when a budget is set. Distance is an approximate straight-line distance, not travel time. Commute times, financial assistance and facilities still need confirmation with each school.' } };
}
