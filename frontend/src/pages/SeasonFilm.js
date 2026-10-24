import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, DownloadSimple, FilmSlate, Plus, Trash, Warning, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { BACKEND_ENABLED } from "../lib/supabase";
import { getTeam } from "../lib/selectors";
import { formatGameShortDate } from "../lib/gameTime";
import { REPLAY_VIEWERS, formatDuration } from "../lib/replay";
import { HOLD_LIMITS, buildFilmSequence, blockingProblems, formatFilmMs } from "../lib/film";
import { filmsOwnedBy } from "../lib/filmMock";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import FilmPreview from "../components/film/FilmPreview";
import {
  cancelFilmRender, editionFileUrl, filmHelperHealth, filmRenderStatus, specSha256, startFilmRender, useRecordingsMediaCheck,
} from "../components/film/filmIO";

/* ============================================================================
 * SEASON FILM (/film) — private, personal film authoring (development mock
 * mode, fictional footage and viewers). Story structure lives here; highlight
 * boundaries stay in Replay Studio (L1). Preview and render consume the same
 * film-sequence/v1. Nothing is published or uploaded.
 * ========================================================================== */

const VIEWER_KEY = "cvf_replay_viewer"; // same per-tab persona as Replay Studio
const readViewer = () => { try { return window.sessionStorage.getItem(VIEWER_KEY) || REPLAY_VIEWERS[0].id; } catch { return REPLAY_VIEWERS[0].id; } };
const uid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const clone = (x) => JSON.parse(JSON.stringify(x));
// Mock actions return (or throw) synchronously; always treat them as promises.
const later = (fn) => Promise.resolve().then(fn);
const PENDING = ["queued", "rendering"];
const FINISHED = ["done", "failed", "canceled"];
// Editions this page is sending to the helper right now (no render_id yet).
const starting = new Set();
const finishedEdition = (st, id, render_id) => ({ id, state: st.state, render_id, file: st.file_name || null, manifest_file: st.manifest_file || null, bytes: st.bytes || null, duration_ms: st.duration_ms || null, error_code: st.code || null, error_detail: st.detail || null, finished_at: new Date().toISOString() });

// Every queued/rendering edition of the viewer's films is resolved from the
// helper whichever film is open (page left, viewer switched, reload, helper
// restart), so nothing stays stuck and a finished file is always linked.
function usePendingEditions(films, app, viewer_id) {
  const pending = films.flatMap((f) => f.editions.filter((e) => PENDING.includes(e.state)).map((e) => ({ film_id: f.id, e })));
  const key = pending.map(({ film_id, e }) => `${film_id}:${e.id}:${e.render_id || ""}`).join("|");
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    const record = (film_id, edition) => later(() => app.recordFilmEdition({ film_id, edition }, viewer_id)).catch(() => {});
    const tick = async () => {
      for (const { film_id, e } of pending) {
        if (!live) return;
        if (!e.render_id) {
          if (!starting.has(e.id)) await record(film_id, { id: e.id, state: "failed", error_code: "HELPER", error_detail: "The render never started (the page was left while it was being sent)." });
          continue;
        }
        const st = await filmRenderStatus(e.render_id);
        if (!live) return;
        if (FINISHED.includes(st.state) && st.id) await record(film_id, finishedEdition(st, e.id, e.render_id));
        else if (!PENDING.includes(st.state)) await record(film_id, { id: e.id, state: "failed", error_code: "HELPER", error_detail: "The film helper no longer knows this render (it was restarted or is not running). Render again; earlier editions are kept." });
      }
    };
    tick();
    const timer = setInterval(tick, 1500);
    return () => { live = false; clearInterval(timer); };
  }, [key, viewer_id]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Text field that saves on blur/Enter (each save is a durable project write).
function CommitInput({ value, onCommit, testid, ...props }) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => { setDraft(value || ""); }, [value]);
  const commit = () => { if ((draft || "") !== (value || "")) onCommit(draft); };
  return <Input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} data-testid={testid} className="bg-surface-sunken border-border" {...props} />;
}

const KIND_COLOR = { title: "bg-muted-foreground/40", chapter: "bg-gold/70", context: "bg-gold/40", clip: "bg-primary/70", hold: "bg-primary/30" };

export default function SeasonFilm() {
  const app = useApp();
  const { state } = app;
  const [viewer_id, setViewer] = useState(readViewer);
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState(null); // { chapter_id, item_id? }
  const [previewing, setPreviewing] = useState(false);
  const [specHash, setSpecHash] = useState(null);
  const [specError, setSpecError] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  useEffect(() => { try { window.sessionStorage.setItem(VIEWER_KEY, viewer_id); } catch { /* optional */ } }, [viewer_id]);
  useEffect(() => { setActiveId(null); setSelected(null); setPreviewing(false); }, [viewer_id]);

  const recordings = state.replayRecordings || [];
  const [mediaStatus, recheck] = useRecordingsMediaCheck(recordings);
  const films = filmsOwnedBy(state, viewer_id);
  const film = films.find((f) => f.id === activeId) || null;
  usePendingEditions(films, app, viewer_id);
  const sequence = useMemo(() => (film ? buildFilmSequence(state, film, mediaStatus) : null), [state, film, mediaStatus]);
  useEffect(() => { let live = true; if (sequence) specSha256(sequence).then((h) => { if (live) { setSpecHash(h); setSpecError(null); } }).catch((e) => { if (live) { setSpecHash(null); setSpecError(e.message); } }); return () => { live = false; }; }, [sequence]);

  if (BACKEND_ENABLED) return <p className="text-sm text-muted-foreground">Season Film is a local rehearsal and runs only in development demo mode.</p>;

  const myClips = (state.replayClips || []).filter((c) => c.owner_id === viewer_id);
  const gameOf = (recording_id) => recordings.find((r) => r.id === recording_id)?.game_id;
  const gameLabel = (game_id) => {
    const g = (state.games || []).find((x) => x.id === game_id);
    return g ? `${formatGameShortDate(g)} · ${getTeam(state, g.away_team_id)?.name} @ ${getTeam(state, g.home_team_id)?.name}` : game_id;
  };

  const save = async (mutate) => {
    try {
      const next = clone(film);
      mutate(next);
      await app.saveFilmComposition(next, viewer_id);
      return true;
    } catch { return false; }
  };
  const create = async () => {
    try {
      const f = await app.createFilmComposition({ title: newTitle || "My season film" }, viewer_id);
      setActiveId(f.id);
      setSelected({ chapter_id: f.chapters[0].id });
      setNewTitle("");
    } catch { /* refusal shown */ }
  };

  const chapterOf = (f, id) => f.chapters.find((c) => c.id === id);
  const selChapter = film && selected ? chapterOf(film, selected.chapter_id) : null;
  const selItem = selChapter && selected?.item_id ? selChapter.items.find((i) => i.id === selected.item_id) : null;
  const problemsFor = (item_id) => (sequence?.problems || []).filter((p) => p.item_id === item_id);

  return (
    <div className="space-y-4 animate-fade-up" data-testid="season-film">
      <header className="space-y-1">
        <p className="text-micro uppercase tracking-[0.25em] text-primary font-bold">Season Film · private</p>
        <h1 className="font-display uppercase text-display-lg text-foreground">Make your season film</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">Arrange your highlights from several games into chapters, add context, hold a moment, choose audio, then render a real video you keep. Only you can see your films. Fictional footage; nothing is uploaded.</p>
        <Link to="/replay/g7" className="inline-flex min-h-10 items-center text-sm text-primary hover:underline" data-testid="film-to-replay">Make or adjust highlights in Replay Studio</Link>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Viewing as">
        <span className="text-micro uppercase tracking-widest text-muted-foreground">You are</span>
        {REPLAY_VIEWERS.map((v) => (
          <button key={v.id} type="button" aria-pressed={v.id === viewer_id} onClick={() => setViewer(v.id)} data-testid={`film-viewer-${v.id}`}
            className={`min-h-10 px-3 rounded-full border text-xs ${v.id === viewer_id ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}>{v.name}</button>
        ))}
      </div>

      <section className="bg-card border border-border rounded-xl p-3 space-y-2" aria-label="My films">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-48 space-y-1">
            <Label htmlFor="film-new-title" className="text-micro uppercase tracking-widest text-muted-foreground">New film</Label>
            <Input id="film-new-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Our 2026 season" className="bg-surface-sunken border-border" data-testid="film-new-title" />
          </div>
          <Button type="button" className="min-h-11" onClick={create} data-testid="film-create"><Plus size={16} weight="bold" /> Start film</Button>
        </div>
        {films.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {films.map((f) => (
              <Button key={f.id} type="button" variant={f.id === film?.id ? "default" : "outline"} size="sm" className="min-h-10" onClick={() => { setActiveId(f.id); setSelected({ chapter_id: f.chapters[0]?.id }); setPreviewing(false); }} data-testid={`film-open-${f.id}`}>
                <FilmSlate size={16} weight="bold" /> {f.title} · {f.editions.filter((e) => e.state === "done").length} edition{f.editions.filter((e) => e.state === "done").length === 1 ? "" : "s"}
              </Button>
            ))}
          </div>
        )}
        {films.length === 0 && <p className="text-sm text-muted-foreground" data-testid="film-none">No films yet. Start one, then add highlights you made in Replay Studio.</p>}
      </section>

      {film && sequence && (
        <>
          <section className="bg-card border border-border rounded-xl p-3 space-y-3" aria-label="Story" data-testid="film-story">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-48 space-y-1">
                <Label className="text-micro uppercase tracking-widest text-muted-foreground">Film title</Label>
                <CommitInput value={film.title} onCommit={(v) => save((f) => { f.title = v; })} testid="film-title" />
              </div>
              <div className="flex-1 min-w-48 space-y-1">
                <Label className="text-micro uppercase tracking-widest text-muted-foreground">Title-card subtitle</Label>
                <CommitInput value={film.title_card?.subtitle} onCommit={(v) => save((f) => { f.title_card = { ...f.title_card, subtitle: v }; })} testid="film-subtitle" placeholder="e.g. Summer 2026" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="film-fit" className="text-micro uppercase tracking-widest text-muted-foreground">Mixed shapes</Label>
                <select id="film-fit" value={film.settings.fit} onChange={(e) => save((f) => { f.settings.fit = e.target.value; })} data-testid="film-fit" className="h-10 rounded-lg bg-surface-sunken border border-border px-3 text-sm text-foreground">
                  <option value="letterbox">Fit whole picture (bars)</option>
                  <option value="fill-crop">Fill frame (crops)</option>
                </select>
              </div>
            </div>
            {/* Whole-film structure at a glance: proportional strip, click a part to select it. */}
            <div className="flex h-8 rounded-md overflow-hidden border border-border" data-testid="film-strip" aria-label={`Film structure, ${formatFilmMs(sequence.total_ms)}`}>
              {sequence.items.map((it, i) => (
                <button key={i} type="button" title={`${it.kind === "card" ? `${it.role} card` : it.kind} · ${formatDuration(it.ms)}`} style={{ flexGrow: it.ms }}
                  onClick={() => it.ref?.chapter_id && setSelected({ chapter_id: it.ref.chapter_id, item_id: it.ref.item_id })}
                  className={`min-w-[3px] border-r border-background/60 ${KIND_COLOR[it.kind === "card" ? it.role : it.kind]} ${selected?.item_id && it.ref?.item_id === selected.item_id ? "ring-2 ring-inset ring-foreground" : ""}`} />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-micro text-muted-foreground" data-testid="film-total">{sequence.items.length} parts · {formatFilmMs(sequence.total_ms)} · chapters in gold, moments in teal, freeze frames pale</p>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setPreviewing(true)} data-testid="film-watch">Watch whole film</Button>
            </div>
            {previewing && <FilmPreview key={specHash || "p"} sequence={sequence} specHash={specHash} onClose={() => setPreviewing(false)} />}
          </section>

          <div className="grid gap-4 grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="space-y-2" aria-label="Chapters" data-testid="film-outline">
              {film.chapters.map((ch, ci) => (
                <div key={ch.id} className={`bg-card border rounded-xl p-3 space-y-2 ${selected?.chapter_id === ch.id && !selected?.item_id ? "border-primary" : "border-border"}`} data-testid={`film-chapter-${ci}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" className="text-left min-h-10 flex-1 min-w-0" onClick={() => setSelected({ chapter_id: ch.id })} data-testid={`film-select-chapter-${ci}`}>
                      <span className="text-micro uppercase tracking-widest text-gold">Chapter {ci + 1}</span>
                      <span className="block font-display uppercase tracking-tight text-foreground break-words">{ch.title}</span>
                    </button>
                    <div className="flex shrink-0">
                      <Button type="button" variant="ghost" size="sm" className="min-h-10 min-w-10" disabled={ci === 0} aria-label="Move chapter earlier" onClick={() => save((f) => { [f.chapters[ci - 1], f.chapters[ci]] = [f.chapters[ci], f.chapters[ci - 1]]; })}><ArrowUp size={16} weight="bold" /></Button>
                      <Button type="button" variant="ghost" size="sm" className="min-h-10 min-w-10" disabled={ci === film.chapters.length - 1} aria-label="Move chapter later" onClick={() => save((f) => { [f.chapters[ci + 1], f.chapters[ci]] = [f.chapters[ci], f.chapters[ci + 1]]; })}><ArrowDown size={16} weight="bold" /></Button>
                    </div>
                  </div>
                  <ol className="space-y-1">
                    {ch.items.length === 0 && <li className="text-micro text-muted-foreground">Empty chapter: select it, then add a moment or a context card.</li>}
                    {ch.items.map((it, ii) => {
                      const probs = problemsFor(it.id);
                      const clipTitle = it.kind === "moment" ? (it.clip_ref?.title || "Untitled highlight") : `Context: ${gameLabel(it.game_id)}`;
                      return (
                        <li key={it.id} className={`flex items-center justify-between gap-1 rounded-lg border px-2 py-1 ${selected?.item_id === it.id ? "border-primary bg-primary/10" : "border-border"}`} data-testid={`film-item-${ci}-${ii}`}>
                          <button type="button" className="text-left min-h-10 flex-1 min-w-0" onClick={() => setSelected({ chapter_id: ch.id, item_id: it.id })} data-testid={`film-select-item-${ci}-${ii}`}>
                            <span className="block text-sm text-foreground truncate">{clipTitle}</span>
                            <span className="block text-micro text-muted-foreground truncate">
                              {it.kind === "moment" ? `${gameLabel(it.clip_ref?.game_id)} · ${formatDuration((it.clip_ref?.out_ms || 0) - (it.clip_ref?.in_ms || 0))}${it.hold ? ` + ${formatDuration(it.hold.ms)} hold` : ""}${it.audio === "mute" ? " · muted" : ""}` : `${formatDuration(it.ms)} card`}
                              {probs.length > 0 && <span className="text-gold"> · needs attention</span>}
                            </span>
                          </button>
                          <div className="flex shrink-0">
                            <Button type="button" variant="ghost" size="sm" className="min-h-10 min-w-9 px-1" disabled={ii === 0} aria-label="Earlier" onClick={() => save((f) => { const its = chapterOf(f, ch.id).items; [its[ii - 1], its[ii]] = [its[ii], its[ii - 1]]; })} data-testid={`film-item-up-${ci}-${ii}`}><ArrowUp size={14} weight="bold" /></Button>
                            <Button type="button" variant="ghost" size="sm" className="min-h-10 min-w-9 px-1" disabled={ii === ch.items.length - 1} aria-label="Later" onClick={() => save((f) => { const its = chapterOf(f, ch.id).items; [its[ii + 1], its[ii]] = [its[ii], its[ii + 1]]; })}><ArrowDown size={14} weight="bold" /></Button>
                            <Button type="button" variant="ghost" size="sm" className="min-h-10 min-w-9 px-1" aria-label="Remove from film" onClick={() => { save((f) => { chapterOf(f, ch.id).items.splice(ii, 1); }); setSelected({ chapter_id: ch.id }); }} data-testid={`film-item-remove-${ci}-${ii}`}><Trash size={14} weight="bold" /></Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
              <Button type="button" variant="outline" className="min-h-11" onClick={async () => { const id = uid("ch"); if (await save((f) => { f.chapters.push({ id, title: `Chapter ${f.chapters.length + 1}`, subtitle: "", card_ms: f.settings.card_ms, items: [] }); })) setSelected({ chapter_id: id }); }} data-testid="film-add-chapter"><Plus size={16} weight="bold" /> Add chapter</Button>
            </section>

            <section className="bg-card border border-border rounded-xl p-3 space-y-3 self-start" aria-label="Selected part" data-testid="film-editor">
              {!selChapter && <p className="text-sm text-muted-foreground">Select a chapter or a moment to edit it.</p>}
              {selChapter && !selItem && (
                <>
                  <p className="text-micro uppercase tracking-widest text-gold">Chapter</p>
                  <div className="space-y-1"><Label className="text-micro text-muted-foreground">Chapter title</Label><CommitInput value={selChapter.title} onCommit={(v) => save((f) => { chapterOf(f, selChapter.id).title = v; })} testid="film-chapter-title" /></div>
                  <div className="space-y-1"><Label className="text-micro text-muted-foreground">Chapter subtitle (optional)</Label><CommitInput value={selChapter.subtitle} onCommit={(v) => save((f) => { chapterOf(f, selChapter.id).subtitle = v; })} testid="film-chapter-subtitle" /></div>
                  <div className="space-y-1">
                    <Label htmlFor="film-add-moment" className="text-micro text-muted-foreground">Add a moment (your highlights)</Label>
                    <select id="film-add-moment" value="" data-testid="film-add-moment" className="w-full h-10 rounded-lg bg-surface-sunken border border-border px-3 text-sm text-foreground"
                      onChange={async (e) => {
                        const clip = myClips.find((c) => c.id === e.target.value);
                        if (!clip) return;
                        const id = uid("it");
                        if (await save((f) => { chapterOf(f, selChapter.id).items.push({ id, kind: "moment", clip_id: clip.id, caption: null, hold: null, audio: "source" }); })) setSelected({ chapter_id: selChapter.id, item_id: id });
                      }}>
                      <option value="">{myClips.length ? "Choose a highlight…" : "No highlights yet: make some in Replay Studio"}</option>
                      {myClips.map((c) => <option key={c.id} value={c.id}>{gameLabel(gameOf(c.recording_id))} · {c.title || "Untitled"} ({formatDuration(c.out_ms - c.in_ms)})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="film-add-context" className="text-micro text-muted-foreground">Add a context card (from the game record)</Label>
                    <select id="film-add-context" value="" data-testid="film-add-context" className="w-full h-10 rounded-lg bg-surface-sunken border border-border px-3 text-sm text-foreground"
                      onChange={async (e) => {
                        const game_id = e.target.value;
                        if (!game_id) return;
                        const id = uid("it");
                        if (await save((f) => { chapterOf(f, selChapter.id).items.push({ id, kind: "context", game_id, ms: 3000, note: null }); })) setSelected({ chapter_id: selChapter.id, item_id: id });
                      }}>
                      <option value="">Choose a game…</option>
                      {[...new Set(recordings.map((r) => r.game_id))].map((g) => <option key={g} value={g}>{gameLabel(g)}</option>)}
                    </select>
                  </div>
                  {film.chapters.length > 1 && (
                    <Button type="button" variant="ghost" className="min-h-10" onClick={() => { save((f) => { f.chapters = f.chapters.filter((c) => c.id !== selChapter.id); }); setSelected(null); }} data-testid="film-remove-chapter"><Trash size={16} weight="bold" /> Remove chapter</Button>
                  )}
                </>
              )}
              {selItem?.kind === "moment" && (
                <>
                  <p className="text-micro uppercase tracking-widest text-primary">Moment · {gameLabel(selItem.clip_ref?.game_id)}</p>
                  <p className="text-sm text-foreground">{selItem.clip_ref?.title || "Untitled highlight"} · {formatDuration(selItem.clip_ref.out_ms - selItem.clip_ref.in_ms)}</p>
                  <Link to={`/replay/${selItem.clip_ref?.game_id}`} className="inline-flex min-h-10 items-center text-sm text-primary hover:underline">Adjust its start/end in Replay Studio</Link>
                  <div className="space-y-1"><Label className="text-micro text-muted-foreground">Your caption (authored, shown over the moment)</Label><CommitInput value={selItem.caption?.text} maxLength={90} onCommit={(v) => save((f) => { const it = chapterOf(f, selChapter.id).items.find((x) => x.id === selItem.id); it.caption = v ? { text: v, authored: true } : null; })} testid="film-caption" placeholder="e.g. First catch of the season" /></div>
                  <fieldset className="space-y-1.5">
                    <legend className="text-micro text-muted-foreground">Source audio</legend>
                    <div className="flex gap-1.5">
                      {["source", "mute"].map((a) => (
                        <button key={a} type="button" aria-pressed={selItem.audio === a} onClick={() => save((f) => { chapterOf(f, selChapter.id).items.find((x) => x.id === selItem.id).audio = a; })} data-testid={`film-audio-${a}`}
                          className={`min-h-10 px-3 rounded-full border text-xs ${selItem.audio === a ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}>{a === "source" ? "Keep game sound" : "Mute"}</button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-1.5">
                    <legend className="text-micro text-muted-foreground">Freeze on the last frame (always silent)</legend>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" aria-pressed={Boolean(selItem.hold)} onClick={() => save((f) => { const it = chapterOf(f, selChapter.id).items.find((x) => x.id === selItem.id); it.hold = it.hold ? null : { at: "end", ms: 1500, comment: "" }; })} data-testid="film-hold-toggle"
                        className={`min-h-10 px-3 rounded-full border text-xs ${selItem.hold ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}>{selItem.hold ? "Hold on" : "No hold"}</button>
                      {selItem.hold && (
                        <select value={selItem.hold.ms} onChange={(e) => save((f) => { chapterOf(f, selChapter.id).items.find((x) => x.id === selItem.id).hold.ms = Number(e.target.value); })} data-testid="film-hold-ms" className="h-10 rounded-lg bg-surface-sunken border border-border px-2 text-sm text-foreground">
                          {[HOLD_LIMITS.min, 1000, 1500, 2000, 3000, HOLD_LIMITS.max].map((ms) => <option key={ms} value={ms}>{ms / 1000} s</option>)}
                        </select>
                      )}
                    </div>
                    {selItem.hold && <CommitInput value={selItem.hold.comment} maxLength={90} onCommit={(v) => save((f) => { chapterOf(f, selChapter.id).items.find((x) => x.id === selItem.id).hold.comment = v; })} testid="film-hold-comment" placeholder="Comment during the freeze (authored)" />}
                  </fieldset>
                </>
              )}
              {selItem?.kind === "context" && (
                <>
                  <p className="text-micro uppercase tracking-widest text-gold">Context card · from the game record</p>
                  <ul className="text-sm text-foreground space-y-0.5" data-testid="film-context-record">
                    <li>{selItem.record?.away_team ?? "Away team not recorded"} @ {selItem.record?.home_team ?? "home team not recorded"}</li>
                    <li>{selItem.record?.starts_at ? formatGameShortDate({ starts_at: selItem.record.starts_at }) : "Date not recorded"}</li>
                    <li>{Number.isFinite(selItem.record?.home_score) ? `Final ${selItem.record.away_score}–${selItem.record.home_score}` : "Score not recorded"}</li>
                  </ul>
                  <div className="space-y-1"><Label className="text-micro text-muted-foreground">Your note (authored, not an official record)</Label><CommitInput value={selItem.note?.text} maxLength={90} onCommit={(v) => save((f) => { const it = chapterOf(f, selChapter.id).items.find((x) => x.id === selItem.id); it.note = v ? { text: v, authored: true } : null; })} testid="film-context-note" /></div>
                </>
              )}
              {selItem && problemsFor(selItem.id).map((p, i) => (
                <div key={i} className="text-sm text-gold flex flex-col gap-1.5" role="status" data-testid="film-item-problem">
                  <p className="flex items-start gap-1.5"><Warning size={16} weight="bold" className="shrink-0 mt-0.5" /> {p.text}</p>
                  {p.code === "clip-changed" && p.soft && <Button type="button" size="sm" className="min-h-10 self-start" onClick={() => later(() => app.adoptUpdatedFilmHighlight({ film_id: film.id, item_id: selItem.id }, viewer_id)).then(() => toast.success("Moment now uses the updated highlight")).catch(() => {})} data-testid="film-adopt-highlight">Use updated highlight</Button>}
                  {p.code === "replaced" && <Button type="button" size="sm" className="min-h-10 self-start" onClick={() => later(() => app.adoptUpdatedFilmHighlight({ film_id: film.id, item_id: selItem.id }, viewer_id)).then(() => toast.success("Moment relinked to the revalidated highlight")).catch(() => {})} data-testid="film-adopt-relinked">Use relinked highlight</Button>}
                  {p.code === "context-outdated" && <Button type="button" size="sm" className="min-h-10 self-start" onClick={() => later(() => app.updateFilmContext({ film_id: film.id, item_id: selItem.id }, viewer_id)).then(() => toast.success("Context card updated from the game record")).catch(() => {})} data-testid="film-update-context">Update context card</Button>}
                </div>
              ))}
            </section>
          </div>

          {sequence.problems.length > 0 && (
            <section className="bg-card border border-gold/50 rounded-xl p-3 space-y-1.5" role="status" data-testid="film-problems" aria-label="Needs attention">
              <p className="text-sm text-gold font-semibold">{blockingProblems(sequence).length ? `${blockingProblems(sequence).length} part(s) are left out until fixed` : "Notes (the film can still render)"}</p>
              <ul className="text-micro text-muted-foreground space-y-0.5">{sequence.problems.map((p, i) => <li key={i}>{p.text}</li>)}</ul>
              <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={recheck}>Check footage again</Button>
            </section>
          )}

          <Editions key={film.id} film={film} sequence={sequence} specHash={specHash} specError={specError} app={app} viewer_id={viewer_id} />
        </>
      )}
    </div>
  );
}

function Editions({ film, sequence, specHash, specError, app, viewer_id }) {
  const [active, setActive] = useState(null); // live render record
  const poll = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true; // re-armed on every mount (StrictMode mounts twice in development)
    return () => { mounted.current = false; clearTimeout(poll.current); };
  }, []);

  const record = (edition) => later(() => app.recordFilmEdition({ film_id: film.id, edition }, viewer_id));
  // Records the helper's final word on a render exactly as reported.
  const finish = (st, edition_id, render_id) => record(finishedEdition(st, edition_id, render_id)).catch(() => {});
  const follow = (render_id, edition_id) => {
    poll.current = setTimeout(async () => {
      const st = await filmRenderStatus(render_id);
      if (!mounted.current) return;
      setActive({ ...st, edition_id });
      if (FINISHED.includes(st.state)) {
        await finish(st, edition_id, render_id);
        if (st.state === "done") toast.success(`Edition rendered`);
      } else follow(render_id, edition_id);
    }, 700);
  };

  // Reopening a film mid-render shows its progress and Cancel again
  // (usePendingEditions records the outcome either way).
  const attached = useRef(false);
  useEffect(() => {
    if (attached.current) return;
    attached.current = true;
    const running = film.editions.find((e) => PENDING.includes(e.state) && e.render_id);
    if (!running) return;
    filmRenderStatus(running.render_id).then((st) => {
      if (mounted.current && PENDING.includes(st.state)) { setActive({ ...st, edition_id: running.id }); follow(running.render_id, running.id); }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const render = async () => {
    const blocked = blockingProblems(sequence);
    if (blocked.length) { toast.error("Fix the parts that need attention first."); return; }
    const edition_id = `ed_${Date.now().toString(36)}`;
    let ed;
    starting.add(edition_id);
    try { ed = await record({ id: edition_id, state: "queued", created_at: new Date().toISOString(), spec_sha256: specHash }); } catch { starting.delete(edition_id); return; }
    const health = await filmHelperHealth();
    const started = health.ok ? await startFilmRender({ film_id: film.id, edition_number: ed.number, title: film.title, sequence, spec_sha256: specHash }) : health;
    if (started.state === "failed" || !started.id) {
      setActive({ ...started, edition_id });
      await record({ id: edition_id, state: "failed", error_code: started.code || "HELPER", error_detail: started.detail || started.message }).catch(() => {});
      starting.delete(edition_id);
      return;
    }
    await record({ id: edition_id, state: "rendering", render_id: started.id }).catch(() => {});
    starting.delete(edition_id);
    setActive({ ...started, edition_id });
    follow(started.id, edition_id);
  };

  const cancel = async () => {
    if (!active?.id) return;
    clearTimeout(poll.current);
    const res = await cancelFilmRender(active.id);
    setActive({ ...active, ...res });
    // The render may have finished just before the cancel arrived: keep what really happened.
    if (FINISHED.includes(res.state) && res.id) {
      await finish(res, active.edition_id, active.id);
      if (res.state === "done") toast.success("The render had already finished; edition kept");
    } else await record({ id: active.edition_id, state: "failed", error_code: res.code || "HELPER", error_detail: res.message || null }).catch(() => {});
  };

  const busy = active && PENDING.includes(active.state);
  const editions = [...film.editions].sort((a, b) => b.number - a.number);
  return (
    <section className="bg-card border border-border rounded-xl p-3 space-y-3" aria-label="Render and editions" data-testid="film-editions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display uppercase tracking-tight text-foreground">Render a new edition</p>
        <div className="flex gap-2">
          <Button type="button" className="min-h-11" onClick={render} disabled={busy || !specHash} data-testid="film-render"><FilmSlate size={16} weight="bold" /> {active?.state === "failed" || active?.state === "canceled" ? "Retry render" : "Render film"}</Button>
          {busy && <Button type="button" variant="outline" className="min-h-11" onClick={cancel} data-testid="film-cancel"><X size={16} weight="bold" /> Cancel</Button>}
        </div>
      </div>
      <p className="text-micro text-muted-foreground">Renders on this computer with the existing FFmpeg container (no network). 1280×720 H.264/AAC, re-encoded. Each render becomes a new edition; earlier editions are kept.</p>
      {specError && <p className="text-sm text-gold" role="status" data-testid="film-spec-error">{specError}</p>}
      {busy && (
        <div className="space-y-1" role="status" data-testid="film-render-busy">
          <div className="h-2 rounded bg-surface-sunken overflow-hidden"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round((active.progress || 0) * 100)}%` }} /></div>
          <p className="text-micro text-muted-foreground">{active.state === "queued" ? "Waiting to start…" : `Rendering… ${Math.round((active.progress || 0) * 100)}%`}</p>
        </div>
      )}
      {active?.state === "failed" && <p className="text-sm text-gold" role="status" data-testid="film-render-failed">Render failed ({active.code}): {active.message}{active.detail ? ` ${active.detail}` : ""} Your film and earlier editions are unchanged.</p>}
      {active?.state === "canceled" && <p className="text-sm text-gold" role="status" data-testid="film-render-canceled">Render cancelled. Your film and earlier editions are unchanged.</p>}
      <ol className="space-y-1.5" data-testid="film-edition-list">
        {editions.length === 0 && <li className="text-sm text-muted-foreground">No editions yet.</li>}
        {editions.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2" data-testid={`film-edition-${e.number}`}>
            <div>
              <p className="text-sm text-foreground font-semibold">Edition {e.number} · <span className="uppercase tracking-widest text-micro">{e.state}</span></p>
              <p className="text-micro text-muted-foreground">{e.duration_ms ? `${formatFilmMs(e.duration_ms)} · ` : ""}{e.bytes ? `${(e.bytes / 1024 / 1024).toFixed(1)} MB · ` : ""}sequence {String(e.spec_sha256 || "").slice(0, 12)}{e.error_code ? ` · ${e.error_code}` : ""}</p>
            </div>
            {e.state === "done" && e.file && (
              <div className="flex gap-1.5">
                <a href={editionFileUrl(film.id, e.file)} download className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-lg bg-primary text-ink text-sm font-semibold" data-testid={`film-download-${e.number}`}><DownloadSimple size={16} weight="bold" /> Video</a>
                <a href={editionFileUrl(film.id, e.manifest_file)} download className="inline-flex items-center min-h-10 px-3 rounded-lg border border-border text-sm text-foreground" data-testid={`film-manifest-${e.number}`}>Manifest</a>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
