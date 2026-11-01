#!/usr/bin/env node
// Test-only stand-in for blender.sh: "renders" by writing bytes, or fails when
// the FAIL_RENDER marker file exists; "probes" by reading the job manifest.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
const [script, , ...rest] = process.argv.slice(2);
if (basename(script) === "render_reel.py") {
  const [manifestPath, , out] = rest;
  if (existsSync(join(dirname(manifestPath), "..", "FAIL_RENDER"))) { console.error("Error: simulated renderer crash"); process.exit(1); }
  const hold = join(dirname(manifestPath), "..", "HOLD");
  const t0 = Date.now();
  while (existsSync(hold) && Date.now() - t0 < 5000) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  writeFileSync(out, "fake video bytes");
  process.exit(0);
}
if (basename(script) === "probe_media.py" && rest[0].endsWith(".webm") && !rest[0].includes("/.")) {
  // Source-media probe: duration from a test sidecar file.
  const ms = Number(readFileSync(rest[0] + ".duration", "utf8"));
  console.log("PROBE " + JSON.stringify({ frames: Math.round(ms * 30 / 1000), fps: 30, duration_ms: ms, has_audio: true }));
  process.exit(0);
}
if (basename(script) === "probe_media.py") {
  const manifest = JSON.parse(readFileSync(join(dirname(rest[0]), "manifest.json"), "utf8"));
  const frames = manifest.items.reduce((s, i) => s + Math.round(i.out_ms * 30 / 1000) - Math.round(i.in_ms * 30 / 1000), 0);
  const silent = existsSync(join(dirname(rest[0]), "..", "SILENT"));
  console.log("PROBE " + JSON.stringify({ frames, fps: 30, has_audio: !silent }));
  process.exit(0);
}
process.exit(2);
