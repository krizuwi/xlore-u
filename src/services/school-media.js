import { assert } from "../utils/http-error.js";

function shortText(value, label, max = 200) {
  assert(value == null || typeof value === "string", 400, `${label} must be text.`);
  const result = (value ?? "").trim();
  assert(result.length <= max, 400, `${label} must be at most ${max} characters.`);
  return result;
}

export function mediaUrl(value, label, required = false) {
  const result = shortText(value, label, 2000);
  if (!result && !required) return "";
  // Only the app's own opaque, server-issued image paths may be relative.
  if (/^\/api\/school-media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result) && /^(Logo URL|Photo URL)$/.test(label)) return result;
  let parsed;
  try { parsed = new URL(result); } catch { assert(false, 400, `${label} must be a complete HTTPS URL.`); }
  assert(parsed.protocol === "https:" && !parsed.username && !parsed.password, 400, `${label} must use HTTPS without embedded credentials.`);
  return result;
}

export function validateSchoolMedia(body) {
  assert(body && typeof body === "object" && !Array.isArray(body), 400, "Provide school media details.");
  assert(Array.isArray(body.campusPhotos) && body.campusPhotos.length <= 10, 400, "Provide up to 10 campus photos.");
  const credit = body.logoCredit ?? {};
  assert(credit && typeof credit === "object" && !Array.isArray(credit), 400, "Provide logo credit details.");
  const campusPhotos = body.campusPhotos.map(photo => {
    assert(photo && typeof photo === "object" && !Array.isArray(photo), 400, "Each photo must be a record.");
    return {
      url: mediaUrl(photo.url, "Photo URL", true),
      caption: shortText(photo.caption, "Photo caption"),
      credit: shortText(photo.credit, "Photo credit"),
      sourceUrl: mediaUrl(photo.sourceUrl, "Photo source URL"),
      license: shortText(photo.license, "Photo license", 100),
      licenseUrl: mediaUrl(photo.licenseUrl, "License URL")
    };
  });
  assert(new Set(campusPhotos.map(photo => photo.url)).size === campusPhotos.length, 400, "Remove duplicate photo URLs.");
  return {
    logoUrl: mediaUrl(body.logoUrl, "Logo URL") || null,
    logoCredit: {
      credit: shortText(credit.credit, "Logo credit"),
      sourceUrl: mediaUrl(credit.sourceUrl, "Logo source URL"),
      license: shortText(credit.license, "Logo license", 100),
      licenseUrl: mediaUrl(credit.licenseUrl, "Logo license URL")
    },
    campusPhotos
  };
}
