import { useEffect, useRef, useState } from "react";
import { Pause, Play, X } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import { CARD_BACKGROUND, CARD_STYLES, CAPTION_STYLE, PAD_COLOR, formatFilmMs } from "../../lib/film";
import { mediaUrl } from "../replay/replayIO";

/* Plays a film-sequence/v1 — the SAME object the renderer consumes — as one
 * continuous experience: cards for their exact durations, clips from their own
 * segment file between in and out, holds frozen on the clip's last frame with
 * silence, captions in the same place and size as the render. Typography is
 * expressed in container-width units so a 16:9 stage of any size matches the
 * 1280×720 render's proportions. */

const HEIGHT_CQW = 56.25; // stage height in cqw for 16:9
const sizeCqw = (fractionOfHeight) => `${(fractionOfHeight * HEIGHT_CQW).toFixed(3)}cqw`;

function CardFace({ item }) {
  return (
    <div className="absolute inset-0" style={{ background: CARD_BACKGROUND }}>
      {item.lines.map((line, i) => {
        const s = CARD_STYLES[line.style] || CARD_STYLES.body;
        return (
          <p key={i} className="absolute left-0 right-0 text-center px-[4%] leading-none" style={{ top: `${s.y * 100}%`, transform: "translateY(-50%)", fontSize: sizeCqw(s.size), color: `#${s.color}`, fontWeight: s.font === "bold" ? 700 : 400, fontFamily: "Arial, Helvetica, sans-serif" }}>
            {line.text}
          </p>
        );
      })}
    </div>
  );
}

function Caption({ text }) {
  if (!text) return null;
  return (
    <p className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap leading-none" style={{
      bottom: `${(1 - CAPTION_STYLE.bottom) * 100}%`, fontSize: sizeCqw(CAPTION_STYLE.size), color: "#fff",
      background: `rgba(0,0,0,${CAPTION_STYLE.boxAlpha})`, padding: `${sizeCqw(CAPTION_STYLE.size * 0.4)}`, fontFamily: "Arial, Helvetica, sans-serif",
    }}>{text}</p>
  );
}

export default function FilmPreview({ sequence, specHash, onClose }) {
  const videoRef = useRef(null);
  const armed = useRef(false);
  const timer = useRef(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const item = sequence.items[index];
  const done = index >= sequence.items.length;

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!item || paused) return undefined;
    const video = videoRef.current;
    if (item.kind === "card") {
      timer.current = setTimeout(() => setIndex((i) => i + 1), item.ms);
      return undefined;
    }
    if (!video) return undefined;
    armed.current = false;
    const at = item.kind === "clip" ? item.media.in_ms : Math.max(0, item.media.at_ms - 34);
    const begin = () => {
      video.addEventListener("seeked", () => {
        armed.current = true;
        if (item.kind === "clip") {
          video.muted = item.audio === "mute";
          video.play().catch(() => {});
        } else {
          video.pause(); // freeze frame, silent
          timer.current = setTimeout(() => setIndex((i) => i + 1), item.ms);
        }
      }, { once: true });
      video.currentTime = at / 1000;
    };
    const src = mediaUrl(item.media.path);
    if (video.dataset.src === item.media.path && video.readyState >= 1) begin();
    else {
      video.dataset.src = item.media.path;
      video.src = src;
      video.addEventListener("loadedmetadata", begin, { once: true });
    }
    return undefined;
  }, [index, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = sequence.items.slice(0, Math.min(index, sequence.items.length)).reduce((s, x) => s + x.ms, 0);
  const media = item && item.kind !== "card";
  const fit = sequence.settings.fit === "fill-crop" ? "cover" : "contain";

  return (
    <section className="bg-card border border-primary/40 rounded-xl p-3 space-y-2" data-testid="film-preview" aria-label="Film preview">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-foreground font-semibold" data-testid="film-preview-position">
          {done ? "End of film" : `${index + 1} / ${sequence.items.length} · ${item.kind === "card" ? `${item.role} card` : item.kind === "hold" ? "freeze frame (silent)" : `clip${item.audio === "mute" ? " (muted)" : ""}`}`}
        </p>
        <div className="flex items-center gap-1">
          <span className="text-micro text-muted-foreground tabular-nums">{formatFilmMs(elapsed)} / {formatFilmMs(sequence.total_ms)}</span>
          {!done && <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={() => { setPaused((p) => !p); videoRef.current?.pause(); }} aria-label={paused ? "Resume" : "Pause"}>{paused ? <Play size={16} weight="bold" /> : <Pause size={16} weight="bold" />}</Button>}
          <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={onClose} aria-label="Close preview"><X size={16} weight="bold" /></Button>
        </div>
      </div>
      <div className="relative w-full aspect-video overflow-hidden rounded-lg" style={{ containerType: "inline-size", background: PAD_COLOR }} data-testid="film-stage">
        <video
          ref={videoRef}
          playsInline
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: fit, visibility: media ? "visible" : "hidden" }}
          onTimeUpdate={(e) => {
            if (armed.current && item?.kind === "clip" && e.currentTarget.currentTime * 1000 >= item.media.out_ms) {
              e.currentTarget.pause();
              armed.current = false;
              setIndex((i) => i + 1);
            }
          }}
          // A clip ending at its segment's end may decode a hair short of out_ms.
          onEnded={() => {
            if (armed.current && item?.kind === "clip") {
              armed.current = false;
              setIndex((i) => i + 1);
            }
          }}
          onError={() => item && item.kind !== "card" && setIndex((i) => i + 1)}
        />
        {item?.kind === "card" && <CardFace item={item} />}
        {item?.kind === "clip" && <Caption text={item.caption?.text} />}
        {item?.kind === "hold" && <Caption text={item.comment?.text} />}
        {done && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" style={{ background: CARD_BACKGROUND }}>End of film · {formatFilmMs(sequence.total_ms)}</div>}
      </div>
      <p className="text-micro text-muted-foreground break-all" data-testid="film-preview-spec">Preview sequence {specHash ? specHash.slice(0, 12) : "…"} · the render uses this exact sequence.</p>
    </section>
  );
}
