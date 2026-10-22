"""Generate the two ORIGINAL synthetic recording segments for the L1 fixture.

Fictional flag-football "recording": a green field, a moving ball marker and
burned-in labels, plus machine-readable markers so boundary accuracy can be
checked after export:
  * top band colour  = whole second index (12-hue palette, s % 12)
  * bottom band grey = tenth of a second (10 levels, evenly spaced in sRGB)
  * audio: a short beep at every whole 5 s (segment A 880 Hz, B 660 Hz)
Run: tools/replay/blender.sh tools/replay/make_fixture_media.py -- <out_dir>
Writes rec-g7-s1.webm (60 s) and rec-g7-s2.webm (45 s), VP9 + Opus, 640x360 @ 30.
"""
import math
import os
import struct
import sys
import wave

import bpy

FPS = 30
W, H = 640, 360
PALETTE = [  # 12 well-separated hues, readable after lossy encoding
    (0.90, 0.10, 0.10), (0.95, 0.55, 0.05), (0.95, 0.90, 0.10), (0.45, 0.85, 0.10),
    (0.05, 0.75, 0.30), (0.05, 0.80, 0.80), (0.10, 0.45, 0.95), (0.35, 0.15, 0.90),
    (0.75, 0.10, 0.90), (0.95, 0.20, 0.60), (0.55, 0.35, 0.20), (0.98, 0.98, 0.98),
]
SEGMENTS = [
    {"id": "rec-g7-s1", "label": "SEGMENT A", "seconds": 60, "tone": 880.0},
    {"id": "rec-g7-s2", "label": "SEGMENT B", "seconds": 45, "tone": 660.0},
]


def out_dir():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not args:
        raise SystemExit("usage: blender.sh make_fixture_media.py -- <out_dir>")
    os.makedirs(args[0], exist_ok=True)
    return os.path.abspath(args[0])


def write_wav(path, seconds, tone):
    rate = 48000
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        frames = bytearray()
        for i in range(seconds * rate):
            t = i / rate
            sample = 0.04 * math.sin(2 * math.pi * 110.0 * t)  # quiet crowd-ish hum
            if (t % 5.0) < 0.12:
                sample += 0.5 * math.sin(2 * math.pi * tone * t)
            frames += struct.pack("<h", int(max(-1, min(1, sample)) * 32767))
        w.writeframes(bytes(frames))


def color_strip(strips, name, channel, start, length, rgb, scale=(1.0, 1.0), offset=(0, 0)):
    s = strips.new_effect(name=name, type="COLOR", channel=channel, frame_start=start, length=length)
    s.color = rgb
    s.transform.scale_x, s.transform.scale_y = scale
    s.transform.offset_x, s.transform.offset_y = offset
    s.blend_type = "ALPHA_OVER"
    return s


def text_strip(strips, name, channel, start, length, text, size, y, color=(1, 1, 1, 1)):
    s = strips.new_effect(name=name, type="TEXT", channel=channel, frame_start=start, length=length)
    s.text = text
    s.font_size = size
    s.location = (0.5, y)
    s.anchor_x = "CENTER"
    s.anchor_y = "CENTER"
    s.color = color
    s.use_shadow = True
    s.blend_type = "ALPHA_OVER"
    return s


def build(segment, folder):
    scene = bpy.data.scenes.new(segment["id"])
    bpy.context.window_manager.windows[0].scene = scene if bpy.context.window_manager.windows else None
    frames = segment["seconds"] * FPS
    # Standard (not AgX) so marker colours map predictably through to sRGB.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.resolution_x, scene.render.resolution_y = W, H
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, frames
    ed = scene.sequence_editor_create()
    strips = ed.strips
    # Field background.
    color_strip(strips, "field", 1, 1, frames, (0.10, 0.42, 0.18))
    # Yard lines.
    for k in range(-4, 5):
        color_strip(strips, f"line{k}", 2, 1, frames, (0.92, 0.95, 0.92), scale=(0.006, 0.62), offset=(k * 64, -10))
    # Moving ball marker (crosses the field every 6 s).
    ball = color_strip(strips, "ball", 3, 1, frames, (0.55, 0.30, 0.12), scale=(0.035, 0.06))
    for f in range(1, frames + 1, FPS * 6):
        ball.transform.offset_x = -260
        ball.transform.keyframe_insert("offset_x", frame=f)
        ball.transform.offset_x = 260
        ball.transform.keyframe_insert("offset_x", frame=min(frames, f + FPS * 6 - 1))
    # Machine-readable markers: per-second hue band (top) and per-tenth grey band (bottom).
    for s in range(segment["seconds"]):
        color_strip(strips, f"sec{s}", 4, 1 + s * FPS, FPS, PALETTE[s % 12], scale=(1.0, 0.12), offset=(0, H / 2 - 0.06 * H))
        text_strip(strips, f"lbl{s}", 6, 1 + s * FPS, FPS,
                   f"{segment['label']}  ·  REC {s // 60:02d}:{s % 60:02d}", 34, 0.62)
        for d in range(10):
            # VSE colour-strip values are display (sRGB) values: evenly spaced ~13..242.
            g = (d + 0.5) / 10.0
            color_strip(strips, f"ds{s}_{d}", 5, 1 + s * FPS + d * 3, 3, (g, g, g), scale=(1.0, 0.10), offset=(0, -H / 2 + 0.05 * H))
    text_strip(strips, "title", 7, 1, frames, "FICTIONAL FLAG FOOTBALL · BOSQUE BLITZ v MESA MAVERICKS", 18, 0.30, (1, 1, 1, 0.85))
    wav = os.path.join(folder, f"{segment['id']}.wav")
    write_wav(wav, segment["seconds"], segment["tone"])
    strips.new_sound(name="audio", filepath=wav, channel=8, frame_start=1)

    r = scene.render
    r.image_settings.media_type = "VIDEO"
    r.image_settings.file_format = "FFMPEG"
    r.ffmpeg.format = "WEBM"
    r.ffmpeg.codec = "WEBM"
    r.ffmpeg.constant_rate_factor = "HIGH"
    r.ffmpeg.ffmpeg_preset = "GOOD"
    r.ffmpeg.gopsize = FPS  # a keyframe every second keeps browser seeking quick
    r.ffmpeg.audio_codec = "OPUS"
    r.ffmpeg.audio_bitrate = 96
    r.ffmpeg.audio_channels = "MONO"
    r.ffmpeg.audio_mixrate = 48000
    r.use_file_extension = False
    target = os.path.join(folder, f"{segment['id']}.webm")
    r.filepath = target
    bpy.context.window.scene = scene if bpy.context.window else None
    with bpy.context.temp_override(scene=scene):
        bpy.ops.render.render(animation=True, scene=scene.name)
    os.remove(wav)
    print("WROTE", target, os.path.getsize(target))


def main():
    folder = out_dir()
    for segment in SEGMENTS:
        build(segment, folder)


main()
