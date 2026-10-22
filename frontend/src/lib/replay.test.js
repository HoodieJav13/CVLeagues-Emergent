import { initialState } from "../data/seed";
import { FIXTURE_INDEX, H1, H2 } from "./__fixtures__/replayIndex";
import {
  buildReelManifest, clipStatus, clipProblems, formatMs, nearSegmentEdge, playableClips,
  recordingFromIndex, recordingGaps, reelsVisibleTo, validateManifest,
} from "./replay";
import { DEMO_EVENTS, mapEventToMedia } from "./replayEvents";
import {
  deleteClip, publishReel, recordExport, registerRecording, revalidateSegment, saveClip, saveReel, unpublishReel,
} from "./replayMock";

let n = 0;
const ctx = (viewer_id) => ({ now: `2026-10-22T22:${String(10 + (n++ % 49)).padStart(2, "0")}:00.000Z`, makeId: (p) => `${p}_${n}`, viewer_id });
const JORDAN = "viewer-jordan";
const RACHEL = "viewer-rachel";

function seeded() {
  const state = JSON.parse(JSON.stringify(initialState));
  return registerRecording(state, { index: FIXTURE_INDEX, game_id: "g7", title: "Bosque Blitz v Mesa Mavericks" }).next;
}

describe("replay/v1 model", () => {
  test("two segments with an exact five-minute recording gap; time is formatted honestly", () => {
    const recording = recordingFromIndex(FIXTURE_INDEX, { game_id: "g7", title: "t" });
    expect(recordingGaps(recording)).toEqual([{ after_segment_id: "rec-g7-s1", before_segment_id: "rec-g7-s2", gap_ms: 300000 }]);
    expect(recording.source_revision).toBe(`${H1}:${H2}`);
    const noStart = { ...recording, segments: recording.segments.map((s, i) => (i ? { ...s, recorded_start: null } : s)) };
    expect(recordingGaps(noStart)[0].gap_ms).toBeNull(); // unknown, never zero
    expect(formatMs(12345)).toBe("0:12.3");
    expect(formatMs(61000)).toBe("1:01.0");
    expect(() => recordingFromIndex({ schema: "x" }, { game_id: "g7" })).toThrow(/missing or unreadable/);
  });

  test("clip bounds: inside one segment, at least 0.5 s, never past the segment end", () => {
    const recording = recordingFromIndex(FIXTURE_INDEX, { game_id: "g7", title: "t" });
    const clip = (in_ms, out_ms, segment_id = "rec-g7-s1") => ({ segment_id, in_ms, out_ms, source_revision: H1 });
    expect(clipProblems(recording, clip(1000, 4000))).toEqual([]);
    expect(clipProblems(recording, clip(1000, 1200))[0]).toMatch(/at least 0.5 s/);
    expect(clipProblems(recording, clip(58000, 61000))[0]).toMatch(/after this segment ends \(1:00.0\)/);
    expect(clipProblems(recording, clip(-1, 3000))[0]).toMatch(/before the segment begins/);
    expect(clipProblems(recording, clip(0, 3000, "nope"))[0]).toMatch(/no longer exists/);
    expect(nearSegmentEdge(recording, clip(56000, 59500))).toBe(true);
    expect(nearSegmentEdge(recording, clip(20000, 25000))).toBe(false);
  });

  test("missing and replaced media are distinct, explicit states", () => {
    const recording = recordingFromIndex(FIXTURE_INDEX, { game_id: "g7", title: "t" });
    const clip = { segment_id: "rec-g7-s1", in_ms: 1000, out_ms: 3000, source_revision: H1 };
    expect(clipStatus(recording, clip).state).toBe("ok");
    expect(clipStatus(recording, clip, { "rec-g7-s1": { state: "missing" } }).state).toBe("media-missing");
    expect(clipStatus(recording, clip, { "rec-g7-s1": { state: "replaced" } }).state).toBe("needs-revalidation");
    expect(clipStatus(recording, { ...clip, source_revision: "c".repeat(64) }).state).toBe("needs-revalidation");
  });

  test("season2-events/v1 demo: mapped through anchors, a gap is reported, no period length assumed", () => {
    const recording = recordingFromIndex(FIXTURE_INDEX, { game_id: "g7", title: "t" });
    const [ev1, ev2, ev3, ev4] = DEMO_EVENTS.events;
    expect(mapEventToMedia(recording, ev1)).toEqual({ status: "mapped", segment_id: "rec-g7-s1", media_ms: 29000 });
    expect(mapEventToMedia(recording, ev2)).toMatchObject({ status: "in-gap" });
    expect(mapEventToMedia(recording, ev3)).toEqual({ status: "mapped", segment_id: "rec-g7-s2", media_ms: 25000 });
    expect(mapEventToMedia(recording, ev4)).toMatchObject({ status: "unanchored", reason: expect.stringMatching(/period 2/) });
    expect(mapEventToMedia(recording, { ...ev1, clock_ms: null }).status).toBe("unanchored");
  });
});

describe("replay authorship transitions", () => {
  test("three highlights (one near the gap), shorten, retag, reorder, publish; a second viewer sees only the snapshot", () => {
    let state = seeded();
    const rec = state.replayRecordings[0];
    const mk = (input) => { const r = saveClip(state, { recording_id: rec.id, ...input }, ctx(JORDAN)); state = r.next; return r.result; };
    const c1 = mk({ segment_id: "rec-g7-s1", in_ms: 12000, out_ms: 18000, title: "Opening drive", tags: { team_ids: ["t4"], profile_ids: ["p17"] } });
    const c2 = mk({ segment_id: "rec-g7-s1", in_ms: 55500, out_ms: 59800, title: "Right before the gap", tags: { team_ids: ["t4"] } });
    const c3 = mk({ segment_id: "rec-g7-s2", in_ms: 22000, out_ms: 30000, title: "Mavericks score", tags: { team_ids: ["t5"] } });
    // Shorten one, change a tag.
    const shorter = mk({ id: c3.id, segment_id: "rec-g7-s2", in_ms: 23500, out_ms: 28000, title: c3.title, tags: { team_ids: ["t5"], profile_ids: ["p22"] } });
    expect(shorter).toMatchObject({ in_ms: 23500, out_ms: 28000, tags: { team_ids: ["t5"], profile_ids: ["p22"] }, created_at: c3.created_at });
    // Reel in a custom order, then reorder.
    let reel = saveReel(state, { game_id: "g7", recording_id: rec.id, title: "Jordan's reel", clip_ids: [c1.id, c2.id, c3.id] }, ctx(JORDAN));
    state = reel.next;
    reel = saveReel(state, { id: reel.result.id, game_id: "g7", recording_id: rec.id, title: "Jordan's reel", clip_ids: [c3.id, c1.id, c2.id] }, ctx(JORDAN));
    state = reel.next;
    expect(state.replayReels[0].clip_ids).toEqual([c3.id, c1.id, c2.id]);

    // Drafts are private.
    expect(reelsVisibleTo(state, "g7", RACHEL)).toEqual({ mine: [], shared: [] });
    state = publishReel(state, reel.result.id, ctx(JORDAN)).next;
    const samView = reelsVisibleTo(state, "g7", RACHEL).shared[0];
    expect(samView.view).toBe("published-snapshot");
    expect(playableClips(state, samView, RACHEL).map((c) => c.id)).toEqual([c3.id, c1.id, c2.id]);
    // Jordan keeps editing the draft; Rachel still sees the frozen snapshot.
    state = saveClip(state, { id: c1.id, recording_id: rec.id, segment_id: "rec-g7-s1", in_ms: 14000, out_ms: 16000, title: "Edited later" }, ctx(JORDAN)).next;
    const frozen = playableClips(state, reelsVisibleTo(state, "g7", RACHEL).shared[0], RACHEL).find((c) => c.id === c1.id);
    expect(frozen).toMatchObject({ in_ms: 12000, out_ms: 18000, title: "Opening drive" });

    // Rachel cannot edit Jordan's work.
    expect(() => saveClip(state, { id: c1.id, recording_id: rec.id, segment_id: "rec-g7-s1", in_ms: 0, out_ms: 5000 }, ctx(RACHEL))).toThrow(/your own highlights/);
    expect(() => saveReel(state, { id: reel.result.id, game_id: "g7", recording_id: rec.id, clip_ids: [] }, ctx(RACHEL))).toThrow(/your own reels/);
    expect(() => saveReel(state, { game_id: "g7", recording_id: rec.id, clip_ids: [c1.id] }, ctx(RACHEL))).toThrow(/your own highlights/);
    expect(() => publishReel(state, reel.result.id, ctx(RACHEL))).toThrow(/author/);
    expect(() => deleteClip(state, c1.id, ctx(RACHEL))).toThrow(/your own/);
    state = unpublishReel(state, reel.result.id, ctx(JORDAN)).next;
    expect(reelsVisibleTo(state, "g7", RACHEL).shared).toEqual([]);
  });

  test("clip rules: no cross-segment move, no bridging the gap, valid bounds only", () => {
    let state = seeded();
    const rec = state.replayRecordings[0];
    const c = saveClip(state, { recording_id: rec.id, segment_id: "rec-g7-s1", in_ms: 1000, out_ms: 3000 }, ctx(JORDAN));
    state = c.next;
    expect(() => saveClip(state, { id: c.result.id, recording_id: rec.id, segment_id: "rec-g7-s2", in_ms: 1000, out_ms: 3000 }, ctx(JORDAN))).toThrow(/another segment/);
    expect(() => saveClip(state, { recording_id: rec.id, segment_id: "rec-g7-s1", in_ms: 58000, out_ms: 65000 }, ctx(JORDAN))).toThrow(/after this segment ends/);
    expect(() => saveClip(state, { recording_id: rec.id, segment_id: "rec-g7-s1", in_ms: 1000, out_ms: 3000 }, ctx(null))).toThrow(/viewing as/);
    expect(() => registerRecording(state, { index: FIXTURE_INDEX, game_id: "g7", title: "x" })).toThrow(/already has/);
  });

  test("replaced footage: clips need explicit revalidation; out-of-bounds clips stay blocked", () => {
    let state = seeded();
    const rec = state.replayRecordings[0];
    const keep = saveClip(state, { recording_id: rec.id, segment_id: "rec-g7-s2", in_ms: 1000, out_ms: 4000 }, ctx(JORDAN)); state = keep.next;
    const late = saveClip(state, { recording_id: rec.id, segment_id: "rec-g7-s2", in_ms: 40000, out_ms: 44000 }, ctx(JORDAN)); state = late.next;
    const NEW = "d".repeat(64);
    const out = revalidateSegment(state, { recording_id: rec.id, segment_id: "rec-g7-s2", sha256: NEW, duration_ms: 30000 }, ctx(JORDAN));
    expect(out.result).toEqual({ revalidated: [keep.result.id], blocked: [late.result.id] });
    const next = out.next;
    const recording = next.replayRecordings[0];
    expect(clipStatus(recording, next.replayClips.find((c) => c.id === keep.result.id)).state).toBe("ok");
    expect(clipStatus(recording, next.replayClips.find((c) => c.id === late.result.id)).state).toBe("needs-revalidation");
    expect(() => saveClip(next, { id: late.result.id, recording_id: rec.id, segment_id: "rec-g7-s2", in_ms: 1000, out_ms: 2000 }, ctx(JORDAN))).toThrow(/Revalidate/);
  });

  test("reel-manifest/v1: exact items in reel order; refuses empty, stale or unknown formats", () => {
    let state = seeded();
    const rec = state.replayRecordings[0];
    const a = saveClip(state, { recording_id: rec.id, segment_id: "rec-g7-s1", in_ms: 12000, out_ms: 18000, title: "A" }, ctx(JORDAN)); state = a.next;
    const b = saveClip(state, { recording_id: rec.id, segment_id: "rec-g7-s2", in_ms: 23500, out_ms: 28000, title: "B" }, ctx(JORDAN)); state = b.next;
    const reel = saveReel(state, { game_id: "g7", recording_id: rec.id, title: "R", clip_ids: [b.result.id, a.result.id] }, ctx(JORDAN)); state = reel.next;
    const { manifest } = buildReelManifest(state, reel.result, { format: "mp4", owner_id: JORDAN, now: "2026-10-22T22:00:00Z" });
    expect(manifest.items.map((i) => [i.order, i.segment_id, i.in_ms, i.out_ms, i.duration_ms])).toEqual([[1, "rec-g7-s2", 23500, 28000, 4500], [2, "rec-g7-s1", 12000, 18000, 6000]]);
    expect(manifest.total_duration_ms).toBe(10500);
    expect(manifest.output).toMatchObject({ container: "mp4", video: "h264", audio: "aac" });
    expect(validateManifest(manifest)).toEqual([]);
    expect(validateManifest({ ...manifest, items: [{ ...manifest.items[0], media_path: "../../etc/passwd" }] })[0]).toMatch(/registered replay file/);
    expect(buildReelManifest(state, reel.result, { format: "avi", owner_id: JORDAN }).error).toMatch(/MP4 or WebM/);
    const emptied = saveReel(state, { id: reel.result.id, game_id: "g7", recording_id: rec.id, clip_ids: [] }, ctx(JORDAN)).next;
    expect(buildReelManifest(emptied, emptied.replayReels[0], { format: "mp4", owner_id: JORDAN }).error).toMatch(/at least one/);
    state = recordExport(state, reel.result.id, { state: "done", format: "mp4" }, ctx(JORDAN)).next;
    expect(state.replayReels[0].last_export).toEqual({ state: "done", format: "mp4" });
  });
});
