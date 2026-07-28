/* ============================================================================
 * HOSTED MIGRATION STATE ASSERTION
 * ----------------------------------------------------------------------------
 * The surface flag says which schema the operator BELIEVES is hosted. Nothing
 * previously checked that belief, and for this pair of migrations that gap is
 * not theoretical:
 *
 *   hosted at Migration 27  ->  26 tables, 25 RPCs, legacy game shape
 *   hosted at Migration 28  ->  26 tables, 25 RPCs, legacy game shape
 *
 * Migration 28 adds no table and no RPC — it adds a private column and changes
 * three function signatures — so `--surface m28` is census-identical to the
 * Migration 27 baseline. A run against the wrong database would seed cleanly,
 * pass, and emit an evidence file headed "Migration 28" that proved only the
 * previous baseline. That is a mislabelled acceptance artifact, which is worse
 * than a failed run: a failure gets retried, a wrong green gets filed.
 *
 * So the runner compares the real remote migration ledger against the local
 * one and aborts BEFORE baseline capture or fixture creation. A count alone is
 * not enough — it cannot see a missing earlier migration replaced by a later
 * one — so the whole ordered sequence is compared and the latest version is
 * pinned by value.
 *
 * Pure functions, no I/O, so every failure mode is executable in a unit test
 * rather than only reachable by pointing the harness at a wrong database.
 * ========================================================================== */

// Supabase names migrations `<version>_<slug>.sql`; the version is the ledger key.
export function versionFromFilename(filename) {
  const match = /^(\d+)_/.exec(filename);
  return match ? match[1] : null;
}

export function localVersions(filenames) {
  return filenames
    .filter((name) => name.endsWith(".sql"))
    .map(versionFromFilename)
    .filter(Boolean)
    .sort();
}

/**
 * Compare the hosted ledger against what the declared surface requires.
 *
 * @param {string[]} local   every local migration version, ascending
 * @param {string[]} remote  every applied hosted version, any order
 * @param {{key:string,migrations:number}} surface
 * @returns {{ok:boolean, problems:string[], observed:object, expected:object}}
 */
export function compareMigrationState({ local, remote, surface }) {
  const problems = [];
  const localSorted = [...local].sort();
  const remoteSorted = [...remote].sort();

  // What this surface requires hosted: exactly the first N local migrations.
  const expectedVersions = localSorted.slice(0, surface.migrations);
  const expectedLatest = expectedVersions[expectedVersions.length - 1] ?? null;
  // Everything the surface requires to be ABSENT — later migrations exist
  // locally but must not be hosted yet, or the surface is understated.
  const forbiddenVersions = localSorted.slice(surface.migrations);

  if (expectedVersions.length !== surface.migrations) {
    problems.push(
      `Surface ${surface.key} expects ${surface.migrations} migrations but only ${expectedVersions.length} exist locally.`,
    );
  }

  if (remoteSorted.length !== surface.migrations) {
    problems.push(
      `Hosted has ${remoteSorted.length} migrations; surface ${surface.key} requires exactly ${surface.migrations}.`,
    );
  }

  // Ordered sequence equality. Catches a missing earlier migration even when
  // the count coincidentally matches because a later one was applied.
  const missing = expectedVersions.filter((v) => !remoteSorted.includes(v));
  if (missing.length) {
    problems.push(`Hosted is missing required migration(s): ${missing.join(", ")}.`);
  }

  const unexpected = remoteSorted.filter((v) => !expectedVersions.includes(v));
  if (unexpected.length) {
    const forbidden = unexpected.filter((v) => forbiddenVersions.includes(v));
    if (forbidden.length) {
      problems.push(
        `Hosted has migration(s) beyond surface ${surface.key}: ${forbidden.join(", ")}. ` +
        `Running this surface would understate the live schema.`,
      );
    }
    const unknown = unexpected.filter((v) => !forbiddenVersions.includes(v));
    if (unknown.length) {
      problems.push(`Hosted has migration(s) not present locally: ${unknown.join(", ")}.`);
    }
  }

  const observedLatest = remoteSorted[remoteSorted.length - 1] ?? null;
  if (observedLatest !== expectedLatest) {
    problems.push(
      `Hosted latest migration is ${observedLatest ?? "none"}; surface ${surface.key} requires ${expectedLatest ?? "none"}.`,
    );
  }

  return {
    ok: problems.length === 0,
    problems,
    // Recorded in evidence as OBSERVED, distinct from the declared surface.
    observed: { count: remoteSorted.length, latest: observedLatest },
    expected: { count: surface.migrations, latest: expectedLatest },
  };
}

export function formatMigrationStateFailure(result, surface) {
  return [
    `Refusing to run: the hosted migration ledger does not match surface "${surface.key}".`,
    ...result.problems.map((problem) => `  - ${problem}`),
    `  observed: ${result.observed.count} migrations, latest ${result.observed.latest ?? "none"}`,
    `  expected: ${result.expected.count} migrations, latest ${result.expected.latest ?? "none"}`,
    "No baseline was captured and no fixture was created.",
  ].join("\n");
}
