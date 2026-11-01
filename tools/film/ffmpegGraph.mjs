// film-sequence/v1 → FFmpeg arguments (pure; no I/O). The render consumes the
// SAME effective sequence the browser preview plays: one input per clip/hold
// item (accurate seek), one generated colour source per card, each normalised
// to WxH @ fps with 48 kHz stereo audio, then a single concat. Text is drawn
// with drawtext from per-item text files (expansion=none, so nothing in a
// caption is ever interpreted). Freeze-frame holds are always silent.

import { readFileSync } from "node:fs";

const STYLE = JSON.parse(readFileSync(new URL("../../frontend/src/lib/filmStyle.json", import.meta.url), "utf8"));
export const CARD_STYLES = STYLE.cardStyles;
export const CAPTION = STYLE.caption;
export const CARD_BG = STYLE.cardBackground;
export const PAD_BG = STYLE.padBackground;

const sec = (ms) => (ms / 1000).toFixed(3);

// This FFmpeg build's drawtext drops one trailing character per extra UTF-8
// byte (verified: "28–20" rendered "28–"). Padding with exactly that many
// trailing spaces makes it drop only invisible padding; centring is unchanged
// because dropped glyphs are not measured.
export function padForDrawtext(text) {
  const value = String(text);
  return value + " ".repeat(Buffer.byteLength(value, "utf8") - [...value].length);
}

function fitFilter(fit, W, H) {
  return fit === "fill-crop"
    ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`
    : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x${PAD_BG}`;
}

function drawLine({ textfile, style, H, fonts }) {
  const s = CARD_STYLES[style] || CARD_STYLES.body;
  const size = Math.round(s.size * H);
  return `drawtext=fontfile=${fonts[s.font]}:textfile=${textfile}:expansion=none:fontsize=${size}:fontcolor=0x${s.color}:x=(w-text_w)/2:y=${Math.round(s.y * H)}-text_h/2`;
}

function drawCaption({ textfile, H, fonts }) {
  const size = Math.round(CAPTION.size * H);
  return `drawtext=fontfile=${fonts.regular}:textfile=${textfile}:expansion=none:fontsize=${size}:fontcolor=white:box=1:boxcolor=0x${CAPTION.box}@${CAPTION.boxAlpha}:boxborderw=${Math.round(size * 0.4)}:x=(w-text_w)/2:y=${Math.round(CAPTION.bottom * H)}-text_h`;
}

// mediaDir/textDir/fontDir are the paths AS SEEN BY FFMPEG (inside the container).
export function buildFfmpegArgs(sequence, { mediaDir, textDir, fonts, output }) {
  const { width: W, height: H, fps, fit } = sequence.settings;
  const args = ["-hide_banner", "-nostdin", "-y"];
  const texts = []; // [{ name, text }]
  const filters = [];
  const pairs = [];
  let inputIndex = 0;
  const textFile = (k, n, text) => {
    const name = `t${k}_${n}.txt`;
    texts.push({ name, text: padForDrawtext(text) });
    return `${textDir}/${name}`;
  };
  const silence = (k, ms) => `anullsrc=r=48000:cl=stereo,atrim=duration=${sec(ms)},asetpts=PTS-STARTPTS[a${k}]`;

  sequence.items.forEach((item, k) => {
    if (item.kind === "card") {
      const draws = item.lines.map((line, n) => drawLine({ textfile: textFile(k, n, line.text), style: line.style, H, fonts }));
      filters.push(`color=c=0x${CARD_BG}:s=${W}x${H}:r=${fps}:d=${sec(item.ms)},format=yuv420p${draws.length ? "," + draws.join(",") : ""},setsar=1[v${k}]`);
      filters.push(silence(k, item.ms));
    } else if (item.kind === "clip") {
      const name = item.media.path.split("/").pop();
      args.push("-ss", sec(item.media.in_ms), "-t", sec(item.ms), "-i", `${mediaDir}/${name}`);
      const i = inputIndex++;
      const caption = item.caption?.text ? "," + drawCaption({ textfile: textFile(k, 0, item.caption.text), H, fonts }) : "";
      filters.push(`[${i}:v]setpts=PTS-STARTPTS,fps=${fps},${fitFilter(fit, W, H)},format=yuv420p,setsar=1,trim=duration=${sec(item.ms)}${caption}[v${k}]`);
      if (item.audio === "source") {
        filters.push(`[${i}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${sec(item.ms)}[a${k}]`);
      } else filters.push(silence(k, item.ms));
    } else if (item.kind === "hold") {
      const name = item.media.path.split("/").pop();
      // The final frame shown by the preceding clip: one frame just before its out point.
      const frame = 1000 / fps;
      args.push("-ss", sec(Math.max(0, item.media.at_ms - frame)), "-t", sec(frame), "-i", `${mediaDir}/${name}`);
      const i = inputIndex++;
      const comment = item.comment?.text ? "," + drawCaption({ textfile: textFile(k, 0, item.comment.text), H, fonts }) : "";
      filters.push(`[${i}:v]setpts=PTS-STARTPTS,fps=${fps},${fitFilter(fit, W, H)},format=yuv420p,setsar=1,trim=end_frame=1,tpad=stop_mode=clone:stop_duration=${sec(item.ms)},trim=duration=${sec(item.ms)}${comment}[v${k}]`);
      filters.push(silence(k, item.ms)); // freeze-frame audio is explicit silence
    } else {
      throw new Error(`unknown sequence item kind: ${item.kind}`);
    }
    pairs.push(`[v${k}][a${k}]`);
  });
  filters.push(`${pairs.join("")}concat=n=${sequence.items.length}:v=1:a=1[vout][aout]`);
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(fps),
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", output,
  );
  return { args, texts };
}
