export const accountLimits = { name: 20, address: 50, email: 40 };

export function validateProfileDetails(form) {
  for (const [field, label] of [["firstName", "First name"], ["middleName", "Middle name"], ["lastName", "Last name"]]) {
    if (String(form[field] ?? "").length > accountLimits.name) throw new Error(`${label} must be at most 20 characters.`);
  }
  if (String(form.address ?? "").length > accountLimits.address) throw new Error("Address must be at most 50 characters.");
}

export function validateRegistration(form) {
  validateProfileDetails(form);
  if (String(form.email ?? "").length > accountLimits.email) throw new Error("Email address must be at most 40 characters.");
  if (!form.confirmPassword || form.password !== form.confirmPassword) throw new Error("The passwords do not match. Re-enter your password.");
}
