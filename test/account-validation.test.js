import test from "node:test";
import assert from "node:assert/strict";
import { accountLimits, validateProfileDetails, validateRegistration } from "../src/lib/account-validation.js";

const form = { firstName: "a".repeat(20), middleName: "b".repeat(20), lastName: "c".repeat(20), address: "d".repeat(50), email: "e".repeat(28) + "@example.com", password: "test-password", confirmPassword: "test-password" };
test("the exact requested limits are accepted", () => {
  assert.deepEqual(accountLimits, { name: 20, address: 50, email: 40 });
  assert.doesNotThrow(() => validateRegistration(form));
});
test("all three name fields reject values longer than 20", () => {
  for (const field of ["firstName", "middleName", "lastName"]) assert.throws(() => validateProfileDetails({ ...form, [field]: "a".repeat(21) }), /20 characters/);
});
test("address and registration email reject values above their limits", () => {
  assert.throws(() => validateProfileDetails({ ...form, address: "a".repeat(51) }), /50 characters/);
  assert.throws(() => validateRegistration({ ...form, email: "e".repeat(29) + "@example.com" }), /40 characters/);
});
test("registration requires password confirmation and an exact match", () => {
  for (const confirmPassword of ["", undefined, "different-password"]) assert.throws(() => validateRegistration({ ...form, confirmPassword }), /passwords do not match/);
});
