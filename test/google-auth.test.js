import test from "node:test";
import assert from "node:assert/strict";
import { classifyGoogleError, googleClient } from "../src/services/google-auth.js";

test("a signing-key network failure is not misreported as a TLS failure", () => {
  assert.equal(classifyGoogleError(new Error("Failed to retrieve verification certificates: request timed out")), "GOOGLE_KEYS_UNAVAILABLE");
});

test("nested certificate validation errors are identified", () => {
  const cause = Object.assign(new Error("TLS connection failed"), { code: "SELF_SIGNED_CERT_IN_CHAIN" });
  assert.equal(classifyGoogleError(new Error("fetch failed", { cause })), "GOOGLE_TLS_TRUST");
});

test("Google transport keeps TLS certificate validation enabled", () => {
  assert.equal(googleClient.transporter.defaults.agent.options.rejectUnauthorized, true);
  assert.ok(googleClient.transporter.defaults.agent.options.ca.length > 0);
});
