import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { compareMigrationState, localVersions, versionFromFilename } from "./migration_state.mjs";

await import("./surface_contract.js");
const { resolveSurface } = globalThis.CVF_MATRIX_SURFACES;

const M28 = resolveSurface("m28");
const M29 = resolveSurface("m29");
const M30 = resolveSurface("m30");

// The real repository ledger, so these tests fail if a migration is added or
// renamed without the surface censuses being updated to match.
const REPO_VERSIONS = localVersions(
  readdirSync(new URL("../../supabase/migrations", import.meta.url)),
);

const ok = (surface, remote) => compareMigrationState({ local: REPO_VERSIONS, remote, surface });

/* ---------------------------------------------------------------------------
 * The repository's real state. If these drift, the surface table is stale.
 * ------------------------------------------------------------------------- */
test("the repository has 30 migrations and Migrations 28–30 remain the final ordered trio", () => {
  assert.equal(REPO_VERSIONS.length, 30);
  assert.equal(REPO_VERSIONS[27], "20260723154411"); // Migration 28, Sequence 5A
  assert.equal(REPO_VERSIONS[28], "20260726120000"); // Migration 29, venues
  assert.equal(REPO_VERSIONS[29], "20260729182047"); // Migration 30, practice mode
});

test("version extraction ignores anything that is not a migration", () => {
  assert.equal(versionFromFilename("20260723154411_sequence_5a.sql"), "20260723154411");
  assert.equal(versionFromFilename("README.md"), null);
  assert.deepEqual(localVersions(["README.md", ".keep", "20260101000000_a.sql"]), ["20260101000000"]);
});

/* ---------------------------------------------------------------------------
 * Happy paths.
 * ------------------------------------------------------------------------- */
test("m28 accepts a hosted ledger of exactly the first 28 migrations", () => {
  const result = ok(M28, REPO_VERSIONS.slice(0, 28));
  assert.ok(result.ok, result.problems.join(" | "));
  assert.equal(result.observed.count, 28);
  assert.equal(result.observed.latest, "20260723154411");
});

// m29 is no longer "everything local" now that Migration 30 exists unhosted.
// It is exactly the first 29, and the 30th must be absent — which is the real
// hosted state until the practice-mode push is separately approved.
test("m29 accepts a hosted ledger of exactly the first 29 migrations", () => {
  const result = ok(M29, REPO_VERSIONS.slice(0, 29));
  assert.ok(result.ok, result.problems.join(" | "));
  assert.equal(result.observed.count, 29);
  assert.equal(result.observed.latest, "20260726120000");
});

test("m30 accepts a hosted ledger of all 30", () => {
  const result = ok(M30, REPO_VERSIONS);
  assert.ok(result.ok, result.problems.join(" | "));
  assert.equal(result.observed.count, 30);
  assert.equal(result.observed.latest, "20260729182047");
});

test("UNEXPECTED LATER — m29 rejects a ledger that already has Migration 30", () => {
  // The failure this exists to catch: practice mode gets pushed, but the matrix
  // is still invoked at m29, so it would probe 26 RPCs against a 33-RPC backend
  // and report a clean pass over seven never-tested admin surfaces.
  const result = ok(M29, REPO_VERSIONS);
  assert.equal(result.ok, false);
  const text = result.problems.join(" ");
  assert.match(text, /beyond surface m29: 20260729182047/);
  assert.match(text, /understate the live schema/);
});

test("remote ordering does not matter — the comparison sorts", () => {
  const shuffled = [...REPO_VERSIONS.slice(0, 28)].reverse();
  assert.ok(ok(M28, shuffled).ok);
});

/* ---------------------------------------------------------------------------
 * The four required failure modes.
 * ------------------------------------------------------------------------- */
test("WRONG COUNT — m28 rejects a hosted ledger still at 27", () => {
  // The exact scenario this assertion exists for: m28 and the Migration 27
  // baseline are census-identical, so nothing else would have caught it.
  const result = ok(M28, REPO_VERSIONS.slice(0, 27));
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /27 migrations; surface m28 requires exactly 28/);
  assert.equal(result.observed.count, 27);
});

test("WRONG LATEST — m28 rejects a ledger whose newest migration is not Sequence 5A", () => {
  // 28 applied, but the newest is venues rather than Sequence 5A.
  const swapped = [...REPO_VERSIONS.slice(0, 27), "20260726120000"];
  const result = ok(M28, swapped);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /latest migration is 20260726120000.*requires 20260723154411/s);
});

test("MISSING EARLIER — a correct count cannot hide a gap", () => {
  // 28 rows, but migration 5 was never applied and venues was. A count-only
  // check passes this; the sequence comparison does not.
  const gapped = [
    ...REPO_VERSIONS.slice(0, 4),
    ...REPO_VERSIONS.slice(5, 28),
    "20260726120000",
  ];
  assert.equal(gapped.length, 28);
  const result = ok(M28, gapped);
  assert.equal(result.ok, false);
  const text = result.problems.join(" ");
  assert.match(text, /missing required migration/i);
  assert.match(text, new RegExp(REPO_VERSIONS[4]));
});

test("UNEXPECTED LATER — m28 rejects a ledger that already has Migration 29", () => {
  const result = ok(M28, REPO_VERSIONS);
  assert.equal(result.ok, false);
  const text = result.problems.join(" ");
  assert.match(text, /beyond surface m28: 20260726120000/);
  assert.match(text, /understate the live schema/);
});

test("m28 explicitly refuses to run while the venues migration is hosted", () => {
  // Stated as its own case because it is the one that would silently produce
  // acceptance evidence for a schema that no longer matches the fixture shape.
  const result = ok(M28, [...REPO_VERSIONS.slice(0, 28), "20260726120000"]);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("20260726120000")));
});

test("a migration hosted but absent locally is reported distinctly", () => {
  const result = ok(M28, [...REPO_VERSIONS.slice(0, 27), "29990101000000"]);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /not present locally: 29990101000000/);
});

test("an empty hosted ledger fails rather than passing vacuously", () => {
  const result = ok(M28, []);
  assert.equal(result.ok, false);
  assert.equal(result.observed.latest, null);
});

/* ---------------------------------------------------------------------------
 * The runner actually enforces it, at the right moment.
 * ------------------------------------------------------------------------- */
const serverSource = readFileSync(new URL("./server.mjs", import.meta.url), "utf8");

test("the runner asserts hosted state BEFORE baseline capture and fixture creation", () => {
  const assertAt = serverSource.indexOf("migrationState = assertHostedMigrationState();");
  const baselineAt = serverSource.indexOf('baseline = getCounts("baseline");');
  const seedAt = serverSource.indexOf("seedFixture();\n", baselineAt);
  assert.ok(assertAt > 0, "runner never calls the assertion");
  assert.ok(assertAt < baselineAt, "assertion must precede baseline capture");
  assert.ok(baselineAt < seedAt, "baseline must precede seeding");
});

test("the runner reads the real hosted ledger rather than trusting the flag", () => {
  assert.match(serverSource, /supabase_migrations\.schema_migrations/);
  assert.match(serverSource, /function assertHostedMigrationState\(\)/);
  // Fail closed: the assertion throws, it does not warn.
  assert.match(serverSource, /throw new Error\(formatMigrationStateFailure\(result, surface\)\)/);
});

test("evidence records the OBSERVED ledger, not only the declared surface", () => {
  assert.match(serverSource, /Observed hosted ledger/);
  assert.match(serverSource, /migrationState\.observed\.count/);
  assert.match(serverSource, /migrationState\.observed\.latest/);
});
