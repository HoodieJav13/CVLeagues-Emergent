import { clipStatus, segmentById } from "./replay";
import { getTeam } from "./selectors";
import { formatGameShortDate } from "./gameTime";
import STYLE from "./filmStyle.json";

/* ============================================================================
 * SEASON FILM — film-composition/v1 → film-sequence/v1 (pure).
 * ----------------------------------------------------------------------------
 * A composition is story structure ABOVE the L1 replay contracts: chapters,
 * pinned highlight revisions, context cards built from actual (fictional)
 * game records, authored captions, deliberate freeze-frame holds, audio
 * choices and render settings. buildFilmSequence() flattens it into the ONE
 * effective sequence that both the browser preview and the FFmpeg render
 * consume, so ordering, durations, text, holds and audio cannot drift apart.
 * Nothing here reads the clock, network or storage.
 * ========================================================================== */

export const COMPOSITION_SCHEMA = "film-composition/v1";
export const SEQUENCE_SCHEMA = "film-sequence/v1";
export const DEFAULT_SETTINGS = { width: 1280, height: 720, fps: 30, fit: "letterbox", card_ms: 2500 };
export const HOLD_LIMITS = { min: 500, max: 4000 };
export const CONTEXT_MS = 3000;
export const MAX_CAPTION = 90;

// One typography/colour table shared with the FFmpeg renderer (tools/film).
export const CARD_STYLES = STYLE.cardStyles;
export const CAPTION_STYLE = STYLE.caption;
export const CARD_BACKGROUND = `#${STYLE.cardBackground}`;
export const PAD_COLOR = `#${STYLE.padBackground}`;

/* --------------------------------- records -------------------------------- */

const scoreKnown = (game) => Number.isFinite(game?.home_score) && Number.isFinite(game?.away_score) && game?.status === "completed";

// Snapshot of the actual game record for a context card. Missing values stay null.
export function contextRecord(state, game_id, captured_at) {
  const game = (state.games || []).find((g) => g.id === game_id);
  if (!game) return null;
  return {
    game_id,
    starts_at: game.starts_at || null,
    home_team: getTeam(state, game.home_team_id)?.name || null,
    away_team: getTeam(state, game.away_team_id)?.name || null,
    home_score: scoreKnown(game) ? game.home_score : null,
    away_score: scoreKnown(game) ? game.away_score : null,
    status: game.status || null,
    captured_at,
  };
}

const RECORD_FIELDS = ["starts_at", "home_team", "away_team", "home_score", "away_score", "status"];
export function contextDrift(state, item) {
  const now = contextRecord(state, item.game_id, item.record?.captured_at);
  if (!now) return ["The game record no longer exists."];
  return RECORD_FIELDS.filter((key) => (now[key] ?? null) !== (item.record?.[key] ?? null))
    .map((key) => `${key.replace("_", " ")} is now ${now[key] ?? "unknown"} (card says ${item.record?.[key] ?? "unknown"})`);
}

export function contextLines(record, note) {
  if (!record) return [{ text: "Game record unavailable", style: "body" }];
  const lines = [];
  const date = record.starts_at ? formatGameShortDate({ starts_at: record.starts_at }) : null;
  const matchup = record.away_team && record.home_team ? `${record.away_team} @ ${record.home_team}` : record.away_team || record.home_team || "Teams not recorded";
  lines.push({ text: matchup, style: "title" });
  lines.push({ text: date ? `${date}, 2026` : "Date not recorded", style: "sub" });
  if (Number.isFinite(record.home_score) && Number.isFinite(record.away_score)) {
    lines.push({ text: `Final ${record.away_score}–${record.home_score}`, style: "body" });
  } else {
    lines.push({ text: "Score not recorded", style: "body" });
  }
  lines.push({ text: note?.text ? `Note: ${note.text}` : "Fictional demo league data", style: "fine" });
  return lines;
}

/* ---------------------------------- clips --------------------------------- */

export function clipRef(state, clip) {
  const recording = (state.replayRecordings || []).find((r) => r.id === clip.recording_id);
  return {
    recording_id: clip.recording_id,
    segment_id: clip.segment_id,
    game_id: recording?.game_id || null,
    in_ms: clip.in_ms,
    out_ms: clip.out_ms,
    source_revision: clip.source_revision,
    clip_updated_at: clip.updated_at,
    title: clip.title || "",
  };
}

// Why a moment cannot render as pinned, or [] when it can.
export function momentProblems(state, item, mediaStatus = {}) {
  const ref = item.clip_ref;
  const recording = (state.replayRecordings || []).find((r) => r.id === ref?.recording_id);
  if (!recording) return [{ code: "recording", text: "Its recording is no longer registered." }];
  const segment = segmentById(recording, ref.segment_id);
  if (!segment) return [{ code: "segment", text: "Its recording segment no longer exists." }];
  const problems = [];
  const media = mediaStatus[segment.id];
  if (media?.state === "missing") problems.push({ code: "missing", text: `${segment.label} footage is missing from this computer.` });
  if (segment.media.sha256 !== ref.source_revision || media?.state === "replaced") {
    problems.push({ code: "replaced", text: `${segment.label} footage changed since this moment was added. Relink it in Replay Studio, then use the updated highlight.` });
  }
  if (!(ref.in_ms >= 0 && ref.out_ms <= segment.media.duration_ms && ref.out_ms - ref.in_ms >= 500)) {
    problems.push({ code: "bounds", text: "The pinned highlight no longer fits its segment." });
  }
  const live = (state.replayClips || []).find((c) => c.id === item.clip_id);
  const replaced = problems.some((p) => p.code === "replaced"); // its message already points at the fix
  if (!replaced && live && (live.updated_at !== ref.clip_updated_at || live.source_revision !== ref.source_revision)) {
    const status = clipStatus(recording, live, mediaStatus);
    problems.push({
      code: "clip-changed",
      soft: status.state === "ok",
      text: status.state === "ok"
        ? "This highlight was edited in Replay Studio. Use the updated version or keep the pinned one."
        : `This highlight changed in Replay Studio and is not usable yet: ${status.reason}`,
    });
  }
  return problems;
}

/* --------------------------- effective sequence --------------------------- */

const clampHold = (ms) => Math.max(HOLD_LIMITS.min, Math.min(HOLD_LIMITS.max, Math.round(ms || 0)));

export function buildFilmSequence(state, composition, mediaStatus = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...(composition.settings || {}) };
  const items = [];
  const problems = [];
  const push = (item) => items.push({ ...item, t0: items.reduce((s, x) => s + x.ms, 0) });

  if (composition.title_card?.show !== false) {
    push({ kind: "card", role: "title", ms: settings.card_ms, lines: [
      { text: composition.title || "Untitled film", style: "title" },
      ...(composition.title_card?.subtitle ? [{ text: composition.title_card.subtitle, style: "sub" }] : []),
      { text: "A personal film · fictional demo footage", style: "fine" },
    ], ref: { part: "title" } });
  }

  (composition.chapters || []).forEach((chapter, ci) => {
    push({ kind: "card", role: "chapter", ms: chapter.card_ms || settings.card_ms, lines: [
      { text: `Chapter ${ci + 1}`, style: "sub" },
      { text: chapter.title || "Untitled chapter", style: "title" },
      ...(chapter.subtitle ? [{ text: chapter.subtitle, style: "body" }] : []),
    ], ref: { chapter_id: chapter.id } });

    (chapter.items || []).forEach((item) => {
      const where = { chapter_id: chapter.id, item_id: item.id };
      if (item.kind === "context") {
        const drift = contextDrift(state, item);
        if (drift.length) problems.push({ ...where, code: "context-outdated", soft: true, text: `Context card is out of date: ${drift.join("; ")}.` });
        push({ kind: "card", role: "context", ms: item.ms || CONTEXT_MS, lines: contextLines(item.record, item.note), ref: where });
        return;
      }
      if (item.kind !== "moment") return;
      const itemProblems = momentProblems(state, item, mediaStatus);
      const name = `“${item.clip_ref?.title || "Untitled highlight"}”`;
      itemProblems.forEach((p) => problems.push({ ...where, ...p, text: `${name}: ${p.text}` }));
      if (itemProblems.some((p) => !p.soft)) return; // blocked: not rendered until resolved
      const recording = state.replayRecordings.find((r) => r.id === item.clip_ref.recording_id);
      const segment = segmentById(recording, item.clip_ref.segment_id);
      const media = {
        path: segment.media.path, sha256: segment.media.sha256,
        width: segment.media.width, height: segment.media.height,
      };
      if (settings.fit === "fill-crop" && segment.media.height > segment.media.width) {
        const kept = (segment.media.width / segment.media.height) / (settings.width / settings.height);
        if (1 - kept > 0.25) {
          problems.push({ ...where, code: "crop", soft: true, text: `Fill-crop keeps only ${Math.round(kept * 100)}% of this portrait recording's height. Letterbox keeps all of it.` });
        }
      }
      const caption = item.caption?.text ? { text: item.caption.text.slice(0, MAX_CAPTION), authored: true } : null;
      push({ kind: "clip", ms: item.clip_ref.out_ms - item.clip_ref.in_ms, media: { ...media, in_ms: item.clip_ref.in_ms, out_ms: item.clip_ref.out_ms },
        audio: item.audio === "mute" ? "mute" : "source", caption, ref: { ...where, clip_id: item.clip_id, game_id: item.clip_ref.game_id } });
      if (item.hold) {
        push({ kind: "hold", ms: clampHold(item.hold.ms), media: { ...media, at_ms: item.clip_ref.out_ms },
          comment: item.hold.comment ? { text: item.hold.comment.slice(0, MAX_CAPTION), authored: true } : null, audio: "silence", ref: where });
      }
    });
  });

  return {
    schema: SEQUENCE_SCHEMA,
    settings: { width: settings.width, height: settings.height, fps: settings.fps, fit: settings.fit },
    total_ms: items.reduce((s, x) => s + x.ms, 0),
    items,
    problems,
  };
}

// The exact bytes hashed for spec_sha256 (browser and helper both use this).
export function canonicalSpec(sequence) {
  const strip = (item) => {
    const { t0, ref, ...rest } = item; // t0 is derivable; refs are provenance, not picture
    return rest;
  };
  return JSON.stringify({ settings: sequence.settings, items: sequence.items.map(strip) });
}

export const blockingProblems = (sequence) => sequence.problems.filter((p) => !p.soft);

export const formatFilmMs = (ms) => {
  const s = Math.round(ms / 100) / 10;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};
