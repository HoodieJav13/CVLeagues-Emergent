import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { BLANK_NEW_GAME as blank, newGameLeagues, newGameTeams, newGameVenues, validateNewGame } from "../../lib/newGame";
import { sportName } from "../../lib/statsConfig";

/* ============================================================================
 * NEW GAME — admin creation of one regular-season game.
 *
 * Writes through the existing createEntity("games") path with the schedule-
 * only payload built in lib/newGame. Tournaments, playoffs, booking conflicts
 * and automatic scheduling are out of scope by decision.
 * ========================================================================== */

const FIELD_IDS = { league_id: "league", home_team_id: "home", away_team_id: "away", starts_at: "start", venue_id: "venue" };

const SELECT_CLASS = "w-full h-11 md:h-10 rounded-lg bg-surface-sunken border border-border px-3 text-sm text-foreground aria-[invalid=true]:border-destructive";

const Field = ({ id, label, error, children }) => (
  <div>
    <Label htmlFor={`new-game-${id}`} className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 block">{label}</Label>
    {children}
    {error && <p id={`new-game-${id}-error`} className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

export { buildNewGamePayload, validateNewGame } from "../../lib/newGame";

export default function NewGameDialog({ app, open, onOpenChange }) {
  const { state, createEntity } = app;
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // `saving` disables Save only after a re-render, and a fast save can finish
  // between the two clicks of a double-click while the dialog animates closed,
  // so the guard is a ref that stays latched after success. Reopening (or a
  // failed save) re-arms it.
  const inFlight = useRef(false);

  useEffect(() => {
    if (open) {
      setForm(blank);
      setErrors({});
      inFlight.current = false;
    }
  }, [open]);

  const leagues = newGameLeagues(state);
  const teams = form.league_id ? newGameTeams(state, form.league_id) : [];
  const venues = newGameVenues(state);

  const set = (key, value) => setForm((current) => {
    if (key !== "league_id") return { ...current, [key]: value };
    // A new league invalidates team picks that are not enrolled in it.
    const keep = (id) => (newGameTeams(state, value).some((team) => team.id === id) ? id : "");
    return { ...current, league_id: value, home_team_id: keep(current.home_team_id), away_team_id: keep(current.away_team_id) };
  });

  const save = async () => {
    if (inFlight.current) return;
    const result = validateNewGame(state, form);
    setErrors(result.errors);
    if (!result.payload) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await createEntity("games", result.payload, "g");
      toast.success("Game scheduled");
      onOpenChange(false);
    } catch (error) {
      // Hosted failures are already toasted centrally; keep the form for a retry.
      if (!error?.message) toast.error("The game could not be saved. Try again.");
      inFlight.current = false;
    } finally {
      setSaving(false);
    }
  };

  const errorList = Object.values(errors);
  const invalid = (key) => (errors[key] ? "true" : "false");
  const describedBy = (key) => (errors[key] ? `new-game-${FIELD_IDS[key]}-error` : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="bg-card border-border max-h-[90vh] flex flex-col" data-testid="new-game-dialog">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display uppercase tracking-tight text-foreground">New Game</DialogTitle>
          <DialogDescription>Regular-season game. Start time is league time (Albuquerque).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 flex-1 overflow-y-auto min-h-0">
          <Field id="league" label="League" error={errors.league_id}>
            <select id="new-game-league" data-testid="new-game-league" value={form.league_id} onChange={(e) => set("league_id", e.target.value)}
              aria-invalid={invalid("league_id")} aria-describedby={describedBy("league_id")} className={SELECT_CLASS}>
              <option value="">Select a league…</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>{league.name} · {sportName(league.sport)} · {league.season}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="away" label="Away team" error={errors.away_team_id}>
              <select id="new-game-away" data-testid="new-game-away" value={form.away_team_id} onChange={(e) => set("away_team_id", e.target.value)}
                disabled={!form.league_id} aria-invalid={invalid("away_team_id")} aria-describedby={describedBy("away_team_id")} className={SELECT_CLASS}>
                <option value="">{form.league_id ? "Select a team…" : "Choose a league first"}</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.division ? ` · ${team.division}` : ""}</option>)}
              </select>
            </Field>
            <Field id="home" label="Home team" error={errors.home_team_id}>
              <select id="new-game-home" data-testid="new-game-home" value={form.home_team_id} onChange={(e) => set("home_team_id", e.target.value)}
                disabled={!form.league_id} aria-invalid={invalid("home_team_id")} aria-describedby={describedBy("home_team_id")} className={SELECT_CLASS}>
                <option value="">{form.league_id ? "Select a team…" : "Choose a league first"}</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.division ? ` · ${team.division}` : ""}</option>)}
              </select>
            </Field>
          </div>
          <Field id="start" label="Start (league time)" error={errors.starts_at}>
            <Input id="new-game-start" type="datetime-local" data-testid="new-game-start" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)}
              aria-invalid={invalid("starts_at")} aria-describedby={describedBy("starts_at")} className="bg-surface-sunken border-border h-11 md:h-10" />
          </Field>
          <Field id="venue" label="Venue" error={errors.venue_id}>
            <select id="new-game-venue" data-testid="new-game-venue" value={form.venue_id} onChange={(e) => set("venue_id", e.target.value)}
              aria-invalid={invalid("venue_id")} aria-describedby={describedBy("venue_id")} className={SELECT_CLASS}>
              <option value="">Select a venue…</option>
              {venues.map((venue) => <option key={venue.id} value={venue.id}>{[venue.name, venue.field_label].filter(Boolean).join(" · ")}</option>)}
            </select>
          </Field>
          {errorList.length > 0 && (
            <div role="alert" data-testid="new-game-errors" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-foreground space-y-1">
              {errorList.map((message) => <p key={message}>{message}</p>)}
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2">
          <Button type="button" variant="outline" data-testid="new-game-cancel" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" data-testid="new-game-save" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save game"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
