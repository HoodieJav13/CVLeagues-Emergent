import { recordingGaps, segmentById } from "./replay";

/* ============================================================================
 * replay-annotation/v1 — a private, manual game log at RECORDING time.
 * ----------------------------------------------------------------------------
 * A logged moment is a note pinned to a segment and a media time, or an
 * honestly unlinked note (not recorded, in a recording gap, or unknown). It is
 * an annotation only: these transitions write state.replayAnnotations and
 * nothing else, so scores, stats, edit history and the scorekeeping ledger are
 * never touched. A game clock is stored only when someone types it.
 * Pure transitions, same conventions as replayMock.js:
 * (state, input, ctx) → { next, result } or throw a user-facing Error.
 * ========================================================================== */

export const ANNOTATION_SCHEMA = "replay-annotation/v1";
export const MAX_ANNOTATION_TEXT = 140;
export const UNLINKED_REASONS = ["not-recorded", "in-gap", "unknown"];
export const MAX_CLOCK_MS = 3600000;
// Declared, measured seek tolerance for "Go to" on the fixture media in
// headless Chromium (see Lane B CONTRACT/RETURN); not a frame-exact promise.
export const SEEK_TOLERANCE_MS = 100;

const list = (state) => (Array.isArray(state.replayAnnotations) ? state.replayAnnotations : []);
const upsert = (items, item) => (items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item]);
const isInt = (n) => Number.isInteger(n);

export const annotationsFor = (state, game_id, viewer_id) =>
  list(state)
    .filter((a) => a.game_id === game_id && a.author_id === viewer_id)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

function rosterFor(state, game) {
  const teams = [game.home_team_id, game.away_team_id];
  const profiles = new Set((state.teamPlayers || []).filter((tp) => teams.includes(tp.team_id)).map((tp) => tp.profile_id));
  return { teams, profiles };
}

// Tags are stable ids. A new tag must be one of the game's two teams or a
// player on their rosters; a tag already saved stays valid even if the roster
// changes later, so editing an old entry's text never fails on it.
function cleanTags(state, game, tags, kept = { team_ids: [], profile_ids: [] }) {
  const { teams, profiles } = rosterFor(state, game);
  const team_ids = [...new Set((tags?.team_ids || []).filter(Boolean))];
  const profile_ids = [...new Set((tags?.profile_ids || []).filter(Boolean))];
  if (team_ids.some((id) => !teams.includes(id) && !kept.team_ids.includes(id))) throw new Error("Tag only the two teams in this game.");
  if (profile_ids.some((id) => !profiles.has(id) && !kept.profile_ids.includes(id))) throw new Error("Tag only players on these two teams' rosters.");
  return { team_ids, profile_ids };
}

function cleanClock(clock) {
  if (clock === null || clock === undefined) return null;
  const { period, clock_ms } = clock;
  if (!isInt(period) || period < 1 || !isInt(clock_ms) || clock_ms < 0 || clock_ms > MAX_CLOCK_MS) {
    throw new Error("Enter the game clock as a period (1 or more) and a time between 0:00 and 60:00, or leave it blank.");
  }
  return { period, clock_ms };
}

// Linked: segment + integer media time inside the segment, bound to the
// segment's registered hash at the moment it is (re)linked.
function cleanLink(recording, link) {
  if (link?.state === "linked") {
    const segment = segmentById(recording, link.segment_id);
    if (!segment) throw new Error("Choose a segment of this game's recording.");
    const ms = link.media_ms;
    if (typeof ms !== "number" || !Number.isFinite(ms)) throw new Error("The recording time is not a number.");
    const media_ms = Math.round(ms);
    if (media_ms < 0) throw new Error("The recording time is before the segment begins.");
    if (media_ms > segment.media.duration_ms) throw new Error("The recording time is after this segment ends.");
    return { state: "linked", segment_id: segment.id, media_ms, source_revision: segment.media.sha256, relinked_from: null };
  }
  if (link?.state === "unlinked") {
    if (!UNLINKED_REASONS.includes(link.reason)) throw new Error("Say why this moment isn't on video.");
    if (link.reason !== "in-gap") return { state: "unlinked", reason: link.reason, gap: null };
    const gap = recordingGaps(recording).find((g) => g.after_segment_id === link.gap?.after_segment_id && g.before_segment_id === link.gap?.before_segment_id);
    if (!gap) throw new Error("Choose which recording gap this happened in.");
    return { state: "unlinked", reason: "in-gap", gap: { after_segment_id: gap.after_segment_id, before_segment_id: gap.before_segment_id } };
  }
  throw new Error("Log the moment at a recording time, or say why it isn't on video.");
}

const sameLinkTarget = (a, b) => a?.state === "linked" && b?.state === "linked" && a.segment_id === b.segment_id && a.media_ms === b.media_ms;
const sameUnlinked = (a, b) => a?.state === "unlinked" && b?.state === "unlinked" && a.reason === b.reason
  && (a.gap?.after_segment_id || null) === (b.gap?.after_segment_id || null) && (a.gap?.before_segment_id || null) === (b.gap?.before_segment_id || null);

export function saveAnnotation(state, input, { now, makeId, viewer_id }) {
  if (!viewer_id) throw new Error("Choose who you are viewing as first.");
  const existing = input.id ? list(state).find((a) => a.id === input.id) : null;
  if (input.id && !existing) throw new Error("That logged moment no longer exists.");
  if (existing && existing.author_id !== viewer_id) throw new Error("You can only edit your own logged moments.");
  if (existing && existing.schema !== ANNOTATION_SCHEMA) throw new Error("This logged moment uses an unsupported version and is kept read-only.");
  const game_id = existing ? existing.game_id : input.game_id;
  const game = (state.games || []).find((g) => g.id === game_id);
  if (!game) throw new Error("That game no longer exists.");
  const recording = (state.replayRecordings || []).find((r) => r.id === (existing ? existing.recording_id : input.recording_id));
  if (!recording) throw new Error("This recording is not registered.");
  if (recording.game_id !== game.id) throw new Error("That recording belongs to a different game.");

  // A text/tag-only edit keeps the stored link untouched (it must not adopt
  // changed footage); a new time re-binds to the footage as registered now.
  const keepLink = existing && (input.link === undefined || sameLinkTarget(existing.link, input.link) || sameUnlinked(existing.link, input.link));
  const link = keepLink ? existing.link : cleanLink(recording, input.link);
  const text = String(input.text ?? existing?.text ?? "").trim();
  if (text.length > MAX_ANNOTATION_TEXT) throw new Error(`Keep a logged moment to ${MAX_ANNOTATION_TEXT} characters.`);
  const tags = cleanTags(state, game, input.tags ?? existing?.tags, existing?.tags);
  if (!text && !tags.team_ids.length && !tags.profile_ids.length) throw new Error("Write what happened or tag a team or player.");

  const annotation = {
    schema: ANNOTATION_SCHEMA,
    id: existing?.id || makeId("ann"),
    game_id: game.id,
    recording_id: recording.id,
    author_id: viewer_id,
    created_at: existing?.created_at || now,
    updated_at: now,
    revision: existing ? existing.revision + 1 : 1,
    link,
    game_clock: cleanClock(input.game_clock === undefined ? existing?.game_clock ?? null : input.game_clock),
    tags,
    text,
  };
  return { next: { ...state, replayAnnotations: upsert(list(state), annotation) }, result: annotation };
}

export function deleteAnnotation(state, id, { viewer_id }) {
  const existing = list(state).find((a) => a.id === id);
  if (!existing) throw new Error("That logged moment no longer exists.");
  if (existing.author_id !== viewer_id) throw new Error("You can only delete your own logged moments.");
  return { next: { ...state, replayAnnotations: list(state).filter((a) => a.id !== id) }, result: existing };
}

// After the footage was replaced and revalidated in Replay Studio: confirm the
// SAME recording time on the new footage. Never moves to a different time.
export function relinkAnnotation(state, id, { now, viewer_id }) {
  const existing = list(state).find((a) => a.id === id);
  if (!existing) throw new Error("That logged moment no longer exists.");
  if (existing.author_id !== viewer_id) throw new Error("You can only relink your own logged moments.");
  if (existing.schema !== ANNOTATION_SCHEMA) throw new Error("This logged moment uses an unsupported version and is kept read-only.");
  if (existing.link?.state !== "linked") throw new Error("Only a moment logged at a recording time can be relinked.");
  const recording = (state.replayRecordings || []).find((r) => r.id === existing.recording_id);
  const segment = segmentById(recording, existing.link.segment_id);
  if (!segment) throw new Error("Its recording segment no longer exists.");
  if (segment.media.sha256 === existing.link.source_revision) throw new Error("This moment already matches the registered footage.");
  if (existing.link.media_ms > segment.media.duration_ms) throw new Error("The replacement footage is shorter than this moment's time; log it again at the right place.");
  const annotation = {
    ...existing,
    updated_at: now,
    revision: existing.revision + 1,
    link: { ...existing.link, source_revision: segment.media.sha256, relinked_from: { source_revision: existing.link.source_revision, at: now } },
  };
  return { next: { ...state, replayAnnotations: upsert(list(state), annotation) }, result: annotation };
}

// mediaStatus[segment_id] = { state: "ok"|"missing"|"replaced"|"checking"|"error" } (replayIO).
export function annotationStatus(recording, annotation, mediaStatus = {}) {
  if (annotation?.schema !== ANNOTATION_SCHEMA) return { state: "unsupported", reason: "Saved by an unsupported version; kept unchanged and read-only." };
  const { link } = annotation;
  if (link.state === "unlinked") {
    if (link.reason === "in-gap") {
      const after = segmentById(recording, link.gap?.after_segment_id);
      const before = segmentById(recording, link.gap?.before_segment_id);
      return { state: "unlinked", reason: `Happened in the recording gap${after && before ? ` between ${after.label} and ${before.label}` : ""}; there is no footage of it.` };
    }
    return { state: "unlinked", reason: link.reason === "not-recorded" ? "Not on the recording." : "Not linked to the recording." };
  }
  const segment = segmentById(recording, link.segment_id);
  if (!segment) return { state: "orphaned", reason: "Its recording segment no longer exists." };
  const media = mediaStatus[segment.id];
  if (media?.state === "missing") return { state: "media-missing", reason: `${segment.label} footage is missing from this device.` };
  if (segment.media.sha256 !== link.source_revision) {
    return { state: "needs-relink", reason: `${segment.label} footage was replaced after this was logged. The same time may now show a different moment; check it, then relink.` };
  }
  if (media?.state === "replaced") return { state: "needs-relink", reason: `${segment.label} footage on this device differs from the registered recording. Relink it in Replay Studio first.` };
  if (link.media_ms > segment.media.duration_ms) return { state: "out-of-bounds", reason: `This time is past the end of ${segment.label}.` };
  if (link.relinked_from) return { state: "relinked", reason: `Confirmed on replaced ${segment.label} footage.` };
  return { state: "ok", reason: "" };
}

export const canJump = (status) => status.state === "ok" || status.state === "relinked";
