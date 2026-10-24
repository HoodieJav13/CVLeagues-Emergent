import { initialState } from "../data/seed";
import { migrateMockState } from "../context/mockState";
import { registerRecording, revalidateSegment } from "./replayMock";
import {
  ANNOTATION_SCHEMA, MAX_ANNOTATION_TEXT, annotationStatus, annotationsFor, canJump, deleteAnnotation, relinkAnnotation, saveAnnotation,
} from "./replayAnnotations";
import { FIXTURE_INDEX, H1 } from "./__fixtures__/replayIndex";

const hex = (c) => c.repeat(64);
const G8 = { schema: "replay-media-index/v1", game_id: "g8", segments: [{ id: "rec-g8-s1", label: "Game 2 · Segment A", path: "replay-media/rec-g8-s1.webm", sha256: hex("8"), bytes: 1, duration_ms: 40000, width: 640, height: 360, fps: 30, has_audio: true, recorded_start: null, anchors: [] }] };
const JORDAN = "viewer-jordan";
const RACHEL = "viewer-rachel";
let n = 0;
const ctx = (viewer_id = JORDAN) => ({ now: `2026-10-24T18:${String(10 + (n++ % 49)).padStart(2, "0")}:00.000Z`, makeId: (p) => `${p}_${n}`, viewer_id });

function world() {
  let s = JSON.parse(JSON.stringify(initialState));
  s = registerRecording(s, { index: FIXTURE_INDEX, game_id: "g7", title: "g7" }).next;
  s = registerRecording(s, { index: G8, game_id: "g8", title: "g8" }).next;
  return s;
}
const at = (segment_id, media_ms) => ({ state: "linked", segment_id, media_ms });
const log = (s, input, viewer = JORDAN) => saveAnnotation(s, { game_id: "g7", recording_id: "rec-g7", ...input }, ctx(viewer));
// Everything except the annotation collection, serialised: must be byte-identical.
const outsideAnnotations = (s) => JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => k !== "replayAnnotations").sort(([a], [b]) => a.localeCompare(b))));

describe("replay-annotation/v1: manual recording-time game log", () => {
  test("create, edit, delete, and survive a store reload; immutable identity, revision counts edits", () => {
    let s = world();
    const created = log(s, { link: at("rec-g7-s1", 12345.4), text: "Deep ball to the left side", tags: { team_ids: ["t4"], profile_ids: ["p17"] }, game_clock: { period: 1, clock_ms: 405000 } });
    s = created.next;
    expect(created.result).toMatchObject({ schema: ANNOTATION_SCHEMA, game_id: "g7", recording_id: "rec-g7", author_id: JORDAN, revision: 1,
      link: { state: "linked", segment_id: "rec-g7-s1", media_ms: 12345, source_revision: H1, relinked_from: null }, game_clock: { period: 1, clock_ms: 405000 } });
    const id = created.result.id;
    // Reload through the versioned store migration.
    s = migrateMockState(JSON.parse(JSON.stringify(s)));
    expect(annotationsFor(s, "g7", JORDAN).map((a) => a.id)).toEqual([id]);
    const edited = saveAnnotation(s, { id, text: "Deep ball, left side", game_id: "g8", author_id: RACHEL }, ctx());
    s = edited.next;
    expect(edited.result).toMatchObject({ id, game_id: "g7", author_id: JORDAN, created_at: created.result.created_at, revision: 2, text: "Deep ball, left side" });
    expect(edited.result.link).toEqual(created.result.link); // a text edit never re-times
    s = deleteAnnotation(s, id, { viewer_id: JORDAN }).next;
    expect(annotationsFor(s, "g7", JORDAN)).toEqual([]);
    // Older stores without the collection load with an empty one.
    const { replayAnnotations, ...old } = s;
    expect(migrateMockState(old).replayAnnotations).toEqual([]);
  });

  test("scores, stats, edit history and the ledger are byte-identical across every transition", () => {
    let s = world();
    const before = outsideAnnotations(s);
    const a = log(s, { link: at("rec-g7-s1", 5000), text: "Touchdown, 7–0", tags: { team_ids: ["t4"] } });
    s = a.next;
    expect(outsideAnnotations(s)).toBe(before);
    s = saveAnnotation(s, { id: a.result.id, text: "Correction: it was called back", link: at("rec-g7-s1", 6000) }, ctx()).next;
    expect(outsideAnnotations(s)).toBe(before);
    s = deleteAnnotation(s, a.result.id, { viewer_id: JORDAN }).next;
    expect(outsideAnnotations(s)).toBe(before);
    const g7 = s.games.find((g) => g.id === "g7");
    expect([g7.home_score, g7.away_score, g7.score_status]).toEqual([21, 14, "approved"]);
  });

  test("private and per game: other viewers and other games never see or change it", () => {
    let s = world();
    const mine = log(s, { link: at("rec-g7-s1", 1000), text: "Mine" });
    s = mine.next;
    expect(annotationsFor(s, "g7", RACHEL)).toEqual([]);
    expect(annotationsFor(s, "g8", JORDAN)).toEqual([]);
    expect(() => saveAnnotation(s, { id: mine.result.id, text: "Hijack" }, ctx(RACHEL))).toThrow(/your own/);
    expect(() => deleteAnnotation(s, mine.result.id, { viewer_id: RACHEL })).toThrow(/your own/);
    expect(() => saveAnnotation(s, { game_id: "g8", recording_id: "rec-g7", link: at("rec-g7-s1", 1000), text: "x" }, ctx())).toThrow(/different game/);
    expect(() => saveAnnotation(s, { game_id: "g8", recording_id: "rec-g8", link: at("rec-g7-s1", 1000), text: "x" }, ctx())).toThrow(/segment of this game/);
  });

  test("invalid, negative, non-finite and out-of-range times are refused; state is untouched", () => {
    const s = world();
    for (const ms of [-1, -0.6, 60001, Infinity, NaN, "1000", null]) {
      expect(() => log(s, { link: at("rec-g7-s1", ms), text: "x" })).toThrow();
    }
    expect(log(s, { link: at("rec-g7-s1", 60000), text: "last frame" }).result.link.media_ms).toBe(60000);
    expect(() => log(s, { link: at("rec-g7-s3", 10), text: "x" })).toThrow(/segment/);
    expect(() => log(s, { link: { state: "linked" }, text: "x" })).toThrow();
    expect(() => log(s, { text: "no link at all" })).toThrow(/recording time/);
    expect(() => log(s, { link: at("rec-g7-s1", 10), text: "x".repeat(MAX_ANNOTATION_TEXT + 1) })).toThrow(/140/);
    expect(() => log(s, { link: at("rec-g7-s1", 10), text: "   " })).toThrow(/Write what happened/);
    for (const clock of [{ period: 0, clock_ms: 1 }, { period: 1, clock_ms: -1 }, { period: 1.5, clock_ms: 1 }, { period: 1, clock_ms: 3600001 }]) {
      expect(() => log(s, { link: at("rec-g7-s1", 10), text: "x", game_clock: clock })).toThrow(/game clock/);
    }
    expect(s.replayAnnotations).toBeUndefined();
  });

  test("a recording gap and an unrecorded moment are honest unlinked entries, never bridged or given a clock", () => {
    let s = world();
    const gap = log(s, { link: { state: "unlinked", reason: "in-gap", gap: { after_segment_id: "rec-g7-s1", before_segment_id: "rec-g7-s2" } }, text: "Score during the camera swap", tags: { team_ids: ["t5"] } });
    s = gap.next;
    expect(gap.result.link).toEqual({ state: "unlinked", reason: "in-gap", gap: { after_segment_id: "rec-g7-s1", before_segment_id: "rec-g7-s2" } });
    expect(gap.result.game_clock).toBeNull();
    const rec = s.replayRecordings.find((r) => r.id === "rec-g7");
    const st = annotationStatus(rec, gap.result);
    expect(st.state).toBe("unlinked");
    expect(st.reason).toMatch(/between Segment A and Segment B/);
    expect(canJump(st)).toBe(false);
    expect(() => log(s, { link: { state: "unlinked", reason: "in-gap", gap: { after_segment_id: "rec-g7-s2", before_segment_id: "rec-g7-s1" } }, text: "x" })).toThrow(/gap/);
    expect(() => log(s, { link: { state: "unlinked", reason: "lost" }, text: "x" })).toThrow(/why/);
    const off = log(s, { link: { state: "unlinked", reason: "not-recorded" }, text: "Before the camera started" });
    expect(annotationStatus(rec, off.result).reason).toMatch(/Not on the recording/);
  });

  test("missing footage blocks jumping; replaced footage needs a deliberate relink at the SAME time", () => {
    let s = world();
    const a = log(s, { link: at("rec-g7-s1", 20000), text: "Flag pull" });
    s = a.next;
    let rec = s.replayRecordings.find((r) => r.id === "rec-g7");
    expect(annotationStatus(rec, a.result, { "rec-g7-s1": { state: "ok" } }).state).toBe("ok");
    expect(annotationStatus(rec, a.result, { "rec-g7-s1": { state: "missing" } }).state).toBe("media-missing");
    // Device file differs, registration not yet revalidated: relink must wait for Replay Studio.
    expect(annotationStatus(rec, a.result, { "rec-g7-s1": { state: "replaced" } }).state).toBe("needs-relink");
    expect(() => relinkAnnotation(s, a.result.id, { now: "2026-10-24T18:00:00.000Z", viewer_id: JORDAN })).toThrow(/already matches/);
    // Revalidated in L1 with new bytes: the stale revision is flagged, not trusted.
    s = revalidateSegment(s, { recording_id: "rec-g7", segment_id: "rec-g7-s1", sha256: hex("c"), duration_ms: 60000 }, { viewer_id: JORDAN }).next;
    rec = s.replayRecordings.find((r) => r.id === "rec-g7");
    const stale = annotationStatus(rec, s.replayAnnotations[0], { "rec-g7-s1": { state: "ok" } });
    expect(stale.state).toBe("needs-relink");
    expect(canJump(stale)).toBe(false);
    // A text edit does not silently adopt the new footage.
    s = saveAnnotation(s, { id: a.result.id, text: "Flag pull, sideline" }, ctx()).next;
    expect(annotationStatus(rec, s.replayAnnotations[0]).state).toBe("needs-relink");
    expect(() => relinkAnnotation(s, a.result.id, { now: "2026-10-24T18:00:00.000Z", viewer_id: RACHEL })).toThrow(/your own/);
    const relinked = relinkAnnotation(s, a.result.id, { now: "2026-10-24T18:30:00.000Z", viewer_id: JORDAN });
    expect(relinked.result.link).toMatchObject({ segment_id: "rec-g7-s1", media_ms: 20000, source_revision: hex("c"), relinked_from: { source_revision: H1, at: "2026-10-24T18:30:00.000Z" } });
    expect(annotationStatus(rec, relinked.result).state).toBe("relinked");
    expect(canJump(annotationStatus(rec, relinked.result))).toBe(true);
  });

  test("shorter replacement footage leaves a late moment blocked, never moved", () => {
    let s = world();
    const a = log(s, { link: at("rec-g7-s1", 55000), text: "Late catch" });
    s = a.next;
    s = revalidateSegment(s, { recording_id: "rec-g7", segment_id: "rec-g7-s1", sha256: hex("d"), duration_ms: 50000 }, { viewer_id: JORDAN }).next;
    expect(() => relinkAnnotation(s, a.result.id, { now: "2026-10-24T18:00:00.000Z", viewer_id: JORDAN })).toThrow(/shorter/);
    const rec = s.replayRecordings.find((r) => r.id === "rec-g7");
    const relinkedAnyway = { ...s.replayAnnotations[0], link: { ...s.replayAnnotations[0].link, source_revision: hex("d") } };
    expect(annotationStatus(rec, relinkedAnyway).state).toBe("out-of-bounds");
    expect(s.replayAnnotations[0].link.media_ms).toBe(55000);
  });

  test("tags are stable ids from the game's own teams and rosters", () => {
    let s = world();
    expect(() => log(s, { link: at("rec-g7-s1", 10), tags: { team_ids: ["t6"] } })).toThrow(/two teams/);
    expect(() => log(s, { link: at("rec-g7-s1", 10), tags: { profile_ids: ["not-a-player"] } })).toThrow(/rosters/);
    const a = log(s, { link: at("rec-g7-s1", 10), tags: { team_ids: ["t4", "t4"], profile_ids: ["p17", "p17"] } });
    s = a.next;
    expect(a.result.tags).toEqual({ team_ids: ["t4"], profile_ids: ["p17"] });
    // Renaming the player changes nothing stored; dropping them from the roster
    // keeps the saved tag valid, so the entry can still be edited.
    s = { ...s, profiles: s.profiles.map((p) => (p.id === "p17" ? { ...p, name: "Renamed" } : p)), teamPlayers: s.teamPlayers.filter((tp) => tp.profile_id !== "p17") };
    const edited = saveAnnotation(s, { id: a.result.id, text: "Still them" }, ctx());
    expect(edited.result.tags.profile_ids).toEqual(["p17"]);
    expect(() => saveAnnotation(edited.next, { id: a.result.id, tags: { team_ids: ["t4"], profile_ids: ["p17", "not-a-player"] } }, ctx())).toThrow(/rosters/);
  });

  test("an unsupported version is kept byte-for-byte and read-only; deleted only by its author", () => {
    let s = world();
    const future = { schema: "replay-annotation/v9", id: "ann_future", game_id: "g7", recording_id: "rec-g7", author_id: JORDAN, created_at: "2026-10-24T18:00:00.000Z", link: { state: "linked", segment_id: "rec-g7-s1", media_ms: 1 }, extra: { kept: true } };
    s = { ...s, replayAnnotations: [future] };
    const loaded = migrateMockState(JSON.parse(JSON.stringify(s)));
    expect(loaded.replayAnnotations[0]).toEqual(future);
    const rec = s.replayRecordings.find((r) => r.id === "rec-g7");
    expect(annotationStatus(rec, future).state).toBe("unsupported");
    expect(() => saveAnnotation(s, { id: "ann_future", text: "edit" }, ctx())).toThrow(/unsupported/);
    expect(() => relinkAnnotation(s, "ann_future", { now: "x", viewer_id: JORDAN })).toThrow(/unsupported/);
    expect(() => deleteAnnotation(s, "ann_future", { viewer_id: RACHEL })).toThrow(/your own/);
    expect(deleteAnnotation(s, "ann_future", { viewer_id: JORDAN }).next.replayAnnotations).toEqual([]);
  });
});
