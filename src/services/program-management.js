const FIELD_ALIASES = {
	programName: ["programName", "program_name", "Program name", "name"],
	university: ["university", "University", "universityName", "university_name", "schoolName", "school_name"],
	category: ["category", "Category", "programCategory", "program_category"],
	duration: ["duration", "Duration", "programDuration", "program_duration"],
	status: ["status", "Status", "programStatus", "program_status"]
};

function normalizedValue(record, aliases) {
	const key = aliases.find((alias) => record[alias] !== undefined);
	const value = key === undefined ? null : record[key];
	if (value === null || value === undefined) return null;
	if (typeof value === "string") return value.trim().replace(/\s+/g, " ") || null;
	return value;
}

function normalizeRecord(record) {
	if (!record || typeof record !== "object" || Array.isArray(record)) {
		throw new TypeError("Each program record must be an object.");
	}

	return Object.fromEntries(
		Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, normalizedValue(record, aliases)])
	);
}

export async function normalizeProgramData(data) {
	if (Array.isArray(data)) return data.map(normalizeRecord);
	return normalizeRecord(data);
}
