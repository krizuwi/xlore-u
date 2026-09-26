import test from "node:test";
import assert from "node:assert/strict";
import { splitLegacyName, userNameParts, validateNameParts } from "../src/utils/user-name.js";

test("separate name fields form a combined display name", () => {
  assert.deepEqual(validateNameParts({
    firstName: "  Ana  Maria ",
    middleName: "  Cruz ",
    lastName: " De la Rosa "
  }), {
    firstName: "Ana Maria",
    middleName: "Cruz",
    lastName: "De la Rosa",
    fullName: "Ana Maria Cruz De la Rosa"
  });
});

test("middle name may be blank, but first and last names are required", () => {
  assert.equal(validateNameParts({ firstName: "Ana", lastName: "Santos" }).fullName, "Ana Santos");
  assert.throws(() => validateNameParts({ firstName: "Ana", lastName: " " }), /Last name is required/);
});

test("existing single-field names remain editable", () => {
  const oldUser = { full_name: "Ana Maria Santos", first_name: null, middle_name: null, last_name: null };
  assert.deepEqual(userNameParts(oldUser), splitLegacyName(oldUser.full_name));
  assert.equal(validateNameParts({ address: "New address" }, oldUser).fullName, "Ana Maria Santos");
});
