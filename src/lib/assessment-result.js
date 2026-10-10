// Historical duplicate attempts may exist, but the dashboard shows one completed result.
export function selectAssessmentResult(assessments = []) {
  return assessments.filter(assessment => assessment.completedAt && Number.isFinite(Date.parse(assessment.completedAt)))
    .reduce((selected, assessment) => !selected || Date.parse(assessment.completedAt) > Date.parse(selected.completedAt) ? assessment : selected, null);
}
