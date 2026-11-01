#!/usr/bin/env node
// Test-only stand-in for `docker`: emulates `run … ffmpeg …`, `run … ffprobe …`
// and `kill <name>` for the film helper's contract tests. Markers in the
// editions root steer it: FAIL (ffmpeg exits 1), HOLD (ffmpeg waits until the
// marker is removed or it is killed), SILENT (probe reports no audio). A
// PROBE_HOLD marker beside the log holds each ffprobe whose container name
// contains the marker's text, until the marker is removed.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const argv = process.argv.slice(2);
const log = process.env.FAKE_DOCKER_LOG;
if (argv[0] === "kill") { if (log) appendFileSync(log, `kill ${argv[1]}\n`); process.exit(0); }
const mounts = [];
for (let i = 0; i < argv.length; i += 1) if (argv[i] === "-v") mounts.push(argv[i + 1].split(":"));
const host = (p) => { const m = mounts.find(([, c]) => p === c || p.startsWith(c + "/")); return m ? m[0] + p.slice(m[1].length) : p; };
const name = argv[argv.indexOf("--name") + 1];
const tool = argv.find((a) => a === "ffmpeg" || a === "ffprobe");
const rest = argv.slice(argv.indexOf(tool) + 1);
if (tool === "ffprobe") {
  if (log) appendFileSync(log, `probe ${name}\n`);
  const hold = log && join(dirname(log), "PROBE_HOLD");
  const held = () => { try { return name.includes(readFileSync(hold, "utf8")); } catch { return false; } };
  while (hold && held()) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  const file = host(rest[rest.length - 1]);
  const meta = existsSync(file + ".json") ? JSON.parse(readFileSync(file + ".json", "utf8")) : { duration: Number(readFileSync(file + ".duration", "utf8")) / 1000, audio: true };
  const streams = [{ codec_type: "video" }, ...(meta.audio ? [{ codec_type: "audio" }] : [])];
  console.log(JSON.stringify({ format: { duration: String(meta.duration) }, streams }));
  process.exit(0);
}
const out = host(rest[rest.length - 1]);
const root = dirname(dirname(dirname(out))); // <editions>/<film>/.work-<id>/film.mp4
if (log) appendFileSync(log, `run ${name}\n`);
if (existsSync(join(root, "FAIL"))) { console.error("Error: simulated ffmpeg failure"); process.exit(1); }
let killed = false;
process.on("SIGTERM", () => { killed = true; });
const graph = rest[rest.indexOf("-filter_complex") + 1];
const total = graph.split(";").filter((f) => /\[v\d+\]$/.test(f))
  .map((f) => { const all = [...f.matchAll(/(?:trim=duration|:d)=([\d.]+)/g)]; return Number(all[all.length - 1][1]); })
  .reduce((s, x) => s + x, 0);
const finish = () => {
  if (log && existsSync(log) && readFileSync(log, "utf8").includes(`kill ${name}`)) process.exit(137);
  writeFileSync(out, "fake mp4 bytes");
  writeFileSync(out + ".json", JSON.stringify({ duration: total, audio: !existsSync(join(root, "SILENT")) }));
  process.stdout.write(`out_time_ms=${Math.round(total * 1e6)}\nprogress=end\n`);
  process.exit(0);
};
const tick = () => {
  if (killed || (log && existsSync(log) && readFileSync(log, "utf8").includes(`kill ${name}`))) process.exit(137);
  if (existsSync(join(root, "HOLD"))) return setTimeout(tick, 20);
  return finish();
};
tick();
