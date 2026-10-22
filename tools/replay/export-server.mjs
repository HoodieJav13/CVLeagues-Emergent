#!/usr/bin/env node
// Replay Studio local export helper (loopback only, Node built-ins only).
//
// The browser cannot run an encoder, so the app hands this helper a
// reel-manifest/v1 and the helper renders a playable, RE-ENCODED file with the
// installed Blender through tools/replay/blender.sh (scratch boundary). Every
// manifest is checked against the registered media index and the actual file
// bytes first; nothing is ever written next to the originals, partial output
// is never served, and a failed render keeps its reason for Retry.
//
// Env: REPLAY_EXPORT_PORT (required), REPLAY_ALLOWED_ORIGIN (e.g. http://127.0.0.1:4812),
//      REPLAY_MEDIA_ROOT, REPLAY_EXPORT_DIR, REPLAY_RENDER_CMD (tests only: stub renderer).

import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ERROR_TEXT = {
  SCHEMA: "This export request is not a valid reel-manifest/v1.",
  MEDIA_MISSING: "Some original footage is missing from this device.",
  MEDIA_REPLACED: "Some original footage changed since the highlights were made. Revalidate them first.",
  CLIP_OUT_OF_BOUNDS: "A highlight runs outside its recording segment.",
  RENDER_FAILED: "The video renderer stopped before finishing.",
  VERIFY_FAILED: "The rendered file did not pass its length or audio check.",
};

const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const isInt = (v) => Number.isInteger(v);
const inRange = (v, lo, hi) => v === undefined || (isInt(v) && v >= lo && v <= hi);

// Shape and value checks on everything the client controls (no I/O).
export function manifestShapeProblem(manifest) {
  if (!manifest || typeof manifest !== "object" || manifest.schema !== "reel-manifest/v1") return "Not a reel-manifest/v1.";
  if (!Array.isArray(manifest.items) || !manifest.items.length || manifest.items.length > 50) return "The reel needs 1–50 items.";
  if (manifest.title !== undefined && typeof manifest.title !== "string") return "The reel title must be text.";
  const out = manifest.output;
  if (!out || typeof out !== "object" || !["mp4", "webm"].includes(out.container)) return "Unknown output container.";
  if (!inRange(out.fps, 1, 60) || !inRange(out.width, 16, 1920) || !inRange(out.height, 16, 1080)) return "Output size or frame rate is out of range.";
  for (const item of manifest.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "Every reel item must be an object.";
    if (typeof item.media_path !== "string" || typeof item.media_sha256 !== "string" || !isInt(item.in_ms) || !isInt(item.out_ms)) return "A reel item is missing its media or bounds.";
  }
  return null;
}

// Duration of a source file. The registered index is trusted only for the
// exact registered bytes; relinked (different) footage is probed for real.
async function sourceDurationMs(segment, file, actualSha, probeDuration) {
  if (actualSha === segment.sha256) return segment.duration_ms;
  return probeDuration ? probeDuration(file) : null;
}

export async function validateAgainstMediaAsync(manifest, mediaRoot, { probeDuration } = {}) {
  const shape = manifestShapeProblem(manifest);
  if (shape) return { code: "SCHEMA", detail: shape };
  let index;
  try {
    index = JSON.parse(readFileSync(join(mediaRoot, "index.json"), "utf8"));
  } catch {
    return { code: "MEDIA_MISSING", detail: "The recording index (replay-media/index.json) is missing." };
  }
  const byPath = new Map((index.segments || []).map((s) => [s.path, s]));
  for (const item of manifest.items) {
    const segment = byPath.get(item.media_path);
    if (!segment || basename(item.media_path) !== `${segment.id}.webm`) return { code: "SCHEMA", detail: `Item ${item.order}: not a registered replay file.` };
    const file = join(mediaRoot, basename(item.media_path));
    if (!existsSync(file)) return { code: "MEDIA_MISSING", detail: `${segment.label} (${basename(file)}) is missing.` };
    const actual = sha256File(file);
    if (actual !== item.media_sha256) {
      return { code: "MEDIA_REPLACED", detail: `${segment.label} on disk is ${actual.slice(0, 12)}…, the highlights were made on ${String(item.media_sha256).slice(0, 12)}….` };
    }
    const duration = await sourceDurationMs(segment, file, actual, probeDuration);
    if (!(item.in_ms >= 0 && item.out_ms - item.in_ms >= 500 && Number.isFinite(duration) && item.out_ms <= duration)) {
      return { code: "CLIP_OUT_OF_BOUNDS", detail: `Item ${item.order}: ${item.in_ms}–${item.out_ms} ms is outside ${segment.label} (0–${duration ?? "unknown"} ms).` };
    }
  }
  return null;
}

// Synchronous variant (registered footage only), kept for callers and tests.
export function validateAgainstMedia(manifest, mediaRoot) {
  const shape = manifestShapeProblem(manifest);
  if (shape) return { code: "SCHEMA", detail: shape };
  let index;
  try {
    index = JSON.parse(readFileSync(join(mediaRoot, "index.json"), "utf8"));
  } catch {
    return { code: "MEDIA_MISSING", detail: "The recording index (replay-media/index.json) is missing." };
  }
  const byPath = new Map((index.segments || []).map((s) => [s.path, s]));
  for (const item of manifest.items) {
    const segment = byPath.get(item.media_path);
    if (typeof item.media_path !== "string" || !segment || basename(item.media_path) !== `${segment.id}.webm`) {
      return { code: "SCHEMA", detail: `Item ${item.order}: not a registered replay file.` };
    }
    if (!(Number.isInteger(item.in_ms) && Number.isInteger(item.out_ms) && item.in_ms >= 0 && item.out_ms - item.in_ms >= 500 && item.out_ms <= segment.duration_ms)) {
      return { code: "CLIP_OUT_OF_BOUNDS", detail: `Item ${item.order}: ${item.in_ms}–${item.out_ms} ms is outside ${segment.label} (0–${segment.duration_ms} ms).` };
    }
    const file = join(mediaRoot, basename(item.media_path));
    if (!existsSync(file)) return { code: "MEDIA_MISSING", detail: `${segment.label} (${basename(file)}) is missing.` };
    const actual = sha256File(file);
    if (actual !== item.media_sha256) {
      return { code: "MEDIA_REPLACED", detail: `${segment.label} on disk is ${actual.slice(0, 12)}…, the highlights were made on ${String(item.media_sha256).slice(0, 12)}….` };
    }
  }
  return null;
}

function run(cmd, args, timeoutMs) {
  return new Promise((done) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const keep = (chunk) => { out = (out + chunk).slice(-20000); };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("close", (code) => { clearTimeout(timer); done({ code, out, pid: child.pid }); });
    child.on("error", (error) => { clearTimeout(timer); done({ code: -1, out: String(error), pid: null }); });
  });
}

export function createExportServer({ mediaRoot, exportDir, allowedOrigin, renderCmd, probeCmd, renderTimeoutMs = 15 * 60 * 1000 }) {
  mkdirSync(exportDir, { recursive: true });
  const jobs = new Map();
  let queue = Promise.resolve();

  const probeDuration = async (file) => {
    const probed = await run(probeCmd[0], [...probeCmd.slice(1), join(HERE, "probe_media.py"), "--", file], 120000);
    const line = probed.out.split("\n").find((l) => l.startsWith("PROBE "));
    return line ? JSON.parse(line.slice(6)).duration_ms : null;
  };

  const render = async (job) => {
    // Re-check right before rendering: footage may have changed while queued.
    const recheck = await validateAgainstMediaAsync(job.manifest, mediaRoot, { probeDuration });
    if (recheck) return Object.assign(job, { state: "failed", ...recheck });
    job.state = "rendering";
    job.started_at = new Date().toISOString();
    const work = join(exportDir, `.${job.id}`);
    mkdirSync(work, { recursive: true });
    const manifestPath = join(work, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(job.manifest, null, 2));
    const tmpOut = join(work, `reel.${job.format}`);
    const t0 = Date.now();
    const rendered = await run(renderCmd[0], [...renderCmd.slice(1), join(HERE, "render_reel.py"), "--", manifestPath, mediaRoot, tmpOut, job.format], renderTimeoutMs);
    job.render_ms = Date.now() - t0;
    job.render_pid = rendered.pid;
    if (rendered.code !== 0 || !existsSync(tmpOut) || statSync(tmpOut).size === 0) {
      rmSync(work, { recursive: true, force: true });
      return Object.assign(job, { state: "failed", code: "RENDER_FAILED", detail: rendered.out.split("\n").filter(Boolean).slice(-6).join("\n") });
    }
    // The sources must still be the verified bytes after rendering too; a file
    // swapped mid-render could otherwise leak into the output.
    const changed = job.manifest.items.find((item) => {
      const file = join(mediaRoot, basename(item.media_path));
      return !existsSync(file) || sha256File(file) !== item.media_sha256;
    });
    if (changed) {
      rmSync(work, { recursive: true, force: true });
      return Object.assign(job, { state: "failed", code: "MEDIA_REPLACED", detail: `${basename(changed.media_path)} changed while the video was being made.` });
    }
    const probed = await run(probeCmd[0], [...probeCmd.slice(1), join(HERE, "probe_media.py"), "--", tmpOut], 120000);
    const line = probed.out.split("\n").find((l) => l.startsWith("PROBE "));
    const probe = line ? JSON.parse(line.slice(6)) : null;
    const fps = Number(job.manifest.output.fps) || 30;
    const expectedFrames = job.manifest.items.reduce((sum, item) => sum + Math.round(item.out_ms * fps / 1000) - Math.round(item.in_ms * fps / 1000), 0);
    if (!probe || Math.abs(probe.frames - expectedFrames) > 2 || !probe.has_audio) {
      rmSync(work, { recursive: true, force: true });
      return Object.assign(job, { state: "failed", code: "VERIFY_FAILED", detail: `Expected ${expectedFrames} frames with audio; got ${probe ? `${probe.frames} frames, audio ${probe.has_audio}` : "no probe"}.` });
    }
    const final = join(exportDir, `${job.id}.${job.format}`);
    renameSync(tmpOut, final); // only a verified file ever appears under its served name
    writeFileSync(join(exportDir, `${job.id}.manifest.json`), JSON.stringify(job.manifest, null, 2));
    rmSync(work, { recursive: true, force: true });
    return Object.assign(job, { state: "done", file: final, bytes: statSync(final).size, probe, expected_frames: expectedFrames, finished_at: new Date().toISOString() });
  };

  const publicJob = (job) => {
    const { manifest, file, ...rest } = job;
    return { ...rest, reel_id: manifest.reel_id, title: manifest.title, message: job.code ? ERROR_TEXT[job.code] : undefined, download: job.state === "done" ? `/exports/${job.id}/file` : undefined };
  };

  const send = (req, res, status, body, extra = {}) => {
    const origin = req.headers.origin;
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra };
    if (origin && origin === allowedOrigin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
    }
    res.writeHead(status, headers);
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  return createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && origin !== allowedOrigin) return send(req, res, 403, { error: "origin not allowed" });
    if (req.method === "OPTIONS") {
      return send(req, res, 204, undefined, { "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" });
    }
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") {
      return send(req, res, 200, { ok: true, service: "replay-export-helper", formats: ["mp4", "webm"], encoder: "Blender (installed) via scratch boundary" });
    }
    if (req.method === "POST" && url.pathname === "/exports") {
      let raw = "";
      req.on("data", (chunk) => { raw += chunk; if (raw.length > 512 * 1024) req.destroy(); });
      req.on("end", async () => {
        try {
          let manifest;
          try { manifest = JSON.parse(raw).manifest; } catch { return send(req, res, 400, { code: "SCHEMA", message: ERROR_TEXT.SCHEMA }); }
          const problem = await validateAgainstMediaAsync(manifest, mediaRoot, { probeDuration });
          if (problem) return send(req, res, 422, { ...problem, message: ERROR_TEXT[problem.code] });
          const job = { id: randomUUID(), state: "queued", format: manifest.output.container, manifest, queued_at: new Date().toISOString() };
          jobs.set(job.id, job);
          queue = queue.then(() => render(job)).catch((error) => Object.assign(job, { state: "failed", code: "RENDER_FAILED", detail: String(error) }));
          return send(req, res, 202, publicJob(job));
        } catch (error) {
          // Never let one malformed request take the helper down.
          return send(req, res, 422, { code: "SCHEMA", message: ERROR_TEXT.SCHEMA, detail: String(error.message || error) });
        }
      });
      return undefined;
    }
    const match = url.pathname.match(/^\/exports\/([0-9a-f-]{36})(\/file)?$/);
    if (req.method === "GET" && match) {
      const job = jobs.get(match[1]);
      if (!job) return send(req, res, 404, { error: "unknown export" });
      if (!match[2]) return send(req, res, 200, publicJob(job));
      if (job.state !== "done") return send(req, res, 409, { error: "not ready" });
      const safe = String(job.manifest.title || "reel").replace(/[^\w -]+/g, "").trim().slice(0, 60) || "reel";
      const headers = {
        "Content-Type": job.format === "mp4" ? "video/mp4" : "video/webm",
        "Content-Length": String(job.bytes),
        "Content-Disposition": `attachment; filename="${safe}.${job.format}"`,
        "Cache-Control": "no-store",
      };
      if (origin === allowedOrigin) headers["Access-Control-Allow-Origin"] = origin;
      res.writeHead(200, headers);
      createReadStream(job.file).pipe(res);
      return undefined;
    }
    return send(req, res, 404, { error: "not found" });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.REPLAY_EXPORT_PORT);
  if (!port) { console.error("Set REPLAY_EXPORT_PORT"); process.exit(2); }
  const repo = resolve(HERE, "../..");
  const blender = [join(HERE, "blender.sh")];
  const server = createExportServer({
    mediaRoot: process.env.REPLAY_MEDIA_ROOT || join(repo, "frontend/public/replay-media"),
    exportDir: process.env.REPLAY_EXPORT_DIR || join(HERE, "exports"),
    allowedOrigin: process.env.REPLAY_ALLOWED_ORIGIN || "",
    renderCmd: process.env.REPLAY_RENDER_CMD ? process.env.REPLAY_RENDER_CMD.split(" ") : blender,
    probeCmd: blender,
  });
  server.listen(port, "127.0.0.1", () => console.log(`replay export helper on http://127.0.0.1:${port} (origin ${process.env.REPLAY_ALLOWED_ORIGIN || "none"})`));
}
