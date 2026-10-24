"""Probe a rendered video with Blender (the only installed decoder the helper relies on).

Usage: blender.sh probe_media.py -- <file>
Prints PROBE {"frames":..., "fps":..., "duration_ms":..., "has_audio":..., "audio_frames":...}.
"""
import json
import sys

import bpy


def main():
    path = sys.argv[sys.argv.index("--") + 1]
    scene = bpy.data.scenes.new("probe")
    strips = scene.sequence_editor_create().strips
    movie = strips.new_movie(name="v", filepath=path, channel=1, frame_start=1)
    fps = movie.fps if getattr(movie, "fps", 0) else scene.render.fps
    out = {"frames": movie.frame_duration, "fps": round(fps, 3), "width": movie.elements[0].orig_width if movie.elements else None}
    out["duration_ms"] = round(movie.frame_duration * 1000 / fps) if fps else None
    try:
        sound = strips.new_sound(name="a", filepath=path, channel=2, frame_start=1)
        out["has_audio"] = sound.frame_duration > 0
        out["audio_frames"] = sound.frame_duration
    except RuntimeError:
        out["has_audio"] = False
        out["audio_frames"] = 0
    print("PROBE " + json.dumps(out))


main()
