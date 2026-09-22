import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("the backend uses PostgreSQL and no longer depends on MySQL", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(packageJson.dependencies.pg);
  assert.equal(packageJson.dependencies.mysql2, undefined);
});

test("ordered database migrations are present", () => {
  const names = fs
    .readdirSync(path.join(root, "database", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(names, [
    "001_initial_schema.sql",
    "002_seed_catalog.sql",
    "003_catalog_updater.sql",
    "004_catalog_source_tuning.sql",
    "005_clean_scraped_program_names.sql",
    "006_add_sti_global_city.sql",
    "007_keep_sti_campus_url.sql",
    "008_keep_verified_school_address.sql",
    "009_auth_recovery_and_google.sql",
    "010_user_address.sql",
    "011_user_school_visits.sql"
  ]);
});

test("user profiles support a private address", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "010_user_address.sql"),
    "utf8"
  );
  assert.match(migration, /ADD COLUMN address varchar\(255\)/);
});

test("school visits are counted per user for dashboard history", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "011_user_school_visits.sql"),
    "utf8"
  );
  const schoolsRoutes = fs.readFileSync(
    path.join(root, "src", "routes", "schools.routes.js"),
    "utf8"
  );
  assert.match(migration, /CREATE TABLE user_school_visits/);
  assert.match(migration, /PRIMARY KEY \(user_id, school_id\)/);
  assert.match(schoolsRoutes, /visit_count = user_school_visits\.visit_count \+ 1/);
});

test("authentication schema supports Google sign-in and password recovery", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "009_auth_recovery_and_google.sql"),
    "utf8"
  );
  assert.match(migration, /google_subject varchar\(255\)/);
  assert.match(migration, /password_reset_code_hash char\(64\)/);
  assert.match(migration, /ALTER COLUMN password_hash DROP NOT NULL/);
});

test("the catalog updater records trusted sources and an audit history", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "migrations", "003_catalog_updater.sql"),
    "utf8"
  );
  assert.match(migration, /CREATE TABLE catalog_sources/);
  assert.match(migration, /CREATE TABLE catalog_update_runs/);
  assert.match(migration, /CREATE TABLE catalog_change_log/);
  assert.match(migration, /allowed_host varchar\(255\) NOT NULL/);
});

test("the PostgreSQL schema protects browser-facing tables with RLS", () => {
  const schema = fs.readFileSync(
    path.join(root, "database", "migrations", "001_initial_schema.sql"),
    "utf8"
  );
  assert.match(schema, /career_paths jsonb NOT NULL/);
  assert.match(schema, /CHECK \(position_index BETWEEN 1 AND 3\)/);
  assert.match(schema, /ALTER TABLE users ENABLE ROW LEVEL SECURITY/);
  assert.match(schema, /ALTER TABLE programs ENABLE ROW LEVEL SECURITY/);
});

test("assessment queries preserve quoted PostgreSQL aliases", () => {
  const routes = fs.readFileSync(
    path.join(root, "src", "routes", "assessments.routes.js"),
    "utf8"
  );
  assert.doesNotMatch(routes, /ORDER BY matchScore/);
  assert.match(routes, /ORDER BY "matchScore" DESC/);
});

test("assessment history includes its nearest suggested school", () => {
  const routes = fs.readFileSync(
    path.join(root, "src", "routes", "assessments.routes.js"),
    "utf8"
  );
  assert.match(routes, /orderSchoolsByAddress/);
  assert.match(routes, /recommendedSchool: nearest/);
  assert.match(routes, /distanceKm: nearest\.distanceKm/);
});
