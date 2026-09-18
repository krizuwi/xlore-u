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

const directionByTag = {
  technology: "Technology and Computing",
  analytical: "Data and Analytical Fields",
  science: "Science and Research",
  health: "Health and Life Sciences",
  business: "Business and Management",
  creative: "Arts, Design, and Media",
  communication: "Communication and Humanities",
  social: "Education and Social Service"
};

export function scoreAssessment(answers) {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  const scores = {};
  const normalizedAnswers = [];

  for (const question of assessmentQuestions) {
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

  const rankedTags = Object.entries(scores)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag]) => tag);

  return {
    primaryDirection: directionByTag[rankedTags[0]],
    rankedTags,
    scores,
    answers: normalizedAnswers
  };
}

export function calculateProgramMatch(programTags, rankedTags) {
  const normalized = new Set(programTags.map((tag) => tag.toLowerCase()));
  let score = 55;
  rankedTags.slice(0, 5).forEach((tag, index) => {
    if (normalized.has(tag)) score += [22, 13, 7, 4, 2][index];
  });
  return Math.min(score, 99);
}
