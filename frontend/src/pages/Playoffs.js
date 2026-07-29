import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, CalendarBlank, Trophy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import { computeStandings, getTeam } from "../lib/selectors";
import { formatGameDateTime, fromDateTimeLocalValue, LEAGUE_TIME_ZONE } from "../lib/gameTime";
import { SPORTS } from "../lib/statsConfig";
import { SectionHeading, EmptyState } from "../components/common/Section";
import { SportBadge, StatusBadge } from "../components/common/Badges";
import { StructuralIdentityBadge } from "../components/direction/StructuralIdentity";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";

export default function Playoffs() {
  const app = useApp();
  const { state } = app;
  const { role } = useRole();
  const isAdmin = role === "admin";
  const [sport, setSport] = useState("kickball");
  const leagues = useMemo(() => state.leagues.filter((league) =>
    league.kind !== "tournament"
    && league.sport === sport
    && league.playoff_format === "single_elim"
  ), [state.leagues, sport]);
  const [leagueId, setLeagueId] = useState(leagues[0]?.id || "");
  const league = leagues.find((item) => item.id === leagueId) || leagues[0];
  const standings = league ? computeStandings(state, league.id) : [];
  const [seedIds, setSeedIds] = useState([]);
  const bracket = state.playoffBrackets.find((item) => item.league_id === league?.id);
  const seeds = state.playoffSeeds.filter((item) => item.bracket_id === bracket?.id).sort((a, b) => a.seed - b.seed);
  const matches = state.playoffMatches.filter((item) => item.bracket_id === bracket?.id);

  useEffect(() => {
    const next = leagues[0]?.id || "";
    if (!leagues.some((item) => item.id === leagueId)) setLeagueId(next);
  }, [leagues, leagueId]);
  useEffect(() => setSeedIds(standings.map((row) => row.team.id)), [league?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSport = (value) => {
    setSport(value);
    const next = state.leagues.find((item) => item.kind !== "tournament" && item.sport === value && item.playoff_format === "single_elim");
    setLeagueId(next?.id || "");
  };
  const moveSeed = (index, direction) => {
    setSeedIds((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  };
  const generate = async () => {
    try {
      await app.generatePlayoffBracket({ league_id: league.id, seed_team_ids: seedIds });
      toast.success("Bracket generated and seeds locked");
    } catch { /* backend adapter already surfaces the error */ }
  };

  return (
    <div className="space-y-5">
      <SectionHeading as="h1" band title="Playoffs" subtitle="Single elimination · all teams qualify · third-place game included" />
      <div className="grid sm:grid-cols-2 gap-2.5">
        <Filter label="Sport" value={sport} onChange={onSport} testid="playoffs-sport">
          {SPORTS.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
        </Filter>
        <Filter label="League / Season" value={league?.id || "none"} onChange={setLeagueId} testid="playoffs-league">
          {leagues.length ? leagues.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.season}</SelectItem>) : <SelectItem value="none" disabled>No single-elim league</SelectItem>}
        </Filter>
      </div>

      {!league ? (
        <EmptyState icon={Trophy} title="No playoff league" message="A single-elimination league must be configured before a bracket can be created." />
      ) : bracket ? (
        <div key={bracket.id} className="space-y-5 animate-fade-in" data-testid="playoff-bracket-reveal">
          <div className="flex flex-wrap items-center gap-2">
            <SportBadge sport={league.sport} />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{league.name} · {league.season}</span>
            <StatusBadge status={bracket.status} />
          </div>
          <BracketView state={state} seeds={seeds} matches={matches} isAdmin={isAdmin} app={app} league={league} />
        </div>
      ) : isAdmin ? (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-display uppercase tracking-tight text-lg text-foreground">Review Seeding</h2>
            <p className="text-xs text-muted-foreground mt-1">Recommended order: wins, head-to-head, point differential, then points scored. Reorder before generating; the snapshot stays fixed afterward.</p>
          </div>
          <div className="space-y-2">
            {seedIds.map((teamId, index) => {
              const team = getTeam(state, teamId);
              const record = standings.find((row) => row.team.id === teamId)?.record;
              return (
                <div key={teamId} className="flex items-center gap-3 bg-surface-sunken border border-border rounded-xl px-3 py-2">
                  <span className="font-mono-score text-primary w-6 text-center">{index + 1}</span>
                  <StructuralIdentityBadge className="cvf-identity-badge--sm" team={team} />
                  <span className="font-medium text-foreground flex-1">{team.name}</span>
                  <span className="text-xs text-muted-foreground">{record?.wins || 0}-{record?.losses || 0} · {record?.diff > 0 ? "+" : ""}{record?.diff || 0}</span>
                  <button type="button" aria-label={`Move ${team.name} up`} disabled={index === 0} onClick={() => moveSeed(index, -1)} className="p-2 disabled:opacity-25"><ArrowUp size={15} /></button>
                  <button type="button" aria-label={`Move ${team.name} down`} disabled={index === seedIds.length - 1} onClick={() => moveSeed(index, 1)} className="p-2 disabled:opacity-25"><ArrowDown size={15} /></button>
                </div>
              );
            })}
          </div>
          <Button data-testid="generate-bracket" disabled={seedIds.length < 4} onClick={generate} className="w-full sm:w-auto">Generate Fixed Bracket</Button>
          {seedIds.length < 4 && <p className="text-xs text-destructive">At least four active teams are required.</p>}
        </section>
      ) : (
        <EmptyState icon={Trophy} title="Bracket not published yet" message={`${league.name}'s bracket will appear after the administrator locks the seeds.`} />
      )}
    </div>
  );
}

const BracketView = ({ state, seeds, matches, isAdmin, app, league }) => {
  const rounds = [...new Set(matches.map((item) => item.round_number))].sort((a, b) => a - b);
  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-3" data-testid="playoff-bracket">
        {rounds.map((round) => (
          <div key={round} className="w-72 shrink-0 space-y-3">
            <h2 className="font-display uppercase tracking-tight text-sm text-gold">Round {round}</h2>
            {matches.filter((item) => item.round_number === round).sort((a, b) => a.match_number - b.match_number).map((match) => (
              <MatchCard key={match.id} state={state} match={match} isAdmin={isAdmin} app={app} league={league} />
            ))}
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-micro uppercase tracking-widest text-muted-foreground mb-2">Locked Seeds</p>
        <div className="flex flex-wrap gap-2">{seeds.map((item) => <span key={item.team_id} className="text-xs border border-border rounded-lg px-2 py-1">#{item.seed} {getTeam(state, item.team_id)?.name}</span>)}</div>
      </div>
    </div>
  );
};

const MatchCard = ({ state, match, isAdmin, app, league }) => {
  const [open, setOpen] = useState(false);
  const scheduleTriggerRef = useRef(null);
  const game = state.games.find((item) => item.id === match.game_id);
  const canAdvance = game?.status === "completed" && game?.score_status === "final" && game?.locked && match.status !== "completed";
  const compatible = state.games.filter((item) =>
    item.league_id === league.id && item.stage === "playoff"
    && !state.playoffMatches.some((other) => other.game_id === item.id)
    && new Set([item.home_team_id, item.away_team_id]).size === 2
    && [item.home_team_id, item.away_team_id].includes(match.home_team_id)
    && [item.home_team_id, item.away_team_id].includes(match.away_team_id)
  );
  const advance = async () => {
    try { await app.advancePlayoffMatch(match.id); toast.success("Winner advanced"); } catch { /* surfaced centrally */ }
  };
  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${match.label === "Championship" ? "border-gold/60" : "border-border"}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-surface-sunken border-b border-border">
        <span className="text-micro uppercase tracking-widest text-muted-foreground">{match.label}</span>
        <StatusBadge status={match.status} />
      </div>
      <TeamSlot state={state} teamId={match.home_team_id} seed={match.home_seed} winner={match.winner_team_id === match.home_team_id} />
      <TeamSlot state={state} teamId={match.away_team_id} seed={match.away_seed} winner={match.winner_team_id === match.away_team_id} />
      {game && <Link to={`/game/${game.id}`} className="block px-3 py-2 border-t border-border text-xs text-primary hover:bg-white/5"><CalendarBlank size={13} className="inline mr-1" />{formatGameDateTime(game)} · {game.status}</Link>}
      {isAdmin && match.status === "ready" && !match.game_id && <button type="button" ref={scheduleTriggerRef} data-testid={`schedule-match-${match.id}`} onClick={() => setOpen(true)} className="w-full border-t border-border px-3 py-2 text-xs font-bold uppercase text-primary hover:bg-primary/10">Schedule or Link Game</button>}
      {isAdmin && canAdvance && <button type="button" data-testid={`advance-match-${match.id}`} onClick={advance} className="w-full border-t border-border px-3 py-2 text-xs font-bold uppercase text-gold hover:bg-gold/10">Advance Final Result</button>}
      <ScheduleDialog open={open} setOpen={setOpen} match={match} app={app} compatible={compatible} triggerRef={scheduleTriggerRef} />
    </div>
  );
};

const TeamSlot = ({ state, teamId, seed, winner }) => {
  const team = getTeam(state, teamId);
  return <div className={`flex items-center gap-2 px-3 py-2.5 border-b border-border last:border-0 ${winner ? "bg-primary/10" : ""}`}><span className="font-mono-score text-xs text-muted-foreground w-5">{seed ? `#${seed}` : "—"}</span><StructuralIdentityBadge className="cvf-identity-badge--sm" team={team} /><span className={`text-sm ${winner ? "text-primary font-semibold" : "text-foreground"}`}>{team?.name || "TBD"}</span></div>;
};

const ScheduleDialog = ({ open, setOpen, match, app, compatible, triggerRef }) => {
  const [form, setForm] = useState({ starts_at: "", venue_id: "", game_id: "" });
  const save = async () => {
    try {
      if (form.game_id) await app.linkPlayoffGame({ match_id: match.id, game_id: form.game_id });
      else await app.schedulePlayoffMatch({ match_id: match.id, starts_at: fromDateTimeLocalValue(form.starts_at), venue_id: form.venue_id });
      toast.success(form.game_id ? "Existing game linked" : "Playoff game scheduled");
      setOpen(false);
    } catch { /* surfaced centrally */ }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="bg-card border-border"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Schedule {match.label}</DialogTitle>
          <DialogDescription>Link a matching playoff game already on the schedule, or enter the required start time and venue.</DialogDescription>
        </DialogHeader>
        {compatible.length > 0 && (
          <Filter label="Existing Match" value={form.game_id || "new"} onChange={(value) => setForm({ ...form, game_id: value === "new" ? "" : value })} testid="playoffs-existing-match">
            <SelectItem value="new">Create new game</SelectItem>
            {compatible.map((game) => <SelectItem key={game.id} value={game.id}>{formatGameDateTime(game)}</SelectItem>)}
          </Filter>
        )}
        {!form.game_id && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="playoff-match-start">Start (required)</Label>
              <Input id="playoff-match-start" name="starts_at" type="datetime-local" required value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} />
              <p className="text-micro text-muted-foreground">Entered and shown in league time ({LEAGUE_TIME_ZONE.split("/")[1].replace("_", " ")}).</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="playoff-match-venue">Venue (required)</Label>
              <select
                id="playoff-match-venue"
                name="venue_id"
                required
                value={form.venue_id}
                onChange={(event) => setForm({ ...form, venue_id: event.target.value })}
                className="h-10 rounded-lg bg-surface-sunken border border-border px-3 text-sm text-foreground"
              >
                <option value="">Select a venue…</option>
                {(app.state?.venues || []).filter((venue) => venue.status !== "retired").map((venue) => (
                  <option key={venue.id} value={venue.id}>{[venue.name, venue.field_label].filter(Boolean).join(" · ")}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form.game_id && (!form.starts_at || !form.venue_id)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Filter = ({ label, value, onChange, testid, children }) => <div><label id={`${testid}-label`} htmlFor={testid} className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger id={testid} aria-labelledby={`${testid}-label`} data-testid={testid} className="bg-card border-border h-10 text-sm"><SelectValue /></SelectTrigger><SelectContent>{children}</SelectContent></Select></div>;
