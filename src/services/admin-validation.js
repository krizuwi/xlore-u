import crypto from "node:crypto";
import { assert } from "../utils/http-error.js";
export const SCORE_TAGS = ["technology", "analytical", "science", "health", "business", "creative", "communication", "social"];
export function text(value, label, max, required = true) {
  const result = String(value ?? "").trim();
  assert((!required || result.length > 0) && result.length <= max, 400, `${label} must be ${required ? "1" : "0"}-${max} characters.`);
  return result;
}
export function number(value, label, min, max, nullable = false) {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  assert(value !== "" && value !== null && value !== undefined, 400, `${label} is required.`);
  const result = Number(value);
  assert(Number.isFinite(result) && result >= min && result <= max, 400, `${label} must be between ${min} and ${max}.`);
  return result;
}
export function id(value) {
  assert(typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), 400, "Invalid record ID.");
  return value;
}
export function url(value) {
  const result = text(value, "Website", 2000, false);
  if (!result) return null;
  let parsed;
  try { parsed = new URL(result); } catch { assert(false, 400, "Enter a valid website URL."); }
  assert(["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password, 400, "Website must use HTTP or HTTPS.");
  return result;
}
export function validateSchool(body) {
  const type = text(body.type, "Type", 20), status = body.status ?? "Active";
  assert(["Public", "Private"].includes(type), 400, "Choose Public or Private.");
  assert(["Active", "Inactive"].includes(status), 400, "Invalid school status.");
  return { name: text(body.name, "School name", 190), type, status,
    city: text(body.city, "City", 100), address: text(body.address, "Address", 255),
    latitude: number(body.latitude, "Latitude", -90, 90), longitude: number(body.longitude, "Longitude", -180, 180),
    website: url(body.website), tuitionRange: text(body.tuitionRange, "Tuition range", 80, false) || "Not provided",
    accreditation: text(body.accreditation, "Accreditation", 255, false) || "Not provided",
    scholarshipInfo: text(body.scholarshipInfo, "Scholarship information", 5000, false),
    description: text(body.description, "Description", 5000, false), googleRating: number(body.googleRating, "Rating", 0, 5, true) };
}
export function validateProgram(body) {
  assert(Array.isArray(body.schools) && body.schools.length <= 100, 400, "Choose the schools offering this program.");
  const schools = body.schools.map(s => {
    assert(s && typeof s === "object" && !Array.isArray(s), 400, "Each school offering must be a record.");
    return { id: id(s.id), tuition: number(s.tuition, "Tuition per semester", 0, 99999999, true) };
  });
  assert(new Set(schools.map(s => s.id)).size === schools.length, 400, "A school cannot be selected twice.");
  const list = (value, label) => {
    assert(Array.isArray(value) && value.length <= 30, 400, `${label} must be a list of up to 30 items.`);
    return [...new Set(value.map(item => text(item, label, 120)))];
  };
  assert(["Active", "Inactive"].includes(body.status ?? "Active"), 400, "Invalid program status.");
  return { name: text(body.name, "Program name", 190), description: text(body.description, "Description", 5000),
    category: text(body.category, "Category", 100), degreeLevel: text(body.degreeLevel, "Degree level", 60),
    duration: text(body.duration, "Duration", 80, false), requirements: text(body.requirements, "Requirements", 5000, false),
    careerPaths: list(body.careerPaths ?? [], "Career paths"), interestTags: list(body.interestTags ?? [], "Interest tags"),
    status: body.status ?? "Active", schools };
}
export function validateQuestion(body) {
  assert(["Active", "Draft"].includes(body.status), 400, "Choose Active or Draft.");
  assert(Array.isArray(body.options) && body.options.length >= 2 && body.options.length <= 6, 400, "Provide 2-6 answer options.");
  const options = body.options.map(option => {
    assert(option && typeof option === "object" && !Array.isArray(option), 400, "Each answer must be a record.");
    const scores = option.scores;
    assert(scores && typeof scores === "object" && !Array.isArray(scores), 400, "Each answer needs interest weights.");
    const entries = Object.entries(scores);
    assert(entries.length > 0 && entries.every(([tag, weight]) => SCORE_TAGS.includes(tag) && Number.isInteger(weight) && weight >= 0 && weight <= 5), 400, "Use valid interest weights from 0 to 5.");
    assert(entries.some(([, weight]) => weight > 0), 400, "Give each answer at least one positive interest weight.");
    return { id: text(option.id || crypto.randomUUID(), "Option ID", 80), label: text(option.label, "Answer", 180), scores };
  });
  assert(new Set(options.map(o => o.id)).size === options.length, 400, "Answer IDs must be unique.");
  assert(new Set(options.map(o => o.label.toLowerCase())).size === options.length, 400, "Each answer must be different.");
  return { prompt: text(body.prompt, "Question", 350), status: body.status, options };
}
