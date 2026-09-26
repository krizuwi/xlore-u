import { assert } from "./http-error.js";

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function splitLegacyName(fullName) {
  const words = clean(fullName).split(" ").filter(Boolean);
  return {
    firstName: words[0] ?? "",
    middleName: "",
    lastName: words.slice(1).join(" ")
  };
}

export function userNameParts(user) {
  const legacy = splitLegacyName(user.full_name);
  return {
    firstName: user.first_name ?? legacy.firstName,
    middleName: user.middle_name ?? legacy.middleName,
    lastName: user.last_name ?? legacy.lastName
  };
}

export function validateNameParts(body, existingUser) {
  const legacyInput = body.fullName != null &&
    body.firstName == null && body.middleName == null && body.lastName == null;
  const source = legacyInput ? splitLegacyName(body.fullName) : body;
  const previous = existingUser ? userNameParts(existingUser) : {};
  const firstName = clean(source.firstName ?? previous.firstName);
  const middleName = clean(source.middleName ?? previous.middleName);
  const lastName = clean(source.lastName ?? previous.lastName);
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

  assert(firstName.length >= 1 && firstName.length <= 120, 400, "First name is required and must be at most 120 characters.");
  assert(middleName.length <= 120, 400, "Middle name must be at most 120 characters.");
  assert(lastName.length >= 1 && lastName.length <= 120, 400, "Last name is required and must be at most 120 characters.");
  assert(fullName.length <= 120, 400, "The combined name must be at most 120 characters.");

  return { firstName, middleName, lastName, fullName };
}
