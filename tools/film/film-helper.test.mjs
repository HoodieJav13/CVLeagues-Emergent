// node --test tools/film/film-helper.test.mjs
// Film render helper contract with a stub `docker` (no real container):
// validation codes, problems refusal, spec hash, editions never overwritten,
// cancel (queued and rendering, exact container), failure→retry, verify
// failure, post-render source swap, origin rule, and the drawtext padding.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalSpec, createFilmHelper, sequenceShapeProblem } from "./film-helper.mjs";
import { buildFfmpegArgs, padForDrawtext } from "./ffmpegGraph.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORIGIN = "http://127.0.0.1:4999";
const sha = (s) => createHash("sha256").update(s).digest("hex");

function setup() {
  const root = mkdtempSync(join(tmpdir(), "film-helper-test-"));
  const media = join(root, "media"); const editions = join(root, "editions"); const fonts = join(root, "fonts");
  [media, editions, fonts].forEach((d) => mkdirSync(d, { recursive: true }));
  const files = { "rec-g8-s1.webm": "game two footage", "rec-g10-s1.webm": "portrait final footage" };
  Object.entries(files).forEach(([n, c]) => writeFileSync(join(media, n), c));
  writeFileSync(join(media, "index-g8.json"), JSON.stringify({ schema: "replay-media-index/v1", game_id: "g8", segments: [{ id: "rec-g8-s1", label: "Game 2 · Segment A", path: "replay-media/rec-g8-s1.webm", sha256: sha(files["rec-g8-s1.webm"]), duration_ms: 40000, width: 640, height: 360 }] }));
  writeFileSync(join(media, "index-g10.json"), JSON.stringify({ schema: "replay-media-index/v1", game_id: "g10", segments: [{ id: "rec-g10-s1", label: "Final · Phone", path: "replay-media/rec-g10-s1.webm", sha256: sha(files["rec-g10-s1.webm"]), duration_ms: 30000, width: 360, height: 640 }] }));
  const m = (n, extra) => ({ path: `replay-media/${n}`, sha256: sha(files[n]), width: 640, height: 360, ...extra });
  const sequence = { schema: "film-sequence/v1", settings: { width: 1280, height: 720, fps: 30, fit: "letterbox" }, problems: [], items: [
    { kind: "card", role: "title", ms: 2000, lines: [{ text: "Season – story", style: "title" }], t0: 0, ref: { part: "title" } },
    { kind: "clip", ms: 3000, media: m("rec-g8-s1.webm", { in_ms: 10000, out_ms: 13000 }), audio: "source", caption: { text: "Deep ball", authored: true } },
    { kind: "hold", ms: 1500, media: m("rec-g8-s1.webm", { at_ms: 13000 }), comment: null, audio: "silence" },
    { kind: "clip", ms: 2500, media: m("rec-g10-s1.webm", { in_ms: 5000, out_ms: 7500, width: 360, height: 640 }), audio: "mute", caption: null },
  ] };
  return { root, media, editions, fonts, files, sequence, log: join(root, "docker.log") };
}

async function withHelper(f, fn) {
  process.env.FAKE_DOCKER_LOG = f.log;
  const server = createFilmHelper({ mediaRoot: f.media, editionsDir: f.editions, allowedOrigin: ORIGIN, docker: [process.execPath, join(HERE, "test-stubs/fake-docker.mjs")], fontsDir: f.fonts });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { await new Promise((r) => server.close(r)); rmSync(f.root, { recursive: true, force: true }); }
}
const post = (base, body, origin = ORIGIN) => fetch(`${base}/films/renders`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
const get = (base, id) => fetch(`${base}/films/renders/${id}`, { headers: { Origin: ORIGIN } }).then((r) => r.json());
async function settle(base, id, states = ["done", "failed", "canceled"]) {
  for (let i = 0; i < 300; i += 1) { const j = await get(base, id); if (states.includes(j.state)) return j; await new Promise((r) => setTimeout(r, 20)); }
  throw new Error("timeout");
}
const req = (f, n = 1, extra = {}) => {
  const sequence = extra.sequence || f.sequence;
  return { film_id: "film_a", edition_number: n, title: "Jordan's season", sequence, spec_sha256: sha(canonicalSpec(sequence)), ...extra };
};
const cancel = (base, id) => fetch(`${base}/films/renders/${id}/cancel`, { method: "POST", headers: { Origin: ORIGIN } }).then((r) => r.json());
const until = async (fn) => { for (let i = 0; i < 300; i += 1) { if (await fn()) return; await new Promise((r) => setTimeout(r, 20)); } throw new Error("timeout"); };

test("drawtext padding: one trailing space per extra UTF-8 byte", () => {
  assert.equal(padForDrawtext("Final 28–20"), "Final 28–20  ");
  assert.equal(padForDrawtext("plain"), "plain");
  const { texts, args } = buildFfmpegArgs(setup().sequence, { mediaDir: "/m", textDir: "/w/text", fonts: { regular: "/f/r.ttf", bold: "/f/b.ttf" }, output: "/w/film.mp4" });
  assert.equal(texts.find((t) => t.name === "t0_0.txt").text, "Season – story  ");
  const graph = args[args.indexOf("-filter_complex") + 1];
  assert.match(graph, /tpad=stop_mode=clone:stop_duration=1\.500/);     // freeze frame
  assert.match(graph, /anullsrc=r=48000:cl=stereo,atrim=duration=1\.500/); // hold is silent
  assert.match(graph, /force_original_aspect_ratio=decrease,pad=1280:720/); // letterbox, nothing cut
  assert.match(graph, /concat=n=4:v=1:a=1/);
  assert.ok(!graph.includes("[3:a]")); // muted clip never reads its source audio
});

test("shape and value refusals return SCHEMA and the helper stays up", async () => {
  const f = setup();
  const bad = [
    { ...req(f), sequence: { ...f.sequence, schema: "nope" } },
    { ...req(f), sequence: { ...f.sequence, items: [{ kind: "card", ms: 2000, lines: Array(7).fill({ text: "x", style: "title" }) }] } },
    { ...req(f), sequence: { ...f.sequence, items: [{ ...f.sequence.items[2], audio: "source" }] } },
    { ...req(f), sequence: { ...f.sequence, items: [{ ...f.sequence.items[1], ms: 2999 }] } },
    { ...req(f), sequence: { ...f.sequence, settings: { ...f.sequence.settings, width: 100000 } } },
    { ...req(f), film_id: "../etc" },
  ];
  bad.forEach((b) => assert.ok(sequenceShapeProblem(b)));
  await withHelper(f, async (base) => {
    for (const b of bad) { const r = await post(base, b); assert.equal(r.status, 422); assert.equal((await r.json()).code, "SCHEMA"); }
    assert.equal((await fetch(`${base}/films/renders`, { method: "POST", headers: { Origin: ORIGIN }, body: "{oops" })).status, 400);
    assert.equal((await (await fetch(`${base}/health`)).json()).ok, true);
    assert.equal((await post(base, req(f), "http://evil.example")).status, 403);
  });
});

test("unresolved problems, missing, replaced, unregistered and out-of-bounds sources are refused before rendering", async () => {
  const f = setup();
  await withHelper(f, async (base) => {
    const codes = async (body) => (await (await post(base, body)).json()).code;
    assert.equal(await codes({ ...req(f), sequence: { ...f.sequence, problems: [{ code: "replaced", text: "x" }] } }), "PROBLEMS");
    assert.equal(await codes({ ...req(f), sequence: { ...f.sequence, problems: [{ code: "crop", soft: true, text: "x" }] } }), undefined); // soft notes do not block
    assert.equal(await codes({ ...req(f), sequence: { ...f.sequence, items: [{ ...f.sequence.items[1], media: { ...f.sequence.items[1].media, path: "replay-media/other.webm" } }] } }), "SCHEMA");
    assert.equal(await codes({ ...req(f), sequence: { ...f.sequence, items: [{ ...f.sequence.items[1], ms: 3000, media: { ...f.sequence.items[1].media, in_ms: 38000, out_ms: 41000 } }] } }), "CLIP_OUT_OF_BOUNDS");
    assert.equal(await codes({ ...req(f), spec_sha256: "0".repeat(64) }), "SCHEMA");
    writeFileSync(join(f.media, "rec-g8-s1.webm"), "replaced footage");
    assert.equal(await codes(req(f)), "MEDIA_REPLACED");
    rmSync(join(f.media, "rec-g8-s1.webm"));
    assert.equal(await codes(req(f)), "MEDIA_MISSING");
  });
});

test("done editions are kept; the next render is a new edition file with its own manifest", async () => {
  const f = setup();
  await withHelper(f, async (base) => {
    const a = await settle(base, (await (await post(base, req(f, 1))).json()).id);
    assert.equal(a.state, "done");
    assert.equal(a.duration_ms, 9000);
    assert.equal(a.spec_sha256, sha(canonicalSpec(f.sequence)));
    const b = await settle(base, (await (await post(base, req(f, 2))).json()).id);
    const files = readdirSync(join(f.editions, "film_a")).sort();
    assert.deepEqual(files.filter((n) => n.endsWith(".mp4")).length, 2);
    assert.ok(files.includes(a.file_name) && files.includes(b.file_name));
    const manifest = JSON.parse(readFileSync(join(f.editions, "film_a", a.manifest_file), "utf8"));
    assert.equal(manifest.schema, "film-manifest/v1");
    assert.equal(manifest.items.length, 4);
    assert.ok(!JSON.stringify(manifest).includes(f.root)); // no absolute paths
    const byName = await fetch(`${base}/films/film_a/files/${a.file_name}`, { headers: { Origin: ORIGIN } });
    assert.equal(byName.status, 200);
    assert.equal((await fetch(`${base}/films/film_a/files/..%2F..%2Fsecret.mp4`)).status, 404);
    const dl = await fetch(`${base}${a.download}`, { headers: { Origin: ORIGIN } });
    assert.match(dl.headers.get("content-disposition"), /Jordans season - edition 1\.mp4/);
  });
});

test("cancel while rendering kills exactly its own container and leaves no output; a queued cancel never runs", async () => {
  const f = setup();
  await withHelper(f, async (base) => {
    writeFileSync(join(f.editions, "HOLD"), "");
    const running = (await (await post(base, req(f, 1))).json()).id;
    const queued = (await (await post(base, req(f, 2))).json()).id;
    await settle(base, running, ["rendering"]);
    const c1 = await (await fetch(`${base}/films/renders/${queued}/cancel`, { method: "POST", headers: { Origin: ORIGIN } })).json();
    assert.equal(c1.state, "canceled");
    const c2 = await (await fetch(`${base}/films/renders/${running}/cancel`, { method: "POST", headers: { Origin: ORIGIN } })).json();
    assert.equal(c2.state, "canceled");
    await new Promise((r) => setTimeout(r, 300));
    rmSync(join(f.editions, "HOLD"));
    await new Promise((r) => setTimeout(r, 300));
    const log = readFileSync(f.log, "utf8");
    assert.match(log, new RegExp(`kill fw3-film-${running}`));
    assert.ok(!log.includes(`run fw3-film-${queued}`)); // the queued job never started
    assert.equal((await get(base, running)).state, "canceled");
    assert.ok(!existsSync(join(f.editions, "film_a")) || !readdirSync(join(f.editions, "film_a")).some((n) => n.endsWith(".mp4")));
    // Retry after cancel renders a fresh edition.
    const retry = await settle(base, (await (await post(base, req(f, 3))).json()).id);
    assert.equal(retry.state, "done");
  });
});

test("render failure is reported and retry succeeds; missing audio fails verification", async () => {
  const f = setup();
  await withHelper(f, async (base) => {
    writeFileSync(join(f.editions, "FAIL"), "");
    let j = await settle(base, (await (await post(base, req(f, 1))).json()).id);
    assert.equal(j.code, "RENDER_FAILED");
    assert.match(j.detail, /simulated ffmpeg failure/);
    rmSync(join(f.editions, "FAIL"));
    j = await settle(base, (await (await post(base, req(f, 2))).json()).id);
    assert.equal(j.state, "done");
    writeFileSync(join(f.editions, "SILENT"), "");
    j = await settle(base, (await (await post(base, req(f, 3))).json()).id);
    assert.equal(j.code, "VERIFY_FAILED");
    assert.equal(j.download, undefined);
  });
});

test("footage swapped during a render is caught after rendering and nothing is published", async () => {
  const f = setup();
  await withHelper(f, async (base) => {
    writeFileSync(join(f.editions, "HOLD"), "");
    const id = (await (await post(base, req(f, 1))).json()).id;
    await settle(base, id, ["rendering"]);
    writeFileSync(join(f.media, "rec-g10-s1.webm"), "swapped mid-render");
    rmSync(join(f.editions, "HOLD"));
    const j = await settle(base, id);
    assert.equal(j.code, "MEDIA_REPLACED");
    assert.ok(!readdirSync(join(f.editions, "film_a")).some((n) => n.endsWith(".mp4")));
  });
});

test("the preview's sequence hash is required and must match", async () => {
  const f = setup();
  await withHelper(f, async (base) => {
    const { spec_sha256: _omit, ...bare } = req(f, 1);
    const r = await post(base, bare);
    assert.equal(r.status, 422);
    assert.equal((await r.json()).code, "SCHEMA");
  });
});

test("cancel during the pre-render source check never starts the render", async () => {
  const f = setup();
  await withHelper(f, async (base) => {
    // Relinked footage (pinned bytes differ from the index) is probed before rendering.
    writeFileSync(join(f.media, "rec-g8-s1.webm"), "relinked game two footage");
    writeFileSync(join(f.media, "rec-g8-s1.webm.duration"), "40000");
    const relinked = JSON.parse(JSON.stringify(f.sequence));
    relinked.items.filter((i) => i.media?.path.endsWith("rec-g8-s1.webm")).forEach((i) => { i.media.sha256 = sha("relinked game two footage"); });
    writeFileSync(join(f.editions, "HOLD"), "");
    const first = (await (await post(base, req(f, 1, { sequence: relinked }))).json()).id;
    await settle(base, first, ["rendering"]);
    const second = (await (await post(base, req(f, 2, { sequence: relinked }))).json()).id;
    const probes = () => readFileSync(f.log, "utf8").split("\n").filter((l) => l === `probe fw3-film-probe-${second}`).length;
    const atSubmit = probes();
    writeFileSync(join(f.root, "PROBE_HOLD"), `fw3-film-probe-${second}`);
    rmSync(join(f.editions, "HOLD")); // first finishes; second starts its own source probe and waits
    await until(() => probes() > atSubmit);
    assert.equal((await cancel(base, second)).state, "canceled");
    rmSync(join(f.root, "PROBE_HOLD"));
    assert.equal((await settle(base, first)).state, "done");
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await get(base, second)).state, "canceled");
    assert.ok(!readFileSync(f.log, "utf8").includes(`run fw3-film-${second}`));
  });
});

test("cancel while the finished file is being verified publishes no edition file or manifest", async () => {
  const f = setup();
  await withHelper(f, async (base) => {
    writeFileSync(join(f.root, "PROBE_HOLD"), "fw3-film-verify-");
    const id = (await (await post(base, req(f, 1))).json()).id;
    await until(() => existsSync(f.log) && readFileSync(f.log, "utf8").includes(`probe fw3-film-verify-${id}`));
    assert.equal((await cancel(base, id)).state, "canceled");
    rmSync(join(f.root, "PROBE_HOLD"));
    await new Promise((r) => setTimeout(r, 300));
    const j = await get(base, id);
    assert.equal(j.state, "canceled");
    assert.equal(j.download, undefined);
    const names = existsSync(join(f.editions, "film_a")) ? readdirSync(join(f.editions, "film_a")) : [];
    assert.ok(!names.some((n) => n.startsWith("edition-") || n.startsWith(".work-")), names.join(","));
  });
});
