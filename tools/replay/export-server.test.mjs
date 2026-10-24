// node --test tools/replay/export-server.test.mjs
// Export helper contract with a stub renderer (no Blender): validation codes,
// failure then retry, verify failure, no partial output, origin and path rules.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createExportServer, validateAgainstMedia } from "./export-server.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = [process.execPath, join(HERE, "test-stubs/fake-blender.mjs")];
const ORIGIN = "http://127.0.0.1:4999";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "replay-export-test-"));
  const media = join(root, "media");
  const exportsDir = join(root, "exports");
  const bytes = { "rec-g7-s1.webm": "segment-a", "rec-g7-s2.webm": "segment-b" };
  const sha = (s) => createHash("sha256").update(s).digest("hex");
  const index = { schema: "replay-media-index/v1", segments: [
    { id: "rec-g7-s1", label: "Segment A", path: "replay-media/rec-g7-s1.webm", duration_ms: 60000, sha256: sha(bytes["rec-g7-s1.webm"]) },
    { id: "rec-g7-s2", label: "Segment B", path: "replay-media/rec-g7-s2.webm", duration_ms: 45000, sha256: sha(bytes["rec-g7-s2.webm"]) },
  ] };
  return { root, media, exportsDir, bytes, index, sha };
}

function setup() {
  const f = fixture();
  mkdirSync(f.media, { recursive: true });
  for (const [name, content] of Object.entries(f.bytes)) writeFileSync(join(f.media, name), content);
  writeFileSync(join(f.media, "index.json"), JSON.stringify(f.index));
  const manifest = {
    schema: "reel-manifest/v1", reel_id: "reel_1", title: "Riley's reel", output: { container: "mp4", fps: 30 },
    items: [
      { order: 1, segment_id: "rec-g7-s2", media_path: "replay-media/rec-g7-s2.webm", media_sha256: f.index.segments[1].sha256, in_ms: 23500, out_ms: 28000, duration_ms: 4500 },
      { order: 2, segment_id: "rec-g7-s1", media_path: "replay-media/rec-g7-s1.webm", media_sha256: f.index.segments[0].sha256, in_ms: 55500, out_ms: 59800, duration_ms: 4300 },
    ],
  };
  return { ...f, manifest };
}

async function withServer(f, fn) {
  const server = createExportServer({ mediaRoot: f.media, exportDir: f.exportsDir, allowedOrigin: ORIGIN, renderCmd: STUB, probeCmd: STUB });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { await new Promise((r) => server.close(r)); rmSync(f.root, { recursive: true, force: true }); }
}
const post = (base, manifest, origin = ORIGIN) => fetch(`${base}/exports`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ manifest }) });
async function waitDone(base, id) {
  for (let i = 0; i < 100; i += 1) {
    const job = await (await fetch(`${base}/exports/${id}`, { headers: { Origin: ORIGIN } })).json();
    if (["done", "failed"].includes(job.state)) return job;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timeout");
}

test("validation codes: schema, missing, replaced, out of bounds, path traversal", () => {
  const f = setup();
  assert.equal(validateAgainstMedia({ schema: "nope" }, f.media).code, "SCHEMA");
  assert.equal(validateAgainstMedia(f.manifest, f.media), null);
  const evil = { ...f.manifest, items: [{ ...f.manifest.items[0], media_path: "replay-media/../../index.json" }] };
  assert.equal(validateAgainstMedia(evil, f.media).code, "SCHEMA");
  const oob = { ...f.manifest, items: [{ ...f.manifest.items[0], out_ms: 46000 }] };
  assert.equal(validateAgainstMedia(oob, f.media).code, "CLIP_OUT_OF_BOUNDS");
  writeFileSync(join(f.media, "rec-g7-s2.webm"), "replaced footage");
  assert.equal(validateAgainstMedia(f.manifest, f.media).code, "MEDIA_REPLACED");
  rmSync(join(f.media, "rec-g7-s2.webm"));
  assert.equal(validateAgainstMedia(f.manifest, f.media).code, "MEDIA_MISSING");
  rmSync(f.root, { recursive: true, force: true });
});

test("render failure is reported with its reason and leaves no output; retry then succeeds and downloads", async () => {
  const f = setup();
  await withServer(f, async (base) => {
    writeFileSync(join(f.exportsDir, "FAIL_RENDER"), "");
    let res = await post(base, f.manifest);
    assert.equal(res.status, 202);
    assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
    let job = await waitDone(base, (await res.json()).id);
    assert.equal(job.state, "failed");
    assert.equal(job.code, "RENDER_FAILED");
    assert.match(job.detail, /simulated renderer crash/);
    assert.match(job.message, /stopped before finishing/);
    assert.deepEqual(readdirSync(f.exportsDir).filter((n) => !n.startsWith("FAIL")), []); // no partial file or temp dir
    rmSync(join(f.exportsDir, "FAIL_RENDER"));
    res = await post(base, f.manifest);
    job = await waitDone(base, (await res.json()).id);
    assert.equal(job.state, "done");
    assert.equal(job.expected_frames, 135 + 129);
    const file = await fetch(`${base}${job.download}`, { headers: { Origin: ORIGIN } });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "video/mp4");
    assert.match(file.headers.get("content-disposition"), /attachment; filename="Rileys reel.mp4"/);
    assert.equal(await file.text(), "fake video bytes");
  });
});

test("a render without audio fails verification instead of being served", async () => {
  const f = setup();
  await withServer(f, async (base) => {
    writeFileSync(join(f.exportsDir, "SILENT"), "");
    const res = await post(base, f.manifest);
    const job = await waitDone(base, (await res.json()).id);
    assert.equal(job.code, "VERIFY_FAILED");
    assert.equal(job.download, undefined);
    assert.ok(!readdirSync(f.exportsDir).some((n) => n.endsWith(".mp4")));
  });
});

test("rejects other origins and invalid manifests before rendering", async () => {
  const f = setup();
  await withServer(f, async (base) => {
    assert.equal((await post(base, f.manifest, "http://evil.example")).status, 403);
    const bad = await post(base, { ...f.manifest, items: [] });
    assert.equal(bad.status, 422);
    assert.equal((await bad.json()).code, "SCHEMA");
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.ok, true);
  });
});

test("review R4/R9: malformed items, non-string titles and silly output sizes are SCHEMA, and the helper keeps running", async () => {
  const f = setup();
  await withServer(f, async (base) => {
    for (const bad of [
      { ...f.manifest, items: [null] },
      { ...f.manifest, items: [42] },
      { ...f.manifest, title: 5 },
      { ...f.manifest, output: { container: "mp4", fps: 0 } },
      { ...f.manifest, output: { container: "mp4", fps: 30, width: 100000 } },
    ]) {
      const res = await post(base, bad);
      assert.equal(res.status, 422);
      assert.equal((await res.json()).code, "SCHEMA");
    }
    const garbage = await fetch(`${base}/exports`, { method: "POST", headers: { Origin: ORIGIN }, body: "{not json" });
    assert.equal(garbage.status, 400);
    assert.equal((await (await fetch(`${base}/health`)).json()).ok, true); // still alive
  });
});

test("review R5: relinked (replaced, longer) footage is bounded by its probed duration, not the frozen index", async () => {
  const f = setup();
  writeFileSync(join(f.media, "rec-g7-s2.webm"), "longer replacement footage");
  writeFileSync(join(f.media, "rec-g7-s2.webm.duration"), "50000"); // stub probe reads this
  const relinked = { ...f.manifest, items: [{ ...f.manifest.items[0], in_ms: 46000, out_ms: 49000, duration_ms: 3000, media_sha256: f.sha("longer replacement footage") }] };
  await withServer(f, async (base) => {
    const res = await post(base, relinked);
    assert.equal(res.status, 202);
    const job = await waitDone(base, (await res.json()).id);
    assert.equal(job.state, "done");
  });
});

test("review R5: footage swapped while a job waits in the queue is refused at render time", async () => {
  const f = setup();
  await withServer(f, async (base) => {
    writeFileSync(join(f.exportsDir, "HOLD"), ""); // stub render waits while HOLD exists
    const first = await (await post(base, f.manifest)).json();
    const second = await (await post(base, f.manifest)).json();
    writeFileSync(join(f.media, "rec-g7-s1.webm"), "swapped while queued");
    rmSync(join(f.exportsDir, "HOLD"));
    const firstJob = await waitDone(base, first.id); // swapped during its render: caught after rendering
    assert.equal(firstJob.code, "MEDIA_REPLACED");
    assert.ok(!readdirSync(f.exportsDir).some((n) => /\.(mp4|webm)$/.test(n)));
    const job = await waitDone(base, second.id);
    assert.equal(job.state, "failed");
    assert.equal(job.code, "MEDIA_REPLACED");
  });
});

test("per-game indexes (index-<game>.json) register their footage alongside index.json", () => {
  const f = setup();
  writeFileSync(join(f.media, "rec-g8-s1.webm"), "game-two");
  const g8 = { id: "rec-g8-s1", label: "Game 2 · Segment A", path: "replay-media/rec-g8-s1.webm", duration_ms: 40000, sha256: f.sha("game-two") };
  const item = { order: 1, segment_id: "rec-g8-s1", media_path: g8.path, media_sha256: g8.sha256, in_ms: 10000, out_ms: 13000, duration_ms: 3000 };
  const m = { ...f.manifest, items: [item] };
  assert.equal(validateAgainstMedia(m, f.media).code, "SCHEMA"); // not registered yet
  writeFileSync(join(f.media, "index-g8.json"), JSON.stringify({ schema: "replay-media-index/v1", game_id: "g8", segments: [g8] }));
  assert.equal(validateAgainstMedia(m, f.media), null);
  assert.equal(validateAgainstMedia(f.manifest, f.media), null); // g7 unchanged
  rmSync(join(f.media, "index.json"));
  assert.equal(validateAgainstMedia(m, f.media).code, "MEDIA_MISSING"); // index.json stays required
  rmSync(f.root, { recursive: true, force: true });
});
