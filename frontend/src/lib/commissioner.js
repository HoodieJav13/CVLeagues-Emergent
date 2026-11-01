/* ============================================================================
 * COMMISSIONER DRAFTS — pure round logic and separate local persistence.
 * ----------------------------------------------------------------------------
 * BROWSER DRAFT ONLY. A check here is a local recap check: it never approves, finalizes
 * or corrects an official score. Nothing in this module touches shared app
 * state, and nothing here can represent an external post.
 *
 * One versioned localStorage key holds every round. Storage and the clock are
 * injected so each rule is testable. Writes are synchronous read-validate-write
 * steps confirmed by reading back; a result is only ever reported from that
 * confirmation. Per-round revisions refuse a write based on an older copy.
 * ========================================================================== */

import { LEAGUE_TIME_ZONE, byStartAscending, formatGameLongDate, gameDateKey } from "./gameTime";
import { isForfeitOutcome } from "./selectors";

export const STORE_KEY = "cvf.commissioner.draft.v1";
export const SET_ASIDE_PREFIX = `${STORE_KEY}.set-aside.`;
export const STORE_SCHEMA = "cvf.commissioner";
export const STORE_VERSION = 1;

export const LIMITS = {
  heading: 120,
  body: 4000,
  rounds: 120,
  checksPerRound: 64,
  id: 120,
  fingerprint: 512,
  rawChars: 2000000,
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const ROUND_KEY = /^[^\s|]{1,120}\|\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const EMPTY_TEXT = Object.freeze({ heading: "", body: "" });
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const stamp = (now) => new Date(now()).toISOString();

export const sameText = (a, b) => (a?.heading ?? "") === (b?.heading ?? "") && (a?.body ?? "") === (b?.body ?? "");

export const formatStamp = (iso) => new Date(iso).toLocaleString("en-US", {
  timeZone: LEAGUE_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/* --------------------------------- rounds ---------------------------------- */
export const roundKeyFor = (leagueId, dateKey) => `${leagueId}|${dateKey}`;

// A round is one league on one league-local date. Newest first; a game that
// cannot be placed in a round is counted rather than quietly dropped.
export function buildRounds(state) {
  const leagues = new Map((state?.leagues || []).map((league) => [league.id, league]));
  const groups = new Map();
  let skipped = 0;
  (state?.games || []).forEach((game) => {
    const league = leagues.get(game.league_id);
    const date = gameDateKey(game);
    const key = roundKeyFor(game.league_id, date);
    if (!league || !DATE_KEY.test(date) || !ROUND_KEY.test(key)) {
      skipped += 1;
      return;
    }
    if (!groups.has(key)) groups.set(key, { key, league, date, games: [] });
    groups.get(key).games.push(game);
  });
  const rounds = [...groups.values()]
    .map(({ key, league, date, games }) => {
      const sorted = [...games].sort(byStartAscending);
      return {
        key,
        date,
        games: sorted,
        leagueId: league.id,
        leagueName: league.name,
        season: league.season,
        sport: league.sport || sorted[0].sport,
        dateLabel: formatGameLongDate(sorted[0]),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.leagueName.localeCompare(b.leagueName));
  return { rounds, skipped };
}

// The address bar wins, then the stored choice, then the newest round that can
// actually be finished.
export const pickRound = (rounds, urlKey, storedKey) =>
  rounds.find((round) => round.key === urlKey)
  || rounds.find((round) => round.key === storedKey)
  || rounds.find((round) => round.games.every((game) => assessGame(game).eligible))
  || rounds[0]
  || null;

/* -------------------------------- eligibility ------------------------------- */
const isScore = (value) => Number.isSafeInteger(value) && value >= 0;

// Fails safe: any forfeit marker keeps a game out of the scored path.
export const isForfeitGame = (game) =>
  Boolean(game) && (
    isForfeitOutcome(game)
    || Object.keys(game).some((key) => /forfeit/i.test(key) && Boolean(game[key]))
    || /forfeit/i.test(`${game.status || ""} ${game.score_status || ""}`));

// Eligible means completed, score final, locked and two nonnegative integers.
// Every other game stays visible and unverified, and a forfeit has no points
// to check whatever its score columns happen to hold.
export function assessGame(game) {
  const blocked = (code, label, note) => ({ eligible: false, code, label, note });
  if (isForfeitGame(game)) return blocked("forfeit", "Forfeit", "Forfeits record no score, so there is nothing to check.");
  if (game?.status === "live") return blocked("live", "Live", "Still in progress.");
  if (game?.status === "postponed") return blocked("postponed", "Postponed", "No new time set.");
  if (game?.status === "canceled") return blocked("canceled", "Canceled", "No score for this game.");
  if (game?.status !== "completed") return blocked("upcoming", "Upcoming", "Not played yet.");
  if (game.score_status !== "final") return blocked("pending", "Score pending", "The score isn't final yet.");
  if (game.locked !== true) return blocked("unlocked", "Not locked", "The game isn't locked yet.");
  if (!isScore(game.home_score) || !isScore(game.away_score)) return blocked("malformed", "Score incomplete", "The recorded score can't be read as two whole numbers.");
  return { eligible: true, code: "eligible", label: "Final", note: "" };
}

export const fingerprintGame = (game) => JSON.stringify([
  game.status ?? null,
  game.score_status ?? null,
  game.locked ?? null,
  game.home_score ?? null,
  game.away_score ?? null,
  isForfeitGame(game),
  game.winner_team_id ?? null,
  game.home_team_id ?? null,
  game.away_team_id ?? null,
]);

const teamName = (state, id) => (state?.teams || []).find((team) => team.id === id)?.name || "TBD";

export const matchupLabel = (state, game) => `${teamName(state, game.away_team_id)} at ${teamName(state, game.home_team_id)}`;

// Figures appear only for an eligible game. A forfeit names its winner, if the
// source does, and never carries points.
export function resultLine(state, game) {
  if (isForfeitGame(game)) {
    return game.winner_team_id ? `${teamName(state, game.winner_team_id)} won by forfeit, no score recorded` : "Forfeit, no score recorded";
  }
  if (!assessGame(game).eligible) return "No confirmed result";
  return `${teamName(state, game.away_team_id)} ${game.away_score}, ${teamName(state, game.home_team_id)} ${game.home_score}`;
}

/* --------------------------------- checks ---------------------------------- */
// checked: a stored check matches the game as it stands now.
// stale: a stored check no longer matches, including a game now ineligible.
export function checkRows(round, record) {
  return round.games.map((game) => {
    const assessment = assessGame(game);
    const check = (record?.checks || []).find((item) => item.gameId === game.id) || null;
    let status = assessment.eligible ? "unchecked" : "ineligible";
    if (check) status = assessment.eligible && check.fingerprint === fingerprintGame(game) ? "checked" : "stale";
    return { game, assessment, check, status };
  });
}

export const checkSnapshot = (round, record) =>
  checkRows(round, record)
    .filter((row) => row.status === "checked")
    .map((row) => ({ gameId: row.game.id, fingerprint: row.check.fingerprint }))
    .sort((a, b) => a.gameId.localeCompare(b.gameId));

const sameChecks = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Generation reads only current checks, so an unverified game cannot enter
// the recap. The caller decides when, and never does so implicitly.
export function buildRecapText(state, round, record) {
  const lines = checkRows(round, record)
    .filter((row) => row.status === "checked")
    .map((row) => resultLine(state, row.game));
  return { heading: `${round.leagueName} · ${round.dateLabel}`, body: lines.join("\n") };
}

/* --------------------------------- recap ----------------------------------- */
// What the page shows for a round. A pin holds text that storage has not
// accepted. It yields once storage holds the same text, and it is a conflict
// when the stored round has moved on from the revision the text was based on.
export function derivePage(record, pin) {
  const stored = record?.working || record?.saved || EMPTY_TEXT;
  const revision = record?.revision || 0;
  if (!pin || sameText(pin, stored)) {
    return { heading: stored.heading, body: stored.body, revision, pinned: false, conflict: false };
  }
  return { heading: pin.heading, body: pin.body, revision: pin.revision, pinned: true, conflict: pin.revision !== revision };
}

// "saved" is the only state the page may render as Saved locally.
export function recapStatus(record, page) {
  const saved = record?.saved || null;
  if (saved && sameText(saved, page)) return { code: "saved", saved };
  if (!saved && !page.heading && !page.body) return { code: "empty", saved };
  return { code: "unsaved", saved };
}

export function assessReadiness(round, record, page) {
  const rows = checkRows(round, record);
  const count = (status) => rows.filter((row) => row.status === status).length;
  const blocked = (code, nextAction) => ({ ready: false, code, nextAction, saved: null });
  if (count("stale")) return blocked("stale", `${plural(count("stale"), "result")} changed after checking. Review and check again.`);
  if (count("ineligible")) return blocked("ineligible", `${plural(count("ineligible"), "game")} can't be checked yet. The preview opens once every game in the round has a current check.`);
  if (count("unchecked")) return blocked("unchecked", `Check ${plural(count("unchecked"), "more result")} to continue.`);
  const saved = record?.saved;
  if (!saved) return blocked("unsaved", "Write the recap and save it. The preview only shows saved text.");
  if (!sameText(saved, page)) return blocked("unsaved", "Save your changes. The preview only shows saved text.");
  if (!sameChecks(saved.checks, checkSnapshot(round, record))) return blocked("resave", "The checks changed after this recap was saved. Review the text, then save again.");
  return { ready: true, code: "ready", nextAction: "", saved };
}

/* ---------------------------- schema validation ----------------------------- */
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const onlyKeys = (value, keys) => {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => present.includes(key));
};
const isCount = (value, minimum) => Number.isSafeInteger(value) && value >= minimum;
const isId = (value) => typeof value === "string" && value.length > 0 && value.length <= LIMITS.id;
const isFingerprint = (value) => typeof value === "string" && value.length > 0 && value.length <= LIMITS.fingerprint;
const isTimestamp = (value) => typeof value === "string" && TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
const isText = (value, max) => typeof value === "string" && value.length <= max;
const isRecapText = (value) => isText(value.heading, LIMITS.heading) && isText(value.body, LIMITS.body);

const uniqueIds = (items) => new Set(items.map((item) => item.gameId)).size === items.length;

const validCheck = (value) => isRecord(value) && onlyKeys(value, ["gameId", "fingerprint", "checkedAt"])
  && isId(value.gameId) && isFingerprint(value.fingerprint) && isTimestamp(value.checkedAt);

const validSnapshotItem = (value) => isRecord(value) && onlyKeys(value, ["gameId", "fingerprint"])
  && isId(value.gameId) && isFingerprint(value.fingerprint);

const validWorking = (value) => isRecord(value) && onlyKeys(value, ["heading", "body", "updatedAt"])
  && isRecapText(value) && isTimestamp(value.updatedAt);

const validSaved = (value) => isRecord(value) && onlyKeys(value, ["heading", "body", "savedAt", "receipt", "checks"])
  && isRecapText(value) && isTimestamp(value.savedAt) && isCount(value.receipt, 1)
  && Array.isArray(value.checks) && value.checks.length <= LIMITS.checksPerRound
  && value.checks.every(validSnapshotItem) && uniqueIds(value.checks);

const validRound = (value) => isRecord(value) && onlyKeys(value, ["revision", "checks", "working", "saved"])
  && isCount(value.revision, 1)
  && Array.isArray(value.checks) && value.checks.length <= LIMITS.checksPerRound
  && value.checks.every(validCheck) && uniqueIds(value.checks)
  && (value.working === null || validWorking(value.working))
  && (value.saved === null || validSaved(value.saved));

const validDoc = (value) => onlyKeys(value, ["schema", "version", "selectedRoundKey", "rounds"])
  && (value.selectedRoundKey === null || (typeof value.selectedRoundKey === "string" && ROUND_KEY.test(value.selectedRoundKey)))
  && isRecord(value.rounds)
  && Object.keys(value.rounds).length <= LIMITS.rounds
  && Object.entries(value.rounds).every(([key, round]) => ROUND_KEY.test(key) && validRound(round));

export const emptyDoc = () => ({ schema: STORE_SCHEMA, version: STORE_VERSION, selectedRoundKey: null, rounds: {} });

// Anything outside the allowlist, a posted flag included, makes the whole value
// unreadable rather than partly trusted.
export function parseStore(raw) {
  if (raw === null || raw === undefined) return { status: "empty", doc: emptyDoc() };
  if (typeof raw !== "string" || raw.length > LIMITS.rawChars) return { status: "corrupt", doc: null };
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: "corrupt", doc: null };
  }
  if (!isRecord(value) || value.schema !== STORE_SCHEMA) return { status: "corrupt", doc: null };
  if (value.version !== STORE_VERSION) return { status: "unknown-version", doc: null };
  return validDoc(value) ? { status: "ready", doc: value } : { status: "corrupt", doc: null };
}

/* ------------------------------- persistence -------------------------------- */
const MESSAGES = {
  unavailable: "This browser is blocking local storage, so nothing was kept. Allow site storage, then try again. Your text stays on this page until you leave it.",
  corrupt: "The commissioner data in this browser can't be read. It was left untouched and nothing new was kept. Set it aside below to carry on.",
  "unknown-version": "The commissioner data in this browser came from a different version. It was left untouched and nothing new was kept. Set it aside below to carry on.",
  conflict: "This round changed in another tab, so nothing was overwritten. Choose which version to keep.",
  "write-failed": "This browser refused the write, so nothing new was kept. Your text is still here and any earlier saved version is unchanged. Free up site storage, then try again.",
  "write-unconfirmed": "This browser didn't confirm the write, so it doesn't count. Your text is still here. Try again.",
  "too-large": "Commissioner data has reached its local size limit. Shorten a long recap, then try again.",
  "round-limit": `Local work is limited to ${LIMITS.rounds} rounds and that limit is reached, so this round wasn't kept.`,
  invalid: "That change doesn't fit the local format, so it wasn't kept. Your text is still here.",
  "text-empty": "Add a heading and a recap body, then save.",
  "not-eligible": "This game can't take a recap check right now.",
  "not-unreadable": "The commissioner data is readable, so there is nothing to set aside.",
  "set-aside-failed": "The unreadable data couldn't be copied, so it was left exactly where it is. Free up site storage, then try again.",
};

const failure = (code, extra = {}) => ({ ok: false, code, message: MESSAGES[code], ...extra });

export function browserStorage() {
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

// Always returns a doc so the page can render. writable is false for every
// state in which a write could damage or misreport what is stored.
export function loadStore(storage) {
  let raw;
  try {
    if (!storage) throw new Error("no storage");
    raw = storage.getItem(STORE_KEY);
  } catch {
    return { status: "unavailable", doc: emptyDoc(), writable: false, message: MESSAGES.unavailable };
  }
  const parsed = parseStore(raw);
  if (parsed.doc) return { status: parsed.status, doc: parsed.doc, writable: true, message: "" };
  return { status: parsed.status, doc: emptyDoc(), writable: false, message: MESSAGES[parsed.status] };
}

function writeDoc(storage, doc) {
  const payload = JSON.stringify(doc);
  if (payload.length > LIMITS.rawChars) return failure("too-large");
  if (parseStore(payload).status !== "ready") return failure("invalid");
  try {
    storage.setItem(STORE_KEY, payload);
  } catch {
    return failure("write-failed");
  }
  try {
    if (storage.getItem(STORE_KEY) !== payload) return failure("write-unconfirmed");
  } catch {
    return failure("write-unconfirmed");
  }
  return { ok: true, doc };
}

// A change returns the next record, or null when there is nothing to write.
function updateRound(storage, roundKey, expectedRevision, change) {
  const loaded = loadStore(storage);
  if (!loaded.writable) return failure(loaded.status);
  if (!ROUND_KEY.test(roundKey || "")) return failure("invalid");
  const current = loaded.doc.rounds[roundKey] || null;
  if ((current?.revision || 0) !== expectedRevision) return failure("conflict", { record: current });
  if (!current && Object.keys(loaded.doc.rounds).length >= LIMITS.rounds) return failure("round-limit");
  const next = change(current || { revision: 0, checks: [], working: null, saved: null });
  if (next === null) return { ok: true, unchanged: true, doc: loaded.doc, record: current };
  const record = { ...next, revision: (current?.revision || 0) + 1 };
  const written = writeDoc(storage, { ...loaded.doc, rounds: { ...loaded.doc.rounds, [roundKey]: record } });
  return written.ok ? { ...written, record } : written;
}

function textFailure({ heading, body }) {
  const over = (label, text, max) => failure("invalid", {
    message: `The ${label} is ${(text.length - max).toLocaleString("en-US")} characters over the ${max.toLocaleString("en-US")} limit. Trim it and try again.`,
  });
  if (heading.length > LIMITS.heading) return over("heading", heading, LIMITS.heading);
  if (body.length > LIMITS.body) return over("recap body", body, LIMITS.body);
  return null;
}

// A working draft is recoverable, never a save: saved content is untouched.
export function saveWorking(storage, { roundKey, expectedRevision, heading, body, now = Date.now }) {
  const tooLong = textFailure({ heading, body });
  if (tooLong) return tooLong;
  return updateRound(storage, roundKey, expectedRevision, (record) => {
    const nothingToKeep = record.saved ? sameText(record.saved, { heading, body }) : !heading && !body;
    if (nothingToKeep) return record.working ? { ...record, working: null } : null;
    if (record.working && sameText(record.working, { heading, body })) return null;
    return { ...record, working: { heading, body, updatedAt: stamp(now) } };
  });
}

// Explicit save. The same text and checks again keep the same receipt.
export function saveRecap(storage, { roundKey, expectedRevision, heading, body, snapshot, now = Date.now }) {
  const tooLong = textFailure({ heading, body });
  if (tooLong) return tooLong;
  if (!heading.trim() || !body.trim()) return failure("text-empty");
  return updateRound(storage, roundKey, expectedRevision, (record) => {
    const repeat = record.saved && sameText(record.saved, { heading, body }) && sameChecks(record.saved.checks, snapshot);
    if (repeat) return record.working ? { ...record, working: null } : null;
    return {
      ...record,
      working: null,
      saved: { heading, body, savedAt: stamp(now), receipt: (record.saved?.receipt || 0) + 1, checks: snapshot },
    };
  });
}

export function setCheck(storage, { roundKey, expectedRevision, game, now = Date.now }) {
  if (!assessGame(game).eligible) return failure("not-eligible");
  const fingerprint = fingerprintGame(game);
  return updateRound(storage, roundKey, expectedRevision, (record) => {
    const existing = record.checks.find((item) => item.gameId === game.id);
    if (existing?.fingerprint === fingerprint) return null;
    const others = record.checks.filter((item) => item.gameId !== game.id);
    return { ...record, checks: [...others, { gameId: game.id, fingerprint, checkedAt: stamp(now) }] };
  });
}

export function clearCheck(storage, { roundKey, expectedRevision, gameId }) {
  return updateRound(storage, roundKey, expectedRevision, (record) =>
    record.checks.some((item) => item.gameId === gameId)
      ? { ...record, checks: record.checks.filter((item) => item.gameId !== gameId) }
      : null);
}

// Which round is open is a preference, not work: it carries no revision and
// never conflicts with another tab's round.
export function writeSelectedRound(storage, roundKey) {
  const loaded = loadStore(storage);
  if (!loaded.writable) return failure(loaded.status);
  if (loaded.doc.selectedRoundKey === roundKey) return { ok: true, unchanged: true, doc: loaded.doc };
  return writeDoc(storage, { ...loaded.doc, selectedRoundKey: roundKey });
}

// Explicit recovery only. The unreadable value is copied to its own key and
// confirmed before the main key is replaced; no key is ever removed.
export function setAsideUnreadable(storage, { now = Date.now } = {}) {
  const loaded = loadStore(storage);
  if (loaded.status === "unavailable") return failure("unavailable");
  if (loaded.writable) return failure("not-unreadable");
  try {
    const raw = storage.getRecoveryItem ? storage.getRecoveryItem(STORE_KEY) : storage.getItem(STORE_KEY);
    const base = `${SET_ASIDE_PREFIX}${stamp(now)}`;
    let key = base;
    for (let suffix = 1; storage.getItem(key) !== null; suffix += 1) key = `${base}-${suffix}`;
    storage.setItem(key, raw);
    if (storage.getItem(key) !== raw) return failure("set-aside-failed");
    const written = writeDoc(storage, emptyDoc());
    return written.ok ? { ...written, setAsideKey: key } : written;
  } catch {
    return failure("set-aside-failed");
  }
}
