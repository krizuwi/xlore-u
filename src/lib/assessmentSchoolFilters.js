function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compareOptionalNumbers(left, right, descending = false) {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return descending ? right - left : left - right;
}

export function filterAssessmentSchools(schools, { maxTuition = "", maxDistance = "", schoolType = "", sort = "original" }) {
  const tuitionLimit = numberOrNull(maxTuition);
  const distanceLimit = numberOrNull(maxDistance);
  const visible = schools.filter((school) => {
    const tuition = numberOrNull(school.minimumTuition);
    const distance = numberOrNull(school.distanceKm);
    return (!schoolType || school.schoolType === schoolType)
      && (tuitionLimit === null || (tuition !== null && tuition <= tuitionLimit))
      && (distanceLimit === null || (distance !== null && distance <= distanceLimit));
  });

  if (sort === "original") return visible;

  return visible.sort((left, right) => {
    let order = 0;
    if (sort === "nearest") {
      order = compareOptionalNumbers(numberOrNull(left.distanceKm), numberOrNull(right.distanceKm));
    } else if (sort === "tuition_low" || sort === "tuition_high") {
      order = compareOptionalNumbers(
        numberOrNull(left.minimumTuition),
        numberOrNull(right.minimumTuition),
        sort === "tuition_high"
      );
    }
    return order || left.name.localeCompare(right.name);
  });
}
