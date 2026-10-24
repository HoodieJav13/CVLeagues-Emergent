"""Write replay-media/index.json for the generated fixture segments.

Plain python3 (no Blender). Hashes each segment file and records the fictional
recording metadata: Segment A starts 20:03:00, runs 60 s; Segment B starts
20:09:00 — a five-minute recording gap after A ends at 20:04:00. Clock anchors
are fictional hints (period 1, running clock) and assume no period length.
Usage: python3 tools/replay/write_index.py frontend/public/replay-media [spec.json]
With a spec (tools/replay/specs/<game>.json) it writes index-<game_id>.json for that
fictional game instead of the g7 index.json.
"""
import hashlib
import json
import os
import sys

SEGMENTS = [
    {"id": "rec-g7-s1", "label": "Segment A", "duration_ms": 60000,
     "recorded_start": "2026-06-07T20:03:00-06:00",
     "anchors": [{"media_ms": 0, "period": 1, "clock_ms": 600000, "clock_direction": "down", "running_clock": True,
                  "note": "Fictional anchor: 10:00 left in period 1 when Segment A starts"}]},
    {"id": "rec-g7-s2", "label": "Segment B", "duration_ms": 45000,
     "recorded_start": "2026-06-07T20:09:00-06:00",
     "anchors": [{"media_ms": 0, "period": 1, "clock_ms": 210000, "clock_direction": "down", "running_clock": True,
                  "note": "Fictional anchor: 3:30 left in period 1 when Segment B starts"}]},
]


def main():
    folder = sys.argv[1]
    spec = None
    if len(sys.argv) > 2:
        with open(sys.argv[2]) as fh:
            spec = json.load(fh)
    segments = SEGMENTS if not spec else [
        {"id": s["id"], "label": s["label"].title(), "duration_ms": s["seconds"] * 1000,
         "recorded_start": s.get("recorded_start"), "anchors": s.get("anchors", []),
         "width": s.get("width", 640), "height": s.get("height", 360)} for s in spec["segments"]]
    out = []
    for seg in segments:
        path = os.path.join(folder, f"{seg['id']}.webm")
        with open(path, "rb") as fh:
            data = fh.read()
        out.append({
            **seg,
            "path": f"replay-media/{seg['id']}.webm",
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
            "width": seg.get("width", 640), "height": seg.get("height", 360), "fps": 30, "has_audio": True,
        })
    index = {"schema": "replay-media-index/v1", "generator": "tools/replay/make_fixture_media.py",
             **({"game_id": spec["game_id"]} if spec else {}),
             "note": "Original synthetic fictional footage generated locally with Blender; no real people or games.",
             "segments": out}
    name = f"index-{spec['game_id']}.json" if spec else "index.json"
    with open(os.path.join(folder, name), "w") as fh:
        json.dump(index, fh, indent=2)
    print(json.dumps({s["id"]: s["sha256"][:12] for s in out}))


main()
