import { initialState } from "../data/seed";
import { registerRecording, saveClip, revalidateSegment } from "./replayMock";
import { blockingProblems, buildFilmSequence, canonicalSpec, contextLines } from "./film";
import { adoptUpdatedHighlight, createFilm, filmsOwnedBy, recordEdition, saveFilm, updateContext } from "./filmMock";
import { FIXTURE_INDEX } from "./__fixtures__/replayIndex";

const hex = (c) => c.repeat(64);
const G8 = { schema: "replay-media-index/v1", game_id: "g8", segments: [{ id: "rec-g8-s1", label: "Game 2 · Segment A", path: "replay-media/rec-g8-s1.webm", sha256: hex("8"), bytes: 1, duration_ms: 40000, width: 640, height: 360, fps: 30, has_audio: true, recorded_start: "2026-06-14T19:20:00-06:00", anchors: [] }] };
const G10 = { schema: "replay-media-index/v1", game_id: "g10", segments: [{ id: "rec-g10-s1", label: "Final · Phone", path: "replay-media/rec-g10-s1.webm", sha256: hex("f"), bytes: 1, duration_ms: 30000, width: 360, height: 640, fps: 30, has_audio: true, recorded_start: "2026-06-26T20:31:00-06:00", anchors: [] }] };
const JORDAN = "viewer-jordan";
const RACHEL = "viewer-rachel";
let n = 0;
const ctx = (viewer_id = JORDAN) => ({ now: `2026-10-23T00:${String(10 + (n++ % 49)).padStart(2, "0")}:00.000Z`, makeId: (p) => `${p}_${n}`, viewer_id });

function world() {
  let s = JSON.parse(JSON.stringify(initialState));
  s = registerRecording(s, { index: FIXTURE_INDEX, game_id: "g7", title: "g7" }).next;
  s = registerRecording(s, { index: G8, game_id: "g8", title: "g8" }).next;
  s = registerRecording(s, { index: G10, game_id: "g10", title: "g10" }).next;
  const clip = (recording_id, segment_id, in_ms, out_ms, title) => {
    const r = saveClip(s, { recording_id, segment_id, in_ms, out_ms, title }, ctx());
    s = r.next;
    return r.result;
  };
  const c7 = clip("rec-g7", "rec-g7-s1", 12000, 18000, "Opening drive");
  const c8 = clip("rec-g8", "rec-g8-s1", 10000, 13000, "Deep ball");
  const c10 = clip("rec-g10", "rec-g10-s1", 5000, 9000, "Title catch");
  return { get s() { return s; }, set s(v) { s = v; }, c7, c8, c10 };
}

function storyFilm(w) {
  let film = createFilm(w.s, { title: "Bosque Blitz: our season" }, ctx()).next;
  w.s = film;
  film = w.s.filmCompositions[0];
  const composition = {
    ...film,
    title_card: { show: true, subtitle: "Summer 2026" },
    chapters: [
      { id: "ch1", title: "Opening night", card_ms: 2000, items: [
        { id: "i1", kind: "context", game_id: "g7", ms: 3000, note: { text: "Our first game together" } },
        { id: "i2", kind: "moment", clip_id: w.c7.id, caption: { text: "First drive of the year" }, hold: { ms: 1500, comment: "Watch the left side" }, audio: "source" },
      ] },
      { id: "ch2", title: "The final", card_ms: 2000, items: [
        { id: "i3", kind: "moment", clip_id: w.c10.id, caption: null, hold: null, audio: "mute" },
        { id: "i4", kind: "moment", clip_id: w.c8.id, caption: { text: "Earlier, game two" }, hold: null, audio: "source" },
      ] },
    ],
  };
  w.s = saveFilm(w.s, composition, ctx()).next;
  return w.s.filmCompositions[0];
}

describe("film-composition/v1 → film-sequence/v1", () => {
  test("one effective sequence: order, durations, cards, captions, silent hold, mute, mixed games", () => {
    const w = world();
    const film = storyFilm(w);
    const seq = buildFilmSequence(w.s, film);
    expect(seq.items.map((i) => `${i.kind}:${i.role || i.audio}:${i.ms}`)).toEqual([
      "card:title:2500", "card:chapter:2000", "card:context:3000", "clip:source:6000", "hold:silence:1500",
      "card:chapter:2000", "clip:mute:4000", "clip:source:3000",
    ]);
    expect(seq.total_ms).toBe(24000);
    expect(seq.items.map((i) => i.t0)).toEqual([0, 2500, 4500, 7500, 13500, 15000, 17000, 21000]);
    expect(seq.items[3].caption).toEqual({ text: "First drive of the year", authored: true });
    expect(seq.items[4].media.at_ms).toBe(18000); // the frozen frame is the clip's last
    expect(seq.items[4].comment.authored).toBe(true);
    expect(seq.items[2].lines.map((l) => l.text)).toEqual(["Mesa Mavericks @ Bosque Blitz", "Jun 7, 2026", "Final 14–21", "Note: Our first game together"]);
    expect(seq.items[6].media).toMatchObject({ path: "replay-media/rec-g10-s1.webm", width: 360, height: 640, in_ms: 5000, out_ms: 9000 });
    expect(seq.problems).toEqual([]);
  });

  test("unknown values stay unknown; nothing is invented for a better story", () => {
    const lines = contextLines({ starts_at: null, home_team: "Bosque Blitz", away_team: null, home_score: null, away_score: null }, null);
    expect(lines.map((l) => l.text)).toEqual(["Bosque Blitz", "Date not recorded", "Score not recorded", "Fictional demo league data"]);
  });

  test("canonical spec excludes timing offsets and provenance refs, and is stable", () => {
    const w = world();
    const film = storyFilm(w);
    const a = canonicalSpec(buildFilmSequence(w.s, film));
    expect(a).toBe(canonicalSpec(buildFilmSequence(w.s, film)));
    expect(a).not.toMatch(/"t0"|"ref"/);
  });

  test("replaced footage blocks the moment until relinked in L1 and deliberately adopted", () => {
    const w = world();
    const film = storyFilm(w);
    w.s = revalidateSegment(w.s, { recording_id: "rec-g8", segment_id: "rec-g8-s1", sha256: hex("9"), duration_ms: 40000 }, ctx()).next;
    let seq = buildFilmSequence(w.s, film);
    expect(blockingProblems(seq).map((p) => [p.item_id, p.code])).toEqual([["i4", "replaced"]]);
    expect(seq.items.some((i) => i.ref?.item_id === "i4")).toBe(false); // excluded, never silently rendered
    w.s = adoptUpdatedHighlight(w.s, { film_id: film.id, item_id: "i4" }, ctx()).next;
    seq = buildFilmSequence(w.s, w.s.filmCompositions[0]);
    expect(blockingProblems(seq)).toEqual([]);
    expect(seq.items.find((i) => i.ref?.item_id === "i4").media.sha256).toBe(hex("9"));
  });

  test("an L1 edit flags the moment softly; the pinned revision renders until the author adopts the new one", () => {
    const w = world();
    const film = storyFilm(w);
    w.s = saveClip(w.s, { id: w.c7.id, recording_id: "rec-g7", segment_id: "rec-g7-s1", in_ms: 13000, out_ms: 16000, title: "Opening drive" }, ctx()).next;
    let seq = buildFilmSequence(w.s, film);
    expect(seq.problems.find((p) => p.item_id === "i2")).toMatchObject({ code: "clip-changed", soft: true });
    expect(seq.items.find((i) => i.ref?.item_id === "i2").media).toMatchObject({ in_ms: 12000, out_ms: 18000 });
    w.s = adoptUpdatedHighlight(w.s, { film_id: film.id, item_id: "i2" }, ctx()).next;
    seq = buildFilmSequence(w.s, w.s.filmCompositions[0]);
    expect(seq.items.find((i) => i.ref?.item_id === "i2").media).toMatchObject({ in_ms: 13000, out_ms: 16000 });
    expect(seq.problems).toEqual([]);
  });

  test("a corrected game record blocks the context card until it is deliberately updated", () => {
    const w = world();
    const film = storyFilm(w);
    w.s = { ...w.s, games: w.s.games.map((g) => (g.id === "g7" ? { ...g, away_score: 13 } : g)) };
    let seq = buildFilmSequence(w.s, film);
    expect(seq.problems[0]).toMatchObject({ code: "context-outdated", item_id: "i1" });
    expect(seq.problems[0].soft).toBeUndefined();
    expect(blockingProblems(seq)).toHaveLength(1); // the render is refused, not silently wrong
    expect(seq.items.some((i) => i.role === "context")).toBe(false); // the stale card is left out
    // A client cannot slip in a hand-made record: saves keep the stored snapshot.
    const forged = { ...film, chapters: film.chapters.map((ch) => ({ ...ch, items: ch.items.map((it) => (it.id === "i1" ? { ...it, record: { ...it.record, away_score: 99 } } : it)) })) };
    w.s = saveFilm(w.s, forged, ctx()).next;
    expect(w.s.filmCompositions[0].chapters[0].items[0].record.away_score).toBe(14);
    w.s = updateContext(w.s, { film_id: film.id, item_id: "i1" }, ctx()).next;
    seq = buildFilmSequence(w.s, w.s.filmCompositions[0]);
    expect(seq.items[2].lines[2].text).toBe("Final 13–21");
    expect(seq.problems).toEqual([]);
  });

  test("fill-crop on a portrait source is flagged with how much is lost; letterbox is not", () => {
    const w = world();
    const film = storyFilm(w);
    const cropped = buildFilmSequence(w.s, { ...film, settings: { ...film.settings, fit: "fill-crop" } });
    expect(cropped.problems.find((p) => p.code === "crop").text).toMatch(/keeps only 32%/);
    expect(buildFilmSequence(w.s, film).problems.some((p) => p.code === "crop")).toBe(false);
  });

  test("films are private, clips must be the author's, and finished editions are never rewritten", () => {
    const w = world();
    const film = storyFilm(w);
    expect(filmsOwnedBy(w.s, RACHEL)).toEqual([]);
    expect(() => saveFilm(w.s, film, ctx(RACHEL))).toThrow(/your own films/);
    const rachelClip = saveClip(w.s, { recording_id: "rec-g8", segment_id: "rec-g8-s1", in_ms: 1000, out_ms: 3000 }, ctx(RACHEL));
    w.s = rachelClip.next;
    const bad = { ...film, chapters: [{ ...film.chapters[0], items: [{ id: "x", kind: "moment", clip_id: rachelClip.result.id, audio: "source" }] }] };
    expect(() => saveFilm(w.s, bad, ctx())).toThrow(/your own highlights/);
    let e = recordEdition(w.s, { film_id: film.id, edition: { id: "ed1", state: "rendering" } }, ctx());
    w.s = e.next;
    expect(e.result.number).toBe(1);
    w.s = recordEdition(w.s, { film_id: film.id, edition: { id: "ed1", state: "done", file: "edition-1-a.mp4" } }, ctx()).next;
    expect(() => recordEdition(w.s, { film_id: film.id, edition: { id: "ed1", state: "failed" } }, ctx())).toThrow(/never rewritten/);
    e = recordEdition(w.s, { film_id: film.id, edition: { id: "ed2", state: "canceled" } }, ctx());
    expect(e.result.number).toBe(2);
    // Saving the authoring state never touches editions.
    const saved = saveFilm(e.next, { ...film, editions: [] }, ctx()).next.filmCompositions[0];
    expect(saved.editions.map((x) => [x.number, x.state])).toEqual([[1, "done"], [2, "canceled"]]);
  });

  test("pinned highlights are never taken from the client; a new moment pins the current highlight", () => {
    const w = world();
    const film = storyFilm(w);
    const pinned = film.chapters[0].items[1].clip_ref;
    const forged = { ...film, chapters: film.chapters.map((ch) => ({ ...ch, items: ch.items.map((it) => (it.id === "i2" ? { ...it, clip_ref: { ...it.clip_ref, in_ms: 0, out_ms: 40000, segment_id: "rec-g8-s1" } } : it)) })) };
    w.s = saveFilm(w.s, forged, ctx()).next;
    expect(w.s.filmCompositions[0].chapters[0].items[1].clip_ref).toEqual(pinned);
    const added = { ...film, chapters: [{ ...film.chapters[0], items: [{ id: "new", kind: "moment", clip_id: w.c8.id, clip_ref: { recording_id: "rec-g7", in_ms: 0, out_ms: 1 }, audio: "source" }] }] };
    const ref = saveFilm(w.s, added, ctx()).next.filmCompositions[0].chapters[0].items[0].clip_ref;
    expect(ref).toMatchObject({ recording_id: "rec-g8", segment_id: "rec-g8-s1", in_ms: 10000, out_ms: 13000 });
  });

  test("the context card shows the record's own year in league time", () => {
    expect(contextLines({ starts_at: "2027-06-08T01:30:00Z", home_team: "A", away_team: "B", home_score: 1, away_score: 2 }, null)[1].text).toBe("Jun 7, 2027");
  });

  test("a recording gap is never bridged: moments either side stay separate clips inside their own segments", () => {
    const w = world();
    const before = saveClip(w.s, { recording_id: "rec-g7", segment_id: "rec-g7-s1", in_ms: 55500, out_ms: 59800, title: "Right before the gap" }, ctx());
    w.s = before.next;
    const after = saveClip(w.s, { recording_id: "rec-g7", segment_id: "rec-g7-s2", in_ms: 0, out_ms: 4000, title: "Right after the gap" }, ctx());
    w.s = after.next;
    w.s = createFilm(w.s, { title: "Gap" }, ctx()).next;
    const film = w.s.filmCompositions[0];
    w.s = saveFilm(w.s, { ...film, chapters: [{ ...film.chapters[0], items: [
      { id: "g1", kind: "moment", clip_id: before.result.id, audio: "source" },
      { id: "g2", kind: "moment", clip_id: after.result.id, audio: "source" },
    ] }] }, ctx()).next;
    const seq = buildFilmSequence(w.s, w.s.filmCompositions[0]);
    const clips = seq.items.filter((i) => i.kind === "clip");
    expect(clips.map((c) => [c.media.path, c.media.in_ms, c.media.out_ms, c.ms])).toEqual([
      ["replay-media/rec-g7-s1.webm", 55500, 59800, 4300],
      ["replay-media/rec-g7-s2.webm", 0, 4000, 4000],
    ]);
    // Consecutive in the film, but nothing claims the five unrecorded minutes.
    expect(seq.items.indexOf(clips[1])).toBe(seq.items.indexOf(clips[0]) + 1);
    expect(seq.total_ms).toBe(seq.items.reduce((n, i) => n + i.ms, 0));
    expect(seq.problems).toEqual([]);
    // A pin that no longer fits its segment (e.g. reaching into the gap) is blocked, not rendered.
    const stored = w.s.filmCompositions[0];
    const stretched = { ...stored, chapters: stored.chapters.map((ch) => ({ ...ch, items: ch.items.map((it) => (it.id === "g1" ? { ...it, clip_ref: { ...it.clip_ref, out_ms: 61000 } } : it)) })) };
    const blocked = buildFilmSequence(w.s, stretched);
    expect(blocked.problems.find((p) => p.item_id === "g1")).toMatchObject({ code: "bounds" });
    expect(blockingProblems(blocked).length).toBeGreaterThan(0);
    expect(blocked.items.filter((i) => i.kind === "clip").map((c) => c.media.path)).toEqual(["replay-media/rec-g7-s2.webm"]);
  });
});

