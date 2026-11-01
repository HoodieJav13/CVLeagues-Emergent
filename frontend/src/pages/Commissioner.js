import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import { RoleGate } from "../components/layout/RoleGate";
import { createDraftStorage, draftScope } from "../lib/commissionerStorage";
import { BACKEND_ENABLED, MOCK_MODE } from "../lib/supabase";
import { sportName } from "../lib/statsConfig";
import { SportBadge } from "../components/common/Badges";
import {
  LIMITS,
  assessReadiness,
  buildRecapText,
  buildRounds,
  checkRows,
  checkSnapshot,
  clearCheck,
  derivePage,
  formatStamp,
  loadStore,
  matchupLabel,
  pickRound,
  recapStatus,
  resultLine,
  sameText,
  saveRecap,
  saveWorking,
  setAsideUnreadable,
  setCheck,
  writeSelectedRound,
} from "../lib/commissioner";
import "./Commissioner.css";

// Reads the shared app state only. Browser drafts never finalize scores or post.

const omit = (map, key) => {
  if (!(key in map)) return map;
  const { [key]: _removed, ...rest } = map;
  return rest;
};

export default function Commissioner() {
  return <RoleGate allow={["admin"]} title="Commissioner"><AuthorizedWorkspace /></RoleGate>;
}

function AuthorizedWorkspace() {
  const { state } = useApp();
  const { role, session, authStatus } = useRole();
  const scope = draftScope({ backend: BACKEND_ENABLED, mock: MOCK_MODE,
    production: process.env.NODE_ENV === "production", project: process.env.REACT_APP_SUPABASE_URL,
    actor: session?.user?.id, role, authStatus });
  if (!scope) return <p role="status">Administrator authorization is required for commissioner drafts.</p>;
  if (!state) return <p role="status">Loading league data…</p>;
  return <Workspace key={scope} state={state} scope={scope} />;
}

function Workspace({ state, scope }) {
  const storage = useMemo(() => createDraftStorage(window, scope), [scope]);
  const location = useLocation();
  const navigate = useNavigate();
  const { rounds, skipped } = useMemo(() => buildRounds(state), [state]);
  const [store, setStore] = useState(() => loadStore(storage));
  const [pins, setPins] = useState({});
  const [errors, setErrors] = useState({});
  const [unconfirmed, setUnconfirmed] = useState({});
  const [recoveryNote, setRecoveryNote] = useState("");

  const urlRound = new URLSearchParams(location.search).get("round");
  const round = pickRound(rounds, urlRound, store.doc.selectedRoundKey);
  const roundKey = round?.key || null;
  const record = roundKey ? store.doc.rounds[roundKey] || null : null;
  const page = derivePage(record, roundKey ? pins[roundKey] : null);

  // Explicit round choices update the address bar; initial render must not
  // navigate over a concurrent role/login navigation.

  // Another tab's write refreshes this one. Visible text that differs is
  // pinned, so it turns into a stated conflict instead of being replaced.
  const view = useRef(null);
  useEffect(() => {
    view.current = { key: roundKey, page };
  });
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== null && !storage.acceptsEvent(event.key)) return;
      const next = loadStore(storage);
      const shown = view.current;
      if (shown?.key && (shown.page.heading || shown.page.body)) {
        const incoming = derivePage(next.doc.rounds[shown.key] || null, null);
        if (incoming.revision !== shown.page.revision && !sameText(incoming, shown.page)) {
          const { heading, body, revision } = shown.page;
          setPins((prior) => (prior[shown.key] ? prior : { ...prior, [shown.key]: { heading, body, revision } }));
        }
      }
      setStore(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storage]);

  // pin: set for a text action, whose page text stored success makes redundant.
  const apply = (key, result, pin, confirmedSave = false) => {
    if (result.ok) {
      if (confirmedSave) setUnconfirmed((prior) => omit(prior, key));
      setStore({ status: "ready", doc: result.doc, writable: true, message: "" });
      setErrors((prior) => omit(prior, key));
      setPins((prior) => {
        if (pin) return omit(prior, key);
        const revision = result.record?.revision;
        return prior[key] && revision ? { ...prior, [key]: { ...prior[key], revision } } : prior;
      });
      return true;
    }
    if (result.code === "write-unconfirmed") setUnconfirmed((prior) => ({ ...prior, [key]: true }));
    if (pin) setPins((prior) => ({ ...prior, [key]: pin }));
    setErrors((prior) => ({ ...prior, [key]: result.message }));
    setStore(loadStore(storage));
    return false;
  };

  const selectRound = (key) => {
    // The address bar already keeps the choice, so a refused preference write
    // costs nothing the user needs to act on.
    writeSelectedRound(storage, key);
    setStore(loadStore(storage));
    const params = new URLSearchParams(location.search);
    params.set("round", key);
    navigate({ search: `?${params}` }, { replace: true, state: location.state });
  };

  // The notice holding the pressed button goes away on recovery, so focus
  // moves to the page heading rather than falling back to the document.
  const headingRef = useRef(null);
  const retryStorage = () => {
    const next = loadStore(storage);
    setRecoveryNote("");
    setStore(next);
    if (next.writable) headingRef.current?.focus();
  };

  const setAside = () => {
    const result = setAsideUnreadable(storage);
    if (!result.ok) {
      setRecoveryNote(result.message);
      return false;
    }
    setStore({ status: "ready", doc: result.doc, writable: true, message: "" });
    setErrors({});
    setRecoveryNote(`The unreadable data is kept under ${result.setAsideKey}. Commissioner work starts empty here.`);
    headingRef.current?.focus();
    return true;
  };

  return (
    <div className="cvf-commissioner" data-testid="commissioner">
      <aside className="cvf-commissioner__banner" aria-label="About browser drafts">
        <p><strong>Browser-only draft</strong> · {BACKEND_ENABLED ? "Current loaded league data" : "Local fixture data"} · drafts stay on this device, including after sign-out. Use a private device; clearing site data loses drafts. No cloud save or posting.</p>
        <Link className="cvf-commissioner__link" to="/admin" data-testid="commissioner-back">Back to Admin</Link>
      </aside>

      <header className="cvf-commissioner__head">
        <h1 id="commissioner-title" ref={headingRef} tabIndex={-1} className="cvf-band text-display-xl">Commissioner</h1>
        <p className="cvf-commissioner__sub">A recap check records your review of the loaded result. It never approves, finalizes or corrects an official score.</p>
      </header>

      {BACKEND_ENABLED ? <div className="cvf-commissioner__actions">
        <button type="button" className="cvf-commissioner__button cvf-commissioner__button--quiet" onClick={() => window.location.reload()}>Refresh results</button>
        <p className="cvf-commissioner__note">Checks use the latest loaded league data. Refresh before using the preview; your kept draft reopens after the page reloads.</p>
      </div> : null}
      <StorageNotice store={store} note={recoveryNote} onRetry={retryStorage} onSetAside={setAside} />

      {round ? (
        <section className="cvf-commissioner__view" aria-labelledby="commissioner-title">
          <RoundPicker rounds={rounds} round={round} skipped={skipped} onSelect={selectRound} />
          <RoundDesk
            key={round.key}
            state={state}
            storage={storage}
            round={round}
            record={record}
            page={page}
            error={errors[round.key] || ""}
            writable={store.writable}
            unconfirmed={Boolean(unconfirmed[round.key])}
            onResult={(result, pin, confirmedSave) => apply(round.key, result, pin, confirmedSave)}
            onHold={(pin) => setPins((prior) => ({ ...prior, [round.key]: pin }))}
            onDiscard={() => {
              setPins((prior) => omit(prior, round.key));
              setErrors((prior) => omit(prior, round.key));
            }}
          />
        </section>
      ) : (
        <p className="cvf-commissioner__notice" data-testid="commissioner-no-rounds">No rounds to review yet. Rounds appear once league games are on the schedule.</p>
      )}
    </div>
  );
}

function StorageNotice({ store, note, onRetry, onSetAside }) {
  const [confirming, setConfirming] = useState(false);
  const opener = useRef(null);
  const confirmButton = useRef(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
    else if (wasConfirming.current) opener.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  const unreadable = store.status === "corrupt" || store.status === "unknown-version";

  return (
    <>
      {note ? <p className="cvf-commissioner__notice" role="status" data-testid="commissioner-recovery-note">{note}</p> : null}
      {store.writable ? null : (
        <div className="cvf-commissioner__notice cvf-commissioner__alert" role="alert" data-testid="commissioner-storage-alert">
          <p>{store.message}</p>
          <div className="cvf-commissioner__actions">
            <button type="button" className="cvf-commissioner__button cvf-commissioner__button--quiet" onClick={onRetry}>Try storage again</button>
            {unreadable && !confirming ? (
              <button ref={opener} type="button" className="cvf-commissioner__button cvf-commissioner__button--quiet" data-testid="commissioner-set-aside" onClick={() => setConfirming(true)}>
                Set aside unreadable data
              </button>
            ) : null}
          </div>
          {unreadable && confirming ? (
            <div className="cvf-commissioner__confirm" data-testid="commissioner-set-aside-confirm">
              <p>This copies the unreadable data to its own local key and starts commissioner work empty. Nothing is deleted and no other saved data is touched. The copy can't be opened from this page.</p>
              <div className="cvf-commissioner__actions">
                <button
                  ref={confirmButton}
                  type="button"
                  className="cvf-commissioner__button"
                  data-testid="commissioner-set-aside-yes"
                  onClick={() => {
                    if (onSetAside()) setConfirming(false);
                  }}
                >
                  Set aside and start empty
                </button>
                <button type="button" className="cvf-commissioner__button cvf-commissioner__button--quiet" data-testid="commissioner-set-aside-no" onClick={() => setConfirming(false)}>Keep it as is</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

function RoundPicker({ rounds, round, skipped, onSelect }) {
  const count = round.games.length;
  return (
    <div className="cvf-commissioner__panel cvf-commissioner__round">
      <label className="cvf-commissioner__field" htmlFor="commissioner-round">
        <span>Round</span>
        <select id="commissioner-round" data-testid="commissioner-round" value={round.key} onChange={(event) => onSelect(event.target.value)}>
          {rounds.map((item) => (
            <option key={item.key} value={item.key}>
              {item.leagueName} · {item.dateLabel} · {item.games.length} game{item.games.length === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <p className="cvf-commissioner__summary" data-testid="commissioner-round-summary">
        <SportBadge sport={round.sport} />
        <span>{sportName(round.sport)}</span>
        <span>{round.dateLabel}</span>
        <span>{count} game{count === 1 ? "" : "s"} this round</span>
      </p>
      {skipped ? <p className="cvf-commissioner__note">{skipped} game{skipped === 1 ? " has" : "s have"} no league or date on record and {skipped === 1 ? "isn't" : "aren't"} in any round.</p> : null}
    </div>
  );
}

const STATUS_LABEL = {
  unchecked: () => "Not checked",
  checked: (row) => `Local recap check · ${formatStamp(row.check.checkedAt)}`,
  stale: () => "Check out of date · the result changed",
  ineligible: (row) => `Unverified · ${row.assessment.note}`,
};

function RoundDesk({ state, storage, round, record, page, error, writable, unconfirmed, onResult, onHold, onDiscard }) {
  const rows = checkRows(round, record);
  const checkedCount = rows.filter((row) => row.status === "checked").length;
  const conflict = page.conflict && writable;
  const pinFor = (text) => ({ heading: text.heading, body: text.body, revision: page.revision });

  const check = (game) => onResult(setCheck(storage, { roundKey: round.key, expectedRevision: page.revision, game }));
  const uncheck = (game) => onResult(clearCheck(storage, { roundKey: round.key, expectedRevision: page.revision, gameId: game.id }));

  const edit = (patch) => {
    const text = { heading: page.heading, body: page.body, ...patch };
    if (page.conflict) {
      onHold(pinFor(text));
      return;
    }
    onResult(saveWorking(storage, { roundKey: round.key, expectedRevision: page.revision, ...text }), pinFor(text));
  };

  const save = () => onResult(
    saveRecap(storage, {
      roundKey: round.key,
      expectedRevision: page.revision,
      heading: page.heading,
      body: page.body,
      snapshot: checkSnapshot(round, record),
    }),
    pinFor(page),
    true,
  );

  const keepThisText = () => {
    const revision = record?.revision || 0;
    const text = { heading: page.heading, body: page.body };
    onResult(saveWorking(storage, { roundKey: round.key, expectedRevision: revision, ...text }), { ...text, revision });
  };

  return (
    <div className="cvf-commissioner__desk">
      <section className="cvf-commissioner__panel" aria-labelledby="commissioner-checks-title">
        <h2 id="commissioner-checks-title" className="cvf-commissioner__title">Check results</h2>
        <p className="cvf-commissioner__note">Review each result shown here. {checkedCount} of {rows.length} checked.</p>
        <ul className="cvf-commissioner__games">
          {rows.map((row) => <GameRow key={row.game.id} state={state} row={row} onCheck={check} onUncheck={uncheck} />)}
        </ul>
      </section>

      <div className="cvf-commissioner__stack">
        <RecapEditor
          state={state}
          round={round}
          record={record}
          page={page}
          error={error}
          unconfirmed={unconfirmed}
          conflict={conflict}
          canBuild={checkedCount > 0}
          onEdit={edit}
          onSave={save}
          onKeepThisText={keepThisText}
          onLoadStored={onDiscard}
        />
        <SharePreview round={round} record={record} page={page} unconfirmed={unconfirmed} />
      </div>
    </div>
  );
}

function GameRow({ state, row, onCheck, onUncheck }) {
  const { game, assessment, status } = row;
  const matchup = matchupLabel(state, game);
  const canCheck = status === "unchecked" || (status === "stale" && assessment.eligible);
  const canUndo = status === "checked" || (status === "stale" && !assessment.eligible);
  const action = canCheck ? (status === "stale" ? "Check again" : "Check result") : "Undo check";
  return (
    <li className="cvf-commissioner__game" data-commissioner-game={game.id} data-check={status}>
      <div className="cvf-commissioner__game-text">
        <p className="cvf-commissioner__state">{assessment.label}</p>
        <p className="cvf-commissioner__matchup">{matchup}</p>
        <p className="cvf-commissioner__result">{resultLine(state, game)}</p>
        <p className="cvf-commissioner__note">{STATUS_LABEL[status](row)}</p>
      </div>
      {/* One element for every state, so keyboard focus survives the toggle. */}
      {canCheck || canUndo ? (
        <button
          type="button"
          className={`cvf-commissioner__button${canCheck ? "" : " cvf-commissioner__button--quiet"}`}
          aria-label={`${action}: ${matchup}`}
          onClick={() => (canCheck ? onCheck(game) : onUncheck(game))}
        >
          {action}
        </button>
      ) : null}
    </li>
  );
}

function RecapEditor({ state, round, record, page, error, unconfirmed, conflict, canBuild, onEdit, onSave, onKeepThisText, onLoadStored }) {
  const [replacing, setReplacing] = useState(false);
  const headingInput = useRef(null);
  const buildButton = useRef(null);
  const replaceButton = useRef(null);
  useEffect(() => {
    if (replacing) replaceButton.current?.focus();
  }, [replacing]);

  const hasText = Boolean(page.heading || page.body);
  const generate = () => {
    onEdit(buildRecapText(state, round, record));
    setReplacing(false);
    headingInput.current?.focus();
  };
  const cancelReplace = () => {
    setReplacing(false);
    buildButton.current?.focus();
  };
  const resolve = (action) => {
    action();
    headingInput.current?.focus();
  };

  return (
    <section className="cvf-commissioner__panel" aria-labelledby="commissioner-recap-title">
      <h2 id="commissioner-recap-title" className="cvf-commissioner__title">Recap</h2>

      <div className="cvf-commissioner__actions">
        <button
          ref={buildButton}
          type="button"
          className="cvf-commissioner__button cvf-commissioner__button--quiet"
          data-testid="commissioner-build"
          disabled={!canBuild}
          onClick={() => (hasText ? setReplacing(true) : generate())}
        >
          {hasText ? "Replace with checked results" : "Build from checked results"}
        </button>
        {canBuild ? null : <span className="cvf-commissioner__note">Check a result to build a recap.</span>}
      </div>

      {replacing ? (
        <div className="cvf-commissioner__confirm" data-testid="commissioner-replace-confirm">
          <p>This replaces the text below with the checked results. Your earlier saved version stays until you save again.</p>
          <div className="cvf-commissioner__actions">
            <button ref={replaceButton} type="button" className="cvf-commissioner__button" data-testid="commissioner-replace-yes" onClick={generate}>Replace text</button>
            <button type="button" className="cvf-commissioner__button cvf-commissioner__button--quiet" data-testid="commissioner-replace-no" onClick={cancelReplace}>Keep my text</button>
          </div>
        </div>
      ) : null}

      <label className="cvf-commissioner__field" htmlFor="commissioner-heading">
        <span>Heading</span>
        <input
          ref={headingInput}
          id="commissioner-heading"
          type="text"
          data-testid="commissioner-heading"
          value={page.heading}
          aria-invalid={page.heading.length > LIMITS.heading}
          aria-describedby="commissioner-heading-count"
          onChange={(event) => onEdit({ heading: event.target.value })}
        />
      </label>
      <p id="commissioner-heading-count" className="cvf-commissioner__note">{page.heading.length} of {LIMITS.heading} characters</p>

      <label className="cvf-commissioner__field" htmlFor="commissioner-body">
        <span>Recap</span>
        <textarea
          id="commissioner-body"
          rows={8}
          data-testid="commissioner-body"
          value={page.body}
          aria-invalid={page.body.length > LIMITS.body}
          aria-describedby="commissioner-body-count"
          onChange={(event) => onEdit({ body: event.target.value })}
        />
      </label>
      <p id="commissioner-body-count" className="cvf-commissioner__note">{page.body.length} of {LIMITS.body} characters</p>

      {conflict ? (
        <div className="cvf-commissioner__notice cvf-commissioner__alert" role="alert" data-testid="commissioner-conflict">
          <p>This round changed in another tab. The text above is this tab's version and nothing has been overwritten.</p>
          <div className="cvf-commissioner__actions">
            <button type="button" className="cvf-commissioner__button cvf-commissioner__button--quiet" data-testid="commissioner-keep-mine" onClick={() => resolve(onKeepThisText)}>Keep this tab's text as the draft</button>
            <button type="button" className="cvf-commissioner__button cvf-commissioner__button--quiet" data-testid="commissioner-load-stored" onClick={() => resolve(onLoadStored)}>Load the other tab's version</button>
          </div>
        </div>
      ) : null}

      {error && !conflict ? <p className="cvf-commissioner__notice cvf-commissioner__alert" role="alert" data-testid="commissioner-error">{error}</p> : null}

      <p className="cvf-commissioner__status" role="status" data-testid="commissioner-save-state">
        <SaveState record={record} page={page} unconfirmed={unconfirmed} />
      </p>

      <div className="cvf-commissioner__actions">
        <button type="button" className="cvf-commissioner__button" data-testid="commissioner-save" onClick={onSave}>Save recap</button>
      </div>
    </section>
  );
}

function SaveState({ record, page, unconfirmed }) {
  if (unconfirmed) return "Save not confirmed · Try Save recap again to verify this browser draft.";
  const status = recapStatus(record, page);
  if (status.code === "saved") {
    return <><strong>Saved locally</strong> · Local receipt {status.saved.receipt} · {formatStamp(status.saved.savedAt)}</>;
  }
  if (status.code === "empty") return "Nothing written yet";
  const kept = record?.working && !page.pinned && sameText(record.working, page);
  const draft = kept ? `Unsaved changes · draft kept in this browser ${formatStamp(record.working.updatedAt)}` : "Unsaved changes · this text is only on this page";
  return status.saved ? `${draft} · earlier version kept, Local receipt ${status.saved.receipt}` : draft;
}

function SharePreview({ round, record, page, unconfirmed }) {
  const readiness = unconfirmed
    ? { ready: false, saved: null, nextAction: "Save was not confirmed. Try Save recap again before opening the preview." }
    : assessReadiness(round, record, page);
  const { saved } = readiness;
  return (
    <section className="cvf-commissioner__panel" aria-labelledby="commissioner-preview-title" data-testid="commissioner-preview" data-ready={readiness.ready}>
      <h2 id="commissioner-preview-title" className="cvf-commissioner__title">Share preview · not posted</h2>
      <p className="cvf-commissioner__state">Browser-only draft</p>
      {saved ? (
        <article className="cvf-commissioner__sheet" aria-labelledby="commissioner-preview-heading" data-testid="commissioner-preview-text">
          <h3 id="commissioner-preview-heading">{saved.heading}</h3>
          <p>{saved.body}</p>
          <p className="cvf-commissioner__note">Local receipt {saved.receipt} · {formatStamp(saved.savedAt)} · {saved.checks.length} current check{saved.checks.length === 1 ? "" : "s"}</p>
        </article>
      ) : (
        <p className="cvf-commissioner__notice" data-testid="commissioner-preview-next">{readiness.nextAction}</p>
      )}
      <p className="cvf-commissioner__note">This preview stays on this page.</p>
    </section>
  );
}
