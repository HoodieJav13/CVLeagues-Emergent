import { orderedSegments } from "./replay";

/* ============================================================================
 * season2-events/v1 → recording time: a small FICTIONAL adapter demonstration.
 * ----------------------------------------------------------------------------
 * Season one has no play-by-play. This shows how a later event feed could jump
 * to footage. An event maps only through a segment anchor that shares its
 * period, declares a clock direction and promises a running clock. No period
 * length or game format is assumed, and a time that lands between segments is
 * reported as a recording gap, never bridged or guessed.
 * ========================================================================== */

export const EVENTS_SCHEMA = "season2-events/v1";

// Fictional events for g7 (Bosque Blitz v Mesa Mavericks). Not season-one data.
export const DEMO_EVENTS = {
  schema: EVENTS_SCHEMA,
  game_id: "g7",
  events: [
    { id: "ev1", period: 1, clock_ms: 571000, type: "touchdown", team_id: "t4", profile_id: "p17", label: "Bosque Blitz touchdown" },
    { id: "ev2", period: 1, clock_ms: 405000, type: "interception", team_id: "t5", profile_id: null, label: "Mesa Mavericks interception" },
    { id: "ev3", period: 1, clock_ms: 185000, type: "touchdown", team_id: "t5", profile_id: "p22", label: "Mesa Mavericks touchdown" },
    { id: "ev4", period: 2, clock_ms: 480000, type: "flag pull", team_id: "t4", profile_id: null, label: "Bosque Blitz stop" },
  ],
};

const offsetFor = (anchor, clock_ms) =>
  anchor.clock_direction === "down" ? anchor.clock_ms - clock_ms : clock_ms - anchor.clock_ms;

export function mapEventToMedia(recording, event) {
  const segments = orderedSegments(recording);
  const usable = segments.flatMap((segment) => (segment.anchors || [])
    .filter((anchor) => anchor.period === event.period && anchor.running_clock && ["down", "up"].includes(anchor.clock_direction) && Number.isFinite(anchor.clock_ms))
    .map((anchor) => ({ segment, anchor })));
  if (!Number.isFinite(event.clock_ms)) return { status: "unanchored", reason: "The event has no game clock." };
  if (!usable.length) return { status: "unanchored", reason: `No recording segment is anchored to period ${event.period}.` };
  for (const { segment, anchor } of usable) {
    const media_ms = anchor.media_ms + offsetFor(anchor, event.clock_ms);
    if (media_ms >= 0 && media_ms < segment.media.duration_ms) {
      return { status: "mapped", segment_id: segment.id, media_ms };
    }
  }
  // Not inside any anchored segment: is it between two of them?
  const positions = usable.map(({ segment, anchor }) => ({ segment, media_ms: anchor.media_ms + offsetFor(anchor, event.clock_ms) }));
  const before = positions.find((p) => p.media_ms >= p.segment.media.duration_ms);
  const after = positions.find((p) => p.media_ms < 0);
  if (before && after && before.segment.index < after.segment.index) {
    return { status: "in-gap", reason: `This moment happened between ${before.segment.label} and ${after.segment.label}, while nothing was recorded.` };
  }
  return { status: "unanchored", reason: "This moment is outside the recorded footage." };
}
