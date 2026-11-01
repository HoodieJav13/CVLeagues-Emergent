import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, ArrowCounterClockwise, ArrowClockwise, FlagBanner, FlagCheckered, NotePencil } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { NUDGE_MS, clipProblems, formatDuration, formatMs, orderedSegments, recordingGaps } from "../../lib/replay";
import { mediaUrl } from "./replayIO";

/* Segment timeline + recording player + highlight editor.
 * Recording time is what you see; a game-clock hint appears only where a
 * segment declares an anchor, and is labelled as a hint. */

function clockHint(segment, media_ms) {
  const anchor = (segment.anchors || []).find((a) => a.running_clock && a.clock_direction && Number.isFinite(a.clock_ms));
  if (!anchor) return null;
  const clock = anchor.clock_direction === "down" ? anchor.clock_ms - (media_ms - anchor.media_ms) : anchor.clock_ms + (media_ms - anchor.media_ms);
  if (clock < 0) return null;
  const m = Math.floor(clock / 60000);
  const s = Math.floor((clock % 60000) / 1000);
  return `P${anchor.period} ≈ ${m}:${String(s).padStart(2, "0")} on the game clock (hint)`;
}

export function SegmentTimeline({ recording, activeSegmentId, onSelect, mediaStatus }) {
  const segments = orderedSegments(recording);
  const gaps = recordingGaps(recording);
  const total = segments.reduce((sum, s) => sum + s.media.duration_ms, 0);
  return (
    <div className="space-y-1.5" data-testid="replay-timeline" aria-label="Recording segments">
      <div className="flex items-stretch gap-1 min-h-11">
        {segments.map((segment, i) => (
          <div key={segment.id} className="contents">
            <button
              type="button"
              onClick={() => onSelect(segment.id)}
              aria-pressed={segment.id === activeSegmentId}
              data-testid={`replay-segment-${segment.id}`}
              style={{ flexGrow: segment.media.duration_ms / total }}
              className={`min-w-0 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors ${segment.id === activeSegmentId ? "border-primary bg-primary/15 text-foreground" : "border-border bg-surface-sunken text-muted-foreground hover:text-foreground"}`}
            >
              <span className="block font-semibold truncate">{segment.label}</span>
              <span className="block truncate">{formatDuration(segment.media.duration_ms)}{mediaStatus?.[segment.id]?.state && mediaStatus[segment.id].state !== "ok" ? ` · ${mediaStatus[segment.id].state}` : ""}</span>
            </button>
            {gaps[i] && (
              <div className="shrink-0 w-16 sm:w-24 rounded-lg border border-dashed border-gold/60 text-gold text-[11px] leading-tight px-1.5 py-1.5 text-center" data-testid="replay-gap">
                {gaps[i].gap_ms === null ? "Gap (unknown length)" : `${Math.round(gaps[i].gap_ms / 60000)} min gap`}
                <span className="block text-muted-foreground">no footage</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-micro text-muted-foreground">Segment widths are to scale; the recording gap is not. Nothing is shown or exported across a gap.</p>
    </div>
  );
}

const BLANK = { id: null, in_ms: null, out_ms: null, title: "", team_ids: [], profile_ids: [] };

export function ClipEditor({ recording, segment, state, game, editing, onSave, onCancelEdit, segmentStatus, seekTo, onSeekApplied, onLogMoment }) {
  const videoRef = useRef(null);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const previewStop = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft({ id: editing.id, in_ms: editing.in_ms, out_ms: editing.out_ms, title: editing.title, team_ids: editing.tags?.team_ids || [], profile_ids: editing.tags?.profile_ids || [] });
    } else setDraft(BLANK);
  }, [editing]);

  useEffect(() => {
    if (seekTo && seekTo.segment_id === segment.id) {
      if (videoRef.current) {
        videoRef.current.currentTime = seekTo.media_ms / 1000;
        setNow(seekTo.media_ms);
      }
      // Applied (or not playable now) exactly once: a later remount never re-seeks.
      onSeekApplied?.();
    }
  }, [seekTo, segment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const teams = [game.home_team_id, game.away_team_id].map((id) => (state.teams || []).find((t) => t.id === id)).filter(Boolean);
  const players = useMemo(() => teams.flatMap((team) => (state.teamPlayers || [])
    .filter((tp) => tp.team_id === team.id)
    .map((tp) => ({ ...((state.profiles || []).find((p) => p.id === tp.profile_id) || {}), jersey: tp.jersey_number, team }))
    .filter((p) => p.id)), [state, teams]);

  const at = () => Math.round((videoRef.current?.currentTime || 0) * 1000);
  const seek = (ms) => {
    const clamped = Math.max(0, Math.min(segment.media.duration_ms, ms));
    if (videoRef.current) videoRef.current.currentTime = clamped / 1000;
    setNow(clamped);
  };
  const toggle = (key, id) => setDraft((d) => ({ ...d, [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] }));
  const candidate = { segment_id: segment.id, in_ms: draft.in_ms, out_ms: draft.out_ms };
  const problems = draft.in_ms === null || draft.out_ms === null ? [] : clipProblems(recording, candidate);
  const ready = draft.in_ms !== null && draft.out_ms !== null && !problems.length;
  const unavailable = segmentStatus && !["ok", "checking"].includes(segmentStatus.state);

  const preview = () => {
    if (!ready || !videoRef.current) return;
    videoRef.current.currentTime = draft.in_ms / 1000;
    previewStop.current = draft.out_ms;
    videoRef.current.play().catch(() => {});
  };

  return (
    <section className="bg-card border border-border rounded-xl p-3 space-y-3" data-testid="replay-editor" aria-label="Recording and highlight editor">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        {unavailable ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-gold" data-testid="replay-player-unavailable">
            {segmentStatus.state === "missing" ? `${segment.label} footage is missing from this device.` : segmentStatus.state === "replaced" ? `${segment.label} footage changed. Relink it below before marking highlights.` : `${segment.label} footage could not be checked.`}
          </div>
        ) : (
          <video
            ref={videoRef}
            key={segment.id}
            src={mediaUrl(segment.media.path)}
            controls
            playsInline
            preload="auto"
            className="w-full h-full"
            data-testid="replay-video"
            onTimeUpdate={(e) => {
              const ms = Math.round(e.currentTarget.currentTime * 1000);
              setNow(ms);
              if (previewStop.current !== null && ms >= previewStop.current) { e.currentTarget.pause(); previewStop.current = null; }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-foreground" data-testid="replay-now"><span className="font-semibold">{segment.label}</span> · recording {formatMs(now)}</p>
        <p className="text-micro text-muted-foreground">{clockHint(segment, now) || "No game-clock anchor for this moment"}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => (playing ? videoRef.current?.pause() : videoRef.current?.play().catch(() => {}))} disabled={unavailable} data-testid="replay-playpause">
          {playing ? <Pause size={16} weight="bold" /> : <Play size={16} weight="bold" />} {playing ? "Pause" : "Play"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => seek(at() - NUDGE_MS)} disabled={unavailable} data-testid="replay-back"><ArrowCounterClockwise size={16} weight="bold" /> 0.5 s</Button>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => seek(at() + NUDGE_MS)} disabled={unavailable} data-testid="replay-fwd"><ArrowClockwise size={16} weight="bold" /> 0.5 s</Button>
        <Button type="button" size="sm" className="min-h-11" onClick={() => setDraft((d) => ({ ...d, in_ms: at() }))} disabled={unavailable} data-testid="replay-mark-in"><FlagBanner size={16} weight="bold" /> Mark start</Button>
        <Button type="button" size="sm" className="min-h-11" onClick={() => setDraft((d) => ({ ...d, out_ms: at() }))} disabled={unavailable} data-testid="replay-mark-out"><FlagCheckered size={16} weight="bold" /> Mark end</Button>
        {onLogMoment && (
          // Pauses first so the logged recording time is the frame on screen.
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => { videoRef.current?.pause(); onLogMoment({ segment_id: segment.id, media_ms: at() }); }} disabled={segmentStatus?.state !== "ok"} data-testid="replay-log-moment"><NotePencil size={16} weight="bold" /> Log a moment here</Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-micro uppercase tracking-widest text-muted-foreground">Start (recording time, ms)</Label>
          <div className="flex gap-1.5">
            <Input type="number" inputMode="numeric" value={draft.in_ms ?? ""} onChange={(e) => setDraft((d) => ({ ...d, in_ms: e.target.value === "" ? null : Number(e.target.value) }))} className="bg-surface-sunken border-border" data-testid="replay-in" aria-label="Start in milliseconds" />
            <Button type="button" variant="outline" size="sm" className="min-h-10 shrink-0" onClick={() => setDraft((d) => ({ ...d, in_ms: d.in_ms === null ? null : d.in_ms - NUDGE_MS }))} aria-label="Start earlier">−</Button>
            <Button type="button" variant="outline" size="sm" className="min-h-10 shrink-0" onClick={() => setDraft((d) => ({ ...d, in_ms: d.in_ms === null ? null : d.in_ms + NUDGE_MS }))} aria-label="Start later">+</Button>
          </div>
          <p className="text-micro text-muted-foreground">{draft.in_ms === null ? "Not marked" : formatMs(draft.in_ms)}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-micro uppercase tracking-widest text-muted-foreground">End (recording time, ms)</Label>
          <div className="flex gap-1.5">
            <Input type="number" inputMode="numeric" value={draft.out_ms ?? ""} onChange={(e) => setDraft((d) => ({ ...d, out_ms: e.target.value === "" ? null : Number(e.target.value) }))} className="bg-surface-sunken border-border" data-testid="replay-out" aria-label="End in milliseconds" />
            <Button type="button" variant="outline" size="sm" className="min-h-10 shrink-0" onClick={() => setDraft((d) => ({ ...d, out_ms: d.out_ms === null ? null : d.out_ms - NUDGE_MS }))} aria-label="End earlier" data-testid="replay-out-earlier">−</Button>
            <Button type="button" variant="outline" size="sm" className="min-h-10 shrink-0" onClick={() => setDraft((d) => ({ ...d, out_ms: d.out_ms === null ? null : d.out_ms + NUDGE_MS }))} aria-label="End later">+</Button>
          </div>
          <p className="text-micro text-muted-foreground">{draft.out_ms === null ? "Not marked" : `${formatMs(draft.out_ms)}${draft.in_ms !== null ? ` · ${formatDuration(draft.out_ms - draft.in_ms)}` : ""}`}</p>
        </div>
      </div>
      {problems.length > 0 && <p className="text-sm text-gold" role="status" data-testid="replay-clip-problems">{problems.join(" ")}</p>}

      <div className="space-y-1">
        <Label htmlFor="replay-title" className="text-micro uppercase tracking-widest text-muted-foreground">Highlight name</Label>
        <Input id="replay-title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. Diving catch" className="bg-surface-sunken border-border" data-testid="replay-clip-title" />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-micro uppercase tracking-widest text-muted-foreground">Tag teams and players (manual)</legend>
        <div className="flex flex-wrap gap-1.5">
          {teams.map((team) => (
            <button key={team.id} type="button" aria-pressed={draft.team_ids.includes(team.id)} onClick={() => toggle("team_ids", team.id)} data-testid={`replay-tag-team-${team.id}`}
              className={`min-h-9 px-2.5 rounded-full border text-xs ${draft.team_ids.includes(team.id) ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}>{team.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {players.map((p) => (
            <button key={`${p.team.id}-${p.id}`} type="button" aria-pressed={draft.profile_ids.includes(p.id)} onClick={() => toggle("profile_ids", p.id)} data-testid={`replay-tag-player-${p.id}`}
              className={`min-h-9 px-2.5 rounded-full border text-xs ${draft.profile_ids.includes(p.id) ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}>#{p.jersey ?? "–"} {p.name}</button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={preview} disabled={!ready || unavailable} data-testid="replay-preview-clip">Preview highlight</Button>
        <Button type="button" className="min-h-11" disabled={!ready || unavailable} data-testid="replay-save-clip"
          onClick={async () => {
            const saved = await onSave({ id: draft.id, segment_id: segment.id, in_ms: draft.in_ms, out_ms: draft.out_ms, title: draft.title, tags: { team_ids: draft.team_ids, profile_ids: draft.profile_ids } });
            if (saved) setDraft(BLANK);
          }}>
          {draft.id ? "Update highlight" : "Save highlight"}
        </Button>
        {draft.id && <Button type="button" variant="ghost" className="min-h-11" onClick={onCancelEdit}>Cancel edit</Button>}
      </div>
    </section>
  );
}
