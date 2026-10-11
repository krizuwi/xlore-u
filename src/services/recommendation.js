export const assessmentQuestions = [
  {
    id: "interests",
    prompt: "Which kind of activity do you enjoy most?",
    options: [
      { id: "technology", label: "Building or exploring technology", scores: { technology: 3, analytical: 1 } },
      { id: "business", label: "Planning, selling, or leading a team", scores: { business: 3, social: 1 } },
      { id: "health", label: "Helping people improve their health", scores: { health: 3, social: 1 } },
      { id: "creative", label: "Designing, writing, or making media", scores: { creative: 3, communication: 1 } }
    ]
  },
  {
    id: "strength",
    prompt: "Which strength best describes you?",
    options: [
      { id: "logic", label: "Logical problem solving", scores: { analytical: 3, technology: 1 } },
      { id: "communication", label: "Speaking and writing clearly", scores: { communication: 3, social: 1 } },
      { id: "empathy", label: "Listening and caring for others", scores: { social: 3, health: 1 } },
      { id: "creativity", label: "Generating original ideas", scores: { creative: 3, communication: 1 } }
    ]
  },
  {
    id: "environment",
    prompt: "What work environment sounds most appealing?",
    options: [
      { id: "lab", label: "A lab or technical workspace", scores: { science: 3, analytical: 1 } },
      { id: "office", label: "A collaborative business office", scores: { business: 3, communication: 1 } },
      { id: "community", label: "A school, clinic, or community", scores: { social: 3, health: 1 } },
      { id: "studio", label: "A creative studio or production space", scores: { creative: 3, technology: 1 } }
    ]
  },
  {
    id: "subject",
    prompt: "Which subject area do you prefer?",
    options: [
      { id: "math", label: "Mathematics or computing", scores: { technology: 2, analytical: 2 } },
      { id: "science", label: "Natural or health sciences", scores: { science: 3, health: 1 } },
      { id: "humanities", label: "Language or social sciences", scores: { communication: 2, social: 2 } },
      { id: "arts", label: "Arts or design", scores: { creative: 3, communication: 1 } }
    ]
  },
  {
    id: "goal",
    prompt: "What outcome matters most in a future career?",
    options: [
      { id: "innovation", label: "Creating useful innovations", scores: { technology: 2, science: 2 } },
      { id: "enterprise", label: "Growing an organization", scores: { business: 3, analytical: 1 } },
      { id: "service", label: "Serving people and communities", scores: { social: 2, health: 2 } },
      { id: "expression", label: "Expressing ideas that influence others", scores: { creative: 2, communication: 2 } }
    ]
  }
];

export const directionByTag = {
  technology: "Technology and Computing",
  analytical: "Data and Analytical Fields",
  science: "Science and Research",
  health: "Health and Life Sciences",
  business: "Business and Management",
  creative: "Arts, Design, and Media",
  communication: "Communication and Humanities",
  social: "Education and Social Service"
};

export const assessmentAlgorithmVersion = "interest-alignment-v2";
const interestTags = Object.keys(directionByTag);

// Analyze the configured key, never infer a key from answer wording or position.
export function auditScoringKey(questions) {
  const bounds = Object.fromEntries(interestTags.map(tag => [tag, { minimum: 0, maximum: 0, informativeItems: 0 }]));
  const constantQuestionIds = [];
  const invalidQuestionIds = [];
  for (const question of questions) {
    const options = question.options;
    if (!Array.isArray(options) || options.length < 2 || options.some(option =>
      !option?.scores || typeof option.scores !== "object" || Array.isArray(option.scores) ||
      Object.entries(option.scores).some(([tag, points]) => !interestTags.includes(tag) ||
        !Number.isInteger(points) || points < 0 || points > 5))) {
      invalidQuestionIds.push(question.id);
      continue;
    }
    let informative = false;
    for (const tag of interestTags) {
      const values = options.map(option => option.scores[tag] ?? 0);
      const minimum = Math.min(...values), maximum = Math.max(...values);
      bounds[tag].minimum += minimum;
      bounds[tag].maximum += maximum;
      if (maximum > minimum) { bounds[tag].informativeItems += 1; informative = true; }
    }
    if (!informative) constantQuestionIds.push(question.id);
  }
  const measuredTags = interestTags.filter(tag => bounds[tag].maximum > bounds[tag].minimum);
  return { usable: questions.length > 0 && !invalidQuestionIds.length && measuredTags.length > 0,
    questionCount: questions.length, informativeQuestionCount: questions.length - constantQuestionIds.length - invalidQuestionIds.length,
    constantQuestionIds, invalidQuestionIds, measuredTags, bounds };
}

export function scoringUnavailableError() {
  const error = new Error("Assessment scoring is awaiting review. Your one-time assessment has not been used. Please contact the administrator.");
  error.status = 503;
  return error;
}

export function scoreAssessment(answers, questions = assessmentQuestions) {
  if (!Array.isArray(answers) || answers.length !== questions.length ||
    answers.some(answer => !answer || typeof answer.questionId !== "string" || typeof answer.optionId !== "string") ||
    new Set(answers.map(answer => answer.questionId)).size !== questions.length) {
    const error = new Error("A valid answer is required for every question exactly once.");
    error.status = 400;
    throw error;
  }
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  const audit = auditScoringKey(questions);
  if (!audit.usable) throw scoringUnavailableError();
  const scores = Object.fromEntries(interestTags.map(tag => [tag, 0]));
  const normalizedAnswers = [];

  for (const question of questions) {
    const optionId = answerMap.get(question.id);
    const option = question.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      const error = new Error(`A valid answer is required for question '${question.id}'.`);
      error.status = 400;
      throw error;
    }
    normalizedAnswers.push({ questionId: question.id, optionId: option.id });
    for (const [tag, value] of Object.entries(option.scores)) {
      scores[tag] = (scores[tag] ?? 0) + value;
    }
  }

  const normalizedScores = Object.fromEntries(audit.measuredTags.map(tag => {
    const { minimum, maximum } = audit.bounds[tag];
    return [tag, (scores[tag] - minimum) / (maximum - minimum)];
  }));
  const rankedTags = Object.entries(normalizedScores).filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag]) => tag);

  const highest = normalizedScores[rankedTags[0]] ?? 0;
  const leadingTags = rankedTags.filter(tag => Math.abs(normalizedScores[tag] - highest) < 1e-10);
  return {
    primaryDirection: leadingTags.length === 1 ? directionByTag[leadingTags[0]] : leadingTags.length ? "Mixed interests" : "Explore your interests with a guidance counselor",
    rankedTags,
    scores,
    metrics: { algorithmVersion: assessmentAlgorithmVersion, normalizedScores, dimensionBounds: audit.bounds,
      measuredTags: audit.measuredTags, leadingTags, informativeQuestionCount: audit.informativeQuestionCount,
      questionCount: questions.length, constantQuestionIds: audit.constantQuestionIds,
      interpretation: "Relative interest alignment, not aptitude, admission eligibility, or a probability of success." },
    answers: normalizedAnswers
  };
}

export function explainProgramMatch(programTags, normalizedScores) {
  if (!Array.isArray(programTags) || !normalizedScores || Array.isArray(normalizedScores)) {
    return { matchScore: 0, status: "unmapped", contributions: [] };
  }
  const tags = [...new Set(programTags.map(tag => String(tag).trim().toLowerCase()))];
  if (!tags.length || tags.some(tag => !interestTags.includes(tag))) {
    return { matchScore: 0, status: "unmapped", contributions: [] };
  }
  if (tags.some(tag => !Number.isFinite(normalizedScores[tag]))) {
    return { matchScore: 0, status: "unmeasured", contributions: [] };
  }
  const contributions = tags.map(tag => ({ tag, alignment: Math.max(0, Math.min(1, normalizedScores[tag])) }));
  const alignment = contributions.reduce((total, item) => total + item.alignment, 0) / tags.length;
  return { matchScore: Math.round(100 * alignment), alignment, status: "scored", contributions };
}

export function calculateProgramMatch(programTags, normalizedScores) {
  return explainProgramMatch(programTags, normalizedScores).matchScore;
}

// Old results remain readable; new results carry their scoring snapshot in JSONB.
export function readScoreBreakdown(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value ?? {};
  return parsed.rawScores && parsed.metrics ? { scores: parsed.rawScores, metrics: parsed.metrics } : { scores: parsed, metrics: null };
}
