import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, CalendarBlank, PencilSimpleLine } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import { getTeam, getProfile } from "../lib/selectors";
import { SportBadge, StatusBadge } from "../components/common/Badges";
import { Button } from "../components/ui/button";
import { Avatar } from "../components/common/Avatar";
import { can } from "../lib/roles";

const PERIOD_LABEL = (sport, i) => (sport === "kickball" ? `${i + 1}` : `Q${i + 1}`);
const PERIOD_HEAD = (sport) => (sport === "kickball" ? "Inning" : "Quarter");

// Key stat columns shown in the box score per sport.
const BOX = {
  kickball: [
    { key: "kicks", label: "K" },
    { key: "rbis", label: "RBI" },
    { key: "runs", label: "R" },
    { key: "homeRuns", label: "HR" },
  ],
  flag_football: [
    { key: "passYards", label: "PYD" },
    { key: "recYards", label: "RYD" },
    { key: "tds", label: "TD" },
    { key: "flagPulls", label: "FP" },
  ],
};

export default function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useApp();
  const { role, roleMeta } = useRole();
  const game = state.games.find((g) => g.id === id);

  if (!game) return <p className="text-muted-foreground">Game not found.</p>;

  const home = getTeam(state, game.home_team_id);
  const away = getTeam(state, game.away_team_id);
  const completed = game.status === "completed";
  const gameStats = state.playerStats.filter((s) => s.game_id === game.id);
  const dateStr = new Date(game.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Temp admin can only score their assigned game.
  const canScore = can.enterScores(role) && (role === "admin" || roleMeta.assignedGameId === game.id);
  const periods = game.periods?.home || [];

  return (
    <div className="space-y-6 animate-fade-up">
      <Button variant="ghost" onClick={() => navigate(-1)} data-testid="game-back" className="h-auto min-h-[44px] -my-1 p-0 pr-2 gap-1.5 normal-case tracking-normal text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent">
        <ArrowLeft size={16} weight="bold" /> Back
      </Button>

      {/* Page-level matchup title. */}
      <div data-testid="game-detail-heading">
        <h1 className="font-display uppercase text-display-lg text-foreground">
          {away?.name || "TBD"} <span className="text-muted-foreground">vs</span> {home?.name || "TBD"}
        </h1>
        <p className="text-caption text-muted-foreground mt-1">{dateStr}</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 md:p-7">
        <div className="flex items-center justify-between mb-5">
          <SportBadge sport={game.sport} />
          <StatusBadge status={game.status} />
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <TeamHead team={away} score={game.away_score} completed={completed} win={completed && game.away_score > game.home_score} />
          <div className="text-center">
            <span className="font-display text-muted-foreground text-sm uppercase tracking-widest">{completed ? "Final" : "VS"}</span>
          </div>
          <TeamHead team={home} score={game.home_score} completed={completed} win={completed && game.home_score > game.away_score} home />
        </div>

        <div className="mt-6 pt-5 border-t border-border flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><CalendarBlank size={15} weight="bold" /> {dateStr}</span>
          <span className="flex items-center gap-1.5"><Clock size={15} weight="bold" /> {game.time}</span>
          <span className="flex items-center gap-1.5"><MapPin size={15} weight="bold" /> {game.location}</span>
        </div>

        {canScore && (
          <Link
            to="/score-entry"
            state={{ game_id: game.id }}
            data-testid="game-enter-score"
            className="mt-5 inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm px-4 py-2.5 rounded-xl hover:bg-teal-deep transition-colors"
          >
            <PencilSimpleLine size={16} weight="bold" /> {completed ? "Edit Score" : "Enter Score"}
          </Link>
        )}
      </div>

      {/* Period breakdown */}
      {completed && periods.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <p className="px-4 py-2.5 border-b border-border text-micro uppercase tracking-widest text-muted-foreground font-semibold">
            {PERIOD_HEAD(game.sport)} by {PERIOD_HEAD(game.sport).toLowerCase()}
          </p>
          <div className="p-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium pb-2 pr-3"> </th>
                  {periods.map((_, i) => (
                    <th key={i} className="text-center tabular-nums px-2 pb-2">{PERIOD_LABEL(game.sport, i)}</th>
                  ))}
                  <th className="text-center tabular-nums px-2 pb-2 text-primary">T</th>
                </tr>
              </thead>
              <tbody>
                {[{ t: away, arr: game.periods.away, total: game.away_score }, { t: home, arr: game.periods.home, total: game.home_score }].map((row) => (
                  <tr key={row.t.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-display uppercase tracking-tight text-foreground whitespace-nowrap">{row.t.name}</td>
                    {row.arr.map((v, i) => (
                      <td key={i} className="text-center font-mono-score px-2 text-muted-foreground">{v}</td>
                    ))}
                    <td className="text-center font-mono-score px-2 text-primary font-bold">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Player box score */}
      {completed && gameStats.length > 0 && (
        <div className="space-y-4">
          {[away, home].map((t) => {
            const rows = gameStats.filter((s) => s.team_id === t.id);
            if (!rows.length) return null;
            const cols = BOX[game.sport];
            return (
              <div key={t.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <p className="px-4 py-2.5 border-b border-border font-display uppercase tracking-tight text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.logo_color }} /> {t.name}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-micro uppercase tracking-wide">
                        <th className="text-left font-semibold px-4 py-2">Player</th>
                        {cols.map((c) => <th key={c.key} className="text-center font-semibold px-2 py-2">{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => {
                        const p = getProfile(state, s.profile_id);
                        return (
                          <tr key={s.id} className="border-t border-border">
                            <td className="px-4 py-2.5">
                              <Link to={`/profile/${p.id}`} className="flex items-center gap-2 hover:text-primary">
                                <Avatar name={p.name} color={p.avatar_color} size={28} />
                                <span className="font-medium text-foreground truncate">{p.name}</span>
                              </Link>
                            </td>
                            {cols.map((c) => (
                              <td key={c.key} className="text-center font-mono-score text-muted-foreground px-2">{s.stats[c.key] || 0}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TeamHead = ({ team, score, completed, win, home }) => (
  <Link to={`/team/${team.id}`} className="flex flex-col items-center text-center group">
    <span className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-lg text-ink mb-2" style={{ backgroundColor: team.logo_color }}>
      {team.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
    </span>
    <span className="font-display uppercase tracking-tight text-foreground text-sm leading-tight group-hover:text-primary transition-colors">{team.name}</span>
    <span className="text-micro text-muted-foreground uppercase">{home ? "Home" : "Away"}</span>
    {completed && (
      <span className={`mt-1 font-mono-score tabular-nums text-score-lg font-bold ${win ? "text-primary" : "text-muted-foreground"}`}>{score}</span>
    )}
  </Link>
);
