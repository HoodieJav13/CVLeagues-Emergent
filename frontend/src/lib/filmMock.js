import { COMPOSITION_SCHEMA, DEFAULT_SETTINGS, HOLD_LIMITS, MAX_CAPTION, clipRef, contextRecord } from "./film";

/* ============================================================================
 * Season Film: development mock-state transitions (pure).
 * ----------------------------------------------------------------------------
 * (state, input, ctx) → { next, result } or throw a plain Error whose message
 * is the user-facing refusal (last-good state untouched). Compositions live in
 * state.filmCompositions in the same versioned mock store; each belongs to one
 * fictional viewer and is never visible to another. Editions are append-only:
 * a done edition is never rewritten, and a new render always gets a new number.
 * ========================================================================== */

const films = (state) => (Array.isArray(state.filmCompositions) ? state.filmCompositions : []);
const upsert = (items, item) => (items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item]);
const text = (value, max = MAX_CAPTION) => String(value || "").trim().slice(0, max);

export const filmsOwnedBy = (state, viewer_id) =>
  films(state).filter((f) => f.owner_id === viewer_id).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));

export function createFilm(state, { title }, { now, makeId, viewer_id }) {
  if (!viewer_id) throw new Error("Choose who you are first.");
  const film = {
    schema: COMPOSITION_SCHEMA,
    id: makeId("film"),
    owner_id: viewer_id,
    title: text(title, 60) || "My season film",
    created_at: now,
    updated_at: now,
    settings: { ...DEFAULT_SETTINGS },
    title_card: { show: true, subtitle: "" },
    chapters: [{ id: makeId("ch"), title: "Chapter one", subtitle: "", card_ms: DEFAULT_SETTINGS.card_ms, items: [] }],
    editions: [],
  };
  return { next: { ...state, filmCompositions: [...films(state), film] }, result: film };
}

// Validates and stores the whole authoring state. Editions are carried over
// from the stored film untouched: only recordEdition may change them.
export function saveFilm(state, composition, { now, viewer_id }) {
  const stored = films(state).find((f) => f.id === composition?.id);
  if (!stored) throw new Error("That film no longer exists.");
  if (stored.owner_id !== viewer_id) throw new Error("You can only edit your own films.");
  const clips = state.replayClips || [];
  const chapters = (composition.chapters || []).map((chapter) => {
    if (!chapter.id) throw new Error("A chapter is missing its id.");
    const items = (chapter.items || []).map((item) => {
      if (item.kind === "moment") {
        const clip = clips.find((c) => c.id === item.clip_id);
        if (!clip && !item.clip_ref) throw new Error("A moment's highlight no longer exists.");
        if (clip && clip.owner_id !== viewer_id) throw new Error("A film can only use your own highlights.");
        const hold = item.hold ? { at: "end", ms: Math.max(HOLD_LIMITS.min, Math.min(HOLD_LIMITS.max, Math.round(Number(item.hold.ms) || 1500))), comment: text(item.hold.comment) } : null;
        return {
          id: item.id, kind: "moment", clip_id: item.clip_id,
          clip_ref: item.clip_ref || clipRef(state, clip),
          caption: text(item.caption?.text) ? { text: text(item.caption.text), authored: true } : null,
          hold, audio: item.audio === "mute" ? "mute" : "source",
        };
      }
      if (item.kind === "context") {
        if (!(state.games || []).some((g) => g.id === item.game_id)) throw new Error("A context card's game no longer exists.");
        return {
          id: item.id, kind: "context", game_id: item.game_id, ms: Math.max(1500, Math.min(6000, Math.round(Number(item.ms) || 3000))),
          record: item.record || contextRecord(state, item.game_id, now),
          note: text(item.note?.text) ? { text: text(item.note.text), authored: true } : null,
        };
      }
      throw new Error("Unknown story item.");
    });
    return { id: chapter.id, title: text(chapter.title, 48) || "Untitled chapter", subtitle: text(chapter.subtitle, 60), card_ms: Math.max(1500, Math.min(5000, Math.round(Number(chapter.card_ms) || 2500))), items };
  });
  const settings = {
    ...DEFAULT_SETTINGS,
    fit: composition.settings?.fit === "fill-crop" ? "fill-crop" : "letterbox",
    card_ms: Math.max(1500, Math.min(5000, Math.round(Number(composition.settings?.card_ms) || DEFAULT_SETTINGS.card_ms))),
  };
  const film = {
    ...stored,
    title: text(composition.title, 60) || "My season film",
    title_card: { show: composition.title_card?.show !== false, subtitle: text(composition.title_card?.subtitle, 60) },
    settings,
    chapters,
    updated_at: now,
  };
  return { next: { ...state, filmCompositions: upsert(films(state), film) }, result: film };
}

// Deliberate adoption of a highlight's current L1 revision (after an L1 edit
// or an explicit relink there).
export function adoptUpdatedHighlight(state, { film_id, item_id }, { now, viewer_id }) {
  const film = films(state).find((f) => f.id === film_id);
  if (!film || film.owner_id !== viewer_id) throw new Error("You can only edit your own films.");
  let found = false;
  const chapters = film.chapters.map((ch) => ({ ...ch, items: ch.items.map((item) => {
    if (item.id !== item_id || item.kind !== "moment") return item;
    const clip = (state.replayClips || []).find((c) => c.id === item.clip_id);
    if (!clip || clip.owner_id !== viewer_id) throw new Error("That highlight no longer exists in Replay Studio.");
    found = true;
    return { ...item, clip_ref: clipRef(state, clip) };
  }) }));
  if (!found) throw new Error("That moment no longer exists.");
  return saveFilm(state, { ...film, chapters }, { now, viewer_id });
}

// Deliberate refresh of a context card from the current game record.
export function updateContext(state, { film_id, item_id }, { now, viewer_id }) {
  const film = films(state).find((f) => f.id === film_id);
  if (!film || film.owner_id !== viewer_id) throw new Error("You can only edit your own films.");
  const chapters = film.chapters.map((ch) => ({ ...ch, items: ch.items.map((item) =>
    item.id === item_id && item.kind === "context" ? { ...item, record: contextRecord(state, item.game_id, now) } : item) }));
  return saveFilm(state, { ...film, chapters }, { now, viewer_id });
}

// Edition records: create (queued) and advance; done ones are immutable.
export function recordEdition(state, { film_id, edition }, { viewer_id }) {
  const film = films(state).find((f) => f.id === film_id);
  if (!film) throw new Error("That film no longer exists.");
  if (film.owner_id !== viewer_id) throw new Error("Only the film's author can render it.");
  const existing = film.editions.find((e) => e.id === edition.id);
  if (existing && existing.state === "done") throw new Error("A finished edition is never rewritten. Render a new edition instead.");
  const number = existing ? existing.number : film.editions.reduce((n, e) => Math.max(n, e.number), 0) + 1;
  const next = { ...existing, ...edition, number };
  const updated = { ...film, editions: upsert(film.editions, next) };
  return { next: { ...state, filmCompositions: upsert(films(state), updated) }, result: next };
}
