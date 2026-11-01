/* ============================================================================
 * REPLAY STUDIO — pure model for replay/v1 and reel-manifest/v1.
 * ----------------------------------------------------------------------------
 * A recording is a set of ordered SEGMENTS (original media files). Recording
 * time inside a segment (media_ms) is the only authoritative position; optional
 * game-clock anchors are separate hints and never assume a period length.
 * Gaps between segments are derived from recorded_start + duration and are
 * never bridged: a clip lives inside exactly one segment.
 * Personal drafts belong to one fictional viewer; publishing freezes a
 * snapshot that other viewers see without inheriting later draft edits.
 * Nothing here reads the clock, the network or storage.
 * ========================================================================== */

export const REPLAY_SCHEMA = "replay/v1";
export const MANIFEST_SCHEMA = "reel-manifest/v1";
export const MIN_CLIP_MS = 500;
export const NUDGE_MS = 500;

// Fictional viewers for the local rehearsal. Ids are local personas, not
// accounts; profile ids point at fictional seed profiles.
export const REPLAY_VIEWERS = [
  { id: "viewer-jordan", name: "Jordan Sandoval (player · Bosque Blitz)", role: "player", profile_id: "p17", team_id: "t4" },
  { id: "viewer-rachel", name: "Rachel Duran (player · Mesa Mavericks)", role: "player", profile_id: "p22", team_id: "t5" },
  { id: "viewer-coach", name: "Coach Morgan (operator)", role: "operator", profile_id: null, team_id: null },
];

export const EXPORT_FORMATS = {
  mp4: { label: "MP4 (H.264 + AAC) — plays in QuickTime, Safari, phones, Chrome", container: "mp4", video: "h264", audio: "aac" },
  webm: { label: "WebM (VP9 + Opus) — plays in Chrome, Firefox, Edge", container: "webm", video: "vp9", audio: "opus" },
};

/* ------------------------------- formatting ------------------------------ */

export function formatMs(ms) {
  if (!Number.isFinite(ms)) return "—";
  const negative = ms < 0;
  const total = Math.abs(Math.round(ms / 100)) / 10; // tenths of a second
  const minutes = Math.floor(total / 60);
  const seconds = (total - minutes * 60).toFixed(1).padStart(4, "0");
  return `${negative ? "-" : ""}${minutes}:${seconds}`;
}

export const formatDuration = (ms) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/* -------------------------------- recordings ----------------------------- */

export const recordingFor = (state, game_id) =>
  (state.replayRecordings || []).find((recording) => recording.game_id === game_id) || null;

export const segmentById = (recording, segment_id) =>
  (recording?.segments || []).find((segment) => segment.id === segment_id) || null;

export const orderedSegments = (recording) =>
  [...(recording?.segments || [])].sort((a, b) => a.index - b.index);

// Gaps between consecutive segments in RECORDING time. Unknown when either
// side lacks a recorded_start: it is then reported as unknown, never as zero.
export function recordingGaps(recording) {
  const segments = orderedSegments(recording);
  const gaps = [];
  for (let i = 0; i < segments.length - 1; i += 1) {
    const a = segments[i];
    const b = segments[i + 1];
    const aStart = a.recorded_start ? Date.parse(a.recorded_start) : NaN;
    const bStart = b.recorded_start ? Date.parse(b.recorded_start) : NaN;
    const gap_ms = Number.isFinite(aStart) && Number.isFinite(bStart) ? bStart - (aStart + a.media.duration_ms) : null;
    gaps.push({ after_segment_id: a.id, before_segment_id: b.id, gap_ms });
  }
  return gaps;
}

// The registered fixture index (written by the media generator) becomes a
// replay/v1 recording for one game. Pure: the caller supplies the index.
export function recordingFromIndex(index, { game_id, title }) {
  if (!index || index.schema !== "replay-media-index/v1" || !Array.isArray(index.segments) || !index.segments.length) {
    throw new Error("The recording index is missing or unreadable.");
  }
  const segments = index.segments.map((segment, i) => ({
    id: segment.id,
    index: i,
    label: segment.label,
    media: {
      path: segment.path,
      sha256: segment.sha256,
      bytes: segment.bytes,
      duration_ms: segment.duration_ms,
      width: segment.width,
      height: segment.height,
      fps: segment.fps,
      has_audio: Boolean(segment.has_audio),
    },
    recorded_start: segment.recorded_start || null,
    anchors: Array.isArray(segment.anchors) ? segment.anchors : [],
  }));
  return {
    schema: REPLAY_SCHEMA,
    id: `rec-${game_id}`,
    game_id,
    title,
    source_revision: segments.map((segment) => segment.media.sha256).join(":"),
    provenance: { kind: "synthetic-original", generator: index.generator || "tools/replay/make_fixture_media.py", note: "Fictional, generated locally" },
    segments,
  };
}

/* ---------------------------------- clips -------------------------------- */

// Problems with a clip's bounds against its segment. Empty means valid.
export function clipProblems(recording, clip) {
  const problems = [];
  const segment = segmentById(recording, clip?.segment_id);
  if (!segment) return ["The clip's recording segment no longer exists."];
  const { in_ms, out_ms } = clip;
  if (!Number.isFinite(in_ms) || !Number.isFinite(out_ms)) problems.push("Mark both a start and an end.");
  else {
    if (in_ms < 0) problems.push("The start is before the segment begins.");
    if (out_ms > segment.media.duration_ms) problems.push(`The end is after this segment ends (${formatMs(segment.media.duration_ms)}).`);
    if (out_ms - in_ms < MIN_CLIP_MS) problems.push(`A highlight must be at least ${MIN_CLIP_MS / 1000} s long.`);
  }
  return problems;
}

// Clip availability against what the browser found for each segment:
// mediaStatus[segment_id] = { state: "ok"|"missing"|"replaced"|"checking", sha256, duration_ms }.
export function clipStatus(recording, clip, mediaStatus = {}) {
  const segment = segmentById(recording, clip.segment_id);
  if (!segment) return { state: "orphaned", reason: "Its recording segment no longer exists." };
  const media = mediaStatus[segment.id];
  if (media?.state === "missing") return { state: "media-missing", reason: `${segment.label} footage is missing from this device.` };
  if (clip.source_revision !== segment.media.sha256) {
    return { state: "needs-revalidation", reason: `${segment.label} footage was replaced after this highlight was made. Revalidate before using it.` };
  }
  if (media?.state === "replaced") {
    return { state: "needs-revalidation", reason: `${segment.label} footage on this device differs from the registered recording. Relink it first.` };
  }
  const problems = clipProblems(recording, clip);
  if (problems.length) return { state: "out-of-bounds", reason: problems.join(" ") };
  return { state: "ok", reason: "" };
}

// Clips near a segment edge are worth flagging: the footage simply stops.
export const nearSegmentEdge = (recording, clip, withinMs = 3000) => {
  const segment = segmentById(recording, clip.segment_id);
  return Boolean(segment) && (clip.in_ms <= withinMs || segment.media.duration_ms - clip.out_ms <= withinMs);
};

/* ---------------------------------- reels -------------------------------- */

const byUpdated = (a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""));

// What one viewer may see for a game: their own reels (draft or published,
// live) and everyone else's PUBLISHED snapshot only.
export function reelsVisibleTo(state, game_id, viewer_id) {
  const reels = (state.replayReels || []).filter((reel) => reel.game_id === game_id);
  const mine = reels.filter((reel) => reel.owner_id === viewer_id).sort(byUpdated);
  const shared = reels
    .filter((reel) => reel.owner_id !== viewer_id && reel.status === "published" && reel.published)
    .map((reel) => ({ ...reel, view: "published-snapshot" }))
    .sort(byUpdated);
  return { mine, shared };
}

export const clipsOwnedBy = (state, recording_id, viewer_id) =>
  (state.replayClips || []).filter((clip) => clip.recording_id === recording_id && clip.owner_id === viewer_id);

export const reelClips = (state, reel) =>
  reel.clip_ids.map((id) => (state.replayClips || []).find((clip) => clip.id === id)).filter(Boolean);

export const reelDuration = (clips) => clips.reduce((sum, clip) => sum + (clip.out_ms - clip.in_ms), 0);

// The clip list a viewer actually plays: the live list for the owner, the
// frozen snapshot for anyone else.
export function playableClips(state, reel, viewer_id) {
  if (reel.owner_id === viewer_id) return reelClips(state, reel);
  return reel.status === "published" && reel.published ? reel.published.clips : [];
}

/* ------------------------------ manifest (tier A) ------------------------ */

export function buildReelManifest(state, reel, { format = "mp4", owner_id, now }) {
  const recording = (state.replayRecordings || []).find((item) => item.id === reel.recording_id);
  if (!recording) return { error: "This reel's recording is not registered." };
  const clips = reel.owner_id === owner_id ? reelClips(state, reel) : playableClips(state, reel, owner_id);
  if (!clips.length) return { error: "Add at least one highlight to the reel." };
  const spec = EXPORT_FORMATS[format];
  if (!spec) return { error: "Choose MP4 or WebM." };
  const items = [];
  for (const [i, clip] of clips.entries()) {
    const status = clipStatus(recording, clip);
    if (status.state !== "ok") return { error: `“${clip.title || "Untitled highlight"}”: ${status.reason}` };
    const segment = segmentById(recording, clip.segment_id);
    items.push({
      order: i + 1,
      clip_id: clip.id,
      segment_id: segment.id,
      media_path: segment.media.path,
      media_sha256: segment.media.sha256,
      in_ms: clip.in_ms,
      out_ms: clip.out_ms,
      duration_ms: clip.out_ms - clip.in_ms,
      title: clip.title || "",
      tags: clip.tags || { team_ids: [], profile_ids: [] },
    });
  }
  const fps = recording.segments[0]?.media.fps || 30;
  return {
    manifest: {
      schema: MANIFEST_SCHEMA,
      reel_id: reel.id,
      title: (reel.owner_id === owner_id ? reel.title : reel.published?.title) || "Untitled reel",
      game_id: reel.game_id,
      recording_id: recording.id,
      source_revision: recording.source_revision,
      owner_id,
      created_at: now,
      output: {
        container: spec.container,
        video: spec.video,
        audio: spec.audio,
        width: recording.segments[0]?.media.width || 640,
        height: recording.segments[0]?.media.height || 360,
        fps,
        quality: "Re-encoded locally from the original segments; declared preset, not the original bytes.",
      },
      items,
      total_duration_ms: items.reduce((sum, item) => sum + item.duration_ms, 0),
    },
  };
}

export function validateManifest(manifest) {
  const problems = [];
  if (!manifest || manifest.schema !== MANIFEST_SCHEMA) return ["Not a reel-manifest/v1 document."];
  if (!Array.isArray(manifest.items) || !manifest.items.length) problems.push("The reel has no items.");
  if (!EXPORT_FORMATS[manifest.output?.container]) problems.push("Unknown output container.");
  (manifest.items || []).forEach((item, i) => {
    if (typeof item.media_path !== "string" || !/^replay-media\/[\w.-]+\.webm$/.test(item.media_path)) problems.push(`Item ${i + 1}: media path is not a registered replay file.`);
    if (!/^[0-9a-f]{64}$/.test(item.media_sha256 || "")) problems.push(`Item ${i + 1}: missing source hash.`);
    if (!(item.in_ms >= 0 && item.out_ms - item.in_ms >= MIN_CLIP_MS)) problems.push(`Item ${i + 1}: invalid bounds.`);
    if (item.duration_ms !== item.out_ms - item.in_ms) problems.push(`Item ${i + 1}: duration does not match its bounds.`);
  });
  return problems;
}
