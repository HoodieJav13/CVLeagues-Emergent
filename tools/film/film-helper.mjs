#!/usr/bin/env node
// Season Film local render helper (loopback only; Node built-ins only).
//
// Renders a film-sequence/v1 — the same effective sequence the browser preview
// plays — with the EXISTING local FFmpeg container image, run with
// --network none --pull never, read-only media/font mounts and a write mount
// limited to one job's work folder. Every render attempt has its own id,
// temporary output, progress and state; cancel kills exactly its own container;
// a finished edition is never overwritten; sources are re-hashed after render.
//
// Env: FILM_HELPER_PORT (required), FILM_ALLOWED_ORIGIN, FILM_MEDIA_ROOT,
//      FILM_EDITIONS_DIR, FILM_IMAGE, FILM_DOCKER (tests only: stub command).

import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFfmpegArgs } from "./ffmpegGraph.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const IMAGE = "cvfpt-media-ffmpeg:6.1.2-r2-a322";
export const MESSAGES = {
  SCHEMA: "This render request is not a valid film-sequence/v1.",
  PROBLEMS: "The film still has unresolved problems. Fix them, then render.",
  MEDIA_MISSING: "Some original footage is missing from this computer.",
  MEDIA_REPLACED: "Some original footage changed. Relink it in Replay Studio and update the film first.",
  CLIP_OUT_OF_BOUNDS: "A moment runs outside its recording segment.",
  RENDER_FAILED: "The film renderer stopped before finishing.",
  VERIFY_FAILED: "The rendered film did not pass its length or audio check.",
  CANCELED: "Render cancelled. Your project and earlier editions are unchanged.",
};

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const sha256File = (path) => sha256(readFileSync(path));

// The exact canonical form the browser hashes (lib/film.js canonicalSpec).
export function canonicalSpec(sequence) {
  const strip = (item) => { const { t0, ref, ...rest } = item; return rest; };
  return JSON.stringify({ settings: sequence.settings, items: sequence.items.map(strip) });
}

export function registeredMedia(mediaRoot) {
  const map = new Map();
  if (!existsSync(mediaRoot)) return map;
  for (const name of readdirSync(mediaRoot).filter((n) => /^index(-[\w-]+)?\.json$/.test(n))) {
    try {
      const index = JSON.parse(readFileSync(join(mediaRoot, name), "utf8"));
      (index.segments || []).forEach((s) => map.set(s.path, s));
    } catch { /* unreadable index: its media simply is not registered */ }
  }
  return map;
}

const isStr = (v, max) => typeof v === "string" && v.length <= max;
const isInt = (v) => Number.isInteger(v);

export function sequenceShapeProblem(body) {
  const seq = body?.sequence;
  if (!body || typeof body.film_id !== "string" || !/^[\w-]{1,80}$/.test(body.film_id)) return "Missing film id.";
  if (!isInt(body.edition_number) || body.edition_number < 1) return "Missing edition number.";
  if (!seq || seq.schema !== "film-sequence/v1" || !Array.isArray(seq.items) || !seq.items.length || seq.items.length > 200) return "Not a film-sequence/v1.";
  const st = seq.settings || {};
  if (!(isInt(st.width) && st.width >= 320 && st.width <= 1920 && isInt(st.height) && st.height >= 180 && st.height <= 1080)) return "Frame size out of range.";
  if (!(isInt(st.fps) && st.fps >= 24 && st.fps <= 60) || !["letterbox", "fill-crop"].includes(st.fit)) return "Frame rate or fit is invalid.";
  for (const item of seq.items) {
    if (!item || typeof item !== "object" || !isInt(item.ms) || item.ms < 300 || item.ms > 120000) return "Every item needs a duration.";
    if (item.kind === "card") {
      if (!Array.isArray(item.lines) || item.lines.length > 6 || !item.lines.every((l) => l && isStr(l.text, 120) && ["title", "sub", "body", "fine"].includes(l.style))) return "A card's text is invalid.";
    } else if (item.kind === "clip" || item.kind === "hold") {
      const m = item.media;
      if (!m || !isStr(m.path, 120) || !/^[0-9a-f]{64}$/.test(m.sha256 || "")) return "A moment is missing its media.";
      const text = item.kind === "clip" ? item.caption : item.comment;
      if (text && !isStr(text.text, 120)) return "A caption is invalid.";
      if (item.kind === "clip" && !(isInt(m.in_ms) && isInt(m.out_ms) && m.out_ms - m.in_ms === item.ms && ["source", "mute"].includes(item.audio))) return "A clip's bounds or audio are invalid.";
      if (item.kind === "hold" && !(isInt(m.at_ms) && item.audio === "silence")) return "A hold must freeze a frame with silence.";
    } else return "Unknown sequence item.";
  }
  return null;
}

function run(cmd, args, { onStdout, timeoutMs = 20 * 60 * 1000 } = {}) {
  return new Promise((done) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stdout.on("data", (c) => onStdout?.(String(c)));
    child.stderr.on("data", (c) => { err = (err + c).slice(-12000); });
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("close", (code) => { clearTimeout(timer); done({ code, err }); });
    child.on("error", (e) => { clearTimeout(timer); done({ code: -1, err: String(e) }); });
  });
}

export function createFilmHelper({ mediaRoot, editionsDir, allowedOrigin, docker = ["docker"], image = IMAGE, fontsDir }) {
  mkdirSync(editionsDir, { recursive: true });
  const renders = new Map();
  let queue = Promise.resolve();

  const containerArgs = (name, mounts, cmd) => [
    ...docker.slice(1), "run", "--rm", "--name", name, "--network", "none", "--pull", "never",
    ...mounts.flatMap((m) => ["-v", m]), image, ...cmd,
  ];

  const probeDurationMs = async (file, name) => {
    let out = "";
    const res = await run(docker[0], [...docker.slice(1), "run", "--rm", "--name", name, "--network", "none", "--pull", "never",
      "-v", `${dirname(file)}:/p:ro`, image, "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", `/p/${basename(file)}`],
    { onStdout: (c) => { out += c; }, timeoutMs: 120000 });
    if (res.code !== 0) return null;
    try {
      const j = JSON.parse(out);
      return { duration_ms: Math.round(Number(j.format.duration) * 1000), has_audio: (j.streams || []).some((s) => s.codec_type === "audio") };
    } catch { return null; }
  };

  async function checkSources(seq, rid) {
    const media = registeredMedia(mediaRoot);
    for (const item of seq.items.filter((i) => i.kind !== "card")) {
      const reg = media.get(item.media.path);
      if (!reg || basename(item.media.path) !== `${reg.id}.webm`) return { code: "SCHEMA", detail: `${item.media.path} is not registered replay footage.` };
      const file = join(mediaRoot, basename(item.media.path));
      if (!existsSync(file)) return { code: "MEDIA_MISSING", detail: `${reg.label} (${basename(file)}) is missing.` };
      const actual = sha256File(file);
      if (actual !== item.media.sha256) return { code: "MEDIA_REPLACED", detail: `${reg.label} on disk is ${actual.slice(0, 12)}…; the film pinned ${item.media.sha256.slice(0, 12)}….` };
      let duration = reg.duration_ms;
      if (actual !== reg.sha256) duration = (await probeDurationMs(file, `fw3-film-probe-${rid}`))?.duration_ms ?? null;
      const end = item.kind === "clip" ? item.media.out_ms : item.media.at_ms;
      const start = item.kind === "clip" ? item.media.in_ms : 0;
      if (!(start >= 0 && Number.isFinite(duration) && end <= duration)) return { code: "CLIP_OUT_OF_BOUNDS", detail: `${reg.label}: ${start}–${end} ms is outside 0–${duration ?? "unknown"} ms.` };
    }
    return null;
  }

  const render = async (job) => {
    if (job.state === "canceled") return job;
    const pre = await checkSources(job.sequence, job.id);
    if (pre) return Object.assign(job, { state: "failed", ...pre });
    job.state = "rendering";
    job.started_at = new Date().toISOString();
    const work = join(editionsDir, job.film_id, `.work-${job.id}`);
    mkdirSync(join(work, "text"), { recursive: true });
    const { args, texts } = buildFfmpegArgs(job.sequence, {
      mediaDir: "/m", textDir: "/w/text", fonts: { regular: "/f/regular.ttf", bold: "/f/bold.ttf" }, output: "/w/film.mp4",
    });
    texts.forEach((t) => writeFileSync(join(work, "text", t.name), t.text));
    const total = job.sequence.items.reduce((s, i) => s + i.ms, 0);
    const t0 = Date.now();
    const res = await run(docker[0], containerArgs(job.container, [`${mediaRoot}:/m:ro`, `${fontsDir}:/f:ro`, `${work}:/w`], ["ffmpeg", ...args]), {
      onStdout: (chunk) => {
        const m = [...chunk.matchAll(/out_time_ms=(\d+)/g)].pop();
        if (m) job.progress = Math.min(0.99, Number(m[1]) / 1000 / total);
      },
    });
    job.render_ms = Date.now() - t0;
    if (job.state === "canceled") { rmSync(work, { recursive: true, force: true }); return job; }
    const out = join(work, "film.mp4");
    if (res.code !== 0 || !existsSync(out) || statSync(out).size === 0) {
      rmSync(work, { recursive: true, force: true });
      return Object.assign(job, { state: "failed", code: "RENDER_FAILED", detail: res.err.split("\n").filter(Boolean).slice(-5).join("\n") });
    }
    // Sources must still be the verified bytes after rendering.
    const post = job.sequence.items.filter((i) => i.kind !== "card").find((i) => {
      const f = join(mediaRoot, basename(i.media.path));
      return !existsSync(f) || sha256File(f) !== i.media.sha256;
    });
    if (post) {
      rmSync(work, { recursive: true, force: true });
      return Object.assign(job, { state: "failed", code: "MEDIA_REPLACED", detail: `${basename(post.media.path)} changed while the film was rendering.` });
    }
    const probe = await probeDurationMs(out, `fw3-film-verify-${job.id}`);
    const frame = 1000 / job.sequence.settings.fps;
    if (!probe || Math.abs(probe.duration_ms - total) > 2 * frame + 30 || !probe.has_audio) {
      rmSync(work, { recursive: true, force: true });
      return Object.assign(job, { state: "failed", code: "VERIFY_FAILED", detail: `Expected ${total} ms with audio; got ${probe ? `${probe.duration_ms} ms, audio ${probe.has_audio}` : "no probe"}.` });
    }
    const name = `edition-${job.edition_number}-${job.id.slice(0, 8)}`;
    const final = join(editionsDir, job.film_id, `${name}.mp4`);
    if (existsSync(final)) { rmSync(work, { recursive: true, force: true }); return Object.assign(job, { state: "failed", code: "RENDER_FAILED", detail: "An edition file with this name already exists; nothing was overwritten." }); }
    renameSync(out, final);
    const manifest = {
      schema: "film-manifest/v1", film_id: job.film_id, edition_number: job.edition_number, title: job.title,
      spec_sha256: job.spec_sha256, created_at: new Date().toISOString(), settings: job.sequence.settings,
      items: job.sequence.items.map(({ t0: _t0, ...rest }) => rest),
      sources: [...new Map(job.sequence.items.filter((i) => i.media).map((i) => [i.media.path, { path: i.media.path, sha256: i.media.sha256 }])).values()],
      output: { container: "mp4", video: "h264", audio: "aac", width: job.sequence.settings.width, height: job.sequence.settings.height, fps: job.sequence.settings.fps, duration_ms: probe.duration_ms },
    };
    writeFileSync(join(editionsDir, job.film_id, `${name}.film-manifest.json`), JSON.stringify(manifest, null, 2));
    rmSync(work, { recursive: true, force: true });
    return Object.assign(job, { state: "done", progress: 1, file: final, manifest_file: `${name}.film-manifest.json`, bytes: statSync(final).size, duration_ms: probe.duration_ms, finished_at: new Date().toISOString() });
  };

  const view = (job) => ({
    id: job.id, film_id: job.film_id, edition_number: job.edition_number, state: job.state, progress: job.progress || 0,
    spec_sha256: job.spec_sha256, code: job.code, detail: job.detail, message: job.code ? MESSAGES[job.code] : undefined,
    render_ms: job.render_ms, bytes: job.bytes, duration_ms: job.duration_ms, manifest_file: job.manifest_file,
    file_name: job.file ? basename(job.file) : undefined, download: job.state === "done" ? `/films/renders/${job.id}/file` : undefined,
  });

  const send = (req, res, status, body, extra = {}) => {
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra };
    if (req.headers.origin && req.headers.origin === allowedOrigin) { headers["Access-Control-Allow-Origin"] = allowedOrigin; headers.Vary = "Origin"; }
    res.writeHead(status, headers);
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  const server = createServer((req, res) => {
    if (req.headers.origin && req.headers.origin !== allowedOrigin) return send(req, res, 403, { error: "origin not allowed" });
    if (req.method === "OPTIONS") return send(req, res, 204, undefined, { "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" });
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") return send(req, res, 200, { ok: true, service: "season-film-helper", image, network: "none", pull: "never" });
    if (req.method === "POST" && url.pathname === "/films/renders") {
      let raw = "";
      req.on("data", (c) => { raw += c; if (raw.length > 1024 * 1024) req.destroy(); });
      req.on("end", async () => {
        try {
          let body;
          try { body = JSON.parse(raw); } catch { return send(req, res, 400, { code: "SCHEMA", message: MESSAGES.SCHEMA }); }
          const shape = sequenceShapeProblem(body);
          if (shape) return send(req, res, 422, { code: "SCHEMA", message: MESSAGES.SCHEMA, detail: shape });
          if ((body.sequence.problems || []).some((p) => !p.soft)) return send(req, res, 422, { code: "PROBLEMS", message: MESSAGES.PROBLEMS, detail: body.sequence.problems.filter((p) => !p.soft).map((p) => p.text).join(" ") });
          const id = randomUUID();
          const pre = await checkSources(body.sequence, id);
          if (pre) return send(req, res, 422, { ...pre, message: MESSAGES[pre.code] });
          const spec_sha256 = sha256(canonicalSpec(body.sequence));
          if (body.spec_sha256 && body.spec_sha256 !== spec_sha256) return send(req, res, 422, { code: "SCHEMA", message: MESSAGES.SCHEMA, detail: "The preview's sequence hash does not match the submitted sequence." });
          const job = { id, container: `fw3-film-${id}`, film_id: body.film_id, edition_number: body.edition_number, title: String(body.title || "Untitled film").slice(0, 80), sequence: body.sequence, spec_sha256, state: "queued", progress: 0 };
          renders.set(id, job);
          queue = queue.then(() => render(job)).catch((e) => Object.assign(job, { state: "failed", code: "RENDER_FAILED", detail: String(e) }));
          return send(req, res, 202, view(job));
        } catch (error) {
          return send(req, res, 422, { code: "SCHEMA", message: MESSAGES.SCHEMA, detail: String(error.message || error) });
        }
      });
      return undefined;
    }
    // Finished editions stay downloadable by name after a helper restart.
    const saved = url.pathname.match(/^\/films\/([\w-]{1,80})\/files\/(edition-\d+-[0-9a-f]{8}\.(?:mp4|film-manifest\.json))$/);
    if (saved && req.method === "GET") {
      const path = join(editionsDir, saved[1], saved[2]);
      if (!existsSync(path)) return send(req, res, 404, { error: "no such edition" });
      const isVideo = saved[2].endsWith(".mp4");
      const headers = { "Content-Type": isVideo ? "video/mp4" : "application/json", "Content-Length": String(statSync(path).size), "Content-Disposition": `attachment; filename="${saved[2]}"`, "Cache-Control": "no-store" };
      if (req.headers.origin === allowedOrigin) headers["Access-Control-Allow-Origin"] = allowedOrigin;
      res.writeHead(200, headers);
      createReadStream(path).pipe(res);
      return undefined;
    }
    const m = url.pathname.match(/^\/films\/renders\/([0-9a-f-]{36})(\/file|\/manifest|\/cancel)?$/);
    const job = m && renders.get(m[1]);
    if (m && !job) return send(req, res, 404, { error: "unknown render" });
    if (job && req.method === "POST" && m[2] === "/cancel") {
      if (["done", "failed", "canceled"].includes(job.state)) return send(req, res, 409, view(job));
      const wasRendering = job.state === "rendering";
      Object.assign(job, { state: "canceled", code: "CANCELED" });
      if (wasRendering) spawn(docker[0], [...docker.slice(1), "kill", job.container], { stdio: "ignore" }); // exactly this render's container
      return send(req, res, 200, view(job));
    }
    if (job && req.method === "GET" && !m[2]) return send(req, res, 200, view(job));
    if (job && req.method === "GET" && (m[2] === "/file" || m[2] === "/manifest")) {
      if (job.state !== "done") return send(req, res, 409, { error: "not ready" });
      const path = m[2] === "/file" ? job.file : join(dirname(job.file), job.manifest_file);
      const safe = job.title.replace(/[^\w -]+/g, "").trim().slice(0, 60) || "film";
      const headers = {
        "Content-Type": m[2] === "/file" ? "video/mp4" : "application/json",
        "Content-Length": String(statSync(path).size),
        "Content-Disposition": `attachment; filename="${safe} - edition ${job.edition_number}${m[2] === "/file" ? ".mp4" : ".film-manifest.json"}"`,
        "Cache-Control": "no-store",
      };
      if (req.headers.origin === allowedOrigin) headers["Access-Control-Allow-Origin"] = allowedOrigin;
      res.writeHead(200, headers);
      createReadStream(path).pipe(res);
      return undefined;
    }
    return send(req, res, 404, { error: "not found" });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.FILM_HELPER_PORT);
  if (!port) { console.error("Set FILM_HELPER_PORT"); process.exit(2); }
  const repo = resolve(HERE, "../..");
  const fontsDir = join(HERE, ".fonts");
  mkdirSync(fontsDir, { recursive: true });
  // Local copies of macOS system fonts (the container image ships none).
  copyFileSync("/System/Library/Fonts/Supplemental/Arial.ttf", join(fontsDir, "regular.ttf"));
  copyFileSync("/System/Library/Fonts/Supplemental/Arial Bold.ttf", join(fontsDir, "bold.ttf"));
  const server = createFilmHelper({
    mediaRoot: process.env.FILM_MEDIA_ROOT || join(repo, "frontend/public/replay-media"),
    editionsDir: process.env.FILM_EDITIONS_DIR || join(HERE, "editions"),
    allowedOrigin: process.env.FILM_ALLOWED_ORIGIN || "",
    docker: process.env.FILM_DOCKER ? process.env.FILM_DOCKER.split(" ") : ["docker"],
    image: process.env.FILM_IMAGE || IMAGE,
    fontsDir,
  });
  server.listen(port, "127.0.0.1", () => console.log(`season film helper on http://127.0.0.1:${port} (origin ${process.env.FILM_ALLOWED_ORIGIN || "none"})`));
}
