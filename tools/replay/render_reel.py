"""Render a reel-manifest/v1 to a playable, RE-ENCODED video with Blender's VSE.

Usage (always through blender.sh, which applies the scratch boundary):
  blender.sh render_reel.py -- <manifest.json> <media_root> <out_file> <mp4|webm>
Each manifest item becomes a trimmed movie strip plus its matching sound strip,
placed back to back in manifest order. Clip bounds are converted to frames at
the source frame rate (round to nearest; one frame = 33 ms at 30 fps). The
original segment files are only read. Prints one JSON line: RESULT {...}.
"""
import json
import os
import sys

import bpy


def args():
    a = sys.argv[sys.argv.index("--") + 1:]
    if len(a) != 4:
        raise SystemExit("usage: render_reel.py -- <manifest.json> <media_root> <out_file> <mp4|webm>")
    return a


def main():
    manifest_path, media_root, out_file, fmt = args()
    with open(manifest_path) as fh:
        manifest = json.load(fh)
    fps = int(manifest["output"].get("fps", 30))
    scene = bpy.data.scenes.new("reel")
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.resolution_x = int(manifest["output"].get("width", 640))
    scene.render.resolution_y = int(manifest["output"].get("height", 360))
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    ed = scene.sequence_editor_create()
    strips = ed.strips
    cursor = 1
    placed = []
    for item in manifest["items"]:
        # media_path is "replay-media/<file>"; media_root is that folder.
        src = os.path.join(media_root, os.path.basename(item["media_path"]))
        in_f = round(item["in_ms"] * fps / 1000)
        out_f = round(item["out_ms"] * fps / 1000)
        dur = out_f - in_f
        movie = strips.new_movie(name=f"v{item['order']}", filepath=src, channel=1, frame_start=cursor - in_f)
        total = movie.frame_duration
        movie.frame_offset_start = in_f
        movie.frame_offset_end = max(0, total - out_f)
        sound = strips.new_sound(name=f"a{item['order']}", filepath=src, channel=2, frame_start=cursor - in_f)
        sound.frame_offset_start = in_f
        sound.frame_offset_end = max(0, sound.frame_duration - out_f)
        placed.append({"order": item["order"], "start": cursor, "in_f": in_f, "out_f": out_f,
                       "video": [movie.frame_final_start, movie.frame_final_end],
                       "audio": [sound.frame_final_start, sound.frame_final_end]})
        cursor += dur
    scene.frame_start, scene.frame_end = 1, cursor - 1

    r = scene.render
    r.image_settings.media_type = "VIDEO"
    r.image_settings.file_format = "FFMPEG"
    if fmt == "mp4":
        r.ffmpeg.format = "MPEG4"
        r.ffmpeg.codec = "H264"
        r.ffmpeg.audio_codec = "AAC"
    elif fmt == "webm":
        r.ffmpeg.format = "WEBM"
        r.ffmpeg.codec = "WEBM"
        r.ffmpeg.audio_codec = "OPUS"
    else:
        raise SystemExit(f"unknown format {fmt}")
    r.ffmpeg.constant_rate_factor = "HIGH"
    r.ffmpeg.ffmpeg_preset = "GOOD"
    r.ffmpeg.gopsize = fps
    r.ffmpeg.audio_bitrate = 128
    r.ffmpeg.audio_channels = "MONO"
    r.ffmpeg.audio_mixrate = 48000
    r.use_file_extension = False
    r.filepath = out_file
    with bpy.context.temp_override(scene=scene):
        bpy.ops.render.render(animation=True, scene=scene.name)
    print("RESULT " + json.dumps({"frames": cursor - 1, "fps": fps, "placed": placed, "out": out_file}))


main()
