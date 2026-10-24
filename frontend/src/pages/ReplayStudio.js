import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Warning, VideoCamera } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { BACKEND_ENABLED } from "../lib/supabase";
import { getTeam } from "../lib/selectors";
import { formatGameDateTime } from "../lib/gameTime";
import { Button } from "../components/ui/button";
import {
  REPLAY_VIEWERS, clipStatus, clipsOwnedBy, formatDuration, formatMs, nearSegmentEdge, orderedSegments, recordingFor, reelsVisibleTo, segmentById,
} from "../lib/replay";
import { DEMO_EVENTS, mapEventToMedia } from "../lib/replayEvents";
import { ClipEditor, SegmentTimeline } from "../components/replay/ClipEditor";
import { ReelPanel, SharedReels } from "../components/replay/ReelPanel";
import { GameLog } from "../components/replay/GameLog";
import { measureDurationMs, mediaUrl, useMediaCheck } from "../components/replay/replayIO";

/* ============================================================================
 * REPLAY STUDIO (/replay/:gameId) — local rehearsal, development mock mode.
 * Open a game's recording, mark highlights inside its segments, tag teams and
 * players by hand, order them into a personal reel, preview, save/reopen,
 * share a frozen snapshot and download a playable re-encoded video.
 * Fictional footage and fictional viewers only; nothing leaves this computer.
 * ========================================================================== */

const VIEWER_KEY = "cvf_replay_viewer"; // per-browser convenience only

function readViewer() {
  try { return window.sessionStorage.getItem(VIEWER_KEY) || REPLAY_VIEWERS[0].id; } catch { return REPLAY_VIEWERS[0].id; }
}

export default function ReplayStudio() {
  const { gameId } = useParams();
  const app = useApp();
  const { state } = app;
  const game = (state.games || []).find((g) => g.id === gameId);
  const [viewer_id, setViewer] = useState(readViewer);
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [activeReelId, setActiveReelId] = useState(null);
  const [seekTo, setSeekTo] = useState(null);
  const [attachError, setAttachError] = useState(null);
  const [pendingAt, setPendingAt] = useState(null); // { segment_id, media_ms } from "Log a moment here"

  const recording = game ? recordingFor(state, game.id) : null;
  const [mediaStatus, recheck] = useMediaCheck(recording);
  useEffect(() => { try { window.sessionStorage.setItem(VIEWER_KEY, viewer_id); } catch { /* optional */ } }, [viewer_id]);
  useEffect(() => { if (recording && !activeSegmentId) setActiveSegmentId(orderedSegments(recording)[0].id); }, [recording, activeSegmentId]);
  useEffect(() => { setEditing(null); setActiveReelId(null); setPendingAt(null); }, [viewer_id]);

  const myClips = useMemo(() => (recording ? clipsOwnedBy(state, recording.id, viewer_id) : []), [state, recording, viewer_id]);
  const { mine, shared } = game ? reelsVisibleTo(state, game.id, viewer_id) : { mine: [], shared: [] };
  const activeReel = mine.find((r) => r.id === activeReelId) || (activeReelId === "new" ? null : mine[0] || null);

  if (BACKEND_ENABLED) {
    return <p className="text-sm text-muted-foreground" data-testid="replay-backend">Replay Studio is a local rehearsal and runs only in development demo mode.</p>;
  }
  if (!game) return <p className="text-sm text-muted-foreground" data-testid="replay-no-game">That game doesn't exist.</p>;

  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const segment = recording && segmentById(recording, activeSegmentId);

  const attach = async () => {
    setAttachError(null);
    try {
      // Per-game recording index first (FW3 multi-game footage); the original
      // index.json is accepted only when its segments belong to this game.
      let index = null;
      const perGame = await fetch(mediaUrl(`replay-media/index-${game.id}.json`), { cache: "no-store" });
      const perGameType = perGame.headers?.get?.("content-type") || "";
      if (perGame.ok && !perGameType.includes("text/html")) index = await perGame.json();
      else {
        const res = await fetch(mediaUrl("replay-media/index.json"), { cache: "no-store" });
        if (!res.ok) throw new Error("missing");
        const fallback = await res.json();
        if (!(fallback.segments || []).every((s) => String(s.id).startsWith(`rec-${game.id}-`))) throw new Error("missing");
        index = fallback;
      }
      if (index.game_id && index.game_id !== game.id) throw new Error("missing");
      await app.registerReplayRecording({ index, game_id: game.id, title: `${away.name} @ ${home.name}` });
      toast.success("Recording attached");
    } catch (error) {
      setAttachError(error.message === "missing"
        ? "The fictional footage isn't on this computer yet. Generate it with tools/replay/make_fixture_media.py (see the launch notes), then try again."
        : error.message);
    }
  };

  const relink = async (seg) => {
    try {
      const st = mediaStatus[seg.id];
      const duration_ms = await measureDurationMs(`${mediaUrl(seg.media.path)}?v=${st.sha256.slice(0, 8)}`);
      const result = await app.revalidateReplaySegment({ recording_id: recording.id, segment_id: seg.id, sha256: st.sha256, duration_ms }, viewer_id);
      toast.success(`${seg.label} relinked: ${result.revalidated.length} highlight(s) revalidated, ${result.blocked.length} blocked`);
      recheck();
    } catch { /* refusal shown */ }
  };

  const saveClip = async (input) => {
    try {
      const clip = await app.saveReplayClip({ ...input, recording_id: recording.id }, viewer_id);
      toast.success(input.id ? "Highlight updated" : "Highlight saved");
      setEditing(null);
      return clip;
    } catch { return null; }
  };

  const reelActions = {
    saveReel: async ({ id, title, clip_ids }) => {
      const reel = await app.saveReplayReel({ id, title, clip_ids, game_id: game.id, recording_id: recording.id }, viewer_id);
      setActiveReelId(reel.id);
      return reel;
    },
    publish: async (id) => app.publishReplayReel(id, viewer_id),
    unpublish: async (id) => app.unpublishReplayReel(id, viewer_id),
    recordExport: async (id, info) => app.recordReplayExport(id, info, viewer_id),
    // Statuses let previews skip footage that is missing or needs relinking.
    statusOf: (clip) => clipStatus(recording, clip, mediaStatus),
  };

  const viewer = REPLAY_VIEWERS.find((v) => v.id === viewer_id);
  const unhealthy = recording ? orderedSegments(recording).filter((s) => ["missing", "replaced", "error"].includes(mediaStatus[s.id]?.state)) : [];

  return (
    <div className="space-y-4 animate-fade-up" data-testid="replay-studio">
      <Link to={`/game/${game.id}`} className="inline-flex items-center gap-1.5 min-h-11 text-sm text-muted-foreground hover:text-foreground" data-testid="replay-back-to-game">
        <ArrowLeft size={16} weight="bold" /> Back to game
      </Link>
      <header className="space-y-1">
        <p className="text-micro uppercase tracking-[0.25em] text-primary font-bold">Replay Studio · flag football</p>
        <h1 className="font-display uppercase text-display-lg text-foreground">{away.name} @ {home.name}</h1>
        <p className="text-sm text-muted-foreground">{formatGameDateTime(game)} · Final {game.away_score}–{game.home_score}</p>
        <p className="text-micro text-muted-foreground">Local rehearsal on fictional footage and fictional viewers. Nothing is uploaded or sent.</p>
        <Link to="/film" className="inline-flex min-h-10 items-center text-sm text-primary hover:underline" data-testid="replay-to-film">Make a season film from your highlights</Link>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Viewing as">
        <span className="text-micro uppercase tracking-widest text-muted-foreground">Viewing as</span>
        {REPLAY_VIEWERS.map((v) => (
          <button key={v.id} type="button" aria-pressed={v.id === viewer_id} onClick={() => { setPendingAt(null); setViewer(v.id); }} data-testid={`replay-viewer-${v.id}`}
            className={`min-h-10 px-3 rounded-full border text-xs ${v.id === viewer_id ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}>{v.name}</button>
        ))}
      </div>

      {!recording ? (
        <section className="bg-card border border-border rounded-xl p-4 space-y-2" data-testid="replay-no-recording">
          <p className="text-foreground flex items-center gap-2"><VideoCamera size={18} weight="bold" /> No recording is attached to this game yet.</p>
          <p className="text-sm text-muted-foreground">Attach the locally generated fictional recording (two segments with a five-minute gap).</p>
          <Button type="button" className="min-h-11" onClick={attach} data-testid="replay-attach">Attach fictional recording</Button>
          {attachError && <p className="text-sm text-gold" role="status" data-testid="replay-attach-error">{attachError}</p>}
        </section>
      ) : (
        <>
          {unhealthy.length > 0 && (
            <section className="bg-card border border-gold/50 rounded-xl p-3 space-y-2" data-testid="replay-media-problems" role="status">
              {unhealthy.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-gold flex items-center gap-1.5"><Warning size={16} weight="bold" />
                    {mediaStatus[s.id].state === "missing" && `${s.label} footage is missing from this computer. Highlights in it can't play or export until it's back.`}
                    {mediaStatus[s.id].state === "replaced" && `${s.label} footage on this computer is different from the registered recording.`}
                    {mediaStatus[s.id].state === "error" && `${s.label} footage could not be checked: ${mediaStatus[s.id].reason}`}
                  </p>
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={recheck} data-testid={`replay-recheck-${s.id}`}>Check again</Button>
                    {mediaStatus[s.id].state === "replaced" && (
                      <Button type="button" size="sm" className="min-h-10" onClick={() => relink(s)} data-testid={`replay-relink-${s.id}`}>Relink and revalidate my highlights</Button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          <SegmentTimeline recording={recording} activeSegmentId={activeSegmentId} onSelect={setActiveSegmentId} mediaStatus={mediaStatus} />
          {segment && (
            <ClipEditor key={`${viewer_id}-${segment.id}`} recording={recording} segment={segment} state={state} game={game} editing={editing && editing.segment_id === segment.id && editing.owner_id === viewer_id ? editing : null}
              onSave={saveClip} onCancelEdit={() => setEditing(null)} segmentStatus={mediaStatus[segment.id]} seekTo={seekTo} onSeekApplied={() => setSeekTo(null)} onLogMoment={setPendingAt} />
          )}

          <GameLog key={`gamelog-${viewer_id}`} state={state} game={game} recording={recording} viewer_id={viewer_id} mediaStatus={mediaStatus}
            pendingAt={pendingAt} onClearPending={() => setPendingAt(null)}
            onJump={(link) => { setActiveSegmentId(link.segment_id); setSeekTo({ segment_id: link.segment_id, media_ms: link.media_ms, at: Date.now() }); }}
            actions={{
              save: async (input) => {
                try {
                  const saved = await app.saveReplayAnnotation(input, viewer_id);
                  toast.success(input.id ? "Logged moment updated" : "Moment logged");
                  return saved;
                } catch { return null; }
              },
              remove: async (id) => { try { await app.deleteReplayAnnotation(id, viewer_id); toast.success("Logged moment deleted"); } catch { /* refusal shown */ } },
              relink: async (id) => { try { await app.relinkReplayAnnotation(id, viewer_id); toast.success("Kept at the same time on the new footage"); } catch { /* refusal shown */ } },
            }} />

          <section className="space-y-2" aria-label="My highlights">
            <p className="font-display uppercase tracking-tight text-foreground">My highlights ({myClips.length})</p>
            {myClips.length === 0 && <p className="text-sm text-muted-foreground" data-testid="replay-no-clips">Mark a start and an end, then save your first highlight. Only {viewer?.name.split(" ")[0]} can see these.</p>}
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="replay-clips">
              {myClips.map((clip) => {
                const status = clipStatus(recording, clip, mediaStatus);
                const seg = segmentById(recording, clip.segment_id);
                const tagNames = [...(clip.tags?.team_ids || []).map((id) => getTeam(state, id)?.name), ...(clip.tags?.profile_ids || []).map((id) => (state.profiles || []).find((p) => p.id === id)?.name)].filter(Boolean);
                return (
                  <li key={clip.id} className="bg-card border border-border rounded-xl p-3 space-y-1" data-testid={`replay-clip-${clip.id}`}>
                    <p className="text-sm text-foreground font-semibold">{clip.title || "Untitled highlight"}</p>
                    <p className="text-micro text-muted-foreground">{seg?.label} · {formatMs(clip.in_ms)}–{formatMs(clip.out_ms)} · {formatDuration(clip.out_ms - clip.in_ms)}</p>
                    {tagNames.length > 0 && <p className="text-micro text-muted-foreground">Tags: {tagNames.join(", ")}</p>}
                    {nearSegmentEdge(recording, clip) && <p className="text-micro text-gold">Near the edge of {seg?.label}: the footage stops there.</p>}
                    {status.state !== "ok" && <p className="text-micro text-gold" data-testid={`replay-clip-status-${clip.id}`}>{status.reason}</p>}
                    <div className="flex gap-1.5 pt-1">
                      <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => { setActiveSegmentId(clip.segment_id); setEditing(clip); }} data-testid={`replay-edit-${clip.id}`}>Edit</Button>
                      <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={async () => { try { await app.deleteReplayClip(clip.id, viewer_id); toast.success("Highlight deleted"); } catch { /* refusal shown */ } }} data-testid={`replay-delete-${clip.id}`}>Delete</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {mine.length > 1 && (
            <div className="flex flex-wrap gap-1.5" aria-label="My reels">
              {mine.map((r) => (
                <Button key={r.id} type="button" variant={r.id === activeReel?.id ? "default" : "outline"} size="sm" className="min-h-10" onClick={() => setActiveReelId(r.id)} data-testid={`replay-open-reel-${r.id}`}>{r.title}</Button>
              ))}
            </div>
          )}
          {mine.length > 0 && <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={() => setActiveReelId("new")} data-testid="replay-new-reel">Start another reel</Button>}
          <ReelPanel key={viewer_id} state={state} recording={recording} reel={activeReel} myClips={myClips} viewer_id={viewer_id} mediaStatus={mediaStatus} actions={reelActions} />

          <section className="space-y-2" aria-label="Shared reels">
            <p className="font-display uppercase tracking-tight text-foreground">Shared by others</p>
            <SharedReels state={state} recording={recording} shared={shared} viewer_id={viewer_id} statusOf={reelActions.statusOf} />
          </section>

          <section className="bg-card border border-border rounded-xl p-3 space-y-2" data-testid="replay-events" aria-label="Season two preview">
            <p className="font-display uppercase tracking-tight text-foreground">Season-two preview: jump from a play to footage</p>
            <p className="text-micro text-muted-foreground">Demonstration with fictional events (season one has no play-by-play). Plays map to footage only through a segment's clock anchor; moments in the recording gap say so.</p>
            <ul className="space-y-1.5">
              {DEMO_EVENTS.events.map((event) => {
                const mapped = mapEventToMedia(recording, event);
                return (
                  <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid={`replay-event-${event.id}`}>
                    <span className="text-foreground">P{event.period} {Math.floor(event.clock_ms / 60000)}:{String(Math.floor((event.clock_ms % 60000) / 1000)).padStart(2, "0")} · {event.label}</span>
                    {mapped.status === "mapped" ? (
                      <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => { setActiveSegmentId(mapped.segment_id); setSeekTo({ ...mapped, at: Date.now() }); }} data-testid={`replay-jump-${event.id}`}>
                        Go to {segmentById(recording, mapped.segment_id)?.label} {formatMs(mapped.media_ms)}
                      </Button>
                    ) : (
                      <span className="text-micro text-gold">{mapped.reason}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
