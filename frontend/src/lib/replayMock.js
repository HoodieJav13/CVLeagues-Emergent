import { MIN_CLIP_MS, clipProblems, recordingFromIndex, segmentById } from "./replay";

/* ============================================================================
 * Replay Studio: development mock-state transitions (pure).
 * ----------------------------------------------------------------------------
 * (state, input, ctx) → { next, result } or throw a plain Error whose message
 * is the user-facing refusal; a refusal leaves the last-good state untouched.
 * Collections live in the same versioned mock store as everything else
 * (replayRecordings, replayClips, replayReels). Every edit is checked against
 * the acting fictional viewer: nobody edits another viewer's draft.
 * ========================================================================== */

const list = (state, key) => (Array.isArray(state[key]) ? state[key] : []);
const upsert = (items, item) => (items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item]);
const cleanTags = (tags) => ({
  team_ids: [...new Set((tags?.team_ids || []).filter(Boolean))],
  profile_ids: [...new Set((tags?.profile_ids || []).filter(Boolean))],
});

export function registerRecording(state, { index, game_id, title }) {
  if (list(state, "replayRecordings").some((r) => r.game_id === game_id)) {
    throw new Error("This game already has a registered recording.");
  }
  if (!(state.games || []).some((g) => g.id === game_id)) throw new Error("That game no longer exists.");
  const recording = recordingFromIndex(index, { game_id, title });
  return { next: { ...state, replayRecordings: [...list(state, "replayRecordings"), recording] }, result: recording };
}

export function saveClip(state, input, { now, makeId, viewer_id }) {
  if (!viewer_id) throw new Error("Choose who you are viewing as first.");
  const recording = list(state, "replayRecordings").find((r) => r.id === input.recording_id);
  if (!recording) throw new Error("This recording is not registered.");
  const existing = input.id ? list(state, "replayClips").find((c) => c.id === input.id) : null;
  if (input.id && !existing) throw new Error("That highlight no longer exists.");
  if (existing && existing.owner_id !== viewer_id) throw new Error("You can only edit your own highlights.");
  const segment = segmentById(recording, input.segment_id);
  if (!segment) throw new Error("Choose a recording segment.");
  if (existing && existing.segment_id !== input.segment_id) throw new Error("A highlight cannot move to another segment; make a new one instead.");
  const clip = {
    id: existing?.id || makeId("clip"),
    recording_id: recording.id,
    segment_id: segment.id,
    // A new clip binds to the footage as registered now. An edit keeps the
    // revision it was made against: replaced footage needs Revalidate first.
    source_revision: existing ? existing.source_revision : segment.media.sha256,
    in_ms: Math.round(input.in_ms),
    out_ms: Math.round(input.out_ms),
    title: String(input.title || "").trim().slice(0, 80),
    tags: cleanTags(input.tags),
    owner_id: viewer_id,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  if (existing && existing.source_revision !== segment.media.sha256) {
    throw new Error("This footage was replaced. Revalidate the highlight before editing it.");
  }
  const problems = clipProblems(recording, clip);
  if (problems.length) throw new Error(problems.join(" "));
  return { next: { ...state, replayClips: upsert(list(state, "replayClips"), clip) }, result: clip };
}

export function deleteClip(state, id, { viewer_id }) {
  const clip = list(state, "replayClips").find((c) => c.id === id);
  if (!clip) throw new Error("That highlight no longer exists.");
  if (clip.owner_id !== viewer_id) throw new Error("You can only delete your own highlights.");
  const inReel = list(state, "replayReels").filter((r) => r.owner_id === viewer_id && r.clip_ids.includes(id));
  return {
    next: {
      ...state,
      replayClips: list(state, "replayClips").filter((c) => c.id !== id),
      // Remove it from the owner's draft orders; published snapshots keep their frozen copy.
      replayReels: list(state, "replayReels").map((r) => (inReel.includes(r) ? { ...r, clip_ids: r.clip_ids.filter((x) => x !== id) } : r)),
    },
    result: clip,
  };
}

export function saveReel(state, input, { now, makeId, viewer_id }) {
  if (!viewer_id) throw new Error("Choose who you are viewing as first.");
  const existing = input.id ? list(state, "replayReels").find((r) => r.id === input.id) : null;
  if (input.id && !existing) throw new Error("That reel no longer exists.");
  if (existing && existing.owner_id !== viewer_id) throw new Error("You can only edit your own reels.");
  const recording = list(state, "replayRecordings").find((r) => r.id === input.recording_id);
  if (!recording) throw new Error("This recording is not registered.");
  if (recording.game_id !== input.game_id) throw new Error("A reel belongs to the game its recording was made at.");
  const clips = list(state, "replayClips");
  const clip_ids = [...new Set(input.clip_ids || [])];
  clip_ids.forEach((id) => {
    const clip = clips.find((c) => c.id === id);
    if (!clip) throw new Error("A highlight in this reel no longer exists.");
    if (clip.owner_id !== viewer_id) throw new Error("A reel can only use your own highlights.");
    if (clip.recording_id !== input.recording_id) throw new Error("A reel uses highlights from one recording.");
  });
  const reel = {
    id: existing?.id || makeId("reel"),
    owner_id: viewer_id,
    game_id: input.game_id,
    recording_id: input.recording_id,
    title: String(input.title || "").trim().slice(0, 80) || "My highlights",
    clip_ids,
    status: existing?.status || "draft",
    published: existing?.published || null,
    last_export: existing?.last_export || null,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  return { next: { ...state, replayReels: upsert(list(state, "replayReels"), reel) }, result: reel };
}

export function publishReel(state, id, { now, viewer_id }) {
  const reel = list(state, "replayReels").find((r) => r.id === id);
  if (!reel) throw new Error("That reel no longer exists.");
  if (reel.owner_id !== viewer_id) throw new Error("Only the reel's author can publish it.");
  const clips = reel.clip_ids.map((cid) => list(state, "replayClips").find((c) => c.id === cid)).filter(Boolean);
  if (!clips.length) throw new Error("Add at least one highlight before sharing the reel.");
  const recording = list(state, "replayRecordings").find((r) => r.id === reel.recording_id);
  const stale = clips.find((c) => c.source_revision !== segmentById(recording, c.segment_id)?.media.sha256);
  if (stale) throw new Error("Revalidate replaced footage before sharing this reel.");
  const published = { at: now, title: reel.title, clips: clips.map((c) => ({ ...c })) };
  const next = { ...reel, status: "published", published, updated_at: now };
  return { next: { ...state, replayReels: upsert(list(state, "replayReels"), next) }, result: next };
}

export function unpublishReel(state, id, { now, viewer_id }) {
  const reel = list(state, "replayReels").find((r) => r.id === id);
  if (!reel) throw new Error("That reel no longer exists.");
  if (reel.owner_id !== viewer_id) throw new Error("Only the reel's author can stop sharing it.");
  const next = { ...reel, status: "draft", published: null, updated_at: now };
  return { next: { ...state, replayReels: upsert(list(state, "replayReels"), next) }, result: next };
}

// Explicit relink after a source file was replaced: adopt the new hash and
// duration for the segment, then mark each of the viewer's clips either
// revalidated (bounds still fit) or blocked (now out of bounds).
export function revalidateSegment(state, { recording_id, segment_id, sha256, duration_ms }, { viewer_id }) {
  const recording = list(state, "replayRecordings").find((r) => r.id === recording_id);
  const segment = segmentById(recording, segment_id);
  if (!segment) throw new Error("That recording segment no longer exists.");
  if (!/^[0-9a-f]{64}$/.test(sha256 || "") || !(duration_ms > MIN_CLIP_MS)) throw new Error("The replacement footage could not be read.");
  const nextRecording = {
    ...recording,
    segments: recording.segments.map((s) => (s.id === segment_id ? { ...s, media: { ...s.media, sha256, duration_ms } } : s)),
  };
  nextRecording.source_revision = nextRecording.segments.map((s) => s.media.sha256).join(":");
  const revalidated = [];
  const blocked = [];
  const clips = list(state, "replayClips").map((clip) => {
    if (clip.segment_id !== segment_id || clip.owner_id !== viewer_id) return clip;
    const moved = { ...clip, source_revision: sha256 };
    if (clipProblems(nextRecording, moved).length) { blocked.push(clip.id); return clip; }
    revalidated.push(clip.id);
    return moved;
  });
  return {
    next: { ...state, replayRecordings: upsert(list(state, "replayRecordings"), nextRecording), replayClips: clips },
    result: { revalidated, blocked },
  };
}

export function recordExport(state, reel_id, exportInfo, { viewer_id }) {
  const reel = list(state, "replayReels").find((r) => r.id === reel_id);
  if (!reel) throw new Error("That reel no longer exists.");
  if (reel.owner_id !== viewer_id) throw new Error("Only the reel's author can record an export.");
  const next = { ...reel, last_export: exportInfo };
  return { next: { ...state, replayReels: upsert(list(state, "replayReels"), next) }, result: next };
}
