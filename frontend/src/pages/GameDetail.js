import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, CalendarBlank, PencilSimpleLine } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import { getTeam, getProfile } from "../lib/selectors";
import { SportBadge, StatusBadge } from "../components/common/Badges";
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

  const home = getTeam(state, game.homeTeamId);
  const away = getTeam(state, game.awayTeamId);
  const completed = game.status === "completed";
  const gameStats = state.playerStats.filter((s) => s.gameId === game.id);
  const dateStr = new Date(game.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Temp admin can only score their assigned game.
  const canScore = can.enterScores(role) && (role === "admin" || roleMeta.assignedGameId === game.id);
  const periods = game.periods?.home || [];

  return (
    <div className="space-y-6 animate-fade-up">
      <button onClick={() => navigate(-1)} data-testid="game-back" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm">
        <ArrowLeft size={16} weight="bold" /> Back
      </button>

      <div className="bg-card border border-border rounded-2xl p-5 md:p-7">
        <div className="flex items-center justify-between mb-5">
          <SportBadge sport={game.sport} />
          <StatusBadge status={game.status} />
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <TeamHead team={away} score={game.awayScore} completed={completed} win={completed && game.awayScore > game.homeScore} />
          <div className="text-center">
            <span className="font-display text-muted-foreground text-sm uppercase tracking-widest">{completed ? "Final" : "VS"}</span>
          </div>
          <TeamHead team={home} score={game.homeScore} completed={completed} win={completed && game.homeScore > game.awayScore} home />
        </div>

        <div className="mt-6 pt-5 border-t border-border flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><CalendarBlank size={15} weight="bold" /> {dateStr}</span>
          <span className="flex items-center gap-1.5"><Clock size={15} weight="bold" /> {game.time}</span>
          <span className="flex items-center gap-1.5"><MapPin size={15} weight="bold" /> {game.location}</span>
        </div>

        {canScore && (
          <Link
            to="/score-entry"
            state={{ gameId: game.id }}
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
          <p className="px-4 py-2.5 border-b border-border text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
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
                {[{ t: away, arr: game.periods.away, total: game.awayScore }, { t: home, arr: game.periods.home, total: game.homeScore }].map((row) => (
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
            const rows = gameStats.filter((s) => s.teamId === t.id);
            if (!rows.length) return null;
            const cols = BOX[game.sport];
            return (
              <div key={t.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <p className="px-4 py-2.5 border-b border-border font-display uppercase tracking-tight text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.logoColor }} /> {t.name}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-[11px] uppercase tracking-wide">
                        <th className="text-left font-semibold px-4 py-2">Player</th>
                        {cols.map((c) => <th key={c.key} className="text-center font-semibold px-2 py-2">{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => {
                        const p = getProfile(state, s.playerId);
                        return (
                          <tr key={s.id} className="border-t border-border">
                            <td className="px-4 py-2.5">
                              <Link to={`/profile/${p.id}`} className="flex items-center gap-2 hover:text-primary">
                                <Avatar name={p.name} color={p.avatarColor} size={28} />
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
    <span className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-extrabold text-lg text-black mb-2" style={{ backgroundColor: team.logoColor }}>
      {team.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
    </span>
    <span className="font-display uppercase tracking-tight text-foreground text-sm leading-tight group-hover:text-primary transition-colors">{team.name}</span>
    <span className="text-[10px] text-muted-foreground uppercase">{home ? "Home" : "Away"}</span>
    {completed && (
      <span className={`mt-1 font-mono-score text-3xl font-bold ${win ? "text-primary" : "text-muted-foreground"}`}>{score}</span>
    )}
  </Link>
);
