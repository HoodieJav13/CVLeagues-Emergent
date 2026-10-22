import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, DownloadSimple, FileArrowDown, FilmStrip, ShareNetwork, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  EXPORT_FORMATS, buildReelManifest, clipStatus, formatDuration, formatMs, playableClips, reelDuration, segmentById,
} from "../../lib/replay";
import { downloadJson, exportDownloadUrl, exportStatus, helperHealth, mediaUrl, startExport } from "./replayIO";

/* Sequential reel preview: plays each clip's in→out from its own segment file.
 * Clips never cross a gap, so the preview never bridges missing footage. */
export function ReelPreview({ recording, clips: allClips, statusOf, onClose, testid = "replay-reel-preview" }) {
  const videoRef = useRef(null);
  const armed = useRef(false); // true once the current clip's seek has landed
  const [index, setIndex] = useState(0);
  // Only footage that is present and unchanged plays; the rest is named, not guessed.
  const clips = statusOf ? allClips.filter((c) => statusOf(c).state === "ok") : allClips;
  const skipped = allClips.length - clips.length;
  const clip = clips[index];
  const segment = clip ? segmentById(recording, clip.segment_id) : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip || !segment) return undefined;
    armed.current = false;
    const start = () => {
      video.addEventListener("seeked", () => { armed.current = true; video.play().catch(() => {}); }, { once: true });
      video.currentTime = clip.in_ms / 1000;
    };
    if (video.readyState >= 1 && video.dataset.src === segment.media.path) start();
    else {
      video.dataset.src = segment.media.path;
      video.src = mediaUrl(segment.media.path);
      video.addEventListener("loadedmetadata", start, { once: true });
    }
    return undefined;
  }, [clip, segment]);

  const next = () => { armed.current = false; setIndex((i) => i + 1); };
  if (!allClips.length) return null;
  return (
    <div className="bg-card border border-primary/40 rounded-xl p-3 space-y-2" data-testid={testid}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-foreground font-semibold" data-testid={`${testid}-position`}>
          {clip ? `Clip ${index + 1} of ${clips.length}: ${clip.title || "Untitled"}` : clips.length ? "Reel finished" : "Nothing playable right now"}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close preview"><X size={16} weight="bold" /></Button>
      </div>
      {skipped > 0 && (
        <p className="text-micro text-gold" data-testid={`${testid}-skipped`}>{skipped} highlight{skipped === 1 ? "" : "s"} skipped: footage missing or needs relinking.</p>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        className="w-full rounded-lg bg-black aspect-video"
        onTimeUpdate={(e) => {
          // Ignore stale events from the previous clip until this clip's seek lands.
          if (armed.current && clip && e.currentTarget.currentTime * 1000 >= clip.out_ms) {
            e.currentTarget.pause();
            next();
          }
        }}
        onEnded={() => clip && next()}
        onError={() => clip && next()}
      />
      {clip && <p className="text-micro text-muted-foreground">{segment?.label} · {formatMs(clip.in_ms)}–{formatMs(clip.out_ms)}</p>}
    </div>
  );
}

const EXPORT_IDLE = { state: "idle" };

function ExportPanel({ state, reel, viewer_id, onRecordExport }) {
  const [format, setFormat] = useState("mp4");
  const [job, setJob] = useState(EXPORT_IDLE);
  const [health, setHealth] = useState(null);
  const poll = useRef(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    helperHealth().then((h) => mounted.current && setHealth(h));
    return () => { mounted.current = false; clearTimeout(poll.current); };
  }, []);

  const manifestResult = () => buildReelManifest(state, reel, { format, owner_id: viewer_id, now: new Date().toISOString() });

  const downloadManifest = () => {
    const { manifest, error } = manifestResult();
    if (error) { toast.error(error); return; }
    downloadJson(`${(reel.title || "reel").replace(/[^\w -]+/g, "").trim() || "reel"}.reel-manifest.json`, manifest);
  };

  const follow = (id) => {
    poll.current = setTimeout(async () => {
      const next = await exportStatus(id);
      if (!mounted.current) return; // panel closed (e.g. viewer switched): stop following
      setJob(next);
      if (next.state === "done" || next.state === "failed") {
        onRecordExport({ state: next.state, format, code: next.code || null, render_ms: next.render_ms || null, at: new Date().toISOString(), job_id: id });
      } else follow(id);
    }, 1000);
  };

  const render = async () => {
    const { manifest, error } = manifestResult();
    if (error) { setJob({ state: "failed", code: "SCHEMA", message: error }); return; }
    const h = await helperHealth();
    setHealth(h);
    if (!h.ok) { setJob({ state: "failed", code: "HELPER", message: "The local export helper is not running. Start it with the preview launcher, then retry. Your manifest is still available." }); return; }
    setJob({ state: "queued" });
    const started = await startExport(manifest);
    setJob(started);
    if (started.state === "failed") onRecordExport({ state: "failed", format, code: started.code, at: new Date().toISOString() });
    else follow(started.id);
  };

  const busy = job.state === "queued" || job.state === "rendering";
  const url = exportDownloadUrl(job);
  return (
    <div className="space-y-2 border-t border-border pt-3" data-testid="replay-export">
      <p className="text-micro uppercase tracking-widest text-muted-foreground">Download</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <Label htmlFor="replay-format" className="text-micro text-muted-foreground">Video format</Label>
          <select id="replay-format" value={format} onChange={(e) => setFormat(e.target.value)} disabled={busy} data-testid="replay-format"
            className="w-full h-10 rounded-lg bg-surface-sunken border border-border px-3 text-sm text-foreground">
            {Object.entries(EXPORT_FORMATS).map(([key, spec]) => <option key={key} value={key}>{spec.label}</option>)}
          </select>
        </div>
        <Button type="button" className="min-h-11" onClick={render} disabled={busy} data-testid="replay-render">
          <FilmStrip size={16} weight="bold" /> {job.state === "failed" ? "Retry video" : "Make playable video"}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={downloadManifest} data-testid="replay-manifest">
          <FileArrowDown size={16} weight="bold" /> Manifest (JSON)
        </Button>
      </div>
      <p className="text-micro text-muted-foreground">
        The video is re-encoded on this computer from the original footage (declared quality preset, not the original bytes). The manifest alone is a recipe, not a playable reel.
        {health && !health.ok && " Export helper: not running."}
      </p>
      {busy && <p className="text-sm text-foreground" role="status" data-testid="replay-export-busy">Making your video… this takes about a minute on this computer.</p>}
      {job.state === "failed" && (
        <div className="text-sm text-gold space-y-0.5" role="status" data-testid="replay-export-failed">
          <p className="font-semibold">Export failed{job.code ? ` (${job.code})` : ""}: {job.message}</p>
          {job.detail && <p className="text-micro text-muted-foreground whitespace-pre-wrap">{job.detail}</p>}
          <p className="text-micro text-muted-foreground">Nothing was half-written. Fix the cause, then press Retry video.</p>
        </div>
      )}
      {job.state === "done" && url && (
        <div className="text-sm space-y-1" data-testid="replay-export-done">
          <a href={url} download className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg bg-primary text-ink font-semibold" data-testid="replay-download">
            <DownloadSimple size={16} weight="bold" /> Download {format.toUpperCase()} ({(job.bytes / 1024 / 1024).toFixed(1)} MB)
          </a>
          <p className="text-micro text-muted-foreground">
            Checked after rendering: {job.probe?.frames} frames ≈ {formatDuration((job.probe?.duration_ms) || 0)}, audio {job.probe?.has_audio ? "present" : "missing"}; rendered in {Math.round((job.render_ms || 0) / 1000)} s.
          </p>
        </div>
      )}
    </div>
  );
}

export function ReelPanel({ state, recording, reel, myClips, viewer_id, mediaStatus, actions }) {
  const [title, setTitle] = useState(reel?.title || "My highlights");
  const [order, setOrder] = useState(reel?.clip_ids || []);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => { setTitle(reel?.title || "My highlights"); setOrder(reel?.clip_ids || []); setPreviewing(false); }, [reel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (reel) setOrder(reel.clip_ids); }, [reel?.clip_ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const clipsById = Object.fromEntries(myClips.map((c) => [c.id, c]));
  const ordered = order.map((id) => clipsById[id]).filter(Boolean);
  const available = myClips.filter((c) => !order.includes(c.id));
  const dirty = !reel || reel.title !== title || reel.clip_ids.join() !== order.join();
  const move = (i, d) => setOrder((o) => { const n = [...o]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  const save = async () => {
    try {
      await actions.saveReel({ id: reel?.id, title, clip_ids: order });
      toast.success("Reel saved");
    } catch { /* refusal shown */ }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-3 space-y-3" data-testid="replay-reel" aria-label="Personal reel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display uppercase tracking-tight text-foreground">My reel</p>
        <span className="text-micro uppercase tracking-widest text-muted-foreground" data-testid="replay-reel-status">
          {reel ? (reel.status === "published" ? "Shared · others see the version from when you shared" : "Private draft · only you can see it") : "Not saved yet"}
        </span>
      </div>
      <div className="space-y-1">
        <Label htmlFor="replay-reel-title" className="text-micro uppercase tracking-widest text-muted-foreground">Reel name</Label>
        <Input id="replay-reel-title" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-surface-sunken border-border" data-testid="replay-reel-title" />
      </div>
      <ol className="space-y-1.5" data-testid="replay-reel-order">
        {ordered.length === 0 && <li className="text-sm text-muted-foreground">Add highlights from your list below.</li>}
        {ordered.map((clip, i) => {
          const status = clipStatus(recording, clip, mediaStatus);
          return (
            <li key={clip.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5" data-testid={`replay-reel-item-${i}`}>
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{i + 1}. {clip.title || "Untitled highlight"}</p>
                <p className="text-micro text-muted-foreground">{segmentById(recording, clip.segment_id)?.label} · {formatDuration(clip.out_ms - clip.in_ms)}{status.state !== "ok" ? ` · ${status.reason}` : ""}</p>
              </div>
              <div className="flex shrink-0">
                <Button type="button" variant="ghost" size="sm" className="min-h-10 min-w-10" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier" data-testid={`replay-reel-up-${i}`}><ArrowUp size={16} weight="bold" /></Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-10 min-w-10" disabled={i === ordered.length - 1} onClick={() => move(i, 1)} aria-label="Move later" data-testid={`replay-reel-down-${i}`}><ArrowDown size={16} weight="bold" /></Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-10 min-w-10" onClick={() => setOrder((o) => o.filter((x) => x !== clip.id))} aria-label="Remove from reel"><X size={16} weight="bold" /></Button>
              </div>
            </li>
          );
        })}
      </ol>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((clip) => (
            <Button key={clip.id} type="button" variant="outline" size="sm" className="min-h-9" onClick={() => setOrder((o) => [...o, clip.id])} data-testid={`replay-add-${clip.id}`}>+ {clip.title || "Untitled"}</Button>
          ))}
        </div>
      )}
      <p className="text-micro text-muted-foreground">Total {formatDuration(reelDuration(ordered))}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-11" onClick={save} disabled={!dirty} data-testid="replay-save-reel">{reel ? "Save changes" : "Save reel"}</Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setPreviewing(true)} disabled={!ordered.length} data-testid="replay-preview-reel">Preview reel</Button>
        {reel && reel.status !== "published" && (
          <Button type="button" variant="outline" className="min-h-11" disabled={dirty} onClick={() => actions.publish(reel.id).then(() => toast.success("Shared with other viewers")).catch(() => {})} data-testid="replay-publish"><ShareNetwork size={16} weight="bold" /> Share</Button>
        )}
        {reel?.status === "published" && (
          <>
            <Button type="button" variant="outline" className="min-h-11" disabled={dirty} onClick={() => actions.publish(reel.id).then(() => toast.success("Shared version updated")).catch(() => {})} data-testid="replay-republish">Update shared version</Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => actions.unpublish(reel.id).then(() => toast.success("No longer shared")).catch(() => {})} data-testid="replay-unpublish">Stop sharing</Button>
          </>
        )}
      </div>
      {dirty && reel && <p className="text-micro text-gold" data-testid="replay-reel-dirty">Unsaved changes. Save before sharing or downloading.</p>}
      {previewing && <ReelPreview recording={recording} clips={ordered} statusOf={actions.statusOf} onClose={() => setPreviewing(false)} />}
      {reel && !dirty && <ExportPanel key={reel.id} state={state} reel={reel} viewer_id={viewer_id} onRecordExport={(info) => actions.recordExport(reel.id, info).catch(() => {})} />}
    </section>
  );
}

export function SharedReels({ state, recording, shared, viewer_id, statusOf }) {
  const [watching, setWatching] = useState(null);
  if (!shared.length) return <p className="text-sm text-muted-foreground" data-testid="replay-shared-empty">No one has shared a reel for this game yet.</p>;
  return (
    <ul className="space-y-2" data-testid="replay-shared">
      {shared.map((reel) => {
        const clips = playableClips(state, reel, viewer_id);
        return (
          <li key={reel.id} className="bg-card border border-border rounded-xl p-3 space-y-2" data-testid={`replay-shared-${reel.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-foreground font-semibold">{reel.published.title}</p>
                <p className="text-micro text-muted-foreground">{clips.length} highlight{clips.length === 1 ? "" : "s"} · {formatDuration(reelDuration(clips))} · shared {new Date(reel.published.at).toLocaleString()}</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setWatching(reel.id)} data-testid={`replay-watch-${reel.id}`}>Watch</Button>
            </div>
            <ol className="text-micro text-muted-foreground list-decimal pl-4">{clips.map((c) => <li key={c.id}>{c.title || "Untitled"} · {formatMs(c.in_ms)}–{formatMs(c.out_ms)}</li>)}</ol>
            {watching === reel.id && <ReelPreview recording={recording} clips={clips} statusOf={statusOf} onClose={() => setWatching(null)} testid={`replay-shared-preview-${reel.id}`} />}
          </li>
        );
      })}
    </ul>
  );
}
