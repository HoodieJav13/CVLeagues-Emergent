// Shared test fixture: a replay-media-index/v1 for g7 with two segments and a
// five-minute recording gap (hashes are placeholders; tests never read media).
export const H1 = "a".repeat(64);
export const H2 = "b".repeat(64);
export const FIXTURE_INDEX = {
  schema: "replay-media-index/v1",
  generator: "tools/replay/make_fixture_media.py",
  segments: [
    { id: "rec-g7-s1", label: "Segment A", path: "replay-media/rec-g7-s1.webm", sha256: H1, bytes: 1, duration_ms: 60000, width: 640, height: 360, fps: 30, has_audio: true,
      recorded_start: "2026-06-07T20:03:00-06:00", anchors: [{ media_ms: 0, period: 1, clock_ms: 600000, clock_direction: "down", running_clock: true }] },
    { id: "rec-g7-s2", label: "Segment B", path: "replay-media/rec-g7-s2.webm", sha256: H2, bytes: 1, duration_ms: 45000, width: 640, height: 360, fps: 30, has_audio: true,
      recorded_start: "2026-06-07T20:09:00-06:00", anchors: [{ media_ms: 0, period: 1, clock_ms: 210000, clock_direction: "down", running_clock: true }] },
  ],
};

