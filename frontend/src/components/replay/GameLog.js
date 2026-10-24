import { useEffect, useMemo, useState } from "react";
import { NotePencil, Crosshair, Trash, LinkSimple } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { formatMs, recordingGaps, segmentById } from "../../lib/replay";
import { mapEventToMedia } from "../../lib/replayEvents";
import { MAX_ANNOTATION_TEXT, annotationStatus, annotationsFor, canJump, isSupported } from "../../lib/replayAnnotations";

/* Game log: private manual notes at RECORDING time (replay-annotation/v1).
 * Logging, editing or deleting never changes the score, stats or history.
 * A moment that isn't on video is logged honestly as unlinked; a typed game
 * clock is kept as entered and only ever SUGGESTS a place in the footage. */

const parseClock = (text) => {
  const m = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(text || "");
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : null;
};
const showClock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const BLANK = { id: null, text: "", team_ids: [], profile_ids: [], period: "", clock: "", reason: "not-recorded", gap: "", link: null };

export function GameLog({ state, game, recording, viewer_id, mediaStatus, pendingAt, onClearPending, onJump, actions }) {
  const [draft, setDraft] = useState(BLANK);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const entries = annotationsFor(state, game.id, viewer_id);
  const gaps = recordingGaps(recording);

  // "Log a moment here" in the player opens a new entry at that exact time. A
  // new entry already being written keeps its note and only takes the new
  // time; an entry being edited offers "Move to the time you just marked".
  useEffect(() => {
    if (!pendingAt || draft.id) return;
    const link = { state: "linked", ...pendingAt };
    if (open) setDraft((d) => ({ ...d, link }));
    else { setDraft({ ...BLANK, link }); setOpen(true); }
  }, [pendingAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const teams = [game.home_team_id, game.away_team_id].map((id) => (state.teams || []).find((t) => t.id === id)).filter(Boolean);
  const players = useMemo(() => teams.flatMap((team) => (state.teamPlayers || [])
    .filter((tp) => tp.team_id === team.id)
    .map((tp) => ({ ...((state.profiles || []).find((p) => p.id === tp.profile_id) || {}), jersey: tp.jersey_number, team }))
    .filter((p) => p.id)), [state, teams]);
  const nameOf = (kind, id) => (kind === "team" ? (state.teams || []).find((t) => t.id === id)?.name : (state.profiles || []).find((p) => p.id === id)?.name) || "Unknown";
  const toggle = (key, id) => setDraft((d) => ({ ...d, [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] }));
  const close = () => { setDraft(BLANK); setOpen(false); onClearPending(); };

  const startEdit = (a) => {
    const g = a.link.state === "unlinked" && a.link.gap ? `${a.link.gap.after_segment_id}|${a.link.gap.before_segment_id}` : "";
    setDraft({ id: a.id, text: a.text, team_ids: a.tags.team_ids, profile_ids: a.tags.profile_ids, period: a.game_clock ? String(a.game_clock.period) : "", clock: a.game_clock ? showClock(a.game_clock.clock_ms) : "", reason: a.link.state === "unlinked" ? a.link.reason : "not-recorded", gap: g, link: a.link });
    setOpen(true);
  };

  const save = async () => {
    const clock_ms = parseClock(draft.clock);
    const clockTyped = draft.period !== "" || draft.clock.trim() !== "";
    const game_clock = clockTyped ? { period: Number(draft.period), clock_ms: clock_ms ?? -1 } : null;
    let link = draft.link;
    if (!link || link.state === "unlinked") {
      const [after, before] = draft.gap.split("|");
      link = { state: "unlinked", reason: draft.reason, gap: draft.reason === "in-gap" ? { after_segment_id: after, before_segment_id: before } : null };
    }
    const saved = await actions.save({ id: draft.id || undefined, game_id: game.id, recording_id: recording.id, link, text: draft.text, tags: { team_ids: draft.team_ids, profile_ids: draft.profile_ids }, game_clock });
    if (saved) close();
  };

  const where = (a) => {
    if (!isSupported(a) || a.link.state !== "linked") return null;
    return `${segmentById(recording, a.link.segment_id)?.label || "Missing segment"} · ${formatMs(a.link.media_ms)}`;
  };

  return (
    <section className="bg-card border border-border rounded-xl p-3 space-y-3" data-testid="gamelog" aria-label="Game log">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display uppercase tracking-tight text-foreground">My game log ({entries.length})</p>
          <p className="text-micro text-muted-foreground">Private notes at a recording time. Logging never changes the score, stats or history.</p>
        </div>
        {!open && <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => { setDraft(BLANK); setOpen(true); }} data-testid="gamelog-add-unlinked">Log a moment that isn't on video</Button>}
      </div>

      {open && (
        <div className="rounded-lg border border-primary/50 bg-surface-sunken p-3 space-y-3" data-testid="gamelog-form">
          <p className="text-sm text-foreground font-semibold" data-testid="gamelog-form-where">
            {draft.id ? "Edit logged moment" : "New logged moment"}
            {draft.link?.state === "linked" ? ` at ${segmentById(recording, draft.link.segment_id)?.label} ${formatMs(draft.link.media_ms)} (recording time)` : " · not on video"}
          </p>
          {draft.id && pendingAt && (draft.link?.state !== "linked" || pendingAt.segment_id !== draft.link.segment_id || pendingAt.media_ms !== draft.link.media_ms) && (
            <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setDraft((d) => ({ ...d, link: { state: "linked", ...pendingAt } }))} data-testid="gamelog-retime">
              Move to the time you just marked ({segmentById(recording, pendingAt.segment_id)?.label} {formatMs(pendingAt.media_ms)})
            </Button>
          )}
          {(!draft.link || draft.link.state === "unlinked") && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="gamelog-reason" className="text-micro uppercase tracking-widest text-muted-foreground">Why it isn't on video</Label>
                <select id="gamelog-reason" value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} data-testid="gamelog-reason" className="h-10 w-full rounded-lg bg-surface-sunken border border-border px-2 text-sm text-foreground">
                  <option value="not-recorded">Not recorded</option>
                  {gaps.length > 0 && <option value="in-gap">In a recording gap</option>}
                  <option value="unknown">Not sure</option>
                </select>
              </div>
              {draft.reason === "in-gap" && (
                <div className="space-y-1">
                  <Label htmlFor="gamelog-gap" className="text-micro uppercase tracking-widest text-muted-foreground">Which gap</Label>
                  <select id="gamelog-gap" value={draft.gap} onChange={(e) => setDraft((d) => ({ ...d, gap: e.target.value }))} data-testid="gamelog-gap" className="h-10 w-full rounded-lg bg-surface-sunken border border-border px-2 text-sm text-foreground">
                    <option value="">Choose…</option>
                    {gaps.map((g) => <option key={g.after_segment_id} value={`${g.after_segment_id}|${g.before_segment_id}`}>Between {segmentById(recording, g.after_segment_id)?.label} and {segmentById(recording, g.before_segment_id)?.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="gamelog-text" className="text-micro uppercase tracking-widest text-muted-foreground">What happened</Label>
            <Input id="gamelog-text" value={draft.text} maxLength={MAX_ANNOTATION_TEXT} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} placeholder="e.g. Flag pull on 3rd down" className="bg-surface-sunken border-border" data-testid="gamelog-text" />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-micro uppercase tracking-widest text-muted-foreground">Game clock (optional, as you saw it)</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="number" inputMode="numeric" min={1} value={draft.period} onChange={(e) => setDraft((d) => ({ ...d, period: e.target.value }))} placeholder="Period" aria-label="Period" className="w-24 bg-surface-sunken border-border" data-testid="gamelog-period" />
              <Input value={draft.clock} onChange={(e) => setDraft((d) => ({ ...d, clock: e.target.value }))} placeholder="m:ss" aria-label="Clock (minutes:seconds)" className="w-24 bg-surface-sunken border-border" data-testid="gamelog-clock" />
            </div>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-micro uppercase tracking-widest text-muted-foreground">Tag teams and players</legend>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((team) => (
                <button key={team.id} type="button" aria-pressed={draft.team_ids.includes(team.id)} onClick={() => toggle("team_ids", team.id)} data-testid={`gamelog-tag-team-${team.id}`}
                  className={`min-h-9 px-2.5 rounded-full border text-xs ${draft.team_ids.includes(team.id) ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}>{team.name}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {draft.profile_ids.filter((id) => !players.some((p) => p.id === id)).map((id) => (
                <button key={`saved-${id}`} type="button" aria-pressed onClick={() => toggle("profile_ids", id)} data-testid={`gamelog-tag-player-${id}`}
                  className="min-h-9 px-2.5 rounded-full border text-xs border-primary bg-primary/15 text-foreground">{nameOf("player", id)} (no longer on roster)</button>
              ))}
              {players.map((p) => (
                <button key={`${p.team.id}-${p.id}`} type="button" aria-pressed={draft.profile_ids.includes(p.id)} onClick={() => toggle("profile_ids", p.id)} data-testid={`gamelog-tag-player-${p.id}`}
                  className={`min-h-9 px-2.5 rounded-full border text-xs ${draft.profile_ids.includes(p.id) ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}>#{p.jersey ?? "–"} {p.name}</button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11" onClick={save} data-testid="gamelog-save">{draft.id ? "Save changes" : "Log it"}</Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={close} data-testid="gamelog-cancel">Cancel</Button>
          </div>
        </div>
      )}

      {entries.length === 0 && !open && <p className="text-sm text-muted-foreground" data-testid="gamelog-empty">Pause the video and press “Log a moment here”, or log something that isn't on video.</p>}
      <ol className="space-y-2" data-testid="gamelog-list">
        {entries.map((a) => {
          const status = annotationStatus(recording, a, mediaStatus);
          const suggestion = isSupported(a) && a.link.state === "unlinked" && a.game_clock ? mapEventToMedia(recording, { period: a.game_clock.period, clock_ms: a.game_clock.clock_ms }) : null;
          const supported = status.state !== "unsupported";
          return (
            <li key={a.id} className="rounded-lg border border-border p-3 space-y-1" data-testid={`gamelog-entry-${a.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm text-foreground font-semibold break-words min-w-0">{supported ? (a.text || "No note") : "Unsupported entry"}</p>
                <p className="text-micro text-muted-foreground tabular-nums" data-testid={`gamelog-where-${a.id}`}>{where(a) || "Not on video"}</p>
              </div>
              {supported && a.game_clock && <p className="text-micro text-muted-foreground">Game clock P{a.game_clock.period} {showClock(a.game_clock.clock_ms)} (as entered)</p>}
              {supported && (a.tags.team_ids.length + a.tags.profile_ids.length) > 0 && (
                <p className="text-micro text-muted-foreground">Tags: {[...a.tags.team_ids.map((id) => nameOf("team", id)), ...a.tags.profile_ids.map((id) => nameOf("player", id))].join(", ")}</p>
              )}
              {status.state !== "ok" && <p className={`text-micro ${status.state === "relinked" ? "text-muted-foreground" : "text-gold"}`} data-testid={`gamelog-status-${a.id}`}>{status.reason}</p>}
              {suggestion?.status === "mapped" && <p className="text-micro text-muted-foreground" data-testid={`gamelog-suggest-${a.id}`}>The clock you entered suggests {segmentById(recording, suggestion.segment_id)?.label} {formatMs(suggestion.media_ms)}. Check the footage before relying on it.</p>}
              {suggestion && suggestion.status !== "mapped" && <p className="text-micro text-muted-foreground">{suggestion.reason}</p>}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {canJump(status) && <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => onJump(a.link)} data-testid={`gamelog-jump-${a.id}`}><Crosshair size={16} weight="bold" /> Go to</Button>}
                {suggestion?.status === "mapped" && <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => onJump(suggestion)} data-testid={`gamelog-jump-suggested-${a.id}`}><Crosshair size={16} weight="bold" /> Look there</Button>}
                {supported && <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => startEdit(a)} data-testid={`gamelog-edit-${a.id}`}><NotePencil size={16} weight="bold" /> Edit</Button>}
                {status.state === "needs-relink" && segmentById(recording, a.link.segment_id)?.media.sha256 !== a.link.source_revision && mediaStatus?.[a.link.segment_id]?.state !== "replaced" && a.link.media_ms > segmentById(recording, a.link.segment_id).media.duration_ms && (
                  <p className="text-micro text-gold" data-testid={`gamelog-shorter-${a.id}`}>The replacement footage is shorter than this time. Log it again at the right place.</p>
                )}
                {status.state === "needs-relink" && segmentById(recording, a.link.segment_id)?.media.sha256 !== a.link.source_revision && mediaStatus?.[a.link.segment_id]?.state !== "replaced" && a.link.media_ms <= segmentById(recording, a.link.segment_id).media.duration_ms && (
                  <Button type="button" size="sm" className="min-h-10" onClick={() => actions.relink(a.id)} data-testid={`gamelog-relink-${a.id}`}><LinkSimple size={16} weight="bold" /> Keep this time on the new footage</Button>
                )}
                {confirmDelete === a.id ? (
                  <>
                    <Button type="button" variant="destructive" size="sm" className="min-h-10" onClick={async () => { await actions.remove(a.id); setConfirmDelete(null); if (draft.id === a.id) close(); }} data-testid={`gamelog-delete-confirm-${a.id}`}>Delete this note</Button>
                    <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={() => setConfirmDelete(null)}>Keep</Button>
                  </>
                ) : (
                  <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={() => setConfirmDelete(a.id)} data-testid={`gamelog-delete-${a.id}`}><Trash size={16} weight="bold" /> Delete</Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
